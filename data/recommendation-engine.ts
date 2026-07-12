import type { AdvisorProfile } from "./advisor-engine";
import { advisorRuleKnowledgeReference, mergeKnowledgeReferences, milestoneKnowledgeReferences, opportunityKnowledgeReferences, type KnowledgeReferences } from "./knowledge-references";
import { getMilestoneOpportunityConnections, toMilestone, type Milestone } from "./milestone-engine";
import { getOpportunityIntelligence, scoreOpportunityIntelligence, type OpportunityPriority, type OpportunityScore, type OpportunityStudentContext } from "./opportunity-intelligence";
import { opportunities as catalogOpportunities, type Opportunity } from "./opportunities";
import { getRoadmap, type RoadmapImportance, type RoadmapMilestone } from "./roadmap-engine";
import { labelForRecommendationScore, recommendationConfig } from "./recommendation-config";
import type { ApplicationRecord, StudentProgress } from "./student-progress";

export type RecommendationKind = "Opportunity" | "Milestone" | "Next Action";

export type RecommendationEngineInput = {
  advisorProfile: AdvisorProfile;
  opportunities?: readonly Opportunity[];
  progress?: StudentProgress;
  limit?: number;
};

export type RecommendationV1 = {
  id: string;
  kind: RecommendationKind;
  title: string;
  description: string;
  reason: string;
  reasons: string[];
  priority: OpportunityPriority;
  confidence: number;
  estimatedValue: number | null;
  estimatedValueLabel: string;
  nextAction: string;
  relatedOpportunityId?: string;
  relatedMilestoneId?: string;
  categories: string[];
  score: number;
  knowledgeReferences: KnowledgeReferences;
};

export type RecommendationEngineResult = {
  recommendations: RecommendationV1[];
  generatedAt: string;
  inputs: {
    major: string;
    year: string;
    careerGoal: string;
    milestoneCount: number;
    opportunityCount: number;
  };
};

type RankedOpportunity = {
  opportunity: Opportunity;
  score: OpportunityScore;
  milestoneReasons: string[];
  roadmapBoost: number;
  progressBoost: number;
  finalScore: number;
};

export type RecommendationReviewRecord = {
  opportunityId: string;
  title: string;
  organization: string;
  finalRank: number | null;
  overallMatch: ReturnType<typeof labelForRecommendationScore>;
  finalScore: number;
  signals: OpportunityScore["signals"];
  reasons: string[];
  filteredOut: boolean;
  filterReasons: string[];
};

export type RecommendationDiagnosticReport = {
  generatedAt: string;
  topRecommendation: RecommendationReviewRecord | null;
  finalRankingOrder: RecommendationReviewRecord[];
  filteredRecommendations: RecommendationReviewRecord[];
  competingOpportunities: RecommendationReviewRecord[];
  performance: {
    opportunityCount: number;
    rankedCount: number;
    recommendedCount: number;
    elapsedMs: number;
  };
};

const priorityWeight: Record<OpportunityPriority, number> = {
  Critical: 4,
  High: 3,
  Recommended: 2,
  Optional: 1,
};

const importanceScore: Record<RoadmapImportance, number> = {
  Critical: 88,
  High: 78,
  Recommended: 66,
  Optional: 52,
};

const terminalApplicationStatuses = new Set(["accepted", "completed", "rejected"]);

const unique = <T,>(items: T[]) => [...new Set(items.filter(Boolean))];

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function recommendationPriority(score: number, fallback: OpportunityPriority): OpportunityPriority {
  if (score >= 88) return "Critical";
  if (score >= 74) return "High";
  if (score >= 48) return "Recommended";
  return fallback === "Critical" ? "High" : "Optional";
}

