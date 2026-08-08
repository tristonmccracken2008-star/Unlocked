import type { AdvisorProfile } from "./advisor-engine";
import type { OpportunityStudentContext } from "./opportunity-intelligence";
import type { Opportunity } from "./opportunities";
import { recommendationConfig } from "./recommendation-config";

export type RecommendationOpportunityClass = "career" | "funding" | "research" | "program" | "resource";

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function recommendationOpportunityClass(opportunity: Opportunity): RecommendationOpportunityClass {
  const text = normalized(`${opportunity.type} ${opportunity.category}`);
  if (opportunity.type === "AI" || opportunity.type === "Benefit") return "resource";
  if (opportunity.type === "Scholarship" || /scholarship|grant|funding|financial aid/.test(text)) return "funding";
  if (opportunity.type === "Research" || /research|lab/.test(text)) return "research";
  if (/internship|job|co op|career/.test(text)) return "career";
  return "program";
}

function explicitResourcePreference(profile: AdvisorProfile) {
  const preferences = [
    ...profile.goals.preferredOpportunityTypes,
    profile.goals.currentPriority ?? "",
  ].map(normalized);
  return preferences.some((value) => /\b(ai|software|tool|benefit|discount)\b/.test(value));
}

export function resourceRecommendationLimit(profile: AdvisorProfile, context: OpportunityStudentContext, limit: number) {
  const sustainedResourceBehavior = (context.resourceBehaviorScore ?? 0) >= 10;
  const strongEvidence = explicitResourcePreference(profile) || sustainedResourceBehavior;
  return Math.min(limit, strongEvidence
    ? recommendationConfig.diversity.maxConvenienceResourcesWithStrongEvidence
    : recommendationConfig.diversity.maxConvenienceResources);
}
