import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { getSession, mergeAccountData, sessionCookieName, withSecurityLock } from "@/lib/auth-store";
import { normalizeNotificationPreferences, validTimezone } from "@/lib/notification-engine";
import { syncUserNotificationSchedules } from "@/lib/notification-service";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";
import { recordAnalyticsEvent } from "@/lib/analytics-store";
import { productIntelligenceEvents } from "@/lib/analytics-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const noStore = { "Cache-Control": "no-store, max-age=0" };

async function authenticated() {
  const cookieStore = await cookies();
  return await getSession(cookieStore.get(sessionCookieName)?.value);
}

export async function GET(request: Request) {
  try {
    const session = await authenticated();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: noStore });
    await enforceRateLimit(request, "notification-preferences-read", 90, 60, session.user.id);
    return NextResponse.json({ preferences: normalizeNotificationPreferences(session.data.preferences?.notifications) }, { headers: noStore });
  } catch (error) {
    return securityErrorResponse(error, "Notification settings could not be loaded.");
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await authenticated();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: noStore });
    await enforceRateLimit(request, "notification-preferences-write", 30, 60, session.user.id);
    const body = await readBoundedJson<Record<string, unknown>>(request, 8 * 1024);
    if (!body.preferences || typeof body.preferences !== "object" || Array.isArray(body.preferences)) throw new SecurityError("Notification settings are required.", 400, "invalid_request");
    const candidate = body.preferences as Record<string, unknown>;
    if (typeof candidate.timezone !== "string" || !validTimezone(candidate.timezone)) throw new SecurityError("Choose a valid timezone.", 400, "invalid_timezone");
    const preferences = normalizeNotificationPreferences({ ...candidate, updatedAt: new Date().toISOString() });
    const data = await withSecurityLock("notification-preferences", session.user.id, async () => await mergeAccountData(session.user.id, {
      preferences: {
        ...(session.data.preferences ?? { updatedAt: preferences.updatedAt }),
        notifications: preferences,
        updatedAt: preferences.updatedAt,
      },
    }));
    after(async () => {
      await Promise.all([
        syncUserNotificationSchedules(session.user.id, data).catch((error) => {
          console.warn("[UnlockED notifications] Preference schedule sync failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
        }),
        recordAnalyticsEvent(productIntelligenceEvents.notificationPreferenceChanged, session.user.id, {
          category: "settings",
          action: "saved",
        }).catch(() => undefined),
      ]);
    });
    return NextResponse.json({ ok: true, preferences }, { headers: noStore });
  } catch (error) {
    return securityErrorResponse(error, "Notification settings could not be saved.");
  }
}
