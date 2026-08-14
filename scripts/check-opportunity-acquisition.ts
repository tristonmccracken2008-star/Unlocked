import assert from "node:assert/strict";
import { opportunityAcquisitionBatch, opportunityAcquisitionCandidates } from "../data/opportunity-acquisition-batch";
import { acquisitionPriority, acquisitionStatuses, findAcquisitionDuplicate, missingAcquisitionEvidence, sortAcquisitionQueue } from "../data/opportunity-acquisition";
import { validateOpportunityData } from "../data/recommendation-professional-pipeline";
import { opportunities } from "../data/opportunities";

assert.equal(new Set(opportunityAcquisitionCandidates.map((candidate) => candidate.id)).size, opportunityAcquisitionCandidates.length, "Acquisition candidate IDs must be unique.");
assert.equal(new Set(opportunityAcquisitionBatch.records.map((record) => record.id)).size, opportunityAcquisitionBatch.records.length, "Batch record IDs must be unique.");
assert.ok(opportunityAcquisitionBatch.records.length >= 6, "The first acquisition wave must add or enrich a material set of recommendation-grade records.");
assert.ok(opportunityAcquisitionCandidates.filter((candidate) => candidate.status === "rejected").length >= 8, "Rejected research must remain documented.");

for (const candidate of opportunityAcquisitionCandidates) {
  assert.ok(acquisitionStatuses.includes(candidate.status), `${candidate.id} has an unsupported status.`);
  assert.ok(candidate.sourceUrls.every((url) => url.startsWith("https://")), `${candidate.id} must use HTTPS official sources.`);
  assert.ok(candidate.dispositionReason.length >= 30, `${candidate.id} needs an operational disposition reason.`);
  assert.ok(Number.isFinite(acquisitionPriority(candidate)), `${candidate.id} must have a finite priority score.`);
  if (candidate.sourceWatch) assert.match(candidate.sourceWatch.expectedReviewAt, /^\d{4}-\d{2}-\d{2}$/, `${candidate.id} has an invalid source-watch date.`);
}

for (const record of opportunityAcquisitionBatch.records) {
  const catalogRecord = opportunities.find((item) => item.id === record.id);
  assert.ok(catalogRecord, `${record.id} must be present in the local catalog.`);
  const comparableCatalogRecord = JSON.parse(JSON.stringify(catalogRecord));
  delete comparableCatalogRecord.canonical;
  delete comparableCatalogRecord.contentComplete;
  delete comparableCatalogRecord.completenessScore;
  delete comparableCatalogRecord.missingContentFields;
  assert.deepEqual(comparableCatalogRecord, JSON.parse(JSON.stringify(record)), `${record.id} must match its reviewed acquisition record.`);
  assert.deepEqual(missingAcquisitionEvidence(record), [], `${record.id} must retain provenance for every safety-critical field.`);
  const gate = validateOpportunityData(catalogRecord);
  assert.equal(gate.allowed, true, `${record.id} must pass the unchanged production recommendation gate: ${gate.reasons.join("; ")}`);
  assert.ok(record.metadata.acquisition, `${record.id} must include operational freshness metadata.`);
  assert.ok((record.metadata.sourceReferences?.length ?? 0) >= 1, `${record.id} must include structured official provenance.`);
  const candidate = opportunityAcquisitionCandidates.find((item) => item.id === record.id);
  assert.ok(candidate, `${record.id} must resolve to its intake candidate.`);
  const duplicate = findAcquisitionDuplicate({ ...candidate, record }, opportunities.filter((item) => item.id !== record.id));
  assert.equal(duplicate, null, `${record.id} duplicates ${duplicate?.catalogId ?? "another catalog record"}.`);
}

const queue = sortAcquisitionQueue(opportunityAcquisitionCandidates);
assert.deepEqual(queue, sortAcquisitionQueue(queue), "Acquisition priority ordering must be deterministic.");
assert.ok(queue.some((candidate) => candidate.coverageGaps.includes("humanities")), "The queue must deliberately cover humanities.");
assert.ok(queue.some((candidate) => candidate.coverageGaps.includes("international")), "The queue must deliberately cover international students.");
assert.ok(queue.some((candidate) => candidate.coverageGaps.includes("transfer")), "The queue must deliberately cover transfer students.");

console.log(JSON.stringify({ batchId: opportunityAcquisitionBatch.batchId, researched: opportunityAcquisitionCandidates.length, accepted: opportunityAcquisitionBatch.records.length, rejected: opportunityAcquisitionCandidates.filter((candidate) => candidate.status === "rejected").length, sourceWatch: opportunityAcquisitionCandidates.filter((candidate) => candidate.sourceWatch).length, topPriorities: queue.slice(0, 5).map((candidate) => ({ id: candidate.id, priority: acquisitionPriority(candidate), status: candidate.status })) }, null, 2));
