import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { opportunities, type Opportunity } from "../data/opportunities";
import type { TrackedOpportunity } from "../data/student-activity";
import {
  buildNotificationRecord,
  buildNotificationSchedules,
  detectMaterialOpportunityChanges,
  inQuietHours,
  localDateTimeToUtc,
  nextAllowedEmailAt,
  normalizeNotificationPreferences,
  opportunityDeadlineIsTrustworthy,
} from "../lib/notification-engine";
import { notificationGroupLabel, notificationTimestamp } from "../lib/notification-presentation";

process.env.AUTH_SECRET = "notification-regression-secret-with-at-least-thirty-two-bytes";
Reflect.set(process.env, "NODE_ENV", "test");
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
const now = new Date("2026-03-01T12:00:00.000Z");
const presentationNow = new Date(2026, 6, 30, 12, 0, 0);
assert.equal(notificationGroupLabel(new Date(2026, 6, 30, 9, 0, 0).toISOString(), presentationNow), "Today");
assert.equal(notificationGroupLabel(new Date(2026, 6, 29, 9, 0, 0).toISOString(), presentationNow), "Yesterday");
assert.equal(notificationGroupLabel(new Date(2026, 6, 27, 9, 0, 0).toISOString(), presentationNow), "Earlier This Week");
assert.equal(notificationGroupLabel(new Date(2026, 6, 20, 9, 0, 0).toISOString(), presentationNow), "Earlier");
assert.equal(notificationTimestamp(new Date(2026, 6, 30, 11, 59, 45).toISOString(), presentationNow), "Just now");
assert.equal(notificationTimestamp(new Date(2026, 6, 30, 11, 55, 0).toISOString(), presentationNow), "5 min ago");
assert.equal(notificationTimestamp(new Date(2026, 6, 30, 10, 0, 0).toISOString(), presentationNow), "2 hours ago");
assert.equal(notificationTimestamp(new Date(2026, 6, 29, 12, 0, 0).toISOString(), presentationNow), "Yesterday");
const base = opportunities[0]!;

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    ...base,
    id: "notification-fixture",
    title: "Verified Student Program",
    organization: "Official Organization",
    application_deadline: "2026-03-21",
    deadline: "2026-03-21",
    last_verified: "2026-03-01",
    verification_status: "verified",
    official_source_url: "https://example.edu/program",
    ...overrides,
    metadata: { ...base.metadata, deadlineType: "fixed", semesters: ["Fall 2026"], ...(overrides.metadata ?? {}) },
  };
}

function tracker(status: TrackedOpportunity["status"] = "Saved", reminderAt?: string, reminderText?: string): TrackedOpportunity {
  return {
    id: "notification-fixture",
    status,
    savedAt: "2026-02-01T12:00:00.000Z",
    updatedAt: "2026-03-01T12:00:00.000Z",
    version: reminderAt ? 1 : 0,
    history: reminderAt ? [{
      id: "history-reminder",
      transition: "choose",
      priorStatus: "Saved",
      resultingStatus: status,
      occurredAt: "2026-03-01T12:00:00.000Z",
      details: { reminderAt, reminderText, source: "student_reported" },
    }] : [],
  };
}

const defaults = normalizeNotificationPreferences(null, now.toISOString());
assert.equal(defaults.inAppEnabled, true);
assert.equal(defaults.emailEnabled, true);
assert.equal(defaults.weeklyDigest, false);
assert.equal(defaults.recommendationUpdates, false);

const savedSchedules = buildNotificationSchedules({ userId: "user-a", record: tracker(), opportunity: opportunity(), now });
assert.deepEqual(savedSchedules.map((item) => item.type), ["deadline", "deadline", "follow_up"]);
assert.deepEqual(savedSchedules.filter((item) => item.type === "deadline").map((item) => item.offsetDays), [7, 1]);

const applyingSchedules = buildNotificationSchedules({ userId: "user-a", record: tracker("Applying"), opportunity: opportunity(), now });
assert.deepEqual(applyingSchedules.filter((item) => item.type === "deadline").map((item) => item.offsetDays), [7, 3, 1]);

