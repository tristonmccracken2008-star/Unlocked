import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { opportunities } from "../data/opportunities";
import type { OpportunityTrackerStatus, TrackedOpportunity } from "../data/student-activity";
import { defaultBillingRecord } from "../lib/billing";
import type { AccountData, AuthUser } from "../lib/account-types";
import { auditJourneyProjection, buildJourneyCommandCenterModel } from "../lib/journey-command-center";

const now = new Date("2026-07-29T12:00:00.000Z");
const user: AuthUser = { id: "journey-command-user", email: "journey@example.test", name: "Jordan Rivera" };

function account(records: TrackedOpportunity[]): AccountData {
  const tracker = Object.fromEntries(records.map((record) => [record.id, record]));
  return {
    profile: { firstName: "Jordan", lastName: "Rivera", schoolSlug: "university-of-chicago", major: "Mathematics", graduationYear: "2030", year: "First year", interests: "Research", careerGoal: "Research", onboardingCompletedAt: now.toISOString() },
    onboardingComplete: true,
    billing: defaultBillingRecord(),
    activity: { viewed: [], saved: records.map((record) => record.id), claimed: [], tracked: tracker },
    savedOpportunities: records.map((record) => ({ opportunityId: record.id, savedAt: record.savedAt })),
    tracker,
    preferences: { appearance: "light", updatedAt: now.toISOString() },
    journeyProgress: {},
    advisor: null,
    referrals: null,
    updatedAt: now.toISOString(),
  };
}

function record(id: string, status: OpportunityTrackerStatus, index: number, reminder = false): TrackedOpportunity {
  const month = String((index % 6) + 1).padStart(2, "0");
  const day = String((index % 25) + 1).padStart(2, "0");
  const updatedAt = `2026-${month}-${day}T12:00:00.000Z`;
  return {
    id,
    status,
    savedAt: `2025-${month}-${day}T12:00:00.000Z`,
    updatedAt,
    version: 1,
    history: [{
      id: `journey:test:${index}:history`,
      transition: status === "Completed" ? "complete" : status === "Rejected" ? "close" : status === "Interview" ? "interview" : status === "Submitted" ? "submit" : status === "Applying" ? "start" : "choose",
      priorStatus: "Saved",
      resultingStatus: status,
      occurredAt: updatedAt,
      details: reminder ? { reminderAt: "2026-07-28T12:00:00.000Z", reminderText: "Follow up with the program.", notes: "Private fixture note.", source: "student_reported" } : undefined,
    }],
  };
}

const empty = account([]);
const emptyModel = buildJourneyCommandCenterModel({ user, account: empty, opportunities: [], now });
assert.equal(emptyModel.activeCount, 0);
assert.equal(emptyModel.historyCount, 0);
assert.equal(emptyModel.attention.length, 0);

for (const count of [5, 20, 50]) {
  const fixtures = opportunities.slice(0, count).map((item, index) => record(item.id, ["Saved", "Applying", "Submitted", "Interview", "Accepted"][index % 5] as OpportunityTrackerStatus, index));
  const model = buildJourneyCommandCenterModel({ user, account: account(fixtures), opportunities: opportunities.slice(0, count), now });
  assert.equal(model.activeCount, count, `${count}-record Journey must preserve every active record.`);
  assert.equal(model.activeRecords.length, Math.min(6, count), `${count}-record Journey must keep the first viewport bounded.`);
  const expanded = buildJourneyCommandCenterModel({ user, account: account(fixtures), opportunities: opportunities.slice(0, count), now, activeLimit: 100 });
  assert.equal(expanded.activeRecords.length, count, `${count}-record Journey must support server-side progressive disclosure.`);
}

