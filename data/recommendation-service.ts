import { buildAdvisorBrain, type AdvisorBrainDashboard } from "./advisor-brain";
import { createAdvisorProfile } from "./advisor-engine";
import { opportunities, type Opportunity } from "./opportunities";
import type { RecommendationV1 } from "./recommendation-engine";
import type { School } from "./seed";
import type { StudentActivity } from "./student-activity";
import type { StudentProfile } from "./student-profile";
import { inferApplicationsFromActivity, type StudentProgress } from "./student-progress";

export type RecommendationMatchLabel = "Excellent Match" | "Strong Match" | "Good Match" | "Worth Reviewing" | "Limited Match";
export type RecommendationServiceInput = {
  profile: StudentProfile;
  school: School;
  activity: StudentActivity;
  progress: StudentProgress;
  source?: readonly Opportunity[];
};
export type RecommendationViewModel = {
  recommendation: RecommendationV1;
  opportunity: Opportunity | null;
  href: string;
  label: RecommendationMatchLabel;
  reasons: string[];
  chips: string[];
};
export type RecommendationServiceResult = {
  brain: AdvisorBrainDashboard;
  recommendations: RecommendationViewModel[];
  topRecommendation: RecommendationViewModel | null;
};

export function recommendationMatchLabel(recommendation: RecommendationV1): RecommendationMatchLabel {
  if (recommendation.confidence >= 90) return "Excellent Match";
  if (recommendation.confidence >= 78) return "Strong Match";
  if (recommendation.confidence >= 62) return "Good Match";
  if (recommendation.confidence >= 42) return "Worth Reviewing";
  return "Limited Match";
}

function recommendationHref(recommendation: RecommendationV1) {
  if (recommendation.relatedOpportunityId) return `/opportunities/${recommendation.relatedOpportunityId}`;
  const params = new URLSearchParams();
  if (recommendation.categories[0]) params.set("category", recommendation.categories[0]);
  if (recommendation.kind === "Opportunity") params.set("query", recommendation.title);
  return `/opportunities${params.size ? `?${params.toString()}` : ""}`;
}

function recommendationChips(recommendation: RecommendationV1, opportunity: Opportunity | null) {
  const chips = [
    opportunity?.academic_years.includes("First year") || opportunity?.academic_years.includes("Any Year") ? "Freshman eligible" : "",
    recommendation.reasons.find((reason) => /major/i.test(reason)) ? "Matches your major" : "",
    recommendation.reasons.find((reason) => /skill|technical|evidence/i.test(reason)) ? "Builds useful skills" : "",
    opportunity?.remote ? "Remote" : "",
    opportunity?.paid ? "Paid" : "",
  ].filter(Boolean);
  return [...new Set(chips)].slice(0, 3);
}

export function buildRecommendationService(input: RecommendationServiceInput): RecommendationServiceResult {
  const source = input.source ?? opportunities;
  const inferredProgress = inferApplicationsFromActivity(input.activity, source, input.progress);
  const advisorProfile = createAdvisorProfile({ profile: input.profile, school: input.school, activity: input.activity, progress: inferredProgress });
  const brain = buildAdvisorBrain({ advisorProfile, opportunities: source, progress: inferredProgress });
  const completed = new Set(Object.values(inferredProgress.applications).filter((item) => ["accepted", "completed", "rejected"].includes(item.status)).map((item) => item.opportunityId));
  const recommendations = brain.recommendations
    .filter((recommendation) => recommendation.relatedOpportunityId && !completed.has(recommendation.relatedOpportunityId))
    .map((recommendation) => {
      const opportunity = source.find((item) => item.id === recommendation.relatedOpportunityId) ?? null;
      return {
        recommendation,
        opportunity,
        href: recommendationHref(recommendation),
        label: recommendationMatchLabel(recommendation),
        reasons: recommendation.reasons.slice(0, 4),
        chips: recommendationChips(recommendation, opportunity),
      };
    });
  return { brain, recommendations, topRecommendation: recommendations[0] ?? null };
}