const dueSoon = buildNotificationSchedules({
  userId: "user-a",
  record: tracker(),
  opportunity: opportunity({ application_deadline: "2026-03-03", deadline: "2026-03-03" }),
  now,
});
assert.deepEqual(dueSoon.map((item) => item.type), ["deadline", "follow_up"]);
assert.equal(dueSoon[0]?.offsetDays, 1);

const afterWindow = buildNotificationSchedules({
  userId: "user-a",
  record: tracker(),
  opportunity: opportunity({ application_deadline: "2026-03-02", deadline: "2026-03-02" }),
  now: new Date("2026-03-01T16:00:00.000Z"),
});
assert.deepEqual(afterWindow.map((item) => item.type), ["follow_up"]);

const custom = buildNotificationSchedules({
  userId: "user-a",
  record: tracker("Saved", "2026-03-02T16:00:00.000Z", "Request a recommendation letter"),
  opportunity: opportunity({ application_deadline: "2026-03-03", deadline: "2026-03-03" }),
  now,
});
assert.equal(custom[0]?.type, "journey_reminder");
assert.equal(custom[0]?.customReminderText, "Request a recommendation letter");

const reminderAtInferredTime = "2026-03-02T14:00:00.000Z";
const customSuppressesInferred = buildNotificationSchedules({
  userId: "user-a",
  record: tracker("Saved", reminderAtInferredTime, "Finish the application"),
  opportunity: opportunity({ application_deadline: "2026-03-03", deadline: "2026-03-03" }),
  now,
});
assert.equal(customSuppressesInferred.filter((item) => item.type === "deadline").length, 0);

const changedReminderText = buildNotificationSchedules({
  userId: "user-a",
  record: tracker("Saved", reminderAtInferredTime, "Ask for the transcript"),
  opportunity: opportunity({ application_deadline: "2026-03-03", deadline: "2026-03-03" }),
  now,
});
assert.notEqual(customSuppressesInferred[0]?.id, changedReminderText[0]?.id, "Changing reminder wording must invalidate the old scheduled payload.");

for (const status of ["Accepted", "Completed", "Rejected", "Paused"] as const) {
  assert.equal(buildNotificationSchedules({ userId: "user-a", record: tracker(status), opportunity: opportunity(), now }).length, 0);
}
assert.equal(buildNotificationSchedules({ userId: "user-a", record: tracker(), opportunity: opportunity({ application_deadline: "not-a-date" }), now }).length, 0);
assert.equal(buildNotificationSchedules({ userId: "user-a", record: tracker(), opportunity: opportunity({ metadata: { ...base.metadata, deadlineType: "rolling" } }), now }).length, 0);
assert.equal(buildNotificationSchedules({ userId: "user-a", record: tracker(), opportunity: opportunity({ verification_status: "needs_review" }), now }).length, 0);
assert.equal(opportunityDeadlineIsTrustworthy(opportunity(), now), true);
assert.equal(opportunityDeadlineIsTrustworthy(opportunity({ last_verified: "2024-01-01" }), now), false);

const emailOff = normalizeNotificationPreferences({ emailEnabled: false }, now.toISOString());
const emailOffRecord = buildNotificationRecord({
  type: "deadline_reminder",
  priority: "high",
  title: "Deadline tomorrow",
  body: "Verified Student Program is due tomorrow.",
  actionLabel: "View opportunity",
  actionHref: "/opportunities/notification-fixture",
  contentVersion: "v1",
  idempotencyKey: "email-off",
  now,
  preferences: emailOff,
});
assert.equal(emailOffRecord.channels.inApp.state, "delivered");
assert.equal(emailOffRecord.channels.email.state, "suppressed");
assert.equal(buildNotificationRecord({ ...emailOffRecord, preferences: defaults, actionHref: "https://attacker.example" }).actionHref, "/notifications");
const balancedRecord = buildNotificationRecord({
  ...emailOffRecord,
  idempotencyKey: "balanced",
  priority: "normal",
  preferences: normalizeNotificationPreferences({ frequency: "balanced" }, now.toISOString()),
});
assert.equal(balancedRecord.channels.email.state, "scheduled");