const selected = opportunities.slice(0, 600);
assert.equal(selected.length, 600, "Large Journey fixtures require 600 catalog records.");
const activeStatuses: OpportunityTrackerStatus[] = ["Saved", "Interested", "Applying", "Submitted", "Interview", "Accepted", "Paused"];
const largeRecords = selected.map((item, index) => record(item.id, index < 100 ? activeStatuses[index % activeStatuses.length] : index % 2 ? "Completed" : "Rejected", index, index === 1));
const largeAccount = account(largeRecords);
const before = JSON.stringify(largeAccount);
const timings: number[] = [];
let largeModel = buildJourneyCommandCenterModel({ user, account: largeAccount, opportunities: selected, now });
for (let run = 0; run < 12; run += 1) {
  const started = performance.now();
  largeModel = buildJourneyCommandCenterModel({ user, account: largeAccount, opportunities: selected, now });
  timings.push(performance.now() - started);
}
assert.equal(JSON.stringify(largeAccount), before, "Command-center projection must not mutate persisted Journey data.");
assert.equal(largeModel.activeCount, 100);
assert.equal(largeModel.historyCount, 500);
assert.equal(largeModel.activeRecords.length, 6);
assert.equal(largeModel.shownActiveCount, 6);
assert.equal(largeModel.shownHistoryCount, 24);
assert.equal(largeModel.historyGroups.flatMap((group) => group.records).length, 24);
assert.ok(largeModel.attention.length > 0 && largeModel.attention.length <= 3, "Needs attention must be useful and bounded.");
assert.ok(largeModel.attention.every((item) => item.reason.length > 10), "Every attention item must state why it appears.");
assert.ok(largeModel.overview.length >= 1 && largeModel.overview.length <= 4, "Overview cards must hide unsupported states instead of rendering empty placeholders.");
assert.equal(largeModel.overview.at(-1)?.id, "year", "The factual year summary must remain available.");
const expandedLarge = buildJourneyCommandCenterModel({ user, account: largeAccount, opportunities: selected, now, activeLimit: 100 });
assert.equal(expandedLarge.activeRecords.length, 100);

const migration = auditJourneyProjection(largeAccount, largeModel);
assert.deepEqual(migration, {
  sourceRecords: 600,
  projectedInitialRecords: 30,
  activeRecords: 100,
  historicalRecords: 500,
  unavailableRecords: 0,
  intentionallyDeferredHistory: 476,
});

const searchTarget = selected[599];
const search = buildJourneyCommandCenterModel({ user, account: largeAccount, opportunities: selected, now, query: searchTarget.organization, filter: "history" });
assert.ok(search.historyGroups.flatMap((group) => group.records).some((item) => item.id === searchTarget.id), "Server-side search must find historical records beyond the initial History page.");
assert.ok(search.historyGroups.flatMap((group) => group.records).every((item) => `${item.title} ${item.organization} ${item.latestDetails?.notes ?? ""}`.toLowerCase().includes(searchTarget.organization.toLowerCase())));

const interviews = buildJourneyCommandCenterModel({ user, account: largeAccount, opportunities: selected, now, filter: "interviewing" });
assert.ok(interviews.activeRecords.length > 0 && interviews.activeRecords.every((item) => item.status === "Interview"));
const byOrganization = buildJourneyCommandCenterModel({ user, account: largeAccount, opportunities: selected, now, sort: "organization" });
assert.deepEqual(byOrganization.activeRecords.map((item) => item.organization), [...byOrganization.activeRecords.map((item) => item.organization)].sort((left, right) => left.localeCompare(right)));

const careerOpportunity = opportunities.find((item) => item.type === "Career")!;
const closedPublic = {
  ...careerOpportunity,
  verification_status: "temporarily_closed" as const,
  metadata: { ...careerOpportunity.metadata, deadlineType: "current_cycle_closed" as const, eligibilityRules: { ...careerOpportunity.metadata.eligibilityRules, availability: "closed" as const } },
};
const interviewingRecord = record(closedPublic.id, "Interview", 0);
const independent = buildJourneyCommandCenterModel({ user, account: account([interviewingRecord]), opportunities: [closedPublic], now });
assert.equal(independent.activeRecords[0]?.stageLabel, "Interview received");
assert.equal(independent.activeRecords[0]?.lifecycle?.state, "temporarily_closed");
assert.equal(independent.activeRecords[0]?.status, "Interview", "Public lifecycle must never overwrite student progress.");

