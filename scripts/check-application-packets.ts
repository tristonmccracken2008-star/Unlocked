import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import type { AccountData } from "../lib/account-types";
import type { TrackedOpportunity } from "../data/student-activity";

const { opportunities } = await import("../data/opportunities");
const { emptyApplicationMaterialStore, materialAssociationId } = await import("../data/application-materials");
const { emptyResumeLabStore } = await import("../data/resume-lab");
const { defaultBillingRecord } = await import("../lib/billing");
const { applicationWorkspaceEligible, materializeApplicationWorkspace, trustedApplicationRequirements } = await import("../lib/application-workspace");
const { projectApplicationPacket } = await import("../lib/application-packet");

const source = opportunities.find((item) => applicationWorkspaceEligible(item) && trustedApplicationRequirements(item).length >= 2);
assert.ok(source, "Packet checks require an application-capable verified opportunity.");
const now = new Date("2026-08-24T12:00:00.000Z");
const iso = now.toISOString();
const opportunity = {
  ...source,
  id: "packet-research-application",
  title: "Packet Research Application",
  application_deadline: "2026-09-12",
  last_verified: "2026-08-20",
  verification_status: "verified" as const,
  metadata: {
    ...source.metadata,
    applicationRequirements: ["Resume", "Transcript"],
    deadlineType: "fixed" as const,
    verification: { ...source.metadata.verification, status: "verified" as const, officialSourceUrl: source.official_source_url, applicationUrlVerified: true, eligibilityVerified: true, deadlineVerified: true, sourceReachable: true, lastVerifiedAt: "2026-08-20" },
  },
};
const record = { id: opportunity.id, status: "Applying" as const, savedAt: iso, updatedAt: iso, version: 2, history: [] };
const workspace = materializeApplicationWorkspace(undefined, opportunity, iso);
workspace.tasks = Object.fromEntries(Object.values(workspace.tasks).map((task) => [task.id, { ...task, completed: true, completedAt: iso }]));
const materials = emptyApplicationMaterialStore();
for (const [type, title] of [["resume", "Research Resume"], ["transcript", "University Transcript"]] as const) {
  const id = `packet-material:${type}`;
  materials.records[id] = { id, type, title, status: "ready", contexts: ["research"], preferred: true, createdAt: iso, updatedAt: iso, version: 0 };
  const associationId = materialAssociationId(opportunity.id, type);
  materials.associations[associationId] = { id: associationId, opportunityId: opportunity.id, requirementType: type, requirementTitle: type === "resume" ? "Resume" : "Transcript", materialId: id, materialSnapshot: { type, title }, selectedAt: iso, updatedAt: iso, version: 0 };
}
const resumes = emptyResumeLabStore();
resumes.resumes["packet-resume"] = { id: "packet-resume", materialId: "packet-material:resume", title: "Research Resume", kind: "targeted", target: { type: "opportunity", id: opportunity.id, label: opportunity.title }, contact: {}, sections: [], skills: [], template: "classic", createdAt: iso, updatedAt: iso, version: 0 };

function accountFor(tracked: TrackedOpportunity = record): AccountData {
  return { profile: null, onboardingComplete: true, firstLaunchComplete: true, billing: defaultBillingRecord(), activity: { viewed: [], saved: [tracked.id], claimed: [], tracked: { [tracked.id]: tracked } }, savedOpportunities: [], tracker: { [tracked.id]: tracked }, preferences: null, journeyProgress: {}, applicationWorkspaces: { [tracked.id]: workspace }, applicationMaterials: materials, resumeLab: resumes, accomplishments: {}, pathPreferences: {}, guidance: {}, advisor: null, referrals: null, updatedAt: iso };
}

const ready = projectApplicationPacket({ account: accountFor(), opportunities: [opportunity], opportunityId: opportunity.id, now });
assert.ok(ready);
assert.equal(ready.status, "known_materials_assembled");
assert.equal(ready.verifiedRequirementCount, 2);
assert.equal(ready.assembledRequirementCount, 2);
assert.equal(ready.nextAction.kind, "final_review");
assert.equal(ready.resume?.targetState, "current_opportunity");
assert.match(ready.statusDetail, /does not confirm provider submission or competitiveness/i);

const reusedAccount = accountFor();
reusedAccount.tracker!["packet-other-application"] = { ...record, id: "packet-other-application" };
reusedAccount.activity!.tracked!["packet-other-application"] = reusedAccount.tracker!["packet-other-application"]!;
const reusedAssociationId = materialAssociationId("packet-other-application", "resume");
reusedAccount.applicationMaterials!.associations[reusedAssociationId] = { ...materials.associations[materialAssociationId(opportunity.id, "resume")]!, id: reusedAssociationId, opportunityId: "packet-other-application" };
const reused = projectApplicationPacket({ account: reusedAccount, opportunities: [opportunity], opportunityId: opportunity.id, now });
assert.equal(reused?.requirements.find((item) => item.materialType === "resume")?.otherApplicationUseCount, 1, "Packet reuse intelligence must derive exact associations without selecting replacements.");

const missingMaterials = emptyApplicationMaterialStore();
const missing = projectApplicationPacket({ account: { ...accountFor(), applicationMaterials: missingMaterials }, opportunities: [opportunity], opportunityId: opportunity.id, now });
assert.ok(missing);
assert.equal(missing.status, "needs_attention");
assert.equal(missing.nextAction.kind, "select_material");

