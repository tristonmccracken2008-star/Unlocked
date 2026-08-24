import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

process.env.AUTH_SECRET ||= "application-materials-test-secret-with-thirty-two-bytes";
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
Reflect.set(process.env, "NODE_ENV", "test");

const { opportunities } = await import("../data/opportunities");
const { defaultBillingRecord } = await import("../lib/billing");
const { applicationMaterialTypeLabels, emptyApplicationMaterialStore } = await import("../data/application-materials");
const { buildApplicationMaterialsModel, materialTypeForRequirement, projectApplicationMaterialReadiness } = await import("../lib/application-materials");
const { trustedApplicationRequirements } = await import("../lib/application-workspace");
const { mergeAccountData, readAccountData, updateAccountBilling, upsertUser } = await import("../lib/auth-store");
const { updateApplicationMaterials } = await import("../lib/application-material-service");

assert.equal(process.env.KV_REST_API_URL, undefined, "Materials checks must never use configured production storage.");
const base = opportunities.find((item) => trustedApplicationRequirements(item).some((requirement) => materialTypeForRequirement(requirement)));
assert.ok(base, "Materials checks require an official opportunity with a verified reusable-material requirement.");

for (const [requirement, expected] of [
  ["Current resume or CV", "resume"],
  ["Official or unofficial transcript", "transcript"],
  ["Personal statement", "personal_statement"],
  ["Letter of recommendation", "recommendation"],
  ["Writing sample", "writing_sample"],
  ["Application form", null],
] as const) assert.equal(materialTypeForRequirement(requirement), expected, `Unexpected canonical material mapping for ${requirement}`);

const now = "2026-08-24T12:00:00.000Z";
const synthetic = (id: string, title: string, requirements: string[]) => ({
  ...base!,
  id,
  title,
  metadata: { ...base!.metadata, applicationRequirements: requirements },
});
const nasa = synthetic("materials-nasa", "NASA Internship", ["Resume", "Transcript"]);
const doe = synthetic("materials-doe", "DOE Research", ["Resume", "Transcript"]);
const goldwater = synthetic("materials-goldwater", "Goldwater Scholarship", ["Resume", "Transcript", "Essay", "Letter of recommendation"]);
const tracker = Object.fromEntries([nasa, doe, goldwater].map((item) => [item.id, { id: item.id, status: "Applying" as const, savedAt: now, updatedAt: now, version: 1, history: [] }]));
const store = {
  records: {
    "material:resume": { id: "material:resume", type: "resume" as const, title: "General Resume", versionLabel: "2027", status: "ready" as const, contexts: ["general" as const], preferred: true, createdAt: now, updatedAt: now, version: 0 },
    "material:transcript": { id: "material:transcript", type: "transcript" as const, title: "Unofficial Transcript", status: "ready" as const, contexts: ["general" as const], preferred: true, createdAt: now, updatedAt: now, version: 0 },
  },
  associations: {},
  version: 2,
  updatedAt: now,
};
const account = { profile: null, onboardingComplete: true, billing: defaultBillingRecord(), activity: { viewed: [], saved: Object.keys(tracker), claimed: [], tracked: tracker }, savedOpportunities: [], tracker, preferences: null, journeyProgress: {}, applicationWorkspaces: {}, applicationMaterials: store, advisor: null, referrals: null, updatedAt: now };
const threeApplication = buildApplicationMaterialsModel({ account, opportunities: [nasa, doe, goldwater] });
assert.equal(threeApplication.recurringRequirements.find((item) => item.type === "resume")?.applicationCount, 3);
assert.equal(threeApplication.recurringRequirements.find((item) => item.type === "transcript")?.applicationCount, 3);
assert.deepEqual(threeApplication.recurringRequirements.filter((item) => !item.available).map((item) => item.type).sort(), ["essay", "recommendation"]);
assert.equal(threeApplication.applications.find((item) => item.opportunityId === goldwater.id)?.readiness.summary, "2 of 4 required materials available");

const changed = synthetic("materials-nasa", "NASA Internship", ["Resume", "Transcript", "Writing sample"]);
assert.equal(projectApplicationMaterialReadiness({ opportunity: changed, store }).missingCount, 1, "A newly verified material requirement must update readiness without changing stored materials.");

const user = await upsertUser({ googleSub: "materials-owner", email: "materials-owner@example.test", name: "Materials Owner" });
const realTracked = { id: base!.id, status: "Applying" as const, savedAt: now, updatedAt: now, version: 1, history: [] };
await mergeAccountData(user.id, { onboardingComplete: true, firstLaunchComplete: true, activity: { viewed: [], saved: [base!.id], claimed: [], tracked: { [base!.id]: realTracked } }, savedOpportunities: [{ opportunityId: base!.id, savedAt: now }], tracker: { [base!.id]: realTracked } });
const mappedRequirement = trustedApplicationRequirements(base!).find((requirement) => materialTypeForRequirement(requirement))!;
const type = materialTypeForRequirement(mappedRequirement)!;
const first = await updateApplicationMaterials(user, { action: "create", expectedVersion: 0, idempotencyKey: "materials:test:first-version", type, title: `${applicationMaterialTypeLabels[type]} General`, status: "ready", contexts: ["general"] });
const duplicate = await updateApplicationMaterials(user, { action: "create", expectedVersion: 0, idempotencyKey: "materials:test:first-version", type, title: `${applicationMaterialTypeLabels[type]} General`, status: "ready", contexts: ["general"] });
assert.equal(duplicate.duplicate, true, "Repeated material creation must remain idempotent.");
const second = await updateApplicationMaterials(user, { action: "create", expectedVersion: 1, idempotencyKey: "materials:test:specialized-version", type, title: `${applicationMaterialTypeLabels[type]} Research`, versionLabel: "v2", status: "ready", contexts: ["research"] });
assert.equal(second.model.records.filter((record) => record.type === type).length, 2, "A new version must not overwrite an earlier version.");
const selectedMaterial = second.model.records.find((record) => record.title.endsWith("Research"))!;
const associated = await updateApplicationMaterials(user, { action: "associate", expectedVersion: 2, opportunityId: base!.id, requirementType: type, materialId: selectedMaterial.id });
assert.equal(associated.model.applications[0]?.readiness.mappedRequirements.find((item) => item.type === type)?.state, "selected");
const afterAssociation = await readAccountData(user.id);
assert.equal(afterAssociation.tracker[base!.id]?.status, "Applying", "Selecting a material must never imply submission or task completion.");

