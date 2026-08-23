import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyJourneyProfessionalUpdate, JourneyTransitionError } from "../data/journey-transformations";
import { getJourneyProfessionalActions, journeyProfessionalWorkflows, resolveJourneyProfessionalStage } from "../data/journey-professional";
import type { JourneyMilestoneDetails, TrackedOpportunity } from "../data/student-activity";

function base(id: string): TrackedOpportunity {
  return { id, status: "Saved", savedAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-01T12:00:00.000Z", version: 0, history: [] };
}

const requiredStages = {
  career: ["Saved", "Preparing application", "Application submitted", "Interview received", "Final round interview", "Offer received", "Offer accepted", "Experience underway", "Experience completed", "Not selected", "Withdrawn", "Offer declined", "Archived"],
  scholarship: ["Saved", "Preparing submission", "Application submitted", "Waitlisted", "Finalist", "Awarded", "Funds received", "Not selected", "Withdrawn", "Award declined", "Archived"],
  research: ["Saved", "Contacted lab", "Application submitted", "Waitlisted", "Research interview", "Research position accepted", "Research underway", "Research completed", "Not selected", "Withdrawn", "Position declined", "Archived"],
  competition: ["Saved", "Registered", "Competition entered", "Finalist", "Placed", "Competition won", "Competition completed", "Withdrawn", "Archived"],
  resource: ["Saved", "Resource activated", "Resource completed", "Archived"],
} as const;

const terminalOutcomeIds = new Set(["not_selected", "withdrawn", "declined_offer", "declined_award", "declined_position"]);

for (const [kind, labels] of Object.entries(requiredStages)) {
  const workflow = journeyProfessionalWorkflows[kind as keyof typeof journeyProfessionalWorkflows];
  assert.deepEqual(workflow.stages.map((stage) => stage.label), labels, `${kind} must expose only its professional workflow stages.`);
  let record = base(`professional-${kind}`);
  for (const [index, target] of workflow.stages.filter((stage) => !["saved", "archived"].includes(stage.id) && !terminalOutcomeIds.has(stage.id)).entries()) {
    const actions = getJourneyProfessionalActions(record, workflow);
    assert.equal(actions[0]?.stage?.id, target.id, `${kind} must expose only the next valid milestone.`);
    const details: JourneyMilestoneDetails = index === 0 ? {
      notes: "Student-entered milestone note.",
      milestoneDate: "2026-08-02",
      reminderAt: "2026-08-15T12:00:00.000Z",
      documents: [{ id: `document:${kind}:one`, name: "application.pdf", mimeType: "application/pdf", size: 1200, stored: false }],
      source: "student_reported",
    } : { source: "student_reported" };
    const result = applyJourneyProfessionalUpdate(record, workflow, {
      targetStageId: target.id,
      expectedStatus: record.status,
      expectedVersion: record.version ?? 0,
      idempotencyKey: `journey:${kind}:${index}:record`,
      occurredAt: `2026-08-${String(index + 2).padStart(2, "0")}T12:00:00.000Z`,
      details,
    });
    record = result.record;
    assert.equal(record.professionalStageId, target.id);
    assert.equal(record.status, target.status);
    assert.equal(result.historyRecord.details?.source, "student_reported");
  }
  assert.ok(getJourneyProfessionalActions(record, workflow).every((action) => action.correction), `${kind} completed records may offer corrections but cannot invent another forward milestone.`);
}

const submittedCareer = applyJourneyProfessionalUpdate(base("professional-outcome"), journeyProfessionalWorkflows.career, {
  targetStageId: "application_submitted",
  expectedStatus: "Saved",
  expectedVersion: 0,
  idempotencyKey: "journey:professional:outcome:submitted",
  occurredAt: "2026-08-02T12:00:00.000Z",
}).record;
assert.ok(getJourneyProfessionalActions(submittedCareer, journeyProfessionalWorkflows.career).some((action) => action.id === "not_selected"), "Submitted applications must allow a factual not-selected outcome.");
assert.equal(getJourneyProfessionalActions(base("professional-no-outcome"), journeyProfessionalWorkflows.career).some((action) => action.id === "not_selected"), false, "Saved records must not expose an impossible not-selected outcome.");

const career = journeyProfessionalWorkflows.career;
let active = applyJourneyProfessionalUpdate(base("professional-pause"), career, {
  targetStageId: "preparing_application",
  expectedStatus: "Saved",
  expectedVersion: 0,
  idempotencyKey: "journey:professional:prepare",
  occurredAt: "2026-08-02T12:00:00.000Z",
}).record;
const pause = applyJourneyProfessionalUpdate(active, career, {
  targetStageId: "paused",
  expectedStatus: active.status,
  expectedVersion: active.version ?? 0,
  idempotencyKey: "journey:professional:pause",
  occurredAt: "2026-08-03T12:00:00.000Z",
});
assert.equal(pause.record.status, "Paused");
assert.equal(pause.record.pausedFromProfessionalStageId, "preparing_application");
const resume = applyJourneyProfessionalUpdate(pause.record, career, {
  targetStageId: "resume",
  expectedStatus: "Paused",
  expectedVersion: pause.record.version ?? 0,
  idempotencyKey: "journey:professional:resume",
  occurredAt: "2026-08-04T12:00:00.000Z",
});
assert.equal(resolveJourneyProfessionalStage(resume.record, career).id, "preparing_application");

const duplicate = applyJourneyProfessionalUpdate(active, career, {
  targetStageId: "paused",
  expectedStatus: active.status,
  expectedVersion: active.version ?? 0,
  idempotencyKey: "journey:professional:duplicate",
  occurredAt: "2026-08-03T12:00:00.000Z",
});
assert.equal(applyJourneyProfessionalUpdate(duplicate.record, career, {
  targetStageId: "paused",
  expectedStatus: duplicate.record.status,
  expectedVersion: duplicate.record.version ?? 0,
  idempotencyKey: "journey:professional:duplicate",
  occurredAt: "2026-08-03T12:00:00.000Z",
}).duplicate, true, "Repeated request identifiers must not duplicate Journey events.");

const directOffer = applyJourneyProfessionalUpdate(base("professional-direct-offer"), career, {
  targetStageId: "offer_received",
  expectedStatus: "Saved",
  expectedVersion: 0,
  idempotencyKey: "journey:professional:direct-offer",
  occurredAt: "2026-08-02T12:00:00.000Z",
});
assert.equal(directOffer.record.professionalStageId, "offer_received", "Students must be able to record a factual offer without first entering every intermediate stage.");
const corrected = applyJourneyProfessionalUpdate(directOffer.record, career, {
  targetStageId: "application_submitted",
  expectedStatus: directOffer.record.status,
  expectedVersion: directOffer.record.version ?? 0,
  idempotencyKey: "journey:professional:correction",
  occurredAt: "2026-08-03T12:00:00.000Z",
});
assert.equal(corrected.record.status, "Submitted", "Students must be able to correct an accidentally advanced stage.");
const archived = applyJourneyProfessionalUpdate(corrected.record, career, {
  targetStageId: "archived",
  expectedStatus: corrected.record.status,
  expectedVersion: corrected.record.version ?? 0,
  idempotencyKey: "journey:professional:archive",
  occurredAt: "2026-08-04T12:00:00.000Z",
});
const restored = applyJourneyProfessionalUpdate(archived.record, career, {
  targetStageId: "application_submitted",
  expectedStatus: archived.record.status,
  expectedVersion: archived.record.version ?? 0,
  idempotencyKey: "journey:professional:restore",
  occurredAt: "2026-08-05T12:00:00.000Z",
});
assert.equal(restored.record.status, "Submitted", "Archived records must restore to their prior factual stage.");
assert.throws(() => applyJourneyProfessionalUpdate(base("professional-invalid"), career, {
  targetStageId: "saved",
  expectedStatus: "Saved",
  expectedVersion: 0,
  idempotencyKey: "journey:professional:invalid",
  occurredAt: "2026-08-02T12:00:00.000Z",
}), (error) => error instanceof JourneyTransitionError && error.code === "invalid_transition");

const route = readFileSync("app/api/journey/transition/route.ts", "utf8");
const control = readFileSync("components/journey-timeline-control.tsx", "utf8");
const timeline = readFileSync("components/journey-timeline.tsx", "utf8");
const timelineModel = readFileSync("lib/journey-timeline.ts", "utf8");
for (const requirement of ["assertSameOrigin", "getSession", "expectedVersion", "idempotencyKey", "cleanDetails"]) assert.ok(route.includes(requirement));
for (const status of ["401", "403", "409", "423", "422"]) assert.ok(control.includes(`status === ${status}`));
for (const copy of ["Update Journey", "Student reported", "Private by default", "UnlockED never advances your Journey automatically", "Journey updated", "Choose a different stage"]) assert.ok(control.includes(copy));
assert.ok(timeline.includes("Annual archive") && timelineModel.includes('"Updated by you"'));
assert.doesNotMatch(control, /Update status|<select|confetti|\bXP\b|streak/i);

const start = performance.now();
for (let index = 0; index < 20_000; index += 1) getJourneyProfessionalActions(index % 2 ? active : pause.record, career);
const duration = performance.now() - start;
assert.ok(duration < 100, `Professional stage resolution must stay inexpensive; received ${duration.toFixed(2)}ms.`);

console.log(JSON.stringify({
  message: "Journey professional achievement checks passed.",
  workflows: Object.fromEntries(Object.entries(journeyProfessionalWorkflows).map(([key, workflow]) => [key, workflow.stages.length])),
  stageResolutionMs: Number(duration.toFixed(2)),
  studentReportedMetadata: true,
  idempotency: true,
}, null, 2));
