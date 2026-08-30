import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import duplicateData from "../data/db/opportunity-duplicates.json";
import { buildCatalogReliabilityReport, canonicalizeCatalogUrl, catalogHealthStates, classifyCatalogRecord, normalizeCatalogOrganization } from "../data/catalog-reliability";
import { evaluateOpportunityEligibility } from "../data/opportunity-eligibility";
import { opportunities, type Opportunity } from "../data/opportunities";

const now = new Date("2026-08-30T12:00:00.000Z");
const baseline = opportunities.find((opportunity) => classifyCatalogRecord(opportunity, { now }).recommendationSafe);
assert.ok(baseline, "A current recommendation-safe fixture must exist.");

function fixture(id: string, mutate: (copy: Opportunity) => void = () => undefined) {
  const copy = structuredClone(baseline) as Opportunity;
  copy.id = id;
  copy.metadata.lifecycle!.identity.identityId = id;
  copy.metadata.lifecycle!.cycle.cycleId = `${id}:2026`;
  copy.metadata.acquisition = { batchId: "catalog-reliability-fixture", acquiredAt: "2026-08-01", reviewCadenceDays: 180, nextReviewAt: "2027-02-01", freshnessModel: "fixed_cycle" };
  mutate(copy);
  return copy;
}

assert.equal(canonicalizeCatalogUrl("https://www.example.org/program/?utm_source=test#apply"), "https://example.org/program", "Canonical URLs must discard tracking and fragments.");
assert.equal(canonicalizeCatalogUrl("http://example.org/program"), null, "Non-HTTPS URLs must be rejected.");
assert.equal(normalizeCatalogOrganization("U.S. Dept. of Energy"), normalizeCatalogOrganization("United States Department of Energy"));

const safe = fixture("fixture--safe");
assert.equal(classifyCatalogRecord(safe, { now }).state, "SAFE");
assert.equal(classifyCatalogRecord(safe, { now }).cycleId, "fixture--safe:2026");

const stale = fixture("fixture--stale", (copy) => { copy.metadata.acquisition!.nextReviewAt = "2026-01-01"; });
assert.equal(classifyCatalogRecord(stale, { now }).state, "STALE");
assert.equal(classifyCatalogRecord(stale, { now }).queueTier, "recertify_stale");

const unknownLifecycle = fixture("fixture--unknown-lifecycle", (copy) => {
  copy.metadata.lifecycle!.state = "unknown";
  copy.metadata.lifecycle!.confidence = "unknown";
  copy.metadata.lifecycle!.reason = "insufficient_current_evidence";
});
assert.equal(classifyCatalogRecord(unknownLifecycle, { now }).recommendationSafe, false);
assert.ok(classifyCatalogRecord(unknownLifecycle, { now }).blockers.includes("lifecycle_unknown"));

const oldDeadline = fixture("fixture--old-deadline", (copy) => {
  copy.application_deadline = "2025-02-01";
  copy.deadline = "2025-02-01";
  copy.metadata.lifecycle!.finalDeadline = { kind: "final_deadline", sourceValue: "2025-02-01", normalizedValue: "2025-02-01", precision: "date", estimated: false, verifiedAt: "2025-01-01", sourceUrl: copy.official_source_url };
});
assert.equal(classifyCatalogRecord(oldDeadline, { now }).recommendationSafe, false, "Past cycles must never remain recommendation-safe.");

const missingCitizenship = fixture("fixture--missing-citizenship", (copy) => {
  copy.metadata.eligibilityRules!.citizenshipStatuses = [];
  copy.metadata.eligibilityRules!.citizenship = "unknown";
  if (copy.metadata.eligibilityRules!.fieldEvidence) delete copy.metadata.eligibilityRules!.fieldEvidence.citizenship;
  copy.metadata.sourceReferences = copy.metadata.sourceReferences?.map((source) => ({ ...source, supports: source.supports.filter((field) => field !== "citizenship") }));
});
assert.equal(classifyCatalogRecord(missingCitizenship, { now }).recommendationSafe, false);
assert.ok(classifyCatalogRecord(missingCitizenship, { now }).blockers.includes("unknown_citizenship"));

