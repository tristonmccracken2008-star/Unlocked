import type { RecommendationV1 } from "./recommendation-engine";

export type RecommendationWeeklyStrategy = {
  title: "This Week";
  deadlineCount: number;
  newOpportunityCount: number;
  scholarshipCount: number;
  bestNextStep: string;
  summary: string;
};

export function buildRecommendationWeeklyStrategy(recommendations: readonly RecommendationV1[]): RecommendationWeeklyStrategy {
  const opportunities = recommendations.filter((item) => item.kind === "Opportunity");
  const deadlineCount = opportunities.filter((item) => item.reasons.some((reason) => /deadline is in/i.test(reason))).length;
  const scholarshipCount = opportunities.filter((item) => item.categories.includes("Scholarship") || item.categories.includes("Scholarships")).length;
  const top = recommendations[0];
  return {
    title: "This Week",
    deadlineCount,
    newOpportunityCount: opportunities.length,
    scholarshipCount,
    bestNextStep: top?.nextAction ?? "Review your top recommendation and decide whether it belongs in your Journey.",
    summary: `${deadlineCount} deadline${deadlineCount === 1 ? "" : "s"}, ${opportunities.length} personalized opportunit${opportunities.length === 1 ? "y" : "ies"}, and ${scholarshipCount} scholarship signal${scholarshipCount === 1 ? "" : "s"} in the current recommendation set.`,
  };
}
