import { buildAdvisorBrain, type AdvisorBrainDashboard } from "./advisor-brain";
import { createAdvisorProfile, type AdvisorProfile } from "./advisor-engine";
import { opportunities, type Opportunity } from "./opportunities";
import type { RecommendationV1 } from "./recommendation-engine";
import type { School } from "./seed";
import type { StudentActivity } from "./student-activity";
import type { StudentProfile } from "./student-profile";
import { inferApplicationsFromActivity, type StudentProgress } from "./student-progress";
import type { AdvisorFeedbackRecord } from "@/lib/advisor/types";
import type { ReferralAccountData } from "@/lib/referrals";
import { getOpportunityIntelligence } from "./opportunity-intelligence";

export type RecommendationMatchLabel = "Excellent Match" | "Strong Match" | "Good Match" | "Worth Reviewing" | "Limited Match" | "Explore";
export type RecommendationDisplaySignal = {
  kind: "career" | "interest" | "major" | "behavior" | "timing" | "eligibility" | "value" | "trust" | "format" | "exploration" | "impact";
  label: string;
};
export type RecommendationServiceInput = {
  profile: StudentProfile;
  school: School;
  activity: StudentActivity;
  progress: StudentProgress;
  source?: readonly Opportunity[];
  feedbackRecords?: AdvisorFeedbackRecord[];
  hiddenOpportunityIds?: string[];
  dismissedOpportunityIds?: string[];
  referralActivity?: ReferralAccountData | null;
  recommendationExposureCounts?: Record<string, number>;
  previousTopOpportunityIds?: string[];
  feedRotationKey?: string;
};
export type RecommendationViewModel = {
  recommendation: RecommendationV1;
  opportunity: Opportunity | null;
  href: string;
  label: RecommendationMatchLabel;
  reasons: string[];
  chips: string[];
  summaryReason?: string;
  signals?: RecommendationDisplaySignal[];
};
export type RecommendationServiceResult = {
  advisorProfile: AdvisorProfile;
  brain: AdvisorBrainDashboard;
  recommendations: RecommendationViewModel[];
  topRecommendation: RecommendationViewModel | null;
};

