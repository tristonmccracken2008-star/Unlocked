import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { accountSyncPreservesJourneyState, applyJourneyTransition, getJourneyTransitionActions, getPrimaryJourneyTransition, JourneyTransitionError } from "../data/journey-transformations";
import { buildPathprint, createOpenLineMotionPlan, createPathGeometry, createPublicPathprint } from "../data/open-line";
import { opportunities } from "../data/opportunities";
import type { JourneyProgressTransition, OpportunityTrackerStatus, TrackedOpportunity } from "../data/student-activity";

const opportunity = opportunities.find((item) => item.category === "Internships") ?? opportunities[0];

const base = (id = opportunity.id): TrackedOpportunity => ({
  id,
  status: "Saved",
  savedAt: "2026-07-01T12:00:00.000Z",
  updatedAt: "2026-07-01T12:00:00.000Z",
  version: 0,
  history: [],
});

let sequence = 0;
function apply(record: TrackedOpportunity, transition: JourneyProgressTransition, occurredAt?: string) {
  sequence += 1;
  return applyJourneyTransition(record, {
    transition,
    expectedStatus: record.status,
    expectedVersion: record.version ?? 0,
    idempotencyKey: `journey:test:${String(sequence).padStart(3, "0")}`,
    occurredAt: occurredAt ?? `2026-07-${String(sequence + 1).padStart(2, "0")}T12:00:00.000Z`,
  });
}

const expectedSequence: Array<[JourneyProgressTransition, OpportunityTrackerStatus]> = [
  ["choose", "Interested"],
  ["start", "Applying"],
  ["submit", "Submitted"],
  ["interview", "Interview"],
  ["accept", "Accepted"],
  ["complete", "Completed"],
];
let record = base();
const records = [record];
for (const [transition, status] of expectedSequence) {
  const primary = getPrimaryJourneyTransition(record);
  assert.equal(primary?.transition, transition, `${record.status} must expose ${transition} as its specific primary action.`);
  const result = apply(record, transition);
  assert.equal(result.record.status, status);
  assert.equal(result.record.version, (record.version ?? 0) + 1);
  assert.equal(result.historyRecord.priorStatus, record.status);
  assert.equal(result.historyRecord.resultingStatus, status);
  record = result.record;
  records.push(record);
}
assert.equal(getPrimaryJourneyTransition(record), undefined, "Completed experiences must not invent a next status action.");

const duplicateRequest = {
  transition: "complete" as const,
  expectedStatus: "Accepted" as const,
  expectedVersion: 5,
  idempotencyKey: record.history!.at(-1)!.id,
  occurredAt: record.updatedAt,
};
const duplicate = applyJourneyTransition(record, duplicateRequest);
assert.equal(duplicate.duplicate, true, "A repeated idempotency key must not create another Path event.");
assert.equal(duplicate.record.history?.length, record.history?.length);

assert.throws(() => applyJourneyTransition(base(), {
  transition: "complete",
  expectedStatus: "Saved",
  expectedVersion: 0,
  idempotencyKey: "journey:invalid:001",
  occurredAt: "2026-07-02T12:00:00.000Z",
}), (error) => error instanceof JourneyTransitionError && error.code === "invalid_transition");
assert.throws(() => applyJourneyTransition(base(), {
  transition: "choose",
  expectedStatus: "Saved",
  expectedVersion: 1,
  idempotencyKey: "journey:stale:001",
  occurredAt: "2026-07-02T12:00:00.000Z",
}), (error) => error instanceof JourneyTransitionError && error.code === "stale_state");

let pausable = apply(base("pause-test"), "choose").record;
pausable = apply(pausable, "start").record;
const paused = apply(pausable, "pause").record;
assert.equal(paused.status, "Paused");
assert.equal(paused.pausedFrom, "Applying");
assert.deepEqual(getJourneyTransitionActions(paused).map((action) => action.transition), ["resume", "close"]);
const resumed = apply(paused, "resume").record;
assert.equal(resumed.status, "Applying");
assert.equal(resumed.pausedFrom, undefined);
const closed = apply(resumed, "close").record;
assert.equal(closed.status, "Rejected");
assert.equal(getJourneyTransitionActions(closed).length, 0, "A closed opportunity cannot jump directly to acceptance.");
assert.equal(accountSyncPreservesJourneyState(undefined, base("new-saved")), true, "Account sync may create the initial Saved record.");
assert.equal(accountSyncPreservesJourneyState(base(), { ...base(), status: "Completed" }), false, "Generic account sync must not bypass Journey transition validity.");
assert.equal(accountSyncPreservesJourneyState(pausable, { ...pausable, version: (pausable.version ?? 0) + 1 }), false, "Generic account sync must not forge transition versions.");

function pathFor(userId: string, current: TrackedOpportunity, second?: TrackedOpportunity) {
  const tracked = { [current.id]: current, ...(second ? { [second.id]: second } : {}) };
  return buildPathprint({
    userId,
    activity: { viewed: [], saved: Object.keys(tracked), claimed: [], tracked },
    opportunities: second ? [opportunity, { ...opportunity, id: second.id, title: "Second Internship" }] : [opportunity],
    generatedAt: "2026-08-01T12:00:00.000Z",
  });
}