function studentContext(profile: AdvisorProfile): OpportunityStudentContext {
  const trackedRecords = Object.values(profile.experience.tracked);
  return {
    schoolSlug: profile.school.slug,
    schoolName: profile.school.name,
    major: profile.academics.major,
    minor: profile.academics.minor,
    academicYear: profile.academics.academicYear,
    careerGoals: unique([profile.goals.careerGoal, profile.goals.currentPriority ?? "", ...profile.goals.primaryGoals]).join(", "),
    interests: unique([...profile.goals.interests, ...profile.goals.topics, profile.goals.currentPriority ?? ""]),
    currentPriority: profile.goals.currentPriority,
    gpaStatus: profile.academics.gpaStatus,
    gpa: profile.academics.gpa,
    savedOpportunityIds: profile.experience.savedOpportunityIds,
    viewedOpportunityIds: profile.experience.viewedOpportunityIds,
    activeOpportunityIds: trackedRecords.filter((record) => !["Rejected", "Completed"].includes(record.status)).map((record) => record.id),
    completedOpportunityIds: trackedRecords.filter((record) => record.status === "Completed").map((record) => record.id),
    rejectedOpportunityIds: trackedRecords.filter((record) => record.status === "Rejected").map((record) => record.id),
    acceptedOpportunityIds: trackedRecords.filter((record) => record.status === "Accepted").map((record) => record.id),
  };
}

function contextWithLearning(context: OpportunityStudentContext, source: readonly Opportunity[]) {
  const categoryFor = (id: string) => source.find((item) => item.id === id)?.category;
  return {
    ...context,
    savedCategories: unique((context.savedOpportunityIds ?? []).map(categoryFor).filter((item): item is string => Boolean(item))),
    completedCategories: unique((context.completedOpportunityIds ?? []).map(categoryFor).filter((item): item is string => Boolean(item))),
  };
}

function estimatedValueLabel(opportunity: Opportunity) {
  if (opportunity.estimated_value !== null) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(opportunity.estimated_value);
  }
  return opportunity.metadata.valueLabel ?? opportunity.metadata.awardAmountLabel ?? opportunity.estimated_value_note ?? "Unknown";
}

function milestoneEstimatedValueLabel(milestone: Milestone) {
  if (milestone.unlocks.length) return `Unlocks: ${milestone.unlocks[0]}`;
  return "Unknown";
}

function primaryReason(reasons: string[]) {
  return reasons[0] ?? "Recommended by structured profile, roadmap, and opportunity matching rules.";
}

function nextActionForOpportunity(opportunity: Opportunity, score: OpportunityScore, application?: ApplicationRecord) {
  if (application && ["preparing", "applying", "interview"].includes(application.status)) return application.nextAction ?? "Keep this application moving before the next deadline.";
  if (application?.status === "saved") return "Open your saved opportunity and decide whether to start the application.";
  if (score.breakdown.deadlineDays !== null && score.breakdown.deadlineDays >= 0 && score.breakdown.deadlineDays <= 10) return "Review the official source today and apply before the deadline.";
  if (opportunity.difficulty === "Highly Competitive") return "Open the official source and start gathering required materials early.";
  if (score.breakdown.matchingYears.length && score.breakdown.matchingMajors.length) return "Confirm eligibility on the official source and save it if you plan to apply.";
  return "Open the official source and decide whether this belongs on your shortlist.";
}

function nextActionForMilestone(milestone: Milestone) {
  if (milestone.completionState === "in_progress") return "Finish this milestone before adding new work.";
  if (milestone.requiredBefore.length) return `Start this before ${milestone.requiredBefore[0]}.`;
  return "Set aside time this week to begin this milestone.";
}

function milestoneReasons(profile: AdvisorProfile, milestone: RoadmapMilestone) {
  return [
    `You are a ${profile.academics.timelineStage.toLowerCase()} ${profile.academics.major} student.`,
    `${milestone.title} is recommended for ${milestone.recommendedYear.toLowerCase()} students.`,
    milestone.relatedOpportunityCategories.length ? `It prepares you for ${milestone.relatedOpportunityCategories.slice(0, 2).join(" and ")} opportunities.` : "It supports your current academic and career stage.",
  ];
}

function opportunityReasons(profile: AdvisorProfile, ranked: RankedOpportunity) {
  const intelligence = getOpportunityIntelligence(ranked.opportunity);
  return unique([
    `You are a ${profile.academics.timelineStage.toLowerCase()} ${profile.academics.major} student.`,
    ...ranked.score.reasons,
    ...ranked.milestoneReasons,
    ranked.roadmapBoost > 0 ? `Fits your roadmap priority: ${intelligence.category}.` : "",
    ranked.progressBoost > 0 ? "Matches an opportunity you already saved or started." : "",
    profile.goals.currentPriority && normalizePriority(profile.goals.currentPriority, ranked.opportunity) ? `Matches your current priority: ${profile.goals.currentPriority}.` : "",
  ]).slice(0, 6);
}

