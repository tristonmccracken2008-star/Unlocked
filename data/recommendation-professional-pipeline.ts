import type { AdvisorProfile } from "./advisor-engine";
import { buildOpportunityConfidence, isProfessionalConfidence, opportunityEligibilityDataConfidence, opportunityVerificationConfidence } from "./opportunity-confidence";
import { evaluateOpportunityEligibility, hasUnknownEligibilityLanguage, rawEligibilityText } from "./opportunity-eligibility";
import { getDeadlineDays, isSchoolEligible, type OpportunityStudentContext } from "./opportunity-intelligence";
import { recommendationConfig } from "./recommendation-config";
import type { RecommendationV1 } from "./recommendation-engine";
import type { Opportunity } from "./opportunities";

export type RecommendationPipelineStage =
  | "data_validation"
  | "eligibility_engine"
  | "recommendation_engine"
  | "career_advisor"
  | "explanation_engine"
  | "quality_auditor";

export type CandidateGateResult = {
  allowed: boolean;
  stage: RecommendationPipelineStage;
  reasons: string[];
  confidenceImpact: "none" | "low" | "medium" | "high";
};

export type RecommendationAuditResult = {
  approved: boolean;
  rejections: string[];
  warnings: string[];
};

export type RecommendationHealthMonitor = {
  totalReviewed: number;
  rejected: number;
  wrongSchool: number;
  wrongYear: number;
  wrongGpa: number;
  expiredOrArchived: number;
  duplicateOrganizations: number;
  lowConfidence: number;
  coverage: {
    categories: number;
    types: number;
    organizations: number;
  };
};

function hasKnownDeadlineProblem(opportunity: Opportunity) {
  const deadlineDays = getDeadlineDays(opportunity);
  return deadlineDays !== null && deadlineDays < 0;
}

function hasUsableSource(opportunity: Opportunity) {
  return opportunity.official_source_url.startsWith("https://") && Boolean(opportunity.organization.trim()) && Boolean(opportunity.eligibility.trim());
}

export function validateOpportunityData(opportunity: Opportunity): CandidateGateResult {
  const reasons: string[] = [];
  if (!hasUsableSource(opportunity)) reasons.push("Missing usable source, organization, or eligibility.");
  if (recommendationConfig.verificationQuality.excludedStatuses.includes(opportunity.verification_status as never)) reasons.push(`Verification status is ${opportunity.verification_status}.`);
  if (hasKnownDeadlineProblem(opportunity)) reasons.push("Deadline has passed.");
  if (opportunity.verification_status === "needs_review") reasons.push("Details need manual review before premium promotion.");
  if (opportunity.verification_status === "temporarily_closed") reasons.push("Opportunity is temporarily closed.");
  if (opportunity.verification_status !== "verified") reasons.push("Eligibility has not been positively verified for Pro recommendations.");
  if (opportunity.metadata.verification?.eligibilityVerified === false) reasons.push("Eligibility verification is explicitly incomplete.");
  if (hasUnknownEligibilityLanguage(opportunity)) reasons.push("Eligibility contains unknown or variable requirements.");
  if (rawEligibilityText(opportunity).trim().length < 24) reasons.push("Eligibility detail is too thin to prove fit.");
  if (opportunityEligibilityDataConfidence(opportunity) < recommendationConfig.confidence.professionalMinimum) reasons.push("Eligibility evidence confidence is below the Pro threshold.");
  if (opportunityVerificationConfidence(opportunity) < recommendationConfig.confidence.professionalMinimum) reasons.push("Verification confidence is below the Pro threshold.");
  return {
    allowed: reasons.length === 0,
    stage: "data_validation",
    reasons,
    confidenceImpact: reasons.length ? "medium" : "none",
  };
}

export function evaluateEligibility(opportunity: Opportunity, context: OpportunityStudentContext): CandidateGateResult {
  const evaluation = evaluateOpportunityEligibility(opportunity, context);
  const reasons = [...evaluation.failures];
  if (context.completedOpportunityIds?.includes(opportunity.id)) reasons.push("Student already completed this opportunity.");
  if (context.rejectedOpportunityIds?.includes(opportunity.id)) reasons.push("Student rejected this opportunity.");
  if (context.activeOpportunityIds?.includes(opportunity.id)) reasons.push("Opportunity is already active in Journey.");
  if (context.dismissedOpportunityIds?.includes(opportunity.id) || context.hiddenOpportunityIds?.includes(opportunity.id)) reasons.push("Student dismissed or hid this opportunity.");
  return {
    allowed: reasons.length === 0,
    stage: "eligibility_engine",
    reasons,
    confidenceImpact: reasons.length ? "high" : "none",
  };
}

export function evaluateProfessionalRecommendationCandidate(opportunity: Opportunity, context: OpportunityStudentContext): CandidateGateResult {
  const validation = validateOpportunityData(opportunity);
  if (!validation.allowed) return validation;
  const eligibility = evaluateEligibility(opportunity, context);
  if (!eligibility.allowed) return eligibility;
  return { allowed: true, stage: "eligibility_engine", reasons: [], confidenceImpact: "none" };
}

