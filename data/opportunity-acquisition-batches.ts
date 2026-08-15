import { opportunityAcquisitionBatch, opportunityAcquisitionCandidates } from "./opportunity-acquisition-batch";
import { opportunityAcquisitionBatch2, opportunityAcquisitionCandidatesBatch2 } from "./opportunity-acquisition-batch-2";

export const opportunityAcquisitionBatches = [opportunityAcquisitionBatch, opportunityAcquisitionBatch2] as const;
export const allOpportunityAcquisitionRecords = opportunityAcquisitionBatches.flatMap((batch) => [...batch.records]);
export const allOpportunityAcquisitionCandidates = [...opportunityAcquisitionCandidates, ...opportunityAcquisitionCandidatesBatch2];