export function recommendationMatchLabel(recommendation: RecommendationV1): RecommendationMatchLabel {
  if (recommendation.tier === "explore") return "Explore";
  if (recommendation.tier === "excellent") return "Excellent Match";
  return "Strong Match";
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

function capturedReason(reasons: readonly string[], pattern: RegExp) {
  return reasons.find((reason) => pattern.test(reason));
}

function conciseReason(reason: string) {
  return reason.replace(/^Matches your career goal:\s*/i, "Fits your goal in ")
    .replace(/^Matches your opportunity interests?:\s*/i, "Matches your interest in ")
    .replace(/^Matches your major:\s*/i, "Built for ")
    .replace(/^Similar to (.+) opportunities you saved\.$/i, "Similar to opportunities you saved in $1.")
    .replace(/^Similar to (.+) opportunities you viewed\.$/i, "Similar to opportunities you explored in $1.");
}

function recommendationSummaryReason(recommendation: RecommendationV1) {
  const reasons = recommendation.reasons;
  const best = capturedReason(reasons, /career goal/i)
    ?? capturedReason(reasons, /opportunity interests?/i)
    ?? capturedReason(reasons, /opportunities you saved/i)
    ?? capturedReason(reasons, /preferred opportunity type/i)
    ?? capturedReason(reasons, /opportunities you viewed|organization you explored/i)
    ?? capturedReason(reasons, /current priority/i)
    ?? capturedReason(reasons, /matches your major/i)
    ?? capturedReason(reasons, /deadline in/i)
    ?? capturedReason(reasons, /high-impact signals|newly added/i)
    ?? capturedReason(reasons, /accepts .*students|available at|available nationally/i)
    ?? reasons.find((reason) => !/^You are a /i.test(reason))
    ?? "It passed UnlockED's eligibility and relevance checks for your profile.";
  return conciseReason(best);
}

function recommendationDisplaySignals(recommendation: RecommendationV1, opportunity: Opportunity | null): RecommendationDisplaySignal[] {
  const reasons = recommendation.reasons;
  const intelligence = opportunity ? getOpportunityIntelligence(opportunity) : null;
  const candidates: Array<RecommendationDisplaySignal | null> = [
    capturedReason(reasons, /career goal/i) ? { kind: "career", label: "Fits your career goal" } : null,
    capturedReason(reasons, /opportunity interests?/i) ? { kind: "interest", label: "Matches your interests" } : null,
    capturedReason(reasons, /matches your major/i) ? { kind: "major", label: "Matches your major" } : null,
    capturedReason(reasons, /opportunities you saved/i) ? { kind: "behavior", label: "Similar to what you saved" } : null,
    capturedReason(reasons, /opportunities you viewed|organization you explored/i) ? { kind: "behavior", label: "Based on what you explored" } : null,
    capturedReason(reasons, /preferred opportunity type/i) ? { kind: "interest", label: "Preferred opportunity type" } : null,
    capturedReason(reasons, /adds variety to your opportunity mix/i) ? { kind: "exploration", label: "Broadens your mix" } : null,
    recommendation.portfolio?.role === "exploration" ? { kind: "exploration", label: "Worth discovering" } : null,
    capturedReason(reasons, /deadline in/i) ? { kind: "timing", label: capturedReason(reasons, /deadline in/i)!.replace(/\.$/, "") } : null,
    recommendation.portfolio?.premiumSignals.includes("New") ? { kind: "impact", label: "New" } : null,
    recommendation.portfolio?.premiumSignals.includes("Editor's Pick") ? { kind: "impact", label: "Editor's pick" } : null,
    recommendation.portfolio?.premiumSignals.includes("High Impact") ? { kind: "impact", label: "High impact" } : null,
    capturedReason(reasons, /accepts .*students/i) ? { kind: "eligibility", label: capturedReason(reasons, /accepts .*students/i)!.replace(/\.$/, "") } : null,
    opportunity?.difficulty === "Open" ? { kind: "eligibility", label: "Beginner friendly" } : null,
    (opportunity?.estimated_value ?? 0) >= 5_000 ? { kind: "value", label: "High documented value" } : null,
    intelligence && intelligence.impactScore >= 45 ? { kind: "impact", label: "High impact" } : null,
    opportunity?.verification_status === "verified" ? { kind: "trust", label: "Official source verified" } : null,
    opportunity?.paid ? { kind: "format", label: "Paid" } : null,
    opportunity?.remote ? { kind: "format", label: "Remote" } : null,
  ];
  const uniqueSignals = new Map<string, RecommendationDisplaySignal>();
  for (const signal of candidates) if (signal && !uniqueSignals.has(signal.label)) uniqueSignals.set(signal.label, signal);
  return [...uniqueSignals.values()].slice(0, 4);
}

export function buildRecommendationService(input: RecommendationServiceInput): RecommendationServiceResult {
  const source = input.source ?? opportunities;
  const opportunityById = new Map(source.map((opportunity) => [opportunity.id, opportunity]));
  const inferredProgress = inferApplicationsFromActivity(input.activity, source, input.progress);
  const advisorProfile = createAdvisorProfile({ profile: input.profile, school: input.school, activity: input.activity, progress: inferredProgress });
  advisorProfile.future.recommendationFeedback = input.feedbackRecords ?? [];
  advisorProfile.future.hiddenOpportunityIds = input.hiddenOpportunityIds ?? [];
  advisorProfile.future.dismissedOpportunityIds = input.dismissedOpportunityIds ?? [];
  advisorProfile.future.recommendationExposureCounts = input.recommendationExposureCounts ?? {};
  advisorProfile.future.previousTopOpportunityIds = input.previousTopOpportunityIds ?? [];
  advisorProfile.future.feedRotationKey = input.feedRotationKey;
  advisorProfile.future.referralActivity = input.referralActivity ? { completed: input.referralActivity.completed.length, pending: input.referralActivity.pending.length, rewards: input.referralActivity.rewardHistory.map((reward) => reward.rewardKey) } : undefined;
  advisorProfile.future.opportunityCategoriesUsed = [...new Set(Object.keys(input.activity.tracked ?? {}).flatMap((id) => {
    const item = opportunityById.get(id);
    return item ? [item.category, item.type] : [];
  }))];
  const brain = buildAdvisorBrain({ advisorProfile, opportunities: source, progress: inferredProgress });
  const completed = new Set(Object.values(inferredProgress.applications).filter((item) => ["accepted", "completed", "rejected"].includes(item.status)).map((item) => item.opportunityId));
  const recommendations = brain.opportunityRecommendations
    .filter((recommendation) => recommendation.relatedOpportunityId && !completed.has(recommendation.relatedOpportunityId))
    .map((recommendation) => {
      const opportunity = recommendation.relatedOpportunityId ? opportunityById.get(recommendation.relatedOpportunityId) ?? null : null;
      return {
        recommendation,
        opportunity,
        href: recommendationHref(recommendation),
        label: recommendationMatchLabel(recommendation),
        reasons: recommendation.reasons.slice(0, 4),
        chips: recommendationChips(recommendation, opportunity),
        summaryReason: recommendationSummaryReason(recommendation),
        signals: recommendationDisplaySignals(recommendation, opportunity),
      };
    });
  return { advisorProfile, brain, recommendations, topRecommendation: recommendations[0] ?? null };
}
