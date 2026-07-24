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
import { getDeadlineDays, getOpportunityIntelligence } from "./opportunity-intelligence";

export type RecommendationMatchLabel = "Excellent Match" | "Strong Match" | "Good Match" | "Worth Reviewing" | "Limited Match" | "Explore";
export type OpportunityScoreLabel = "Exceptional Match" | "Excellent Fit" | "Strong Match" | "Worth Exploring";
export type RecommendationDisplaySignal = {
  kind: "career" | "interest" | "major" | "behavior" | "timing" | "eligibility" | "value" | "trust" | "format" | "exploration" | "impact";
  label: string;
};
export type RecommendationReasonDetail = {
  kind: RecommendationDisplaySignal["kind"];
  label: string;
  detail: string;
};
export type RecommendationTiming = {
  label: string;
  detail: string;
  urgency: "high" | "medium" | "low";
};
export type RecommendationTrustSignal = {
  label: string;
  detail: string;
};
export type SimilarRecommendation = {
  opportunityId: string;
  title: string;
  organization: string;
  category: string;
  href: string;
  relationship: string;
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
  opportunityScore: {
    value: number;
    label: OpportunityScoreLabel;
  };
  whyThisOpportunity: RecommendationReasonDetail[];
  whyApplyNow: RecommendationTiming;
  trustSignals: RecommendationTrustSignal[];
  freshnessLabel?: "New this week" | "Recently added" | "Recently verified";
  historyLabel?: "Viewed before" | "Previously recommended" | "Preference noted";
  similarOpportunities: SimilarRecommendation[];
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

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function opportunityScoreLabel(value: number): OpportunityScoreLabel {
  if (value >= 94) return "Exceptional Match";
  if (value >= 90) return "Excellent Fit";
  if (value >= 84) return "Strong Match";
  return "Worth Exploring";
}

export function buildOpportunityScore(recommendation: RecommendationV1, opportunity: Opportunity) {
  const intelligence = getOpportunityIntelligence(opportunity);
  const normalizedRelevance = clamp(80 + Math.min(recommendation.score, 216) / 12, 80, 98);
  const value = clamp(
    normalizedRelevance * 0.55
      + recommendation.confidence * 0.2
      + intelligence.qualityScore * 0.2
      + intelligence.impactScore * 0.05,
    72,
    99,
  );
  return { value, label: opportunityScoreLabel(value) };
}

function reasonKind(reason: string): RecommendationReasonDetail["kind"] {
  if (/career goal|current priority/i.test(reason)) return "career";
  if (/opportunity interests?|preferred opportunity type/i.test(reason)) return "interest";
  if (/major/i.test(reason)) return "major";
  if (/saved|viewed|explored/i.test(reason)) return "behavior";
  if (/deadline/i.test(reason)) return "timing";
  if (/accepts|available|class year|school/i.test(reason)) return "eligibility";
  if (/verified/i.test(reason)) return "trust";
  if (/variety|mix/i.test(reason)) return "exploration";
  return "impact";
}

function reasonLabel(reason: string) {
  if (/career goal/i.test(reason)) return "Career alignment";
  if (/current priority/i.test(reason)) return "Current priority";
  if (/opportunity interests?/i.test(reason)) return "Interest alignment";
  if (/preferred opportunity type/i.test(reason)) return "Preferred format";
  if (/matches your major/i.test(reason)) return "Major fit";
  if (/saved/i.test(reason)) return "Saved activity";
  if (/viewed|explored/i.test(reason)) return "Recent exploration";
  if (/accepts .*students|class year/i.test(reason)) return "Year eligibility";
  if (/available at|available nationally/i.test(reason)) return "School eligibility";
  if (/deadline/i.test(reason)) return "Timing";
  if (/variety|mix/i.test(reason)) return "Portfolio balance";
  return "Verified fit";
}

function recommendationReasonDetails(recommendation: RecommendationV1) {
  const priority = [
    /career goal/i,
    /current priority/i,
    /opportunity interests?/i,
    /saved|viewed|explored/i,
    /matches your major/i,
    /accepts .*students|class year/i,
    /available at|available nationally/i,
    /deadline/i,
    /variety|mix/i,
  ];
  const ordered = [...recommendation.reasons].sort((left, right) => {
    const leftIndex = priority.findIndex((pattern) => pattern.test(left));
    const rightIndex = priority.findIndex((pattern) => pattern.test(right));
    return (leftIndex < 0 ? priority.length : leftIndex) - (rightIndex < 0 ? priority.length : rightIndex);
  });
  const details = new Map<string, RecommendationReasonDetail>();
  for (const reason of ordered) {
    if (/^You are a /i.test(reason)) continue;
    const label = reasonLabel(reason);
    if (!details.has(label)) details.set(label, { kind: reasonKind(reason), label, detail: conciseReason(reason) });
  }
  return [...details.values()].slice(0, 4);
}

function daysSince(value: string, now = new Date()) {
  const timestamp = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((now.getTime() - timestamp) / 86_400_000)) : Number.POSITIVE_INFINITY;
}

