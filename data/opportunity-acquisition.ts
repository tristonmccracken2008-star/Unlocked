import type { Opportunity, OpportunityEligibilityEvidenceField, OpportunitySourceReference } from "./opportunities";

export const acquisitionStatuses = [
  "candidate",
  "researching",
  "source_confirmed",
  "structuring",
  "review_needed",
  "recommendation_safe",
  "rejected",
] as const;

export type OpportunityAcquisitionStatus = (typeof acquisitionStatuses)[number];
export type OpportunityVerificationEffort = "low" | "medium" | "high";
export type OpportunityCandidateDisposition =
  | "current_cycle_unavailable"
  | "eligibility_unclear"
  | "conflicting_official_sources"
  | "variable_position_eligibility"
  | "institution_membership_unproven"
  | "duplicate"
  | "stale"
  | "graduate_only"
  | "accepted";

export type OpportunitySourceWatch = {
  sourceUrl: string;
  expectedReviewAt: string;
  reason: string;
};

export type OpportunityAcquisitionCandidate = {
  id: string;
  title: string;
  organization: string;
  type: Opportunity["type"];
  targetStudentGroups: string[];
  coverageGaps: string[];
  sourceUrls: string[];
  verificationEffort: OpportunityVerificationEffort;
  quality: "established" | "high" | "very_high";
  lifecycleStability: "low" | "medium" | "high";
  broadEligibility: boolean;
  status: OpportunityAcquisitionStatus;
  disposition: OpportunityCandidateDisposition;
  dispositionReason: string;
  sourceWatch?: OpportunitySourceWatch;
  record?: Opportunity;
};

const scarcityWeights: Record<string, number> = {
  scholarship: 24,
  internship: 22,
  research: 20,
  fellowship: 20,
  competition: 18,
  humanities: 18,
  "social sciences": 18,
  "first year": 17,
  international: 16,
  transfer: 16,
};

export function acquisitionPriority(candidate: OpportunityAcquisitionCandidate) {
  const gapScore = candidate.coverageGaps.reduce((sum, gap) => sum + (scarcityWeights[gap.toLowerCase()] ?? 8), 0);
  const qualityScore = candidate.quality === "very_high" ? 24 : candidate.quality === "high" ? 18 : 12;
  const stabilityScore = candidate.lifecycleStability === "high" ? 14 : candidate.lifecycleStability === "medium" ? 8 : 2;
  const effortPenalty = candidate.verificationEffort === "high" ? 14 : candidate.verificationEffort === "medium" ? 7 : 0;
  return gapScore + qualityScore + stabilityScore + (candidate.broadEligibility ? 12 : 0) - effortPenalty;
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sourceKey = (value: string) => {
  try {
    const url = new URL(value);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return normalize(value);
  }
};

export type AcquisitionDuplicate = { candidateId: string; catalogId: string; reason: "id" | "title_organization" | "official_source" };

export function findAcquisitionDuplicate(candidate: OpportunityAcquisitionCandidate, catalog: readonly Opportunity[]): AcquisitionDuplicate | null {
  if (!candidate.record) return null;
  const exactId = catalog.find((item) => item.id === candidate.record?.id);
  if (exactId) return { candidateId: candidate.id, catalogId: exactId.id, reason: "id" };
  const titleOrganization = catalog.find((item) => normalize(item.title) === normalize(candidate.title) && normalize(item.organization) === normalize(candidate.organization));
  if (titleOrganization) return { candidateId: candidate.id, catalogId: titleOrganization.id, reason: "title_organization" };
  const sources = new Set(candidate.sourceUrls.map(sourceKey));
  const source = catalog.find((item) => sources.has(sourceKey(item.official_source_url)));
  return source ? { candidateId: candidate.id, catalogId: source.id, reason: "official_source" } : null;
}

export function missingAcquisitionEvidence(record: Opportunity) {
  const references = record.metadata.sourceReferences ?? [];
  const supported = new Set(references.flatMap((reference: OpportunitySourceReference) => reference.supports));
  const required: OpportunityEligibilityEvidenceField[] = ["academic_level", "institution_type", "enrollment_status", "school_restriction", "external_student_eligibility", "class_year", "major", "citizenship", "application_status"];
  if (record.metadata.deadlineType === "fixed") required.push("deadline");
  return required.filter((field) => !supported.has(field));
}

export function sortAcquisitionQueue(candidates: readonly OpportunityAcquisitionCandidate[]) {
  return [...candidates].sort((left, right) => acquisitionPriority(right) - acquisitionPriority(left) || left.id.localeCompare(right.id));
}
