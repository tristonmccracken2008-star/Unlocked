import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import type { OpportunityChangeEvent } from "../data/opportunity-changelog-types";
import type { TrackedOpportunity } from "../data/student-activity";

const { opportunities } = await import("../data/opportunities");
const { materialAssociationId, emptyApplicationMaterialStore } = await import("../data/application-materials");
const { defaultBillingRecord } = await import("../lib/billing");
const { createApplicationMaterialProjectionContext } = await import("../lib/application-materials");
const { applicationWorkspaceEligible, materializeApplicationWorkspace, projectApplicationWorkspace, trustedApplicationRequirements } = await import("../lib/application-workspace");
const { buildApplicationsWorkspace } = await import("../lib/applications-workspace");

const source = opportunities.find((item) => applicationWorkspaceEligible(item) && trustedApplicationRequirements(item).length >= 2);
assert.ok(source, "Applications Workspace checks require an application-capable verified catalog record.");
const benefit = opportunities.find((item) => item.type === "Benefit");
assert.ok(benefit && !applicationWorkspaceEligible(benefit), "Benefits must never enter Applications.");

const now = new Date("2026-08-24T12:00:00.000Z");
const iso = now.toISOString();
const synthetic = (id: string, title: string, requirements: string[], deadline = "2026-09-03") => ({
  ...source!,
  id,
  title,
  organization: `${title} Foundation`,
  application_deadline: deadline,
  last_verified: "2026-08-20",
  metadata: {
    ...source!.metadata,
    applicationRequirements: requirements,
    deadlineType: "fixed" as const,
    verification: {
      ...source!.metadata.verification,
      status: "verified" as const,
      officialSourceUrl: source!.official_source_url,
      applicationUrlVerified: true,
      eligibilityVerified: true,
      deadlineVerified: true,
      sourceReachable: true,
      lastVerifiedAt: "2026-08-20",
    },
  },
});
const readyOpportunity = synthetic("applications-ready", "Ready Research", ["Resume", "Transcript"]);
const missingOpportunity = synthetic("applications-missing", "Missing Scholarship", ["Resume", "Essay"], "2026-08-27");
const unknownOpportunity = {
  ...synthetic("applications-unknown", "Unknown Program", []),
  metadata: { ...synthetic("applications-unknown", "Unknown Program", []).metadata, applicationRequirements: [], verification: { ...source!.metadata.verification, status: "verified" as const, eligibilityVerified: false } },
};
const submittedOpportunity = synthetic("applications-submitted", "Submitted Fellowship", ["Resume"]);
const savedOpportunity = synthetic("applications-saved", "Saved Only", ["Resume"]);

const records = {
  [readyOpportunity.id]: { id: readyOpportunity.id, status: "Applying" as const, savedAt: iso, updatedAt: iso, version: 2, history: [] },
  [missingOpportunity.id]: { id: missingOpportunity.id, status: "Applying" as const, savedAt: iso, updatedAt: iso, version: 1, history: [] },
  [unknownOpportunity.id]: { id: unknownOpportunity.id, status: "Interested" as const, savedAt: iso, updatedAt: iso, version: 1, history: [] },
  [submittedOpportunity.id]: { id: submittedOpportunity.id, status: "Submitted" as const, savedAt: iso, updatedAt: iso, version: 3, history: [{ id: "event:submitted", transition: "submit" as const, priorStatus: "Applying" as const, resultingStatus: "Submitted" as const, occurredAt: iso }] },
  [savedOpportunity.id]: { id: savedOpportunity.id, status: "Saved" as const, savedAt: iso, updatedAt: iso, version: 0, history: [] },
};

function completedWorkspace(opportunity: typeof readyOpportunity, record: (typeof records)[keyof typeof records]) {
  const workspace = materializeApplicationWorkspace(undefined, opportunity, iso);
  workspace.tasks = Object.fromEntries(Object.values(workspace.tasks).map((task) => [task.id, { ...task, completed: true, completedAt: iso }]));
  return workspace;
}

const materialStore = emptyApplicationMaterialStore();
for (const [id, type, title] of [["material:resume", "resume", "General Resume"], ["material:transcript", "transcript", "Unofficial Transcript"]] as const) {
  materialStore.records[id] = { id, type, title, status: "ready", contexts: ["general"], preferred: true, createdAt: iso, updatedAt: iso, version: 0 };
}
for (const type of ["resume", "transcript"] as const) {
  const materialId = `material:${type}`;
  const id = materialAssociationId(readyOpportunity.id, type);
  materialStore.associations[id] = { id, opportunityId: readyOpportunity.id, requirementType: type, requirementTitle: type === "resume" ? "Resume" : "Transcript", materialId, materialSnapshot: { type, title: materialStore.records[materialId]!.title }, selectedAt: iso, updatedAt: iso, version: 0 };
}
const account = {
  profile: null,
  onboardingComplete: true,
  billing: defaultBillingRecord(),
  activity: { viewed: [], saved: Object.keys(records), claimed: [], tracked: records },
  savedOpportunities: [],
  tracker: records,
  preferences: null,
  journeyProgress: {},
  applicationWorkspaces: { [readyOpportunity.id]: completedWorkspace(readyOpportunity, records[readyOpportunity.id]!) },
  applicationMaterials: materialStore,
  advisor: null,
  referrals: null,
  updatedAt: iso,
};

