import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import type { Opportunity } from "../data/opportunities";
import { opportunities } from "../data/opportunities";
import type { OpportunityTrackerStatus, TrackedOpportunity } from "../data/student-activity";
import type { AccountData, ApplicationTaskRecord } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";
import { buildCalendarIntelligenceModel, detectCalendarClusters, type CalendarIntelligenceEvent } from "../lib/calendar-intelligence";
import { buildJourneyCalendarModel } from "../lib/journey-calendar";

const now = new Date("2026-10-01T03:30:00.000Z");

function event(id: string, date: string, kind: CalendarIntelligenceEvent["kind"], opportunityId = id): CalendarIntelligenceEvent {
  return { id, kind, date, title: `Event ${id}`, opportunityId, opportunityTitle: `Opportunity ${opportunityId}`, relationship: kind === "opening_date" ? "watching" : "pursuing", dateControl: kind === "application_deadline" || kind === "opening_date" ? "fixed" : "user_editable" };
}

const sameDay = detectCalendarClusters([event("a", "2026-10-15", "application_deadline"), event("b", "2026-10-15", "application_deadline"), event("c", "2026-10-15", "application_deadline")]);
assert.equal(sameDay.clusters.length, 1);
assert.equal(sameDay.clusters[0]?.sameDay, true);
assert.equal(sameDay.clusters[0]?.deadlineCount, 3);
assert.equal(sameDay.clusters[0]?.fixedCount, 3);

const fiveDay = detectCalendarClusters([event("a", "2026-10-10", "application_deadline"), event("b", "2026-10-12", "application_deadline"), event("c", "2026-10-15", "application_deadline")]);
assert.equal(fiveDay.clusters.length, 1);
assert.equal(fiveDay.clusters[0]?.spanDays, 6);

const mixed = detectCalendarClusters([event("deadline", "2026-10-15", "application_deadline"), event("task-a", "2026-10-10", "personal_task", "deadline"), event("task-b", "2026-10-11", "personal_task", "deadline"), event("task-c", "2026-10-14", "personal_task", "deadline")]);
assert.equal(mixed.clusters.length, 1);
assert.equal(mixed.clusters[0]?.deadlineCount, 1);
assert.equal(mixed.clusters[0]?.taskCount, 3);
assert.equal(mixed.clusters[0]?.userEditableCount, 3);

const sparse = detectCalendarClusters([event("only", "2026-10-20", "application_deadline")]);
assert.equal(sparse.clusters.length, 0, "One deadline must not be misrepresented as a conflict.");
assert.equal(sparse.unclustered.length, 1);

const source = opportunities.find((item) => item.type === "Career")!;
function opportunity(id: string, deadline: string, status: "fixed" | "rolling" = "fixed"): Opportunity {
  return { ...source, id, title: `Calendar ${id}`, organization: `Organization ${id}`, application_deadline: status === "fixed" ? deadline : null, deadline: status === "fixed" ? deadline : "Rolling", verification_status: "verified", last_verified: "2026-09-20", metadata: { ...source.metadata, applicationRequirements: ["Resume", "Transcript"], deadlineType: status, verification: { ...source.metadata.verification, status: "verified", officialSourceUrl: source.official_source_url, applicationUrlVerified: true, deadlineVerified: status === "fixed", eligibilityVerified: true, sourceReachable: true } } } as Opportunity;
}

function tracked(id: string, status: OpportunityTrackerStatus): TrackedOpportunity {
  return { id, status, savedAt: "2026-09-01T12:00:00.000Z", updatedAt: "2026-09-20T12:00:00.000Z", version: 1, history: [] };
}

function task(id: string, dueDate: string | undefined, completed = false): ApplicationTaskRecord {
  return { id, title: `Task ${id}`, dueDate, source: "user", completed, completedAt: completed ? now.toISOString() : undefined, createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 0 };
}

const active = [opportunity("active-a", "2026-10-10"), opportunity("active-b", "2026-10-12"), opportunity("active-c", "2026-10-15")];
const submitted = opportunity("submitted", "2026-10-13");
const rolling = opportunity("rolling", "", "rolling");
const watchedBase = opportunity("watched", "2026-11-01");
const watched = { ...watchedBase, metadata: { ...watchedBase.metadata, lifecycle: { ...watchedBase.metadata.lifecycle, confidence: "confirmed", openingDate: { normalizedValue: "2026-10-05", precision: "date", estimated: false } } } } as Opportunity;
const records = Object.fromEntries([...active.map((item) => [item.id, tracked(item.id, "Applying")] as const), [submitted.id, tracked(submitted.id, "Submitted")], [rolling.id, tracked(rolling.id, "Applying")]]);
const account: AccountData = {
  profile: null,
  onboardingComplete: true,
  firstLaunchComplete: true,
  billing: defaultBillingRecord(),
  activity: { viewed: [], saved: Object.keys(records), claimed: [], tracked: records },
  savedOpportunities: Object.values(records).map((record) => ({ opportunityId: record.id, savedAt: record.savedAt })),
  watchedOpportunities: [{ opportunityId: watched.id, watchedAt: now.toISOString(), updatedAt: now.toISOString(), version: 0 }],
  tracker: records,
  applicationWorkspaces: { "active-a": { opportunityId: "active-a", tasks: { "task-a": task("task-a", "2026-10-10"), "task-b": task("task-b", "2026-10-11"), "task-complete": task("task-complete", "2026-10-12", true), "task-undated": task("task-undated", undefined) }, deletedTasks: {}, createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 0 } },
  preferences: null,
  journeyProgress: {},
  calendarEvents: {},
  advisor: null,
  referrals: null,
  updatedAt: now.toISOString(),
};

