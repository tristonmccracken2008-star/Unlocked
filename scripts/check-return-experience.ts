import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { opportunities, type Opportunity } from "../data/opportunities";
import type { TrackedOpportunity } from "../data/student-activity";
import { defaultBillingRecord } from "../lib/billing";
import type { AccountData, AuthUser } from "../lib/account-types";
import { buildJourneyCommandCenterModel } from "../lib/journey-command-center";
import type { NotificationRecord } from "../lib/notification-types";
import { buildReturnBriefing } from "../lib/return-experience";

const now = new Date("2026-08-10T16:00:00.000Z");
const user: AuthUser = { id: "return-owner", email: "return@example.test", name: "Taylor Student" };
const base = opportunities.find((item) => item.type === "Career")!;
const changedBase = opportunities.find((item) => item.id !== base.id)!;
const deadlineOpportunity: Opportunity = {
  ...base,
  id: "return-deadline-opportunity",
  title: "NASA OSTEM Internship",
  organization: "NASA",
  application_deadline: "2026-08-14",
  verification_status: "verified",
  last_verified: "2026-08-01",
  metadata: { ...base.metadata, deadlineType: "fixed" },
};

const tracked: TrackedOpportunity = {
  id: deadlineOpportunity.id,
  status: "Applying",
  savedAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-09T12:00:00.000Z",
  version: 1,
  history: [{ id: "return-start", transition: "start", priorStatus: "Saved", resultingStatus: "Applying", occurredAt: "2026-08-09T12:00:00.000Z", details: { notes: "private return fixture note", source: "student_reported" } }],
};