const thirdPartyOnly = fixture("fixture--third-party", (copy) => {
  copy.metadata.verification!.officialSourceUrl = "https://different.example.org/program";
  copy.metadata.sourceReferences = [];
});
assert.equal(classifyCatalogRecord(thirdPartyOnly, { now }).sourceTier, "discovery_only");

const duplicate = fixture("fixture--duplicate");
assert.equal(classifyCatalogRecord(duplicate, { now, duplicateGroups: [{ canonicalId: safe.id, ids: [safe.id, duplicate.id] }] }).state, "DUPLICATE_CANDIDATE");

const rolling = fixture("fixture--rolling", (copy) => {
  copy.application_deadline = null;
  copy.deadline = null;
  copy.metadata.deadlineType = "rolling";
  copy.metadata.lifecycle!.state = "rolling";
  copy.metadata.lifecycle!.reason = "rolling_confirmed";
  copy.metadata.lifecycle!.recurrence = { type: "rolling_cohort", confidence: "confirmed", officialStatement: "Applications are reviewed on a rolling basis." };
  delete copy.metadata.lifecycle!.finalDeadline;
});
assert.equal(classifyCatalogRecord(rolling, { now }).lifecycle, "rolling");

const upcoming = fixture("fixture--upcoming", (copy) => {
  copy.metadata.lifecycle!.state = "upcoming";
  copy.metadata.lifecycle!.reason = "opening_date_future";
  copy.metadata.lifecycle!.openingDate = { kind: "application_open", sourceValue: "2026-10-01", normalizedValue: "2026-10-01", precision: "date", estimated: false, verifiedAt: "2026-08-30", sourceUrl: copy.official_source_url };
});
assert.equal(classifyCatalogRecord(upcoming, { now }).recommendationSafe, false, "Future-opening cycles remain outside current recommendations.");

const graduateOnly = fixture("fixture--graduate", (copy) => {
  copy.academic_years = ["Graduate student"];
  copy.metadata.eligibilityRules!.educationLevels = ["graduate"];
  copy.metadata.eligibilityRules!.classYears = ["Graduate student"];
});
assert.equal(evaluateOpportunityEligibility(graduateOnly, { degreeLevel: "undergraduate", academicYear: "Third year", institutionType: "university", enrollmentStatus: "enrolled", citizenshipStatus: "us_citizen" }).eligible, false, "Graduate-only opportunities must reject undergraduate profiles.");

const reportA = buildCatalogReliabilityReport(opportunities, { now, duplicateGroups: duplicateData.groups });
const reportB = buildCatalogReliabilityReport(opportunities, { now, duplicateGroups: duplicateData.groups });
assert.deepEqual(reportA, reportB, "Catalog health output must be deterministic and idempotent.");
assert.equal(reportA.records.length, opportunities.length);
assert.ok(reportA.totals.recommendationSafe > 0);
assert.ok(reportA.queue.every((record) => catalogHealthStates.includes(record.state)));

const timings: number[] = [];
for (let index = 0; index < 5; index += 1) {
  const started = performance.now();
  buildCatalogReliabilityReport(opportunities, { now, duplicateGroups: duplicateData.groups });
  timings.push(performance.now() - started);
}
const averageMs = timings.reduce((sum, value) => sum + value, 0) / timings.length;
assert.ok(averageMs < 1_500, `Catalog reliability reporting must remain operationally efficient; received ${averageMs.toFixed(2)}ms average.`);

console.log(JSON.stringify({ totals: reportA.totals, healthStates: reportA.healthStates, review: reportA.review, averageMs: Number(averageMs.toFixed(2)) }, null, 2));
