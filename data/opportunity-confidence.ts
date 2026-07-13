import { dataQualityScore } from "./opportunity-enrichment";
import { evaluateOpportunityEligibility, hasUnknownEligibilityLanguage, type OpportunityEligibilityEvaluation } from "./opportunity-eligibility";
import type { OpportunityStudentContext } from "./opportunity-intelligence";
import type { Opportunity } from "./opportunities";

export type ConfidenceLevel = "High" | "Moderate" | "Low";

export type OpportunityConfidenceProfile = {
  eligibilityConfidence: number;
  metadataConfidence: number;
  verificationConfidence: number;
  recommendationConfidence: number;
  overallConfidence: number;
  level: ConfidenceLevel;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function confidenceLevel(value: number): ConfidenceLevel {
  if (value >= 78) return "High";
  if (value >= 55) return "Moderate";
  return "Low";
}

export function opportunityVerificationConfidence(opportunity: Opportunity, now = new Date()) {
  if (opportunity.verification_status !== "verified") return 0;
  let score = 52;
  if (opportunity.official_source_url.startsWith("https://")) score += 12;
  const verifiedAt = new Date(`${opportunity.last_verified}T00:00:00Z`);
  const ageDays = Number.isFinite(verifiedAt.getTime()) ? Math.floor((now.getTime() - verifiedAt.getTime()) / 86400000) : Number.POSITIVE_INFINITY;
  if (ageDays >= 0 && ageDays <= 120) score += 18;
  else if (ageDays <= 180) score += 8;
  else score -= 20;
  if (opportunity.metadata.verification?.status === "verified") score += 6;
  if (opportunity.metadata.verification?.sourceReachable === true || opportunity.metadata.verification?.applicationUrlVerified === true) score += 4;
  if (opportunity.metadata.verification?.eligibilityVerified === true) score += 4;
  if (opportunity.metadata.verification?.sourceReachable === false) score = 0;
  return clamp(score);
}

export function opportunityEligibilityDataConfidence(opportunity: Opportunity) {
  if (opportunity.verification_status !== "verified" || opportunity.metadata.verification?.eligibilityVerified === false || hasUnknownEligibilityLanguage(opportunity)) return 0;
  let score = 68;
  if (opportunity.eligibility.trim().length >= 36) score += 6;
  if (opportunity.majors.length > 0) score += 4;
  if (opportunity.academic_years.length > 0) score += 4;
  if (opportunity.school_scope === "National" || opportunity.schools.length > 0) score += 4;
  if (opportunity.metadata.verification?.eligibilityVerified === true) score += 10;
  if (opportunity.metadata.eligibilityRules?.evidence?.length) score += 4;
  return clamp(score);
}

export function buildOpportunityConfidence(
  opportunity: Opportunity,
  context: OpportunityStudentContext,
  recommendationConfidence: number,
  eligibility: OpportunityEligibilityEvaluation = evaluateOpportunityEligibility(opportunity, context),
): OpportunityConfidenceProfile {
  const eligibilityConfidence = eligibility.eligible ? Math.min(eligibility.confidence, opportunityEligibilityDataConfidence(opportunity)) : 0;
  const metadataConfidence = dataQualityScore(opportunity);
  const verificationConfidence = opportunityVerificationConfidence(opportunity);
  const normalizedRecommendationConfidence = clamp(recommendationConfidence);
  const overallConfidence = Math.min(eligibilityConfidence, metadataConfidence, verificationConfidence, normalizedRecommendationConfidence);
  return {
    eligibilityConfidence,
    metadataConfidence,
    verificationConfidence,
    recommendationConfidence: normalizedRecommendationConfidence,
    overallConfidence,
    level: confidenceLevel(overallConfidence),
  };
}

export function isProfessionalConfidence(profile: OpportunityConfidenceProfile) {
  return profile.level === "High"
    && profile.eligibilityConfidence >= 78
    && profile.metadataConfidence >= 78
    && profile.verificationConfidence >= 78
    && profile.recommendationConfidence >= 78;
}