const canonical = pathFor("journey-user-one", record);
assert.deepEqual(canonical.events.map((event) => event.kind), ["explored", "chosen", "active", "submitted", "validated", "accepted", "completed"]);
assert.match(canonical.events.find((event) => event.kind === "submitted")?.narrative ?? "", /first internship application/i);
assert.match(canonical.events.find((event) => event.kind === "validated")?.whatChanged ?? "", /outside UnlockED/i);
assert.match(canonical.events.find((event) => event.kind === "completed")?.whatChanged ?? "", /evidence/i);

let second = base("journey-transform-second");
second = apply(second, "choose", "2026-08-02T12:00:00.000Z").record;
second = apply(second, "start", "2026-08-03T12:00:00.000Z").record;
second = apply(second, "submit", "2026-08-04T12:00:00.000Z").record;
second = apply(second, "interview", "2026-08-05T12:00:00.000Z").record;
const repeated = pathFor("journey-user-one", record, second);
const submissionNarratives = repeated.events.filter((event) => event.kind === "submitted").map((event) => event.narrative);
assert.match(submissionNarratives[0], /first internship application/i);
assert.match(submissionNarratives[1], /another internship application/i);
const interviewNarratives = repeated.events.filter((event) => event.kind === "validated").map((event) => event.narrative);
assert.ok(interviewNarratives.some((copy) => /Another internship application/i.test(copy)), "Repeated interviews must receive restrained repeated-event copy.");

const pausedPath = pathFor("pause-user", paused);
const resumedPath = pathFor("pause-user", resumed);
assert.ok(pausedPath.events.some((event) => event.kind === "paused"));
assert.ok(resumedPath.events.some((event) => event.kind === "active" && /returned/i.test(event.narrative)), "Resume must create a canonical reactivation event.");
const closedPath = pathFor("pause-user", closed);
assert.match(closedPath.events.at(-1)?.narrative ?? "", /broader direction remains open/i);

const publicProjection = createPublicPathprint(canonical);
assert.ok(publicProjection.events.every((event) => ["submitted", "validated", "accepted", "completed"].includes(event.kind)), "Public Pathprints must not expose private choose/start/pause activity.");
assert.notEqual(pathFor("journey-user-one", record).signature, pathFor("journey-user-two", record).signature, "Account-scoped Pathprints must remain isolated.");

const expectedMotion = [
  "direction_chosen",
  "application_started",
  "application_submitted",
  "validation_received",
  "opportunity_accepted",
  "experience_completed",
] as const;
for (let index = 1; index < records.length; index += 1) {
  const before = createPathGeometry(pathFor("motion-user", records[index - 1]), { mode: "desktop" });
  const after = createPathGeometry(pathFor("motion-user", records[index]), { mode: "desktop" });
  const full = createOpenLineMotionPlan(before, after, { cause: "meaningful_update", preference: "full" });
  assert.equal(full.transitionKind, expectedMotion[index - 1]);
  const reduced = createOpenLineMotionPlan(before, after, { cause: "meaningful_update", preference: "reduced" });
  assert.ok(reduced.phases.filter((phase) => phase.durationMs > 0).every((phase) => phase.durationMs <= 100), "Reduced motion phases must remain brief.");
  const none = createOpenLineMotionPlan(before, after, { cause: "meaningful_update", preference: "none" });
  assert.equal(none.totalDurationMs, 0, "No-motion mode must remain static.");
}

const route = readFileSync("app/api/journey/transition/route.ts", "utf8");
const control = readFileSync("components/journey-transition-control.tsx", "utf8");
const service = readFileSync("lib/journey-transition-service.ts", "utf8");
for (const requirement of ["assertSameOrigin", "getSession", "withSecurityLock", "expectedVersion", "idempotencyKey"]) {
  assert.ok(route.includes(requirement) || service.includes(requirement), `Journey mutations must preserve ${requirement}.`);
}
for (const status of ["401", "403", "409", "423", "422"]) assert.ok(control.includes(`status === ${status}`), `Client recovery must distinguish HTTP ${status}.`);
assert.ok(control.includes('aria-live="polite"') && control.includes('role="alert"'), "Status changes and errors must be announced accessibly.");
assert.ok(control.includes("accountSessionEvent") && control.includes("controllerRef.current?.abort"), "Account changes must abort pending transformations.");
assert.ok(service.includes("moment?.title ?? pathEvent!.title") && service.includes("moment?.body ?? pathEvent!.narrative"), "Routine transitions suppressed from editorial history must still return their canonical Path event narrative.");
assert.ok(service.includes("freshMoment ?? (pathEvent ? undefined : currentMoments.at(-1))"), "A fresh routine Path event cannot be replaced by an unrelated older editorial moment.");

const performanceStart = performance.now();
for (let index = 0; index < 2_000; index += 1) getJourneyTransitionActions(index % 2 ? pausable : paused);
const duration = performance.now() - performanceStart;
assert.ok(duration < 50, `Transition validity must remain inexpensive; received ${duration.toFixed(2)}ms.`);

console.log(JSON.stringify({
  message: "Journey transformation checks passed.",
  transitionSequence: expectedSequence.map(([transition]) => transition),
  canonicalEventCount: canonical.events.length,
  repeatedEventCount: repeated.events.length,
  validityLookupMs: Number(duration.toFixed(3)),
}, null, 2));