const catalog = [...active, submitted, rolling, watched];
const calendar = buildJourneyCalendarModel({ account, opportunities: catalog, now });
const duplicatedCalendar = { ...calendar, items: [...calendar.items, ...calendar.items.filter((item) => item.type === "application_deadline").slice(0, 1).map((item) => ({ ...item, id: "duplicate-source-reference" }))] };
const model = buildCalendarIntelligenceModel({ account, opportunities: catalog, calendar: duplicatedCalendar, now });
const period = model.periods["30"];
assert.equal(period.deadlineCount, 3, "Submitted and rolling applications must not enter active deadline conflicts.");
assert.equal(period.openingCount, 1, "A verified watched opening should appear as an opening, not a deadline.");
assert.equal(period.taskCount, 2, "Completed tasks must be excluded.");
assert.equal(model.undatedTaskCount, 1);
assert.equal(model.generatedForDate, "2026-09-30", "Projection dates must use the account timezone at UTC-day boundaries.");
assert.equal(period.clusters.flatMap((cluster) => cluster.events).filter((item) => item.id === "deadline:active-a:2026-10-10").length, 1, "A provider deadline must count once across source projections.");
assert.ok(period.clusters.some((cluster) => cluster.missingMaterialApplicationCount > 0), "Deadline clusters should reuse verified Materials readiness context.");
assert.equal(period.clusters.some((cluster) => cluster.events.some((item) => item.opportunityId === submitted.id)), false);
assert.equal(period.clusters.some((cluster) => cluster.events.some((item) => item.opportunityId === rolling.id)), false);

const isolated = buildCalendarIntelligenceModel({ account: { ...account, activity: { viewed: [], saved: [], claimed: [], tracked: {} }, tracker: {}, savedOpportunities: [], watchedOpportunities: [], applicationWorkspaces: {}, calendarEvents: {} }, opportunities: catalog, calendar: buildJourneyCalendarModel({ account: { ...account, activity: { viewed: [], saved: [], claimed: [], tracked: {} }, tracker: {}, savedOpportunities: [], watchedOpportunities: [], applicationWorkspaces: {}, calendarEvents: {} }, opportunities: catalog, now }), now });
assert.equal(isolated.periods["90"].fixedCount + isolated.periods["90"].userEditableCount, 0, "One account's dates must never enter another account projection.");

const large = Array.from({ length: 500 }, (_, index) => event(`load-${index}`, `2026-${String(10 + Math.floor((index % 80) / 28)).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`, index % 4 === 0 ? "application_deadline" : "personal_task"));
const signature = JSON.stringify(detectCalendarClusters(large));
const timings: number[] = [];
for (let run = 0; run < 30; run += 1) {
  const started = performance.now();
  const projected = detectCalendarClusters(large);
  timings.push(performance.now() - started);
  assert.equal(JSON.stringify(projected), signature, "Cluster output must remain deterministic.");
}
timings.sort((left, right) => left - right);
const p95 = timings[Math.ceil(timings.length * 0.95) - 1]!;
assert.ok(p95 < 20, `500-event cluster detection should remain fast; received ${p95.toFixed(2)}ms p95.`);

const openingHeavy = Array.from({ length: 500 }, (_, index) => event(`opening-${index}`, "2026-10-15", "opening_date"));
const openingStarted = performance.now();
const openingProjection = detectCalendarClusters(openingHeavy);
const openingDuration = performance.now() - openingStarted;
assert.equal(openingProjection.clusters.length, 0, "Opening dates alone must not be labeled as a conflict.");
assert.equal(openingProjection.unclustered.length, 500);
assert.ok(openingDuration < 20, `A dense non-qualifying history must remain bounded; received ${openingDuration.toFixed(2)}ms.`);

const component = readFileSync("components/journey-deadline-calendar.tsx", "utf8");
const docs = readFileSync("docs/CALENDAR_INTELLIGENCE.md", "utf8");
assert.match(component, /Conflict Planning groups nearby deadlines and tasks/);
assert.match(component, /Fixed dates/);
assert.match(component, /Your dates/);
assert.match(component, /View affected applications/);
assert.doesNotMatch(component, /workload score|stress level|burnout|auto.?schedul|estimated hours/i);
assert.match(docs, /seven-day window/i);

console.log("Calendar Intelligence checks passed", { p95Ms: Number(p95.toFixed(2)), denseNonConflictMs: Number(openingDuration.toFixed(2)), sameDay: true, mixed: true, deduplicated: true, watchedOpening: true, submittedExcluded: true });
