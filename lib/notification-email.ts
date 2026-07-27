import "server-only";

import crypto from "node:crypto";
import type { AuthUser } from "./account-types";
import type { NotificationRecord } from "./notification-types";

export type NotificationEmail = {
  subject: string;
  html: string;
  text: string;
};

export type EmailDeliveryResult =
  | { status: "sent"; providerId: string }
  | { status: "suppressed"; reason: "provider_not_configured" | "non_production" }
  | { status: "failed"; reason: "provider_timeout" | "provider_rejected" | "malformed_response"; retryable: boolean };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
}

function applicationOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  try {
    const origin = new URL(configured ?? "http://localhost:3000");
    if (process.env.NODE_ENV === "production" && origin.protocol !== "https:") throw new Error("Production email links require HTTPS.");
    return origin.origin;
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be a valid absolute URL.");
  }
}

function safeActionUrl(href: string) {
  if (!href.startsWith("/") || href.startsWith("//") || /[\r\n]/.test(href)) throw new Error("Notification action must be an internal path.");
  return new URL(href, applicationOrigin()).toString();
}

function subjectFor(record: NotificationRecord) {
  if (record.type === "deadline_reminder") {
    const opportunity = record.body.split(/\s+is due\s+/i)[0]?.trim();
    return `${opportunity || record.organization || "Opportunity"}: ${record.title.toLowerCase()}`;
  }
  if (record.type === "journey_reminder") return `Reminder: ${record.title.replace(/^Your reminder is due$/i, record.organization ?? "Journey update")}`;
  if (record.type === "opportunity_change") {
    const opportunity = record.body.split(":")[0]?.trim();
    return `${opportunity || record.organization || "Opportunity"}: ${record.title.toLowerCase()}`;
  }
  if (record.type === "weekly_digest") return "Your weekly UnlockED summary";
  return record.title;
}

export function renderNotificationEmail(record: NotificationRecord): NotificationEmail {
  const actionUrl = safeActionUrl(record.actionHref);
  const preferencesUrl = new URL("/profile#notifications", applicationOrigin()).toString();
  const subject = subjectFor(record).slice(0, 140);
  const title = escapeHtml(record.title);
  const body = escapeHtml(record.body);
  const organization = record.organization ? `<p style="margin:0 0 12px;color:#6b625b;font-size:14px">${escapeHtml(record.organization)}</p>` : "";
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f7f3eb;color:#2b211a;font-family:Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden">${body}</div>
  <main style="max-width:600px;margin:0 auto;padding:32px 20px">
    <p style="margin:0 0 32px;color:#0f5c42;font-size:20px;font-weight:700">UnlockED</p>
    <section style="background:#ffffff;border:1px solid #ded8ce;padding:32px">
      <p style="margin:0 0 10px;color:#0f5c42;font-size:12px;font-weight:700;text-transform:uppercase">A useful update</p>
      <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:30px;line-height:1.15">${title}</h1>
      ${organization}
      <p style="margin:0;color:#534b45;font-size:16px;line-height:1.6">${body}</p>
      <p style="margin:28px 0 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#0f5c42;color:#ffffff;padding:13px 20px;text-decoration:none;font-size:15px;font-weight:700">${escapeHtml(record.actionLabel)}</a></p>
    </section>
    <p style="margin:24px 0 0;color:#756d66;font-size:12px;line-height:1.6">You received this because this notification category is enabled for your UnlockED account. <a href="${escapeHtml(preferencesUrl)}" style="color:#0f5c42">Manage notification preferences</a>.</p>
    <p style="margin:12px 0 0;color:#756d66;font-size:12px">© 2026 UnlockED. All rights reserved.</p>
  </main>
</body>
</html>`;
  const text = `UnlockED

${record.title}
${record.organization ? `${record.organization}\n` : ""}${record.body}

${record.actionLabel}: ${actionUrl}

Manage notification preferences: ${preferencesUrl}

© 2026 UnlockED. All rights reserved.`;
  return { subject, html, text };
}

export function emailProviderConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL_FROM && process.env.NEXT_PUBLIC_APP_URL);
}

export async function sendNotificationEmail(record: NotificationRecord, user: Pick<AuthUser, "email">): Promise<EmailDeliveryResult> {
  if (process.env.NODE_ENV !== "production" && process.env.NOTIFICATION_EMAIL_TEST_SEND !== "1") return { status: "suppressed", reason: "non_production" };
  if (!emailProviderConfigured()) return { status: "suppressed", reason: "provider_not_configured" };
  const message = renderNotificationEmail(record);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": record.idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify({
        from: process.env.NOTIFICATION_EMAIL_FROM,
        to: [user.email],
        subject: message.subject,
        html: message.html,
        text: message.text,
        tags: [{ name: "notification_type", value: record.type }],
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return { status: "failed", reason: "provider_rejected", retryable: response.status === 429 || response.status >= 500 };
    const payload = await response.json().catch(() => null) as { id?: unknown } | null;
    return typeof payload?.id === "string" && payload.id.length <= 160
      ? { status: "sent", providerId: payload.id }
      : { status: "failed", reason: "malformed_response", retryable: false };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error && error.name === "AbortError" ? "provider_timeout" : "provider_rejected",
      retryable: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function verifyResendWebhook(payload: string, headers: Headers, now = new Date()) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatureHeader = headers.get("svix-signature");
  if (!secret || !id || !timestamp || !signatureHeader || !/^[A-Za-z0-9_-]{8,180}$/.test(id)) return null;
  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds) || Math.abs(now.getTime() / 1_000 - timestampSeconds) > 300) return null;
  const secretValue = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(secretValue, "base64");
  } catch {
    return null;
  }
  if (!key.length) return null;
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest();
  const valid = signatureHeader.split(/\s+/).some((entry) => {
    const [version, encoded] = entry.split(",", 2);
    if (version !== "v1" || !encoded) return false;
    try {
      const candidate = Buffer.from(encoded, "base64");
      return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
    } catch {
      return false;
    }
  });
  if (!valid) return null;
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
}