function account(record: TrackedOpportunity = tracked): AccountData {
  return {
    profile: { firstName: "Taylor", schoolSlug: "university-of-chicago", major: "Computer Science", graduationYear: "2030", year: "First year", careerGoal: "Software Engineering", interests: "Software, Research", onboardingCompletedAt: "2026-08-01T12:00:00.000Z" },
    onboardingComplete: true,
    firstLaunchComplete: true,
    firstLaunchCompletedAt: "2026-08-01T12:00:00.000Z",
    billing: defaultBillingRecord(),
    activity: { viewed: [], saved: [record.id], claimed: [], tracked: { [record.id]: record } },
    savedOpportunities: [{ opportunityId: record.id, savedAt: record.savedAt }],
    tracker: { [record.id]: record },
    preferences: { appearance: "light", notifications: { inAppEnabled: true, emailEnabled: false, deadlineReminders: true, journeyReminders: true, opportunityChanges: true, personalizedOpportunities: true, milestoneUpdates: true, accountUpdates: true, productAnnouncements: false, weeklyDigest: false, recommendationUpdates: false, frequency: "important_only", timezone: "America/New_York", quietHours: { enabled: true, startHour: 22, endHour: 8 }, updatedAt: now.toISOString() }, updatedAt: now.toISOString() },
    journeyProgress: {},
    applicationWorkspaces: { [record.id]: { opportunityId: record.id, tasks: {
      resume: { id: "resume", title: "Update resume", source: "user", completed: true, completedAt: "2026-08-08T12:00:00.000Z", createdAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-08T12:00:00.000Z", version: 1 },
      essay: { id: "essay", title: "Draft essay", source: "user", completed: false, createdAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-08T12:00:00.000Z", version: 0 },
    }, createdAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-08T12:00:00.000Z", version: 1 } },
    advisor: null,
    referrals: null,
    updatedAt: now.toISOString(),
  };
}

function notification(input: Partial<NotificationRecord> & Pick<NotificationRecord, "id" | "type" | "title" | "body">): NotificationRecord {
  return {
    priority: "normal",
    state: "delivered",
    actionLabel: "View",
    actionHref: "/notifications",
    createdAt: "2026-08-10T14:00:00.000Z",
    expiresAt: "2026-09-10T14:00:00.000Z",
    idempotencyKey: input.id,
    contentVersion: "v1",
    channels: { inApp: { state: "delivered", deliveredAt: "2026-08-10T14:00:00.000Z" }, email: { state: "not_requested" } },
    ...input,
  };
}

const ownerAccount = account();
const journey = buildJourneyCommandCenterModel({ user, account: ownerAccount, opportunities: [deadlineOpportunity], now });
const notifications = [
  notification({ id: "11111111-1111-4111-8111-111111111111", type: "opportunity_change", priority: "high", title: "Deadline extended", body: "A saved scholarship now closes September 21.", opportunityId: changedBase.id, actionLabel: "View update", actionHref: `/opportunities/${changedBase.id}` }),
  notification({ id: "22222222-2222-4222-8222-222222222222", type: "recommendation_update", title: "A new opportunity fits your profile", body: "A verified opportunity is a strong match.", opportunityId: "new-match", actionLabel: "Review match", actionHref: "/advisor" }),
  notification({ id: "33333333-3333-4333-8333-333333333333", type: "opportunity_change", title: "Old update", body: "This should not return.", createdAt: "2026-08-01T14:00:00.000Z" }),
];

const briefing = buildReturnBriefing({ profile: ownerAccount.profile!, journey, notifications, freshnessCutoff: "2026-08-09T00:00:00.000Z", now });
assert.ok(briefing);
assert.equal(briefing.items.length, 3, "Return briefing must remain bounded to three meaningful items.");
assert.equal(briefing.items[0]?.kind, "application", "Near-term application work must outrank informational updates.");
assert.match(briefing.items[0]?.title ?? "", /closes in 4 days/);
assert.match(briefing.items[0]?.detail ?? "", /1 application task remaining/);
assert.ok(briefing.items.some((item) => item.kind === "opportunity_change" && item.title === "Deadline extended"));
assert.ok(briefing.items.some((item) => item.kind === "recommendation"));
assert.equal(briefing.items.some((item) => item.title === "Old update"), false, "Previously presented updates must not be described as new.");
assert.doesNotMatch(JSON.stringify(briefing), /private return fixture note|return@example\.test|Computer Science/, "Return projections must not expose notes, email, or profile answers.");

const isolated = buildJourneyCommandCenterModel({ user: { ...user, id: "other-user" }, account: { ...account(), activity: { viewed: [], saved: [], claimed: [], tracked: {} }, savedOpportunities: [], tracker: {}, applicationWorkspaces: {} }, opportunities: [], now });
assert.equal(buildReturnBriefing({ profile: ownerAccount.profile!, journey: isolated, notifications: [], now }), null, "An account without activity must never receive another account’s briefing.");

const timings: number[] = [];
for (let run = 0; run < 300; run += 1) {
  const started = performance.now();
  buildReturnBriefing({ profile: ownerAccount.profile!, journey, notifications, freshnessCutoff: "2026-08-09T00:00:00.000Z", now });
  timings.push(performance.now() - started);
}
timings.sort((left, right) => left - right);
const p95 = timings[Math.floor(timings.length * .95)]!;
assert.ok(p95 < 5, `Return projection must remain under 5ms p95; received ${p95.toFixed(2)}ms.`);

const component = readFileSync("components/return-briefing.tsx", "utf8");
const projection = readFileSync("lib/return-experience.ts", "utf8");
const styles = readFileSync("components/return-briefing.module.css", "utf8");
const route = readFileSync("app/api/return-experience/route.ts", "utf8");
const page = readFileSync("app/page.tsx", "utf8");
for (const contract of ["You’re all caught up.", "applicationTargetId", "returnBriefingDismissed", "aria-labelledby=\"return-briefing-heading\""]) assert.ok(component.includes(contract), `Return UI must preserve ${contract}.`);
assert.match(projection, /Here’s what matters right now\./);
assert.match(styles, /@media \(max-width: 700px\)/);
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(styles, /min-height: 44px/);
assert.match(route, /assertSameOrigin/);
assert.match(route, /getServerSessionForProduct/);
assert.match(route, /httpOnly: true/);
assert.match(page, /returnNotifications\(session\.user\.id/);
assert.match(page, /Promise\.race/);
assert.ok(page.includes("setTimeout(() => resolve({ notifications: [], unreadCount: 0, nextCursor: null }), 500)"));
assert.match(page, /readReturnExperienceReceipt/);

console.log("Smart Return Experience checks passed", { items: briefing.items.map((item) => item.kind), freshness: true, accountIsolation: true, p95Ms: Number(p95.toFixed(3)) });
