import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { opportunityAcquisitionBatch, opportunityAcquisitionCandidates } from "../data/opportunity-acquisition-batch";
import { acquisitionPriority, findAcquisitionDuplicate, missingAcquisitionEvidence, sortAcquisitionQueue } from "../data/opportunity-acquisition";
import { validateOpportunityData } from "../data/recommendation-professional-pipeline";
import type { Opportunity } from "../data/opportunities";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "data", "db", "opportunities.json");
const write = process.argv.includes("--write");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8")) as Opportunity[];
const original = JSON.stringify(catalog);
const acceptedIds = new Set(opportunityAcquisitionBatch.records.map((record) => record.id));
const diagnostics = { wouldAdd: [] as string[], wouldUpdate: [] as string[], unchanged: [] as string[], rejected: [] as { id: string; reason: string }[], duplicates: [] as ReturnType<typeof findAcquisitionDuplicate>[], missingEvidence: [] as { id: string; fields: string[] }[], gateFailures: [] as { id: string; reasons: string[] }[] };

for (const candidate of sortAcquisitionQueue(opportunityAcquisitionCandidates)) {
  if (candidate.status !== "recommendation_safe") {
    diagnostics.rejected.push({ id: candidate.id, reason: candidate.dispositionReason });
    continue;
  }
  if (!candidate.record || !acceptedIds.has(candidate.id)) throw new Error(`${candidate.id} is marked recommendation-safe without a batch record.`);
  const missingEvidence = missingAcquisitionEvidence(candidate.record);
  if (missingEvidence.length) diagnostics.missingEvidence.push({ id: candidate.id, fields: missingEvidence });
  const gate = validateOpportunityData(candidate.record);
  if (!gate.allowed) diagnostics.gateFailures.push({ id: candidate.id, reasons: gate.reasons });
  const existingIndex = catalog.findIndex((item) => item.id === candidate.record?.id);
  const duplicate = findAcquisitionDuplicate(candidate, catalog.filter((item) => item.id !== candidate.record?.id));
  if (duplicate) {
    diagnostics.duplicates.push(duplicate);
    continue;
  }
  if (existingIndex < 0) {
    diagnostics.wouldAdd.push(candidate.id);
    catalog.push(candidate.record);
    continue;
  }
  if (JSON.stringify(catalog[existingIndex]) === JSON.stringify(candidate.record)) diagnostics.unchanged.push(candidate.id);
  else {
    diagnostics.wouldUpdate.push(candidate.id);
    catalog[existingIndex] = candidate.record;
  }
}

if (diagnostics.missingEvidence.length || diagnostics.gateFailures.length || diagnostics.duplicates.length) {
  console.error(JSON.stringify({ batchId: opportunityAcquisitionBatch.batchId, mode: write ? "write" : "dry-run", diagnostics }, null, 2));
  process.exitCode = 1;
} else {
  if (write && JSON.stringify(catalog) !== original) fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(JSON.stringify({
    batchId: opportunityAcquisitionBatch.batchId,
    mode: write ? "write" : "dry-run",
    summary: { researched: opportunityAcquisitionCandidates.length, accepted: opportunityAcquisitionBatch.records.length, wouldAdd: diagnostics.wouldAdd.length, wouldUpdate: diagnostics.wouldUpdate.length, unchanged: diagnostics.unchanged.length, rejected: diagnostics.rejected.length },
    accepted: opportunityAcquisitionBatch.records.map((record) => record.id),
    rejected: diagnostics.rejected,
    priorityQueue: sortAcquisitionQueue(opportunityAcquisitionCandidates).map((candidate) => ({ id: candidate.id, status: candidate.status, priority: acquisitionPriority(candidate), disposition: candidate.disposition })),
  }, null, 2));
}