function normalizePriority(priority: string, opportunity: Opportunity) {
  const value = priority.toLowerCase();
  const target = `${opportunity.type} ${opportunity.category} ${opportunity.tags.join(" ")}`.toLowerCase();
  if (value.includes("internship")) return target.includes("internship");
  if (value.includes("research")) return target.includes("research");
  if (value.includes("scholarship")) return target.includes("scholarship");
  if (value.includes("benefit")) return target.includes("benefit") || target.includes("software") || target.includes("ai");
  if (value.includes("application")) return target.includes("career") || target.includes("internship") || target.includes("fellowship");
  return false;
}

function rankMilestone(profile: AdvisorProfile, milestone: RoadmapMilestone, progress?: StudentProgress): RecommendationV1 {
  const structured = toMilestone(milestone, progress);
  const baseScore = importanceScore[milestone.importance];
  const stateBoost = structured.completionState === "in_progress" ? 8 : 0;
  const score = clamp(baseScore + stateBoost);
  const priority = recommendationPriority(score, milestone.importance);
  const reasons = milestoneReasons(profile, milestone);
  return {
    id: `recommendation-milestone-${milestone.id}`,
    kind: "Milestone",
    title: milestone.title,
    description: milestone.description,
    reason: primaryReason(reasons),
    reasons,
    priority,
    confidence: clamp(score + (profile.student.completedProfile ? 8 : 0)),
    estimatedValue: null,
    estimatedValueLabel: milestoneEstimatedValueLabel(structured),
    nextAction: nextActionForMilestone(structured),
    relatedMilestoneId: milestone.id,
    categories: unique([structured.category, ...structured.relatedOpportunityCategories]),
    score,
    knowledgeReferences: mergeKnowledgeReferences(
      milestoneKnowledgeReferences(milestone),
      advisorRuleKnowledgeReference("milestone_recommendation_v1"),
    ),
  };
}

function progressForOpportunity(profile: AdvisorProfile, opportunityId: string) {
  const applications = [
    ...profile.progress.activeApplications,
    ...profile.progress.upcomingDeadlines,
    ...profile.progress.applicationsNeedingAttention,
  ];
  return applications.find((record) => record.opportunityId === opportunityId);
}

function rankOpportunity(profile: AdvisorProfile, opportunity: Opportunity, context: OpportunityStudentContext, milestones: readonly Milestone[], roadmapCategories: readonly string[]): RankedOpportunity {
  const score = scoreOpportunityIntelligence(opportunity, context);
  const connections = milestones.flatMap((milestone) => getMilestoneOpportunityConnections(milestone, [opportunity]));
  const milestoneReasons = unique(connections.flatMap((connection) => connection.reasons));
  const intelligence = getOpportunityIntelligence(opportunity);
  const roadmapBoost = roadmapCategories.includes(intelligence.category) || roadmapCategories.includes(opportunity.category) ? 10 : 0;
  const savedBoost = profile.experience.savedOpportunityIds.includes(opportunity.id) ? 5 : 0;
  const activeApplicationBoost = progressForOpportunity(profile, opportunity.id) ? 7 : 0;
  const connectionBoost = Math.min(12, milestoneReasons.length * 6);
  const finalScore = clamp(score.score + roadmapBoost + savedBoost + activeApplicationBoost + connectionBoost);
  return { opportunity, score, milestoneReasons, roadmapBoost, progressBoost: savedBoost + activeApplicationBoost, finalScore };
}

function qualityGateFailures(ranked: RankedOpportunity) {
  const failures: string[] = [];
  const { opportunity, score, finalScore } = ranked;
  if (!score.breakdown.schoolEligible) failures.push("Not eligible for the student's school.");
  if (!score.breakdown.matchingYears.length && opportunity.academic_years.length && !opportunity.academic_years.includes("Any Year")) failures.push("Does not match the student's class year.");
  if (score.breakdown.gpaEligible === false) failures.push("Student GPA is below the listed GPA requirement.");
  if (score.breakdown.deadlineDays !== null && score.breakdown.deadlineDays < 0) failures.push("Deadline has passed.");
  if (score.positiveSignalCount < recommendationConfig.qualityGates.minimumPositiveSignals) failures.push("Fewer than two meaningful positive recommendation signals.");
  if (finalScore < recommendationConfig.qualityGates.minimumRecommendationScore) failures.push("Final recommendation score is below the quality gate.");
  if (!score.reasons.some((reason) => /matches|accepts|available|deadline|verified|gpa|supports|open to/i.test(reason))) failures.push("Missing factual explanation reasons.");
  return failures;
}