export function auditFinalOpportunityRecommendation(recommendation: RecommendationV1, opportunity: Opportunity, context: OpportunityStudentContext): RecommendationAuditResult {
  const rejections: string[] = [];
  const warnings: string[] = [];
  const validation = validateOpportunityData(opportunity);
  const eligibilityEvaluation = evaluateOpportunityEligibility(opportunity, context);
  const eligibility = evaluateEligibility(opportunity, context);
  if (!validation.allowed) rejections.push(...validation.reasons);
  if (!eligibility.allowed) rejections.push(...eligibility.reasons);
  const confidence = recommendation.confidenceBreakdown ?? buildOpportunityConfidence(opportunity, context, recommendation.confidence, eligibilityEvaluation);
  if (!isProfessionalConfidence(confidence)) rejections.push("Recommendation confidence is too low for Pro.");
  if (!recommendation.reasons.length || recommendation.reasons.some((reason) => /matches your school|available through your university|campus-specific/i.test(reason) && !isSchoolEligible(opportunity, context))) rejections.push("Explanation contains unsupported school relevance.");
  if (!recommendation.explainability.whyThisUser || !recommendation.explainability.whyNow || !recommendation.explainability.whyThisOpportunity || !recommendation.explainability.whyAboveAlternatives) rejections.push("Recommendation explanation is incomplete.");
  if (!recommendation.explainability.evidence.length) rejections.push("Recommendation has no eligibility evidence.");
  if (opportunity.verification_status === "needs_review") warnings.push("Verified details need review before acting.");
  if (opportunity.metadata.deadlineType === "unknown" || opportunity.metadata.verification?.deadlineVerified === false) warnings.push("Deadline confidence is limited.");
  return { approved: rejections.length === 0, rejections, warnings };
}

export function careerAdvisorFit(profile: AdvisorProfile, opportunity: Opportunity) {
  const roadmapCategories = new Set(profile.future.opportunityCategoriesUsed ?? []);
  const pathwayCategories = new Set(profile.pathway.bestOpportunityCategories);
  const preferredTypes = new Set(profile.goals.preferredOpportunityTypes);
  const categoryFit = pathwayCategories.has(opportunity.category) || pathwayCategories.has(opportunity.type) || preferredTypes.has(opportunity.category) || preferredTypes.has(opportunity.type);
  const addsCoverage = !roadmapCategories.has(opportunity.category) && !roadmapCategories.has(opportunity.type);
  return {
    stage: "career_advisor" as const,
    shouldDoNext: categoryFit,
    reasons: [
      categoryFit ? "Fits the student's pathway or stated opportunity preferences." : "",
      addsCoverage ? "Adds useful variety to the student's opportunity mix." : "",
    ].filter(Boolean),
  };
}

export function buildRecommendationHealthMonitor(finalRecommendations: RecommendationV1[], reviewedOpportunities: Opportunity[], context: OpportunityStudentContext): RecommendationHealthMonitor {
  const rejected = reviewedOpportunities.filter((opportunity) => !evaluateProfessionalRecommendationCandidate(opportunity, context).allowed);
  const organizationCounts = finalRecommendations.reduce((counts, recommendation) => {
    const opportunity = reviewedOpportunities.find((item) => item.id === recommendation.relatedOpportunityId);
    if (opportunity) counts.set(opportunity.organization, (counts.get(opportunity.organization) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const finalOpportunities = finalRecommendations.map((recommendation) => reviewedOpportunities.find((item) => item.id === recommendation.relatedOpportunityId)).filter((item): item is Opportunity => Boolean(item));
  return {
    totalReviewed: reviewedOpportunities.length,
    rejected: rejected.length,
    wrongSchool: reviewedOpportunities.filter((opportunity) => !isSchoolEligible(opportunity, context)).length,
    wrongYear: reviewedOpportunities.filter((opportunity) => evaluateOpportunityEligibility(opportunity, context).checks.some((check) => check.key === "class_year" && check.applicable && !check.proven)).length,
    wrongGpa: reviewedOpportunities.filter((opportunity) => evaluateOpportunityEligibility(opportunity, context).checks.some((check) => check.key === "gpa" && check.applicable && !check.proven)).length,
    expiredOrArchived: reviewedOpportunities.filter((opportunity) => recommendationConfig.verificationQuality.excludedStatuses.includes(opportunity.verification_status as never) || hasKnownDeadlineProblem(opportunity)).length,
    duplicateOrganizations: [...organizationCounts.values()].filter((count) => count > 1).length,
    lowConfidence: finalRecommendations.filter((recommendation) => recommendation.confidenceLevel !== "High").length,
    coverage: {
      categories: new Set(finalOpportunities.map((opportunity) => opportunity.category)).size,
      types: new Set(finalOpportunities.map((opportunity) => opportunity.type)).size,
      organizations: new Set(finalOpportunities.map((opportunity) => opportunity.organization)).size,
    },
  };
}
