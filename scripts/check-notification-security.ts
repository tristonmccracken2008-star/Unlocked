import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanAccountDataInput } from "../lib/account-input";

const source = (file: string) => readFileSync(file, "utf8");
const routes = {
  center: source("app/api/notifications/route.ts"),
  preferences: source("app/api/notifications/preferences/route.ts"),
  scheduler: source("app/api/notifications/schedule/route.ts"),
  webhook: source("app/api/notifications/webhook/route.ts"),
};

for (const route of [routes.center, routes.preferences]) {
  assert.match(route, /getSession/);
  assert.match(route, /enforceRateLimit/);
  assert.match(route, /Cache-Control/);
}
assert.match(routes.center, /assertSameOrigin/);
assert.match(routes.center, /readBoundedJson/);
assert.match(routes.preferences, /assertSameOrigin/);
assert.match(routes.preferences, /withSecurityLock/);
assert.match(routes.preferences, /readBoundedJson/);
assert.match(routes.scheduler, /CRON_SECRET/);
assert.match(routes.scheduler, /headers\.get\("authorization"\)/);
assert.doesNotMatch(routes.scheduler, /email|profile|reminderText/i, "Scheduler logs must not include private notification content.");
assert.match(routes.webhook, /verifyResendWebhook/);
assert.match(routes.webhook, /claimProviderWebhook/);
assert.match(routes.webhook, /readBoundedText/);
assert.doesNotMatch(routes.webhook, /RESEND_WEBHOOK_SECRET/);

const store = source("lib/notification-store.ts");
assert.match(store, /withSecurityLock\("notifications", userId/);
assert.match(store, /idempotencyKey/);
assert.match(store, /slice\(0, maxHistory\)/);
assert.match(store, /ZRANGEBYSCORE/);
assert.match(store, /timed out/);
assert.doesNotMatch(store, /console\.(log|info).*(record|userId|providerId)/);

for (const testFile of ["scripts/check-notifications.ts", "scripts/benchmark-notifications.ts"]) {
  const testSource = source(testFile);
  assert.match(testSource, /Reflect\.set\(process\.env, "NODE_ENV", "test"\)/, `${testFile} must force its isolated test store.`);
  assert.match(testSource, /delete process\.env\.KV_REST_API_URL/, `${testFile} must not use production KV during builds.`);
  assert.match(testSource, /delete process\.env\.UPSTASH_REDIS_REST_URL/, `${testFile} must not use production Upstash during builds.`);
}

const email = source("lib/notification-email.ts");
assert.match(email, /timingSafeEqual/);
assert.match(email, /Idempotency-Key/);
assert.match(email, /cache: "no-store"/);
assert.match(email, /NOTIFICATION_EMAIL_TEST_SEND/);
assert.doesNotMatch(email, /console\.(log|info|warn|error)/, "The provider adapter must not log recipients, content, or credentials.");

const now = "2026-03-01T12:00:00.000Z";
const cleaned = cleanAccountDataInput({
  preferences: {
    notifications: {
      inAppEnabled: true,
      emailEnabled: false,
      deadlineReminders: true,
      journeyReminders: false,
      opportunityChanges: true,
      weeklyDigest: true,
      recommendationUpdates: false,
      frequency: "balanced",
      timezone: "America/Chicago",
      quietHours: { enabled: true, startHour: 21, endHour: 7 },
      updatedAt: now,
      forgedAdminSetting: true,
    },
    updatedAt: now,
  },
});
assert.equal(cleaned.preferences?.notifications?.timezone, "America/Chicago");
assert.equal(cleaned.preferences?.notifications?.emailEnabled, false);
assert.equal("forgedAdminSetting" in (cleaned.preferences?.notifications as object), false);

const center = source("components/notification-center.tsx");
assert.match(center, /accountSessionEvent/);
assert.match(center, /aria-live="polite"/);
assert.match(center, /Mark as read:/);
assert.match(center, /Dismiss:/);
assert.match(source("components/notification-nav-button.tsx"), /aria-label=\{label\}/);
assert.match(source("app/notifications/page.tsx"), /requireCompletedOnboarding/);
assert.match(source("vercel.json"), /\/api\/notifications\/schedule/);

console.log("Notification security, ownership, accessibility, and configuration checks passed");