const unavailableRecord = record("deleted-opportunity-fixture", "Completed", 700);
const unavailable = buildJourneyCommandCenterModel({ user, account: account([unavailableRecord]), opportunities: [], now, filter: "history" });
assert.equal(unavailable.historyCount, 1);
assert.equal(unavailable.unavailableCount, 1);
assert.equal(unavailable.historyGroups[0]?.records[0]?.title, "Unavailable opportunity");

const privateNoteModel = buildJourneyCommandCenterModel({
  user,
  account: account([record(careerOpportunity.id, "Applying", 1, true)]),
  opportunities: [careerOpportunity],
  now,
});
assert.doesNotMatch(privateNoteModel.activeRecords[0]?.statusDetail ?? "", /Private fixture note/, "Private notes must not appear in collapsed record summaries.");
assert.equal(buildJourneyCommandCenterModel({
  user,
  account: account([record(careerOpportunity.id, "Applying", 1, true)]),
  opportunities: [careerOpportunity],
  now,
  query: "Private fixture note",
}).activeRecords.length, 1, "Server-side private-note search must work without exposing the note as a broad result snippet.");

const componentSource = readFileSync("components/journey-command-center.tsx", "utf8");
const styleSource = readFileSync("components/journey-command-center.module.css", "utf8");
const actionSource = readFileSync("components/journey-command-actions.tsx", "utf8");
const addRouteSource = readFileSync("app/api/journey/add/route.ts", "utf8");
const exportRouteSource = readFileSync("app/api/journey/export/route.ts", "utf8");
assert.match(componentSource, /<main[\s\S]*data-journey-command-center/);
assert.match(componentSource, /aria-label="Journey overview"/);
assert.match(componentSource, /role="search"/);
assert.match(componentSource, /<label htmlFor="journey-search"/);
assert.match(componentSource, /<details[\s\S]*<summary>/);
assert.match(componentSource, /aria-labelledby="active-opportunities-heading"/);
assert.match(componentSource, /Needs attention/);
assert.match(componentSource, /JourneyCommandActions/);
assert.doesNotMatch(componentSource, /draggable=|onDrag/, "Journey must not require drag and drop.");
assert.match(styleSource, /min-height:\s*44px/);
assert.match(styleSource, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
assert.match(styleSource, /@media\s*\(forced-colors:\s*active\)/);
assert.match(styleSource, /@media\s*\(max-width:\s*7\d{2}px\)/);
assert.match(styleSource, /\[data-theme="dark"\]/);
assert.match(actionSource, /\/api\/opportunities\?/);
assert.match(actionSource, /\/api\/journey\/add/);
assert.match(actionSource, /\/api\/journey\/export/);
assert.match(actionSource, /Already in Journey/);
assert.match(addRouteSource, /initialStage/);
assert.match(addRouteSource, /assertSameOrigin/);
assert.match(exportRouteSource, /getSession/);
assert.match(exportRouteSource, /Content-Disposition/);
assert.doesNotMatch(exportRouteSource, /session\.user\.email/, "Journey exports must not expose the account email.");

timings.sort((a, b) => a - b);
const average = timings.reduce((sum, value) => sum + value, 0) / timings.length;
const p95 = timings[Math.ceil(timings.length * 0.95) - 1]!;
const worst = timings.at(-1)!;
assert.ok(p95 < 150, `600-record command-center projection p95 must remain under 150ms; received ${p95.toFixed(2)}ms.`);

console.log(JSON.stringify({
  message: "Journey command-center projection, migration, lifecycle separation, search, and large-data checks passed.",
  migration,
  performance: { averageMs: Number(average.toFixed(2)), p95Ms: Number(p95.toFixed(2)), worstMs: Number(worst.toFixed(2)) },
  attentionItems: largeModel.attention.length,
  initialHistoryRecords: largeModel.shownHistoryCount,
}, null, 2));