const archived = await updateApplicationMaterials(user, { action: "archive", expectedVersion: 3, materialId: selectedMaterial.id, expectedMaterialVersion: selectedMaterial.version });
const archivedRecord = archived.model.archived.find((record) => record.id === selectedMaterial.id)!;
assert.ok(archivedRecord, "Archived versions must remain in Materials.");
await updateAccountBilling(user.id, { tier: "pro", status: "active" });
await updateAccountBilling(user.id, { tier: "free", status: "free" });
const afterDowngrade = await readAccountData(user.id);
assert.equal(Object.keys(afterDowngrade.applicationMaterials?.records ?? {}).length, 2, "Downgrading must never remove or hide material ownership.");

const usageCount = archivedRecord.selectedFor.length;
const deleted = await updateApplicationMaterials(user, { action: "delete", expectedVersion: 4, materialId: selectedMaterial.id, expectedMaterialVersion: archivedRecord.version, expectedUsageCount: usageCount });
assert.equal(deleted.model.records.some((record) => record.id === selectedMaterial.id), false);
const deletedAccount = await readAccountData(user.id);
const historical = Object.values(deletedAccount.applicationMaterials?.associations ?? {}).find((association) => association.materialId === selectedMaterial.id);
assert.ok(historical?.materialDeletedAt && historical.materialSnapshot.title.endsWith("Research"), "Deletion must preserve historical application association context.");

const other = await upsertUser({ googleSub: "materials-other", email: "materials-other@example.test", name: "Other Student" });
await assert.rejects(() => updateApplicationMaterials(other, { action: "associate", expectedVersion: 0, opportunityId: base!.id, requirementType: type, materialId: first.model.records[0]!.id }), (error: unknown) => error instanceof Error && error.name === "ApplicationMaterialOwnershipError");

const largeStore = emptyApplicationMaterialStore();
for (let index = 0; index < 200; index += 1) largeStore.records[`material:load-${index}`] = { id: `material:load-${index}`, type: index % 2 ? "resume" : "transcript", title: `Material ${index}`, status: index % 3 ? "ready" : "draft", contexts: ["general"], preferred: index < 2, createdAt: now, updatedAt: now, version: 0 };
const loadOpportunities = Array.from({ length: 20 }, (_, index) => synthetic(`materials-load-${index}`, `Application ${index}`, ["Resume", "Transcript", index % 2 ? "Essay" : "Application form"]));
const loadTracker = Object.fromEntries(loadOpportunities.map((item) => [item.id, { id: item.id, status: "Applying" as const, savedAt: now, updatedAt: now, version: 1, history: [] }]));
const samples: number[] = [];
for (let run = 0; run < 40; run += 1) {
  const started = performance.now();
  buildApplicationMaterialsModel({ account: { ...account, tracker: loadTracker, activity: { viewed: [], saved: Object.keys(loadTracker), claimed: [], tracked: loadTracker }, applicationMaterials: largeStore }, opportunities: loadOpportunities });
  if (run >= 5) samples.push(performance.now() - started);
}
const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
assert.ok(averageMs < 15, `200 materials and 20 applications must project under 15ms average; received ${averageMs.toFixed(2)}ms.`);

const route = readFileSync("app/api/materials/route.ts", "utf8");
const publicAccount = readFileSync("lib/public-account.ts", "utf8");
const exportRoute = readFileSync("app/api/account/export/route.ts", "utf8");
for (const token of ["assertSameOrigin(request)", "enforceRateLimit", "readBoundedJson", "expectedVersion", "updateApplicationMaterials"]) assert.match(route, new RegExp(token.replace(/[()]/g, "\\$&")));
assert.doesNotMatch(route, /STRIPE|KV_REST_API_TOKEN|fileUrl|publicUrl|upload/i, "The metadata-only endpoint must not expose storage or secret semantics.");
assert.match(publicAccount, /applicationMaterials: undefined/);
assert.match(exportRoute, /materials: data\.applicationMaterials/);

console.log("Application Materials checks passed", {
  mappedRequirementTypes: 10,
  threeApplicationReuse: true,
  versionsPreserved: true,
  historicalIntegrity: true,
  downgradeSafe: true,
  accountIsolation: true,
  averageLargeProjectionMs: Number(averageMs.toFixed(2)),
});
