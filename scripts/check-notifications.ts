import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { opportunities, type Opportunity } from "../data/opportunities";
import type { TrackedOpportunity } from "../data/student-activity";
import type { RecommendationViewModel } from "../data/recommendation-service";
import {
  buildNotificationRecord,
  buildNotificationSchedules,
  detectMaterialOpportunityChanges,
  emailEligible,
  evaluateNotificationQuality,
  inQuietHours,
  localDateTimeToUtc,
  nextAllowedEmailAt,
  normalizeNotificationPreferences,
  opportunityDeadlineIsTrustworthy,
  selectPersonalizedNotificationCandidate,
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
    metadata: {
      ...base.metadata,
      deadlineType: "fixed",
      semesters: ["Fall 2026"],
      verification: { status: "verified", deadlineVerified: true, eligibilityVerified: true, applicationUrlVerified: true, sourceReachable: true },
      lifecycle: {
        schemaVersion: 1,
        identity: { identityId: "notification-fixture" },
        cycle: { cycleId: "notification-fixture:2026" },
        state: "open",
        confidence: "confirmed",
        reason: "official_status_open",
        effectiveAt: "2026-03-01T12:00:00.000Z",
        finalDeadline: { kind: "final_deadline", sourceValue: "2026-03-21", normalizedValue: "2026-03-21", precision: "date", estimated: false, verifiedAt: "2026-03-01", sourceUrl: "https://example.edu/program" },
        evidence: [{ id: "notification-evidence", source: "manual_review", observedAt: "2026-03-01T12:00:00.000Z", value: "Applications open", confidence: "confirmed" }],
        events: [],
      },
      ...(overrides.metadata ?? {}),
    },
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
assert.equal(defaults.personalizedOpportunities, true);
assert.equal(defaults.milestoneUpdates, true);
assert.equal(defaults.accountUpdates, true);
assert.equal(defaults.productAnnouncements, false);

const savedSchedules = buildNotificationSchedules({ userId: "user-a", record: tracker(), opportunity: opportunity(), now });
assert.deepEqual(savedSchedules.map((item) => item.type), ["deadline", "deadline", "follow_up"]);
assert.deepEqual(savedSchedules.filter((item) => item.type === "deadline").map((item) => item.offsetDays), [7, 1]);

const twoWeekCheckIn = buildNotificationSchedules({
  userId: "user-a",
  record: { ...tracker(), savedAt: "2026-02-15T12:00:00.000Z", updatedAt: "2026-02-15T12:00:00.000Z" },
  opportunity: opportunity(),
  now,
});
assert.equal(twoWeekCheckIn.filter((item) => item.followUpKind === "saved_check_in").length, 1);
assert.equal(buildNotificationSchedules({
  userId: "user-a",
  record: { ...tracker(), savedAt: "2026-02-15T12:00:00.000Z", updatedAt: "2026-02-20T12:00:00.000Z" },
  opportunity: opportunity(),
  now,
}).some((item) => item.followUpKind === "saved_check_in"), false);

const applyingSchedules = buildNotificationSchedules({ userId: "user-a", record: tracker("Applying"), opportunity: opportunity(), now });
assert.deepEqual(applyingSchedules.filter((item) => item.type === "deadline").map((item) => item.offsetDays), [7, 1]);

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
assert.equal(emailEligible("milestone", "high", defaults), false);
assert.equal(emailEligible("account", "high", defaults), false);
assert.equal(emailEligible("recommendation_update", "high", defaults), false);
assert.equal(emailEligible("opportunity_change", "high", defaults), false, "Opportunity changes are in-app only");

assert.deepEqual(evaluateNotificationQuality({ relevance: 95, usefulness: 90, urgency: 70, uniqueness: 100 }), { allowed: true, score: 90, reason: "useful" });
assert.equal(evaluateNotificationQuality({ relevance: 60, usefulness: 95, urgency: 90, uniqueness: 100 }).allowed, false);
assert.equal(evaluateNotificationQuality({ relevance: 100, usefulness: 100, urgency: 100, uniqueness: 100, outdated: true }).reason, "outdated");

const newMatchOpportunity = opportunity({ date_added: "2026-02-28" });
const newMatch = {
  opportunity: newMatchOpportunity,
  href: `/opportunities/${newMatchOpportunity.id}`,
  opportunityScore: { value: 94, label: "Exceptional Match" },
  recommendation: { confidence: 92, tier: "excellent" },
} as RecommendationViewModel;
assert.equal(selectPersonalizedNotificationCandidate([newMatch], new Set(), now)?.opportunity?.id, newMatchOpportunity.id);
assert.equal(selectPersonalizedNotificationCandidate([{ ...newMatch, opportunityScore: { value: 89, label: "Worth Exploring" } }], new Set(), now), undefined);
assert.equal(selectPersonalizedNotificationCandidate([{ ...newMatch, historyLabel: "Previously recommended" }], new Set(), now), undefined);
assert.equal(selectPersonalizedNotificationCandidate([newMatch], new Set([newMatchOpportunity.id]), now), undefined);
assert.equal(selectPersonalizedNotificationCandidate([{ ...newMatch, opportunity: { ...newMatchOpportunity, verification_status: "needs_review" } }], new Set(), now), undefined);

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
const extendedDeadline = opportunity({ application_deadline: "2026-03-28", deadline: "2026-03-28", metadata: { ...before.metadata, lifecycle: { ...before.metadata.lifecycle!, finalDeadline: { ...before.metadata.lifecycle!.finalDeadline!, sourceValue: "2026-03-28", normalizedValue: "2026-03-28" } } } });
assert.deepEqual(detectMaterialOpportunityChanges(before, extendedDeadline, now).map((item) => item.field), ["deadline"]);
const temporarilyClosed = opportunity({ metadata: { ...before.metadata, lifecycle: { ...before.metadata.lifecycle!, state: "temporarily_closed", reason: "official_status_closed" } } });
assert.deepEqual(detectMaterialOpportunityChanges(before, temporarilyClosed, now).map((item) => item.field), ["application_status"]);
assert.deepEqual(detectMaterialOpportunityChanges(temporarilyClosed, before, now).map((item) => item.field), ["application_status"]);
assert.deepEqual(detectMaterialOpportunityChanges(before, { ...before, metadata: { ...before.metadata, semesters: ["Spring 2027"] } }, now).map((item) => item.field), ["program_dates"]);

const { claimNotificationSchedule, claimNotificationSync, claimProviderWebhook, readNotifications, releaseNotificationSchedule, storeNotification, updateNotificationState } = await import("../lib/notification-store");
const firstStored = await storeNotification("account-a", emailOffRecord);
assert.equal(firstStored.duplicate, false);
assert.equal((await storeNotification("account-a", { ...emailOffRecord, id: crypto.randomUUID() })).duplicate, true);
assert.equal((await readNotifications("account-b")).notifications.length, 0);
assert.equal(await updateNotificationState("account-b", emailOffRecord.id, "read"), null);
assert.equal((await updateNotificationState("account-a", emailOffRecord.id, "read"))?.state, "read");
const archiveRecord = { ...emailOffRecord, id: crypto.randomUUID(), idempotencyKey: "archive-record" };
await storeNotification("account-a", archiveRecord);
assert.equal((await updateNotificationState("account-a", archiveRecord.id, "archive"))?.state, "archived");
assert.equal((await readNotifications("account-a")).notifications.some((item) => item.id === archiveRecord.id), false);
assert.equal(await claimNotificationSync("account-a", "version-a"), true);
assert.equal(await claimNotificationSync("account-a", "version-a"), false);
assert.equal(await claimNotificationSync("account-a", "version-b"), true);
assert.equal(await claimNotificationSchedule("schedule-replay"), true);
assert.equal(await claimNotificationSchedule("schedule-replay"), false);
await releaseNotificationSchedule("schedule-replay");
assert.equal(await claimNotificationSchedule("schedule-replay"), true);
assert.equal(await claimProviderWebhook("webhook-replay"), true);
assert.equal(await claimProviderWebhook("webhook-replay"), false);

const auth = await import("../lib/auth-store");
const service = await import("../lib/notification-service");
const integrationNow = new Date();
const integrationDate = integrationNow.toISOString().slice(0, 10);
const integrationDeadline = new Date(integrationNow.getTime() + 21 * 86_400_000).toISOString().slice(0, 10);
const integrationOpportunity = opportunity({
  date_added: integrationDate,
  last_verified: integrationDate,
  application_deadline: integrationDeadline,
  deadline: integrationDeadline,
  metadata: {
    ...opportunity().metadata,
    lifecycle: {
      ...opportunity().metadata.lifecycle!,
      effectiveAt: integrationNow.toISOString(),
      finalDeadline: {
        ...opportunity().metadata.lifecycle!.finalDeadline!,
        sourceValue: integrationDeadline,
        normalizedValue: integrationDeadline,
        verifiedAt: integrationDate,
      },
    },
  },
});
const integrationMatch = { ...newMatch, opportunity: integrationOpportunity } as RecommendationViewModel;
const integrationUser = await auth.upsertUser({
  googleSub: "notification-engine-integration",
  email: "notification-engine@example.test",
  name: "Notification Test",
});
let integrationAccount = await auth.mergeAccountData(integrationUser.id, {
  onboardingComplete: true,
  activity: { viewed: [], saved: [], claimed: [], tracked: {} },
});
assert.equal((await service.syncPersonalizedOpportunityNotification({
  userId: integrationUser.id,
  account: integrationAccount,
  recommendations: [integrationMatch],
  catalogVersion: "catalog-test-v1",
  now: integrationNow,
})).status, "generated");
assert.equal((await service.syncPersonalizedOpportunityNotification({
  userId: integrationUser.id,
  account: integrationAccount,
  recommendations: [integrationMatch],
  catalogVersion: "catalog-test-v1",
  now: integrationNow,
})).status, "duplicate");
assert.equal((await service.queueAccountNotification({
  userId: integrationUser.id,
  eventId: "billing-event-1",
  title: "Your Pro plan is active",
  body: "Your subscription is active and your account has been updated.",
  now: integrationNow,
})).status, "generated");
assert.equal((await service.queueAccountNotification({
  userId: integrationUser.id,
  eventId: "billing-event-1",
  title: "Your Pro plan is active",
  body: "Your subscription is active and your account has been updated.",
  now: integrationNow,
})).status, "duplicate");
const milestoneEventId = "journey-first-save-event";
const milestoneRecord = {
  ...tracker(),
  id: base.id,
  version: 1,
  history: [{
    id: milestoneEventId,
    transition: "choose" as const,
    priorStatus: "Saved" as const,
    resultingStatus: "Saved" as const,
    occurredAt: integrationNow.toISOString(),
    details: { source: "student_reported" as const },
  }],
};
integrationAccount = await auth.mergeAccountData(integrationUser.id, {
  tracker: { [base.id]: milestoneRecord },
  activity: { viewed: [], saved: [base.id], claimed: [], tracked: { [base.id]: milestoneRecord } },
  savedOpportunities: [{ opportunityId: base.id, savedAt: milestoneRecord.savedAt }],
});
assert.equal(integrationAccount.tracker[base.id]?.id, base.id);
assert.equal((await service.queueJourneyMilestoneNotification({
  userId: integrationUser.id,
  opportunityId: base.id,
  eventId: milestoneEventId,
  now: integrationNow,
})).status, "generated");
const integrationCenter = await readNotifications(integrationUser.id, 0, 20);
assert.deepEqual(new Set(integrationCenter.notifications.map((item) => item.type)), new Set(["recommendation_update", "account", "milestone"]));

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
