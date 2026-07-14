import type { AccountData } from "../../lib/account-types";
import type { AdvisorBrainAction } from "../advisor-brain";
import type { RecommendationV1 } from "../recommendation-engine";
import type { RoadmapMilestone } from "../roadmap-engine";
import type { OpenLineInput, OpenLineWaypointSource } from "./types";

export function waypointFromRecommendation(recommendation: Pick<RecommendationV1, "id" | "title" | "reason" | "priority" | "relatedOpportunityId">, estimatedTime?: string): OpenLineWaypointSource | null {
  if (!recommendation.id.trim() || !recommendation.title.trim() || !recommendation.reason.trim()) return null;
  return {
    type: "recommendation",
    id: recommendation.id,
    title: recommendation.title,
    whyItMatters: recommendation.reason,
    estimatedTime,
    impact: recommendation.priority,
    sourceOpportunityId: recommendation.relatedOpportunityId,
  };
}

export function waypointFromAdvisorAction(action: Pick<AdvisorBrainAction, "recommendationId" | "title" | "whyRecommended" | "estimatedCompletionTime" | "priority">): OpenLineWaypointSource | null {
  const reason = action.whyRecommended.find((item) => item.trim());
  if (!action.recommendationId.trim() || !action.title.trim() || !reason) return null;
  return {
    type: "recommendation",
    id: action.recommendationId,
    title: action.title,
    whyItMatters: reason,
    estimatedTime: action.estimatedCompletionTime,
    impact: action.priority,
  };
}

export function waypointFromRoadmap(milestone: Pick<RoadmapMilestone, "id" | "title" | "description" | "estimatedCompletionTime" | "importance">): OpenLineWaypointSource | null {
  if (!milestone.id.trim() || !milestone.title.trim() || !milestone.description.trim()) return null;
  return {
    type: "roadmap",
    id: milestone.id,
    title: milestone.title,
    whyItMatters: milestone.description,
    estimatedTime: milestone.estimatedCompletionTime,
    impact: milestone.importance,
  };
}

export function openLineInputFromAccount(input: {
  userId: string;
  account: Pick<AccountData, "profile" | "activity" | "savedOpportunities" | "tracker">;
  generatedAt?: string;
}): OpenLineInput {
  const activity = input.account.activity
    ? { ...input.account.activity, tracked: { ...(input.account.activity.tracked ?? {}), ...(input.account.tracker ?? {}) } }
    : Object.keys(input.account.tracker ?? {}).length
      ? { viewed: [], saved: Object.keys(input.account.tracker), claimed: [], tracked: input.account.tracker }
      : null;
  return {
    userId: input.userId,
    profile: input.account.profile,
    activity,
    savedRecords: input.account.savedOpportunities,
    generatedAt: input.generatedAt,
  };
}