const model = buildApplicationsWorkspace({ account, opportunities: [readyOpportunity, missingOpportunity, unknownOpportunity, submittedOpportunity, savedOpportunity, benefit!], now });
assert.equal(model.counts.active, 3);
assert.equal(model.counts.submitted, 1);
assert.equal(model.counts.ready, 1);
assert.equal(model.counts.needsAttention, 1);
assert.equal(model.counts.unknown, 1);
assert.equal(model.applications.some((item) => item.id === savedOpportunity.id), false, "Saved-only opportunities must remain in Journey until active pursuit begins.");
assert.equal(model.applications.some((item) => item.id === benefit!.id), false, "Non-application resources must remain excluded.");
assert.equal(model.applications.find((item) => item.id === readyOpportunity.id)?.state, "ready");
assert.equal(model.applications.find((item) => item.id === readyOpportunity.id)?.nextAction.kind, "mark_applied");
assert.equal(model.applications.find((item) => item.id === unknownOpportunity.id)?.state, "requirements_unknown", "Unknown requirements must never project as Ready.");
assert.equal(model.applications.find((item) => item.id === submittedOpportunity.id)?.attention.length, 0, "Submitted applications must leave preparation attention.");
assert.ok(model.applications.find((item) => item.id === missingOpportunity.id)?.attention.some((item) => item.kind === "material_missing"));
assert.ok(model.applications.find((item) => item.id === missingOpportunity.id)?.attention.some((item) => item.kind === "deadline"));
assert.ok(model.deadlineClusters.length >= 1, "Nearby verified deadlines should produce a factual cluster.");
assert.equal(account.tracker[readyOpportunity.id]!.status, "Applying", "Readiness projection must never imply submission.");

const changed = synthetic("applications-ready", "Ready Research", ["Resume", "Transcript", "Essay"]);
const changedModel = buildApplicationsWorkspace({ account, opportunities: [changed], now });
assert.equal(changedModel.applications[0]?.state, "needs_attention", "A new verified requirement must invalidate prior readiness when uncovered.");

const unindexedProjection = projectApplicationWorkspace({ opportunity: readyOpportunity, record: records[readyOpportunity.id]!, workspace: account.applicationWorkspaces[readyOpportunity.id], materials: materialStore, now });
const indexedProjection = projectApplicationWorkspace({ opportunity: readyOpportunity, record: records[readyOpportunity.id]!, workspace: account.applicationWorkspaces[readyOpportunity.id], materials: materialStore, materialContext: createApplicationMaterialProjectionContext(materialStore), now });
assert.deepEqual(indexedProjection, unindexedProjection, "Request-scoped Material indexes must preserve the exact application projection.");

const largeOpportunities = Array.from({ length: 25 }, (_, index) => synthetic(`applications-load-${index}`, `Application ${index}`, ["Resume", "Transcript"], `2026-09-${String((index % 20) + 1).padStart(2, "0")}`));
const largeRecords = Object.fromEntries(largeOpportunities.map((item) => [item.id, { id: item.id, status: "Applying" as const, savedAt: iso, updatedAt: iso, version: 1, history: [] }]));
const largeStore = emptyApplicationMaterialStore();
for (let index = 0; index < 200; index += 1) largeStore.records[`material:${index}`] = { id: `material:${index}`, type: index % 2 ? "resume" : "transcript", title: `Material ${index}`, status: index % 3 ? "ready" : "needs_update", contexts: ["general"], preferred: index < 2, createdAt: iso, updatedAt: iso, version: 0 };

function statistics(samples: number[]) {
  const sorted = [...samples].sort((left, right) => left - right);
  const trim = Math.max(1, Math.floor(sorted.length * 0.1));
  const trimmed = sorted.slice(trim, -trim);
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    average: average(sorted),
    median: sorted[Math.floor(sorted.length / 2)]!,
    trimmedAverage: average(trimmed),
    p95: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!,
    maximum: sorted.at(-1)!,
  };
}