function toOpportunityRecommendation(profile: AdvisorProfile, ranked: RankedOpportunity): RecommendationV1 {
  const opportunity = ranked.opportunity;
  const application = progressForOpportunity(profile, opportunity.id);
  const priority = recommendationPriority(ranked.finalScore, ranked.score.priority);
  const reasons = opportunityReasons(profile, ranked);
  return {
    id: `recommendation-opportunity-${opportunity.id}`,
    kind: "Opportunity",
    title: opportunity.title,
    description: opportunity.description,
    reason: primaryReason(reasons),
    reasons,
    priority,
    confidence: clamp((ranked.score.confidence + ranked.finalScore) / 2),
    estimatedValue: opportunity.estimated_value,
    estimatedValueLabel: estimatedValueLabel(opportunity),
    nextAction: nextActionForOpportunity(opportunity, ranked.score, application),
    relatedOpportunityId: opportunity.id,
    categories: unique([opportunity.category, opportunity.type]),
    score: ranked.finalScore,
    knowledgeReferences: mergeKnowledgeReferences(
      opportunityKnowledgeReferences(opportunity),
      advisorRuleKnowledgeReference("opportunity_recommendation_v1"),
    ),
  };
}

function shouldExcludeOpportunity(profile: AdvisorProfile, opportunity: Opportunity) {
  if (opportunity.verification_status === "expired") return true;
  if (!opportunity.organization.trim() || !opportunity.eligibility.trim() || !opportunity.official_source_url.startsWith("https://")) return true;
  if (profile.experience.claimedOpportunityIds.includes(opportunity.id)) return true;
  const trackerRecord = profile.experience.tracked[opportunity.id];
  if (trackerRecord && ["Saved", "Interested", "Applying", "Submitted", "Interview", "Accepted", "Rejected", "Completed"].includes(trackerRecord.status)) return true;
  const application = progressForOpportunity(profile, opportunity.id);
  return Boolean(application && terminalApplicationStatuses.has(application.status));
}

function rankAllOpportunities(input: RecommendationEngineInput) {
  const { advisorProfile: profile, progress } = input;
  const source = input.opportunities ?? catalogOpportunities;
  const roadmap = getRoadmap(profile, progress);
  const activeMilestones = roadmap.upcomingMilestones.slice(0, 4).map((milestone) => toMilestone(milestone, progress));
  const context = contextWithLearning(studentContext(profile), source);
  const prefiltered = source.filter((opportunity) => !shouldExcludeOpportunity(profile, opportunity));
  return prefiltered
    .map((opportunity) => rankOpportunity(profile, opportunity, context, activeMilestones, roadmap.opportunityPriorities))
    .sort((a, b) => b.finalScore - a.finalScore || priorityWeight[b.score.priority] - priorityWeight[a.score.priority] || a.opportunity.title.localeCompare(b.opportunity.title));
}

function diversityAdjustedOpportunityRecommendations(profile: AdvisorProfile, ranked: RankedOpportunity[], limit: number) {
  const config = recommendationConfig.diversity;
  const selected: RankedOpportunity[] = [];
  const remaining = [...ranked];
  const organizationCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  while (selected.length < limit && remaining.length) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const orgCount = organizationCounts.get(candidate.opportunity.organization) ?? 0;
      const categoryCount = categoryCounts.get(candidate.opportunity.category) ?? 0;
      const typeCount = typeCounts.get(candidate.opportunity.type) ?? 0;
      let adjusted = candidate.finalScore;
      if (orgCount >= config.maxSameOrganizationBeforePenalty) adjusted -= config.organizationPenalty * orgCount;
      if (categoryCount >= config.maxSameCategoryBeforePenalty) adjusted -= config.categoryPenalty * categoryCount;
      if (typeCount >= config.maxSameTypeBeforePenalty) adjusted -= config.typePenalty * typeCount;
      if (adjusted > bestScore || (adjusted === bestScore && candidate.opportunity.title.localeCompare(remaining[bestIndex].opportunity.title) < 0)) {
        bestScore = adjusted;
        bestIndex = index;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    selected.push(next);
    organizationCounts.set(next.opportunity.organization, (organizationCounts.get(next.opportunity.organization) ?? 0) + 1);
    categoryCounts.set(next.opportunity.category, (categoryCounts.get(next.opportunity.category) ?? 0) + 1);
    typeCounts.set(next.opportunity.type, (typeCounts.get(next.opportunity.type) ?? 0) + 1);
  }
  return selected.map((item) => toOpportunityRecommendation(profile, item));
}