const deadlineOff = normalizeNotificationPreferences({ deadlineReminders: false }, now.toISOString());
assert.equal(buildNotificationSchedules({ userId: "user-a", record: tracker(), opportunity: opportunity(), preferences: deadlineOff, now }).length, 0);

assert.equal(localDateTimeToUtc("2026-03-07", 9, "America/New_York")?.toISOString(), "2026-03-07T14:00:00.000Z");
assert.equal(localDateTimeToUtc("2026-03-08", 9, "America/New_York")?.toISOString(), "2026-03-08T13:00:00.000Z");
assert.equal(localDateTimeToUtc("2026-11-01", 9, "America/New_York")?.toISOString(), "2026-11-01T14:00:00.000Z");
assert.equal(inQuietHours(new Date("2026-01-15T05:00:00.000Z"), defaults), true);
assert.equal(nextAllowedEmailAt(new Date("2026-01-15T05:00:00.000Z"), defaults).toISOString(), "2026-01-15T13:00:00.000Z");

const before = opportunity();
assert.deepEqual(detectMaterialOpportunityChanges(before, { ...before, description: `${before.description} ` }), []);
assert.deepEqual(detectMaterialOpportunityChanges(before, { ...before, eligibility: `${before.eligibility}.` }), []);
assert.deepEqual(detectMaterialOpportunityChanges(before, { ...before, official_source_url: `${before.official_source_url}?utm_source=test` }), []);
assert.deepEqual(detectMaterialOpportunityChanges(before, { ...before, application_deadline: "2026-03-28" }).map((item) => item.field), ["deadline"]);
assert.deepEqual(detectMaterialOpportunityChanges(before, { ...before, verification_status: "temporarily_closed" }).map((item) => item.field), ["application_status"]);
assert.deepEqual(detectMaterialOpportunityChanges({ ...before, verification_status: "temporarily_closed" }, before).map((item) => item.field), ["application_status"]);
assert.deepEqual(detectMaterialOpportunityChanges(before, { ...before, metadata: { ...before.metadata, semesters: ["Spring 2027"] } }).map((item) => item.field), ["program_dates"]);

const { claimNotificationSchedule, claimProviderWebhook, readNotifications, releaseNotificationSchedule, storeNotification, updateNotificationState } = await import("../lib/notification-store");
const firstStored = await storeNotification("account-a", emailOffRecord);
assert.equal(firstStored.duplicate, false);
assert.equal((await storeNotification("account-a", { ...emailOffRecord, id: crypto.randomUUID() })).duplicate, true);
assert.equal((await readNotifications("account-b")).notifications.length, 0);
assert.equal(await updateNotificationState("account-b", emailOffRecord.id, "read"), null);
assert.equal((await updateNotificationState("account-a", emailOffRecord.id, "read"))?.state, "read");
assert.equal(await claimNotificationSchedule("schedule-replay"), true);
assert.equal(await claimNotificationSchedule("schedule-replay"), false);
await releaseNotificationSchedule("schedule-replay");
assert.equal(await claimNotificationSchedule("schedule-replay"), true);
assert.equal(await claimProviderWebhook("webhook-replay"), true);
assert.equal(await claimProviderWebhook("webhook-replay"), false);

const catastrophicBatchStarted = performance.now();
for (let index = 0; index < 250; index += 1) {
  buildNotificationSchedules({ userId: `perf-${index}`, record: tracker(index % 2 ? "Saved" : "Applying"), opportunity: opportunity(), now });
  detectMaterialOpportunityChanges(before, { ...before, application_deadline: index % 2 ? "2026-03-28" : "2026-03-21" });
}
const catastrophicBatchMs = Number((performance.now() - catastrophicBatchStarted).toFixed(2));
assert.ok(
  catastrophicBatchMs < 2_000,
  `Notification generation exceeded the deployment catastrophic ceiling: ${catastrophicBatchMs}ms`,
);
console.log("Notification engine and ownership checks passed", { scenarios: 30, catastrophicBatchMs });