function benchmarkProjection(opportunityItems: typeof largeOpportunities, store = materialStore, measuredRuns = 30, sourceRecords: Record<string, TrackedOpportunity> = largeRecords) {
  const ids = new Set(opportunityItems.map((item) => item.id));
  const tracked = Object.fromEntries(Object.entries(sourceRecords).filter(([id]) => ids.has(id)));
  const fixtureAccount = { ...account, tracker: tracked, activity: { viewed: [], saved: Object.keys(tracked), claimed: [], tracked }, applicationWorkspaces: {}, applicationMaterials: store };
  const project = () => buildApplicationsWorkspace({ account: fixtureAccount, opportunities: opportunityItems, now });
  const coldStarted = performance.now();
  const coldModel = project();
  const cold = performance.now() - coldStarted;
  for (let run = 0; run < 10; run += 1) project();
  const timings: number[] = [];
  for (let run = 0; run < measuredRuns; run += 1) {
    const started = performance.now();
    const result = project();
    const duration = performance.now() - started;
    assert.deepEqual(result, coldModel, "Repeated projections must remain deterministic.");
    timings.push(duration);
  }
  return { cold, ...statistics(timings) };
}

const historyRecords = Object.fromEntries(Object.entries(largeRecords).map(([id, record]) => [id, {
  ...record,
  history: Array.from({ length: 100 }, (_, index) => ({ id: `${id}:history:${index}`, transition: "choose" as const, priorStatus: "Saved" as const, resultingStatus: "Interested" as const, occurredAt: iso })),
}]));
const changeHeavyOpportunities = largeOpportunities.map((opportunity) => {
  const event = {
    id: `${opportunity.id}:requirements-change`, opportunityId: opportunity.id, identityId: opportunity.id, cycleId: "2026", field: "requirements", changeType: "requirements_changed", previousValue: "Resume", newValue: "Resume · Transcript", detectedAt: iso, effectiveAt: iso, source: "manual_review", confidence: "confirmed", importance: "important", userRelevant: true, notificationEligible: true, calendarImpact: false, workspaceImpact: true, idempotencyKey: `${opportunity.id}:requirements-change`,
  } satisfies OpportunityChangeEvent;
  return { ...opportunity, metadata: { ...opportunity.metadata, changelog: [event] } };
});

const scaling = {
  zero: benchmarkProjection([]),
  one: benchmarkProjection(largeOpportunities.slice(0, 1)),
  five: benchmarkProjection(largeOpportunities.slice(0, 5)),
  ten: benchmarkProjection(largeOpportunities.slice(0, 10)),
  heavy: benchmarkProjection(largeOpportunities, largeStore, 50),
  largeHistory: benchmarkProjection(largeOpportunities, largeStore, 20, historyRecords),
  requirementChanges: benchmarkProjection(changeHeavyOpportunities, largeStore, 20),
};
assert.ok(scaling.heavy.trimmedAverage < 25, `25 applications and 200 materials must project under 25ms trimmed average; received ${scaling.heavy.trimmedAverage.toFixed(2)}ms.`);
assert.ok(scaling.heavy.p95 < 35, `25 applications and 200 materials must remain under 35ms p95; received ${scaling.heavy.p95.toFixed(2)}ms.`);
assert.ok(scaling.heavy.maximum < 100, `25 applications and 200 materials exceeded the 100ms catastrophic ceiling; received ${scaling.heavy.maximum.toFixed(2)}ms.`);
assert.ok(scaling.heavy.cold < 150, `Cold 25-application projection exceeded the 150ms ceiling; received ${scaling.heavy.cold.toFixed(2)}ms.`);
assert.ok(scaling.largeHistory.p95 < 35, `Large Journey histories must remain under 35ms p95; received ${scaling.largeHistory.p95.toFixed(2)}ms.`);
assert.ok(scaling.requirementChanges.p95 < 35, `Requirement-change-heavy projections must remain under 35ms p95; received ${scaling.requirementChanges.p95.toFixed(2)}ms.`);

const route = readFileSync("app/applications/page.tsx", "utf8");
const component = readFileSync("components/applications-workspace.tsx", "utf8");
const header = readFileSync("components/header.tsx", "utf8");
const docs = readFileSync("docs/APPLICATIONS_WORKSPACE.md", "utf8");
assert.match(route, /requireCompletedOnboarding/);
assert.match(route, /buildApplicationsWorkspace/);
assert.match(component, /Open packet/);
assert.doesNotMatch(component, /\/api\/journey\/application|\/api\/materials|\/api\/journey\/transition/, "The cross-application overview must delegate mutations to the one-application Packet.");
assert.doesNotMatch(component, /upload|application score|productivity score|confetti/i);
assert.match(header, /href: "\/applications"/);
assert.match(docs, /stores no application workspace of its own/i);
assert.match(docs, /never projected as Ready/i);

console.log("Applications Workspace checks passed", { activeSemantics: true, readiness: true, unknownRequirements: true, submittedHandoff: true, nonApplicationsExcluded: true, requirementChange: true, deadlineClusters: true, projectionOutputStable: true, performanceMs: Object.fromEntries(Object.entries(scaling).map(([key, value]) => [key, Object.fromEntries(Object.entries(value).map(([metric, number]) => [metric, Number(number.toFixed(2))]))])) });
