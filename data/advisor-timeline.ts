import type { AdvisorProfile } from "./advisor-engine";
import { runRecommendationEngineV1, type RecommendationV1 } from "./recommendation-engine";
import { opportunities as catalogOpportunities, type Opportunity } from "./opportunities";
import { getRoadmap, type RoadmapMilestone } from "./roadmap-engine";
import type { StudentProgress } from "./student-progress";

export type AdvisorTimelinePeriod = "Today's Focus" | "This Month" | "This Semester" | "Next Semester" | "Long-Term";

export type AdvisorTimelineItem = {
  period: AdvisorTimelinePeriod;
  title: string;
  description: string;
  reason: string;
  nextAction: string;
  milestone?: {
    id: string;
    title: string;
    category: string;
  };
  opportunities: {
    id: string;
    title: string;
    category: string;
    deadline: string | null;
  }[];
};

export type AdvisorTimelineResult = {
  items: AdvisorTimelineItem[];
  generatedAt: string;
};

export type AdvisorTimelineInput = {
  advisorProfile: AdvisorProfile;
  opportunities?: readonly Opportunity[];
  progress?: StudentProgress;
};

const periods: AdvisorTimelinePeriod[] = ["Today's Focus", "This Month", "This Semester", "Next Semester", "Long-Term"];

function opportunitySummary(opportunity: Opportunity) {
  return {
    id: opportunity.id,
    title: opportunity.title,
    category: opportunity.category,
    deadline: opportunity.application_deadline,
  };
}

function byOpportunityId(opportunities: readonly Opportunity[]) {
  return new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));
}

function opportunitiesForMilestone(milestone: RoadmapMilestone | undefined, recommendations: readonly RecommendationV1[], opportunities: readonly Opportunity[]) {
  const lookup = byOpportunityId(opportunities);
  const milestoneCategories = new Set(milestone?.relatedOpportunityCategories ?? []);
  return recommendations
    .map((recommendation) => recommendation.relatedOpportunityId ? lookup.get(recommendation.relatedOpportunityId) : undefined)
    .filter((opportunity): opportunity is Opportunity => Boolean(opportunity))
    .filter((opportunity) => !milestone || milestoneCategories.has(opportunity.category) || milestoneCategories.has(opportunity.type))
    .slice(0, 2)
    .map(opportunitySummary);
}

function fallbackOpportunities(recommendations: readonly RecommendationV1[], opportunities: readonly Opportunity[]) {
  const lookup = byOpportunityId(opportunities);
  return recommendations
    .map((recommendation) => recommendation.relatedOpportunityId ? lookup.get(recommendation.relatedOpportunityId) : undefined)
    .filter((opportunity): opportunity is Opportunity => Boolean(opportunity))
    .slice(0, 2)
    .map(opportunitySummary);
}

function timelineTitle(period: AdvisorTimelinePeriod, milestone: RoadmapMilestone | undefined, recommendation: RecommendationV1 | undefined) {
  if (period === "Today's Focus" && recommendation) return recommendation.title;
  if (milestone) return milestone.title;
  return recommendation?.title ?? "Review your next best opportunity";
}

function timelineDescription(period: AdvisorTimelinePeriod, milestone: RoadmapMilestone | undefined, recommendation: RecommendationV1 | undefined) {
  if (period === "Today's Focus" && recommendation) return recommendation.description;
  if (milestone) return milestone.description;
  if (recommendation) return recommendation.description;
  if (period === "Long-Term") return "Keep building toward larger applications, career plans, and post-graduation options.";
  return "Use your recommendations to choose one concrete next step.";
}

function timelineReason(profile: AdvisorProfile, period: AdvisorTimelinePeriod, milestone: RoadmapMilestone | undefined, recommendation: RecommendationV1 | undefined) {
  if (recommendation?.reason) return recommendation.reason;
  if (milestone) return `${milestone.title} fits a ${profile.academics.timelineStage.toLowerCase()} ${profile.academics.major} roadmap.`;
  return `${period} is based on your major, year, career goal, milestones, and opportunity matches.`;
}

function timelineNextAction(period: AdvisorTimelinePeriod, milestone: RoadmapMilestone | undefined, recommendation: RecommendationV1 | undefined) {
  if (period === "Today's Focus" && recommendation?.nextAction) return recommendation.nextAction;
  if (milestone?.recommendedBefore.length) return `Start this before ${milestone.recommendedBefore[0]}.`;
  if (recommendation?.nextAction) return recommendation.nextAction;
  return "Pick one recommendation and review the official source.";
}

export function buildAdvisorTimeline(input: AdvisorTimelineInput): AdvisorTimelineResult {
  const opportunities = input.opportunities ?? catalogOpportunities;
  const roadmap = getRoadmap(input.advisorProfile, input.progress);
  const recommendationResult = runRecommendationEngineV1({ advisorProfile: input.advisorProfile, opportunities, progress: input.progress, limit: 12 });
  const opportunityRecommendations = recommendationResult.recommendations.filter((recommendation) => recommendation.kind === "Opportunity");
  const milestones = [
    roadmap.recommendedMilestone,
    ...roadmap.upcomingMilestones.filter((milestone) => milestone.id !== roadmap.recommendedMilestone.id),
  ];

  const items = periods.map((period, index): AdvisorTimelineItem => {
    const milestone = period === "Today's Focus" ? roadmap.recommendedMilestone : milestones[index - 1] ?? milestones[index];
    const recommendation = period === "Today's Focus" ? recommendationResult.recommendations[0] : opportunityRecommendations[index - 1] ?? recommendationResult.recommendations[index];
    const matchedOpportunities = opportunitiesForMilestone(milestone, opportunityRecommendations, opportunities);
    const linkedOpportunities = matchedOpportunities.length ? matchedOpportunities : fallbackOpportunities(opportunityRecommendations.slice(index), opportunities);
    return {
      period,
      title: timelineTitle(period, milestone, recommendation),
      description: timelineDescription(period, milestone, recommendation),
      reason: timelineReason(input.advisorProfile, period, milestone, recommendation),
      nextAction: timelineNextAction(period, milestone, recommendation),
      milestone: milestone ? { id: milestone.id, title: milestone.title, category: milestone.category } : undefined,
      opportunities: linkedOpportunities,
    };
  });

  return {
    items,
    generatedAt: new Date().toISOString(),
  };
}

export function getTimelineItem(timeline: AdvisorTimelineResult, period: AdvisorTimelinePeriod) {
  return timeline.items.find((item) => item.period === period) ?? null;
}
