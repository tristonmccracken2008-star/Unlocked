import type { RecommendationMatchLabel } from "./recommendation-service";

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
    needsReview: 3,
    qualityMultiplier: 0.18,
    highValue: 8,
    openDifficulty: 5,
    highlyCompetitivePenalty: -4,
    savedSimilarCategory: 5,
    completedSimilarCategory: 4,
    viewedPenalty: -3,
    activeTrackedPenalty: -70,
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
  },
} as const;

export function labelForRecommendationScore(score: number): RecommendationMatchLabel {
  if (score >= recommendationConfig.thresholds.excellent) return "Excellent Match";
  if (score >= recommendationConfig.thresholds.strong) return "Strong Match";
  if (score >= recommendationConfig.thresholds.good) return "Good Match";
  if (score >= recommendationConfig.thresholds.worthReviewing) return "Worth Reviewing";
  return "Limited Match";
}