const draftMaterials = emptyApplicationMaterialStore();
draftMaterials.records["packet-draft-resume"] = { id: "packet-draft-resume", type: "resume", title: "Resume draft", status: "draft", contexts: ["research"], preferred: true, createdAt: iso, updatedAt: iso, version: 0 };
const draft = projectApplicationPacket({ account: { ...accountFor(), applicationMaterials: draftMaterials }, opportunities: [opportunity], opportunityId: opportunity.id, now });
assert.ok(draft);
assert.equal(draft.requirements.find((item) => item.materialType === "resume")?.state, "available_needs_attention", "An unselected draft must not be described as selected.");
assert.equal(draft.nextAction.kind, "review_material");

const unknownOpportunity = { ...opportunity, metadata: { ...opportunity.metadata, applicationRequirements: [], verification: { ...opportunity.metadata.verification, eligibilityVerified: false } } };
const unknown = projectApplicationPacket({ account: { ...accountFor(), applicationWorkspaces: {} }, opportunities: [unknownOpportunity], opportunityId: opportunity.id, now });
assert.ok(unknown);
assert.equal(unknown.status, "requirements_unknown");
assert.equal(unknown.verifiedRequirementCount, 0);
assert.equal(unknown.nextAction.kind, "review_requirements");

const submittedRecord = { ...record, status: "Submitted" as const, version: 3, history: [{ id: "packet-submit-event", transition: "submit" as const, priorStatus: "Applying" as const, resultingStatus: "Submitted" as const, occurredAt: iso }] };
const archivedMaterials = structuredClone(materials);
archivedMaterials.records["packet-material:resume"]!.status = "archived";
const submitted = projectApplicationPacket({ account: { ...accountFor(submittedRecord), applicationMaterials: archivedMaterials }, opportunities: [opportunity], opportunityId: opportunity.id, now });
assert.ok(submitted);
assert.equal(submitted.status, "submitted");
assert.equal(submitted.requirements.find((item) => item.materialType === "resume")?.selectedSnapshot?.title, "Research Resume", "Historical packets must retain the selected snapshot after archival.");
assert.equal(submitted.nextAction.kind, "await_outcome");

for (const terminalStatus of ["Accepted", "Rejected", "Completed"] as const) {
  const terminal = projectApplicationPacket({ account: accountFor({ ...submittedRecord, status: terminalStatus }), opportunities: [opportunity], opportunityId: opportunity.id, now });
  assert.ok(terminal, `${terminalStatus} applications must remain available as historical Packets.`);
  assert.equal(terminal.historical, true);
}

assert.equal(projectApplicationPacket({ account: { ...accountFor(), tracker: {}, activity: { viewed: [], saved: [], claimed: [], tracked: {} } }, opportunities: [opportunity], opportunityId: opportunity.id, now }), null, "An account without the pursued application cannot project another account's Packet.");

const largeOpportunities = Array.from({ length: 100 }, (_, index) => ({ ...opportunity, id: `packet-load-${index}`, title: `Packet ${index}` }));
const largeRecords = Object.fromEntries(largeOpportunities.map((item) => [item.id, { ...record, id: item.id }]));
const largeMaterials = emptyApplicationMaterialStore();
for (let index = 0; index < 500; index += 1) largeMaterials.records[`packet-load-material-${index}`] = { id: `packet-load-material-${index}`, type: index % 2 ? "resume" : "transcript", title: `Material ${index}`, status: "ready", contexts: ["general"], preferred: index < 2, createdAt: iso, updatedAt: iso, version: 0 };
const largeAccount = { ...accountFor(), tracker: largeRecords, activity: { viewed: [], saved: Object.keys(largeRecords), claimed: [], tracked: largeRecords }, applicationWorkspaces: {}, applicationMaterials: largeMaterials } as AccountData;
for (let index = 0; index < 5; index += 1) projectApplicationPacket({ account: largeAccount, opportunities: largeOpportunities, opportunityId: largeOpportunities[50]!.id, now });
const timings: number[] = [];
for (let index = 0; index < 20; index += 1) { const started = performance.now(); projectApplicationPacket({ account: largeAccount, opportunities: largeOpportunities, opportunityId: largeOpportunities[50]!.id, now }); timings.push(performance.now() - started); }
const averageMs = timings.reduce((sum, value) => sum + value, 0) / timings.length;
const p95Ms = [...timings].sort((a, b) => a - b)[Math.ceil(timings.length * .95) - 1]!;
assert.ok(averageMs < 80 && p95Ms < 140, `100-application Packet projection must remain bounded; average ${averageMs.toFixed(2)}ms, p95 ${p95Ms.toFixed(2)}ms.`);

const component = readFileSync("components/application-packet.tsx", "utf8");
const route = readFileSync("app/applications/[applicationId]/page.tsx", "utf8");
const docs = readFileSync("docs/APPLICATION_PACKETS.md", "utf8");
for (const token of ["/api/materials", "/api/journey/application", "/api/journey/transition", "expectedVersion", "idempotencyKey"]) assert.ok(component.includes(token));
assert.match(route, /requireCompletedOnboarding/);
assert.match(route, /trackedIds\.includes\(applicationId\)/);
assert.match(docs, /do not introduce a packet store/i);
assert.doesNotMatch(component, /readiness score|chance of success|competitive score|AI-powered/i);

console.log("Application Packet checks passed", { knownRequirements: ready.verifiedRequirementCount, historicalSnapshot: true, accountIsolation: true, averageMs: Number(averageMs.toFixed(2)), p95Ms: Number(p95Ms.toFixed(2)) });
