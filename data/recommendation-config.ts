import type { RecommendationMatchLabel } from "./recommendation-service";

export const recommendationRulesVersion = "professional-recommendations-v4-tiered-eligibility";

export const recommendationConfig = {
  weights: {
    schoolEligibleNational: 10,
    schoolEligibleSpecific: 24,
    wrongSchoolPenalty: -100,
    majorExact: 24,
    majorAny: 8,
    minorExact: 12,
    classYearExact: 22,
    classYearAny: 8,
    wrongClassYearPenalty: -55,
    careerGoalPerSignal: 5,
    careerGoalMax: 24,
    interestPerSignal: 5,
    interestMax: 22,
    currentPriority: 18,
    gpaMeetsRequirement: 8,
    noGpaKnownRequirementPenalty: -8,
    deadlineCritical: 18,
    deadlineSoon: 10,
    deadlinePassedPenalty: -100,
    verified: 12,
    needsReview: -14,
    temporarilyClosed: -28,
    excludedVerificationStatus: -100,
    qualityMultiplier: 0.18,
    highValue: 8,
    openDifficulty: 5,
    highlyCompetitivePenalty: -4,
    savedSimilarCategory: 5,
    completedSimilarCategory: 4,
    viewedPenalty: -3,
    activeTrackedPenalty: -70,
    careerRoadmapCategory: 12,
    careerRoadmapSignal: 6,
    careerRoadmapOrganization: 10,
    skillAlignmentPerSignal: 4,
    skillAlignmentMax: 16,
    categoryGapBoost: 12,
    ignoredSimilarPenalty: -18,
    dismissedOpportunityPenalty: -100,
    completedOpportunityPenalty: -100,
    freshnessRecent: 6,
    weakDeadlineConfidencePenalty: -6,
    expectedRoiHigh: 7,
    estimatedTimeLow: 5,
  },
  thresholds: {
    excellent: 86,
    strong: 72,
    good: 56,
    worthReviewing: 38,
  },
  diversity: {
    organizationPenalty: 14,
    categoryPenalty: 9,
    typePenalty: 5,
    maxSameOrganizationBeforePenalty: 1,
    maxSameCategoryBeforePenalty: 2,
    maxSameTypeBeforePenalty: 3,
    maxSameOrganization: 1,
    maxSameCategory: 2,
    maxSameType: 3,
  },
  qualityGates: {
    minimumPositiveSignals: 2,
    minimumPersonalizedSignals: 1,
    minimumRecommendationScore: 34,
  },
  verificationQuality: {
    excludedStatuses: ["expired", "archived", "broken_source"],
    suppressFromPremiumStatuses: ["needs_review"],
    nonActionableStatuses: ["temporarily_closed"],
    urgentDeadlineRequiresVerifiedDeadline: true,
  },
  confidence: {
    minimumVisible: "Medium",
    highThreshold: 78,
    mediumThreshold: 52,
    professionalMinimum: 78,
  },
} as const;

export function labelForRecommendationScore(score: number): RecommendationMatchLabel {
  if (score >= recommendationConfig.thresholds.excellent) return "Excellent Match";
  if (score >= recommendationConfig.thresholds.strong) return "Strong Match";
  if (score >= recommendationConfig.thresholds.good) return "Good Match";
  if (score >= recommendationConfig.thresholds.worthReviewing) return "Worth Reviewing";
  return "Limited Match";
}
