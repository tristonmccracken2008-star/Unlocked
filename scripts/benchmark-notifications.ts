import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { opportunities, type Opportunity } from "../data/opportunities";
import type { TrackedOpportunity } from "../data/student-activity";
import {
  buildNotificationRecord,
  buildNotificationSchedules,
  detectMaterialOpportunityChanges,
  normalizeNotificationPreferences,
} from "../lib/notification-engine";

process.env.AUTH_SECRET = "notification-benchmark-secret-with-at-least-thirty-two-bytes";
process.env.NEXT_PUBLIC_APP_URL = "https://www.unlockededu.com";
Reflect.set(process.env, "NODE_ENV", "test");
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
const { renderNotificationEmail } = await import("../lib/notification-email");
const {
  readDueNotificationSchedules,
  readNotifications,
  scheduleNotification,
  storeNotification,
  unreadNotificationCount,
  updateNotificationState,
} = await import("../lib/notification-store");

const now = new Date("2026-07-27T12:00:00.000Z");
const base = opportunities[0]!;
const opportunity: Opportunity = {
  ...base,
  id: "notification-benchmark-opportunity",
  application_deadline: "2026-08-20",
  deadline: "2026-08-20",
  verification_status: "verified",
  last_verified: "2026-07-27",
  metadata: { ...base.metadata, deadlineType: "fixed" },
};
const tracked: TrackedOpportunity = {
  id: opportunity.id,
  status: "Applying",
  savedAt: "2026-07-01T12:00:00.000Z",
  updatedAt: now.toISOString(),
  version: 0,
  history: [],
};
const preferences = normalizeNotificationPreferences(null, now.toISOString());

function distribution(name: string, runs: number, operation: () => void) {
  const samples: number[] = [];
  operation();
  for (let run = 0; run < runs; run += 1) {
    const started = performance.now();
    operation();
    samples.push(performance.now() - started);
  }
  const sorted = [...samples].sort((left, right) => left - right);
  return {
    name,
    coldMs: Number(samples[0]!.toFixed(3)),
    averageMs: Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(3)),
    p95Ms: Number(sorted[Math.ceil(sorted.length * .95) - 1]!.toFixed(3)),
    worstMs: Number(sorted.at(-1)!.toFixed(3)),
  };
}

const generated = buildNotificationRecord({
  type: "deadline_reminder",
  priority: "high",
  title: "Deadline tomorrow",
  body: "Verified Student Program is due tomorrow.",
  organization: opportunity.organization,
  actionLabel: "View opportunity",
  actionHref: `/opportunities/${opportunity.id}`,
  contentVersion: "benchmark-v1",
  idempotencyKey: "benchmark-record",
  now,
  preferences,
});

const pure = [
  distribution("notification_generation_250", 40, () => {
    for (let index = 0; index < 250; index += 1) buildNotificationSchedules({ userId: `user-${index}`, record: tracked, opportunity, now });
  }),
  distribution("change_detection_1000", 40, () => {
    for (let index = 0; index < 1_000; index += 1) detectMaterialOpportunityChanges(opportunity, { ...opportunity, application_deadline: index % 2 ? "2026-08-21" : opportunity.application_deadline });
  }),
  distribution("email_render_500", 40, () => {
    for (let index = 0; index < 500; index += 1) renderNotificationEmail(generated);
  }),
  distribution("preference_normalization_1000", 40, () => {
    for (let index = 0; index < 1_000; index += 1) normalizeNotificationPreferences({ timezone: index % 2 ? "America/New_York" : "America/Los_Angeles" }, now.toISOString());
  }),
];

const userId = "benchmark-user";
const records = Array.from({ length: 100 }, (_, index) => buildNotificationRecord({
  ...generated,
  idempotencyKey: `benchmark-record-${index}`,
  contentVersion: `benchmark-${index}`,
  title: `Benchmark update ${index}`,
  now: new Date(now.getTime() + index),
  preferences,
}));
for (const record of records) await storeNotification(userId, record);
const asyncTimings: Record<string, number> = {};
let started = performance.now();
for (let index = 0; index < 50; index += 1) await unreadNotificationCount(userId);
asyncTimings.unreadCountAverageMs = Number(((performance.now() - started) / 50).toFixed(3));
started = performance.now();
for (let index = 0; index < 30; index += 1) await readNotifications(userId, 0, 30);
asyncTimings.centerLoadAverageMs = Number(((performance.now() - started) / 30).toFixed(3));
started = performance.now();
for (let index = 0; index < 30; index += 1) await updateNotificationState(userId, records[index]!.id, "read");
asyncTimings.markReadAverageMs = Number(((performance.now() - started) / 30).toFixed(3));
started = performance.now();
for (let index = 0; index < 100; index += 1) await storeNotification(userId, generated);
asyncTimings.duplicatePreventionAverageMs = Number(((performance.now() - started) / 100).toFixed(3));

for (let index = 0; index < 100; index += 1) {
  await scheduleNotification({
    id: `benchmark-schedule-${index}`,
    userId,
    type: "deadline",
    opportunityId: opportunity.id,
    scheduledFor: new Date(now.getTime() - index * 1_000).toISOString(),
    contentVersion: "benchmark-v1",
  });
}
started = performance.now();
for (let index = 0; index < 30; index += 1) await readDueNotificationSchedules(now, 100);
asyncTimings.schedulerDueBatchAverageMs = Number(((performance.now() - started) / 30).toFixed(3));

const strictPureBudgets: Record<string, { averageMs: number; p95Ms: number; worstMs: number }> = {
  notification_generation_250: { averageMs: 150, p95Ms: 250, worstMs: 500 },
  change_detection_1000: { averageMs: 50, p95Ms: 100, worstMs: 250 },
  email_render_500: { averageMs: 25, p95Ms: 50, worstMs: 150 },
  preference_normalization_1000: { averageMs: 50, p95Ms: 100, worstMs: 250 },
};
for (const timing of pure) {
  const budget = strictPureBudgets[timing.name]!;
  assert.ok(timing.averageMs < budget.averageMs, `${timing.name} exceeded the strict average budget.`);
  assert.ok(timing.p95Ms < budget.p95Ms, `${timing.name} exceeded the strict p95 budget.`);
  assert.ok(timing.worstMs < budget.worstMs, `${timing.name} exceeded the strict maximum budget.`);
}
for (const [name, value] of Object.entries(asyncTimings)) assert.ok(value < 100, `${name} exceeded the catastrophic average ceiling.`);
console.log("Notification performance benchmark passed", { pure, storeAndScheduler: asyncTimings });