export function rankOpportunityRecommendations(input: RecommendationEngineInput): RecommendationV1[] {
  const ranked = rankAllOpportunities(input).filter((item) => qualityGateFailures(item).length === 0);
  return diversityAdjustedOpportunityRecommendations(input.advisorProfile, ranked, input.limit ?? 24);
}

function reviewRecord(ranked: RankedOpportunity, finalRank: number | null): RecommendationReviewRecord {
  const failures = qualityGateFailures(ranked);
  return {
    opportunityId: ranked.opportunity.id,
    title: ranked.opportunity.title,
    organization: ranked.opportunity.organization,
    finalRank,
    overallMatch: labelForRecommendationScore(ranked.finalScore),
    finalScore: ranked.finalScore,
    signals: ranked.score.signals,
    reasons: ranked.score.reasons,
    filteredOut: failures.length > 0,
    filterReasons: failures,
  };
}

export function buildRecommendationDiagnosticReport(input: RecommendationEngineInput): RecommendationDiagnosticReport {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const allRanked = rankAllOpportunities(input);
  const eligibleRanked = allRanked.filter((item) => qualityGateFailures(item).length === 0);
  const diversified = diversityAdjustedOpportunityRecommendations(input.advisorProfile, eligibleRanked, input.limit ?? 8);
  const finalIds = new Map(diversified.map((item, index) => [item.relatedOpportunityId, index + 1]));
  const finalRankingOrder = eligibleRanked.filter((item) => finalIds.has(item.opportunity.id)).sort((a, b) => (finalIds.get(a.opportunity.id) ?? 999) - (finalIds.get(b.opportunity.id) ?? 999)).map((item) => reviewRecord(item, finalIds.get(item.opportunity.id) ?? null));
  const filteredRecommendations = allRanked.filter((item) => qualityGateFailures(item).length > 0).slice(0, 20).map((item) => reviewRecord(item, null));
  const competingOpportunities = eligibleRanked.filter((item) => !finalIds.has(item.opportunity.id)).slice(0, 10).map((item) => reviewRecord(item, null));
  const elapsedMs = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - started);
  return {
    generatedAt: new Date().toISOString(),
    topRecommendation: finalRankingOrder[0] ?? null,
    finalRankingOrder,
    filteredRecommendations,
    competingOpportunities,
    performance: {
      opportunityCount: input.opportunities?.length ?? catalogOpportunities.length,
      rankedCount: allRanked.length,
      recommendedCount: finalRankingOrder.length,
      elapsedMs,
    },
  };
}

export function rankMilestoneRecommendations(input: RecommendationEngineInput): RecommendationV1[] {
  const roadmap = getRoadmap(input.advisorProfile, input.progress);
  return roadmap.upcomingMilestones.slice(0, 3).map((milestone) => rankMilestone(input.advisorProfile, milestone, input.progress));
}

export function runRecommendationEngineV1(input: RecommendationEngineInput): RecommendationEngineResult {
  const limit = input.limit ?? 8;
  const opportunityRecommendations = rankOpportunityRecommendations(input);
  const milestoneRecommendations = rankMilestoneRecommendations(input);
  const recommendations = [...milestoneRecommendations, ...opportunityRecommendations]
    .sort((a, b) => b.score - a.score || priorityWeight[b.priority] - priorityWeight[a.priority] || a.title.localeCompare(b.title))
    .slice(0, limit);
  return {
    recommendations,
    generatedAt: new Date().toISOString(),
    inputs: {
      major: input.advisorProfile.academics.major,
      year: input.advisorProfile.academics.academicYear,
      careerGoal: input.advisorProfile.goals.careerGoal,
      milestoneCount: milestoneRecommendations.length,
      opportunityCount: input.opportunities?.length ?? catalogOpportunities.length,
    },
  };
}
