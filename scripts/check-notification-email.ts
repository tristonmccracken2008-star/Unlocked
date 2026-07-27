import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildNotificationRecord, normalizeNotificationPreferences } from "../lib/notification-engine";

process.env.AUTH_SECRET = "notification-email-test-secret-with-at-least-thirty-two-bytes";
process.env.NEXT_PUBLIC_APP_URL = "https://www.unlockededu.com";
process.env.RESEND_API_KEY = "re_test_notification";
process.env.NOTIFICATION_EMAIL_FROM = "UnlockED <updates@notify.unlockededu.com>";
process.env.NOTIFICATION_EMAIL_TEST_SEND = "1";
const secretBytes = Buffer.from("notification-webhook-secret-at-least-thirty-two-bytes");
process.env.RESEND_WEBHOOK_SECRET = `whsec_${secretBytes.toString("base64")}`;

const { renderNotificationEmail, sendNotificationEmail, verifyResendWebhook } = await import("../lib/notification-email");
const now = new Date("2026-03-01T12:00:00.000Z");
const record = buildNotificationRecord({
  type: "journey_reminder",
  priority: "high",
  title: "Your reminder is due",
  body: "Ask <Professor Smith> for a recommendation letter.",
  organization: "Journey",
  actionLabel: "Open Journey",
  actionHref: "/",
  contentVersion: "email-v1",
  idempotencyKey: "notification:email-fixture",
  now,
  preferences: normalizeNotificationPreferences(null, now.toISOString()),
});

const message = renderNotificationEmail(record);
assert.match(message.subject, /^Reminder:/);
assert.match(message.html, /UnlockED/);
assert.match(message.html, /Ask &lt;Professor Smith&gt;/);
assert.doesNotMatch(message.html, /<img/i);
assert.doesNotMatch(message.html, /tracking/i);
assert.match(message.html, /Manage notification preferences/);
assert.match(message.text, /Ask <Professor Smith>/);
assert.match(message.text, /https:\/\/www\.unlockededu\.com\/profile#notifications/);

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"), record.idempotencyKey);
    const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(payload.to instanceof Array, true);
    assert.equal("tracking_pixel" in payload, false);
    return new Response(JSON.stringify({ id: "email_notification_test_123" }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  assert.deepEqual(await sendNotificationEmail(record, { email: "student@example.test" }), { status: "sent", providerId: "email_notification_test_123" });

  globalThis.fetch = async () => new Response("temporary", { status: 503 });
  assert.deepEqual(await sendNotificationEmail(record, { email: "student@example.test" }), { status: "failed", reason: "provider_rejected", retryable: true });

  globalThis.fetch = async () => new Response("invalid", { status: 400 });
  assert.deepEqual(await sendNotificationEmail(record, { email: "student@example.test" }), { status: "failed", reason: "provider_rejected", retryable: false });
} finally {
  globalThis.fetch = originalFetch;
}

const payload = JSON.stringify({ type: "email.delivered", created_at: now.toISOString(), data: { email_id: "email_notification_test_123" } });
const id = "msg_notification_test_123";
const timestamp = String(Math.floor(now.getTime() / 1_000));
const signature = crypto.createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${payload}`).digest("base64");
const headers = new Headers({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,invalid v1,${signature}` });
assert.deepEqual(verifyResendWebhook(payload, headers, now), JSON.parse(payload));
assert.equal(verifyResendWebhook(payload, new Headers({ ...Object.fromEntries(headers), "svix-signature": "v1,invalid" }), now), null);
assert.equal(verifyResendWebhook(payload, headers, new Date(now.getTime() + 301_000)), null);

console.log("Notification email rendering, provider adapter, and webhook checks passed");