function formattedDeadline(opportunity: Opportunity) {
  if (!opportunity.application_deadline) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(`${opportunity.application_deadline}T00:00:00Z`));
}

function opportunityValueLabel(opportunity: Opportunity) {
  if (opportunity.estimated_value !== null) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
      .format(opportunity.estimated_value);
  }
  return opportunity.metadata.valueLabel ?? opportunity.metadata.awardAmountLabel ?? opportunity.estimated_value_note ?? "Unknown";
}

export function recommendationTiming(opportunity: Opportunity, now = new Date()): RecommendationTiming {
  const deadlineDays = getDeadlineDays(opportunity, now);
  const deadlineVerified = opportunity.metadata.verification?.deadlineVerified === true || opportunity.verification_status === "verified";
  if (deadlineVerified && deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 14) {
    return {
      label: deadlineDays === 0 ? "Closes today" : `${deadlineDays} days left`,
      detail: deadlineDays === 0 ? "The verified application deadline is today." : `Applications close in ${deadlineDays} days.`,
      urgency: "high",
    };
  }
  if (deadlineVerified && deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 45) {
    return { label: "Deadline approaching", detail: `Applications close in ${deadlineDays} days.`, urgency: "medium" };
  }
  if (daysSince(opportunity.date_added, now) <= 30) {
    return { label: "Recently discovered", detail: "Added to UnlockED within the last 30 days.", urgency: "medium" };
  }
  if (opportunity.metadata.deadlineType === "rolling") {
    return { label: "Rolling applications", detail: "The official source lists applications as rolling.", urgency: "low" };
  }
  const deadline = formattedDeadline(opportunity);
  if (deadlineVerified && deadline) {
    return { label: "Deadline confirmed", detail: `The published deadline is ${deadline}.`, urgency: "low" };
  }
  if ((opportunity.estimated_value ?? 0) >= 5_000) {
    return { label: "High documented value", detail: `The listed value is ${opportunityValueLabel(opportunity)}.`, urgency: "low" };
  }
  return { label: "No artificial urgency", detail: "No near-term verified deadline is listed.", urgency: "low" };
}

function recommendationTrustSignals(opportunity: Opportunity, now = new Date()): RecommendationTrustSignal[] {
  const signals: RecommendationTrustSignal[] = [];
  if (opportunity.verification_status === "verified") signals.push({ label: "Official source verified", detail: `Reviewed ${opportunity.last_verified}.` });
  if (opportunity.metadata.verification?.applicationUrlVerified === true) signals.push({ label: "Application link confirmed", detail: "The application link was checked during verification." });
  if (opportunity.metadata.verification?.deadlineVerified === true) signals.push({ label: "Deadline verified", detail: "The published deadline was checked against the official source." });
  if (daysSince(opportunity.last_verified, now) <= 30) signals.push({ label: "Recently reviewed", detail: "Opportunity details were reviewed within the last 30 days." });
  return signals.slice(0, 3);
}

function recommendationFreshnessLabel(opportunity: Opportunity, now = new Date()): RecommendationViewModel["freshnessLabel"] {
  const addedDays = daysSince(opportunity.date_added, now);
  if (addedDays <= 7) return "New this week";
  if (addedDays <= 30) return "Recently added";
  if (daysSince(opportunity.last_verified, now) <= 30) return "Recently verified";
  return undefined;
}

