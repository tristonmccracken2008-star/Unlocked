import { NextResponse } from "next/server";
import { verifyResendWebhook } from "@/lib/notification-email";
import {
  claimProviderWebhook,
  providerEmailOwner,
  suppressEmailForUser,
  updateNotificationEmailDelivery,
} from "@/lib/notification-store";
import { readBoundedText } from "@/lib/security";
import { recordAnalyticsEvent } from "@/lib/analytics-store";
import { productIntelligenceEvents } from "@/lib/analytics-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const noStore = { "Cache-Control": "no-store, max-age=0" };

type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
  };
};

export async function POST(request: Request) {
  const payload = await readBoundedText(request, 64 * 1024).catch(() => null);
  if (payload === null) return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: noStore });
  const verified = verifyResendWebhook(payload, request.headers) as ResendEvent | null;
  const eventId = request.headers.get("svix-id");
  if (!verified || !eventId) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400, headers: noStore });
  if (!await claimProviderWebhook(eventId)) return NextResponse.json({ ok: true, duplicate: true }, { headers: noStore });
  const providerId = verified.data?.email_id;
  if (!providerId || !/^[A-Za-z0-9_-]{8,180}$/.test(providerId)) return NextResponse.json({ ok: true, ignored: true }, { headers: noStore });
  const owner = await providerEmailOwner(providerId);
  if (!owner) return NextResponse.json({ ok: true, ignored: true }, { headers: noStore });
  const eventAt = typeof verified.created_at === "string" && Number.isFinite(Date.parse(verified.created_at)) ? verified.created_at : new Date().toISOString();
  if (verified.type === "email.delivered") {
    await updateNotificationEmailDelivery(owner.userId, owner.notificationId, { state: "delivered", providerId, deliveredAt: eventAt });
    await recordAnalyticsEvent(productIntelligenceEvents.notificationDelivered, owner.userId, { channel: "email" }).catch(() => undefined);
  } else if (verified.type === "email.bounced" || verified.type === "email.complained") {
    await suppressEmailForUser(owner.userId, verified.type === "email.bounced" ? "provider_bounce" : "provider_complaint");
    await updateNotificationEmailDelivery(owner.userId, owner.notificationId, { state: "failed", providerId, attemptedAt: eventAt, failureCode: verified.type });
    await recordAnalyticsEvent(productIntelligenceEvents.notificationEmailBounced, owner.userId, {
      component: "notification_email",
      errorType: "unavailable",
    }).catch(() => undefined);
  } else if (verified.type === "email.failed") {
    await updateNotificationEmailDelivery(owner.userId, owner.notificationId, { state: "failed", providerId, attemptedAt: eventAt, failureCode: "provider_failed" });
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
