import assert from "node:assert/strict";
import { allOpportunityAcquisitionCandidates, allOpportunityAcquisitionRecords, opportunityAcquisitionBatches } from "../data/opportunity-acquisition-batches";
import { acquisitionPriority, acquisitionStatuses, findAcquisitionDuplicate, missingAcquisitionEvidence, sortAcquisitionQueue } from "../data/opportunity-acquisition";
import { validateOpportunityData } from "../data/recommendation-professional-pipeline";
import { opportunities } from "../data/opportunities";

assert.equal(new Set(allOpportunityAcquisitionCandidates.map((candidate) => candidate.id)).size, allOpportunityAcquisitionCandidates.length, "Acquisition candidate IDs must be unique.");
assert.equal(new Set(allOpportunityAcquisitionRecords.map((record) => record.id)).size, allOpportunityAcquisitionRecords.length, "Batch record IDs must be unique.");
assert.ok(allOpportunityAcquisitionRecords.length >= 10, "Acquisition waves must retain a material set of recommendation-grade records.");
assert.ok(allOpportunityAcquisitionCandidates.filter((candidate) => candidate.status === "rejected").length >= 35, "Rejected research must remain documented.");

for (const candidate of allOpportunityAcquisitionCandidates) {
  assert.ok(acquisitionStatuses.includes(candidate.status), `${candidate.id} has an unsupported status.`);
  assert.ok(candidate.sourceUrls.every((url) => url.startsWith("https://")), `${candidate.id} must use HTTPS official sources.`);
  assert.ok(candidate.dispositionReason.length >= 30, `${candidate.id} needs an operational disposition reason.`);
  assert.ok(Number.isFinite(acquisitionPriority(candidate)), `${candidate.id} must have a finite priority score.`);
  if (candidate.sourceWatch) assert.match(candidate.sourceWatch.expectedReviewAt, /^\d{4}-\d{2}-\d{2}$/, `${candidate.id} has an invalid source-watch date.`);
}

for (const record of allOpportunityAcquisitionRecords) {
  const catalogRecord = opportunities.find((item) => item.id === record.id);
  assert.ok(catalogRecord, `${record.id} must be present in the local catalog.`);
  const comparableCatalogRecord = JSON.parse(JSON.stringify(catalogRecord));
  delete comparableCatalogRecord.canonical;
  delete comparableCatalogRecord.contentComplete;
  delete comparableCatalogRecord.completenessScore;
  delete comparableCatalogRecord.missingContentFields;
  assert.deepEqual(comparableCatalogRecord, JSON.parse(JSON.stringify(record)), `${record.id} must match its reviewed acquisition record.`);
  assert.deepEqual(missingAcquisitionEvidence(record), [], `${record.id} must retain provenance for every safety-critical field.`);
  const reviewedAt = new Date(`${record.last_verified}T12:00:00.000Z`);
  const gate = validateOpportunityData(catalogRecord, reviewedAt);
  assert.equal(gate.allowed, true, `${record.id} must pass the production recommendation gate at its documented review date: ${gate.reasons.join("; ")}`);
  assert.ok(record.metadata.acquisition, `${record.id} must include operational freshness metadata.`);
  assert.ok((record.metadata.sourceReferences?.length ?? 0) >= 1, `${record.id} must include structured official provenance.`);
  const candidate = allOpportunityAcquisitionCandidates.find((item) => item.id === record.id);
  assert.ok(candidate, `${record.id} must resolve to its intake candidate.`);
  const duplicate = findAcquisitionDuplicate({ ...candidate, record }, opportunities.filter((item) => item.id !== record.id));
  assert.equal(duplicate, null, `${record.id} duplicates ${duplicate?.catalogId ?? "another catalog record"}.`);
}

const queue = sortAcquisitionQueue(allOpportunityAcquisitionCandidates);
assert.deepEqual(queue, sortAcquisitionQueue(queue), "Acquisition priority ordering must be deterministic.");
assert.ok(queue.some((candidate) => candidate.coverageGaps.includes("humanities")), "The queue must deliberately cover humanities.");
assert.ok(queue.some((candidate) => candidate.coverageGaps.includes("international")), "The queue must deliberately cover international students.");
assert.ok(queue.some((candidate) => candidate.coverageGaps.includes("transfer")), "The queue must deliberately cover transfer students.");

const batch2 = opportunityAcquisitionBatches[1];
assert.ok(batch2.records.some((record) => record.metadata.eligibilityRules?.transferEligibility === "explicitly_eligible"), "Batch 2 must add an explicitly transfer-eligible record without marking it transfer-only.");
console.log(JSON.stringify({ batchIds: opportunityAcquisitionBatches.map((batch) => batch.batchId), researched: allOpportunityAcquisitionCandidates.length, accepted: allOpportunityAcquisitionRecords.length, rejected: allOpportunityAcquisitionCandidates.filter((candidate) => candidate.status === "rejected").length, sourceWatch: allOpportunityAcquisitionCandidates.filter((candidate) => candidate.sourceWatch).length, topPriorities: queue.slice(0, 5).map((candidate) => ({ id: candidate.id, priority: acquisitionPriority(candidate), status: candidate.status })) }, null, 2));