function recommendationHistoryLabel(
  recommendation: RecommendationV1,
  opportunity: Opportunity,
  input: RecommendationServiceInput,
): RecommendationViewModel["historyLabel"] {
  if ((input.feedbackRecords ?? []).some((record) => record.recommendationId === recommendation.id && record.feedbackType === "helpful")) return "Preference noted";
  if (input.activity.viewed.includes(opportunity.id)) return "Viewed before";
  if ((input.recommendationExposureCounts?.[opportunity.id] ?? 0) > 0) return "Previously recommended";
  return undefined;
}

function similarityScore(left: RecommendationViewModel, right: RecommendationViewModel) {
  if (!left.opportunity || !right.opportunity) return 0;
  let score = 0;
  if (left.recommendation.portfolio?.semanticCluster === right.recommendation.portfolio?.semanticCluster) score += 8;
  if (left.opportunity.category === right.opportunity.category) score += 6;
  if (left.opportunity.type === right.opportunity.type) score += 4;
  score += Math.min(3, left.opportunity.majors.filter((major) => major !== "Any Major" && right.opportunity?.majors.includes(major)).length);
  return score;
}

function similarityRelationship(left: RecommendationViewModel, right: RecommendationViewModel) {
  if (!left.opportunity || !right.opportunity) return "Related opportunity";
  const difficulty = { Open: 0, Competitive: 1, "Highly Competitive": 2 } as const;
  const leftDifficulty = left.opportunity.difficulty ? difficulty[left.opportunity.difficulty] : null;
  const rightDifficulty = right.opportunity.difficulty ? difficulty[right.opportunity.difficulty] : null;
  if (leftDifficulty !== null && rightDifficulty !== null && rightDifficulty < leftDifficulty) return "More approachable alternative";
  if (leftDifficulty !== null && rightDifficulty !== null && rightDifficulty > leftDifficulty) return "More selective alternative";
  if (left.recommendation.portfolio?.semanticCluster === right.recommendation.portfolio?.semanticCluster) return "Same focus area";
  if (left.opportunity.category === right.opportunity.category) return `More in ${left.opportunity.category}`;
  return "Related fit";
}

function attachSimilarOpportunities(recommendations: RecommendationViewModel[]) {
  return recommendations.map((view) => {
    const similarOpportunities = recommendations
      .filter((candidate) => candidate.recommendation.id !== view.recommendation.id && candidate.opportunity)
      .map((candidate) => ({ candidate, score: similarityScore(view, candidate) }))
      .sort((left, right) => right.score - left.score || right.candidate.opportunityScore.value - left.candidate.opportunityScore.value)
      .slice(0, 2)
      .map(({ candidate }) => ({
        opportunityId: candidate.opportunity!.id,
        title: candidate.opportunity!.title,
        organization: candidate.opportunity!.organization,
        category: candidate.opportunity!.category,
        href: candidate.href,
        relationship: similarityRelationship(view, candidate),
      }));
    return { ...view, similarOpportunities };
  });
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
      if (!opportunity) return null;
      return {
        recommendation,
        opportunity,
        href: recommendationHref(recommendation),
        label: recommendationMatchLabel(recommendation),
        reasons: recommendation.reasons.slice(0, 6),
        chips: recommendationChips(recommendation, opportunity),
        summaryReason: recommendationSummaryReason(recommendation),
        signals: recommendationDisplaySignals(recommendation, opportunity),
        opportunityScore: buildOpportunityScore(recommendation, opportunity),
        whyThisOpportunity: recommendationReasonDetails(recommendation),
        whyApplyNow: recommendationTiming(opportunity),
        trustSignals: recommendationTrustSignals(opportunity),
        freshnessLabel: recommendationFreshnessLabel(opportunity),
        historyLabel: recommendationHistoryLabel(recommendation, opportunity, input),
        similarOpportunities: [],
      };
    })
    .filter((view): view is NonNullable<typeof view> => Boolean(view));
  const recommendationsWithRelationships = attachSimilarOpportunities(recommendations);
  return { advisorProfile, brain, recommendations: recommendationsWithRelationships, topRecommendation: recommendationsWithRelationships[0] ?? null };
}
