import type { AdvisorProfile } from "./advisor-engine";
import { advisorRuleKnowledgeReference, mergeKnowledgeReferences, milestoneKnowledgeReferences, opportunityKnowledgeReferences, type KnowledgeReferences } from "./knowledge-references";
import { getMilestoneOpportunityConnections, toMilestone, type Milestone } from "./milestone-engine";
import { getOpportunityIntelligence, scoreOpportunityIntelligence, type OpportunityPriority, type OpportunityScore, type OpportunityStudentContext } from "./opportunity-intelligence";
import { opportunities as catalogOpportunities, type Opportunity } from "./opportunities";
import { getRoadmap, type RoadmapImportance, type RoadmapMilestone } from "./roadmap-engine";
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
  return {
    schoolSlug: profile.school.slug,
    schoolName: profile.school.name,
    major: profile.academics.major,
    academicYear: profile.academics.academicYear,
    careerGoals: unique([profile.goals.careerGoal, ...profile.goals.primaryGoals]).join(", "),
    interests: unique([...profile.goals.interests, ...profile.goals.topics]),
    savedOpportunityIds: profile.experience.savedOpportunityIds,
    viewedOpportunityIds: profile.experience.viewedOpportunityIds,
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
  ]).slice(0, 6);
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
  if (profile.experience.claimedOpportunityIds.includes(opportunity.id)) return true;
  const application = progressForOpportunity(profile, opportunity.id);
  return Boolean(application && terminalApplicationStatuses.has(application.status));
}

export function rankOpportunityRecommendations(input: RecommendationEngineInput): RecommendationV1[] {
  const { advisorProfile: profile, progress } = input;
  const source = input.opportunities ?? catalogOpportunities;
  const roadmap = getRoadmap(profile, progress);
  const activeMilestones = roadmap.upcomingMilestones.slice(0, 4).map((milestone) => toMilestone(milestone, progress));
  const context = studentContext(profile);
  return source
    .filter((opportunity) => !shouldExcludeOpportunity(profile, opportunity))
    .map((opportunity) => rankOpportunity(profile, opportunity, context, activeMilestones, roadmap.opportunityPriorities))
    .sort((a, b) => b.finalScore - a.finalScore || priorityWeight[b.score.priority] - priorityWeight[a.score.priority] || a.opportunity.title.localeCompare(b.opportunity.title))
    .map((ranked) => toOpportunityRecommendation(profile, ranked));
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
