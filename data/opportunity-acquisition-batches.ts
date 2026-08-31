import { opportunityAcquisitionBatch, opportunityAcquisitionCandidates } from "./opportunity-acquisition-batch";
import { opportunityAcquisitionBatch2, opportunityAcquisitionCandidatesBatch2 } from "./opportunity-acquisition-batch-2";
import { opportunityAcquisitionBatch3, opportunityAcquisitionCandidatesBatch3 } from "./opportunity-acquisition-batch-3";
import { opportunityAcquisitionBatch4, opportunityAcquisitionCandidatesBatch4 } from "./opportunity-acquisition-batch-4";
import { opportunityAcquisitionBatch5, opportunityAcquisitionCandidatesBatch5 } from "./opportunity-acquisition-batch-5";
import { opportunityAcquisitionBatch6, opportunityAcquisitionCandidatesBatch6 } from "./opportunity-acquisition-batch-6";
import { opportunityAcquisitionBatch7, opportunityAcquisitionCandidatesBatch7 } from "./opportunity-acquisition-batch-7";
import { opportunityAcquisitionBatch8, opportunityAcquisitionCandidatesBatch8 } from "./opportunity-acquisition-batch-8";

export const opportunityAcquisitionBatches = [opportunityAcquisitionBatch, opportunityAcquisitionBatch2, opportunityAcquisitionBatch3, opportunityAcquisitionBatch4, opportunityAcquisitionBatch5, opportunityAcquisitionBatch6, opportunityAcquisitionBatch7, opportunityAcquisitionBatch8] as const;
export const allOpportunityAcquisitionRecords = opportunityAcquisitionBatches.flatMap((batch) => [...batch.records]);
export const allOpportunityAcquisitionCandidates = [...opportunityAcquisitionCandidates, ...opportunityAcquisitionCandidatesBatch2, ...opportunityAcquisitionCandidatesBatch3, ...opportunityAcquisitionCandidatesBatch4, ...opportunityAcquisitionCandidatesBatch5, ...opportunityAcquisitionCandidatesBatch6, ...opportunityAcquisitionCandidatesBatch7, ...opportunityAcquisitionCandidatesBatch8];
