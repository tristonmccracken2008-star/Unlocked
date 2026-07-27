import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { markAllNotificationsRead, unreadNotificationCount, updateNotificationState } from "@/lib/notification-store";
import { readNotificationCenter, syncUserNotificationSchedules } from "@/lib/notification-service";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";
import { recordAnalyticsEvent } from "@/lib/analytics-store";
import { productIntelligenceEvents } from "@/lib/analytics-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const noStore = { "Cache-Control": "no-store, max-age=0" };
const notificationId = /^[0-9a-f-]{36}$/i;

async function authenticated() {
  const cookieStore = await cookies();
  return await getSession(cookieStore.get(sessionCookieName)?.value);
}

export async function GET(request: Request) {
  try {
    const session = await authenticated();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: noStore });
    await enforceRateLimit(request, "notifications-read", 120, 60, session.user.id);
    const url = new URL(request.url);
    if (url.searchParams.get("view") === "count") {
      return NextResponse.json({ unreadCount: await unreadNotificationCount(session.user.id) }, { headers: noStore });
    }
    const cursor = Number(url.searchParams.get("cursor") ?? "0");
    const offset = Number.isInteger(cursor) && cursor >= 0 && cursor <= 1_000 ? cursor : 0;
    after(async () => {
      await Promise.all([
        syncUserNotificationSchedules(session.user.id, session.data).catch((error) => {
          console.warn("[UnlockED notifications] Center schedule sync failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
        }),
        recordAnalyticsEvent(productIntelligenceEvents.notificationViewed, session.user.id, {
          category: "center",
          channel: "in_app",
        }).catch(() => undefined),
      ]);
    });
    const center = await readNotificationCenter(session.user.id, offset, 30);
    return NextResponse.json(center, { headers: noStore });
  } catch (error) {
    console.error("[UnlockED notifications] Read failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Notifications could not be loaded.");
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await authenticated();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: noStore });
    await enforceRateLimit(request, "notifications-write", 90, 60, session.user.id);
    const body = await readBoundedJson<Record<string, unknown>>(request, 4 * 1024);
    const action = body.action;
    if (action === "mark_all_read") {
      const updated = await markAllNotificationsRead(session.user.id);
      after(async () => { await recordAnalyticsEvent(productIntelligenceEvents.notificationRead, session.user.id, { category: "all" }).catch(() => undefined); });
      return NextResponse.json({ ok: true, updated }, { headers: noStore });
    }
    if (!["read", "dismiss", "acted"].includes(String(action)) || typeof body.notificationId !== "string" || !notificationId.test(body.notificationId)) {
      throw new SecurityError("Invalid notification action.", 400, "invalid_request");
    }
    const notification = await updateNotificationState(session.user.id, body.notificationId, action as "read" | "dismiss" | "acted");
    if (!notification) throw new SecurityError("Notification not found.", 404, "notification_not_found");
    const eventName = action === "dismiss"
      ? productIntelligenceEvents.notificationDismissed
      : action === "acted"
        ? productIntelligenceEvents.notificationActed
        : productIntelligenceEvents.notificationRead;
    after(async () => { await recordAnalyticsEvent(eventName, session.user.id, { category: notification.type }).catch(() => undefined); });
    return NextResponse.json({ ok: true, notification }, { headers: noStore });
  } catch (error) {
    return securityErrorResponse(error, "Notification could not be updated.");
  }
}
