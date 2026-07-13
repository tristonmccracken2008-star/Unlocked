import type { AdvisorProfile } from "./advisor-engine";
import { careerRoadmapForStage, scoreCareerRoadmapFit } from "./career-roadmaps";
import { advisorRuleKnowledgeReference, mergeKnowledgeReferences, milestoneKnowledgeReferences, opportunityKnowledgeReferences, type KnowledgeReferences } from "./knowledge-references";
import { getMilestoneOpportunityConnections, toMilestone, type Milestone } from "./milestone-engine";
import { buildOpportunityConfidence, type OpportunityConfidenceProfile } from "./opportunity-confidence";
import { evaluateOpportunityEligibility } from "./opportunity-eligibility";
import { getOpportunityIntelligence, isSchoolEligible, scoreOpportunityIntelligence, type OpportunityPriority, type OpportunityScore, type OpportunityStudentContext } from "./opportunity-intelligence";
import { getOpportunityRelationship, type OpportunityRelationship } from "./opportunity-relationships";
import { opportunities as catalogOpportunities, type Opportunity } from "./opportunities";
import { auditFinalOpportunityRecommendation, buildRecommendationHealthMonitor, careerAdvisorFit, evaluateProfessionalRecommendationCandidate, type RecommendationHealthMonitor } from "./recommendation-professional-pipeline";
import { getRoadmap, type RoadmapImportance, type RoadmapMilestone } from "./roadmap-engine";
import { buildRecommendationWeeklyStrategy, type RecommendationWeeklyStrategy } from "./recommendation-weekly-strategy";
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
  confidenceLevel: "High" | "Medium" | "Low";
  confidenceBreakdown: OpportunityConfidenceProfile;
  estimatedValue: number | null;
  estimatedValueLabel: string;
  nextAction: string;
  relatedOpportunityId?: string;
  relatedMilestoneId?: string;
  categories: string[];
  score: number;
  knowledgeReferences: KnowledgeReferences;
  explainability: {
    whyThisUser: string;
    whyNow: string;
    whyThisOpportunity: string;
    whyAboveAlternatives: string;
    evidence: string[];
  };
};

export type RecommendationEngineResult = {
  recommendations: RecommendationV1[];
  generatedAt: string;
  weeklyStrategy: RecommendationWeeklyStrategy;
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
  careerRoadmapBoost: number;
  relationshipBoost: number;
  relationship: OpportunityRelationship | null;
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
  health: RecommendationHealthMonitor;
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

function confidenceLevel(confidence: number): RecommendationV1["confidenceLevel"] {
  if (confidence >= recommendationConfig.confidence.highThreshold) return "High";
  if (confidence >= recommendationConfig.confidence.mediumThreshold) return "Medium";
  return "Low";
}

export function buildOpportunityStudentContext(profile: AdvisorProfile): OpportunityStudentContext {
  const trackedRecords = Object.values(profile.experience.tracked);
  const feedbackRecords = profile.future.recommendationFeedback ?? [];
  const negativeFeedback = feedbackRecords.filter((record) => ["not-relevant", "dismissed", "dont-enjoy-this", "not-interested", "too-expensive", "too-time-consuming"].includes(record.feedbackType));
  const hiddenOpportunityIds = unique([
    ...(profile.future.hiddenOpportunityIds ?? []),
    ...negativeFeedback.flatMap((record) => record.actionId.startsWith("opportunity:") ? [record.actionId.replace("opportunity:", "")] : []),
  ]);
  const dismissedOpportunityIds = unique([
    ...(profile.future.dismissedOpportunityIds ?? []),
    ...negativeFeedback.flatMap((record) => record.recommendationId.startsWith("recommendation-opportunity-") ? [record.recommendationId.replace("recommendation-opportunity-", "")] : []),
  ]);
  const ignoredCategories = unique(negativeFeedback.map((record) => record.signal ?? "").filter((signal) => signal.startsWith("category:")).map((signal) => signal.replace("category:", "")));
  const { stagePlan } = careerRoadmapForStage(profile.goals.careerGoal, profile.academics.timelineStage);
  const categoryCounts = trackedRecords.reduce((counts, record) => counts.set(record.status, (counts.get(record.status) ?? 0) + 1), new Map<string, number>());
  const underusedCategories = stagePlan.categories.filter((category) => !(profile.future.opportunityCategoriesUsed ?? []).includes(category) && (categoryCounts.get(category) ?? 0) === 0).slice(0, 3);
  return {
    schoolSlug: profile.school.slug,
    schoolName: profile.school.name,
    institutionType: profile.academics.institutionType,
    enrollmentStatus: profile.academics.enrollmentStatus,
    degreeLevel: profile.academics.degreeLevel,
    citizenshipStatus: profile.academics.citizenshipStatus,
    workAuthorization: profile.academics.workAuthorization,
    residency: profile.academics.residency,
    age: profile.academics.age,
    transferStatus: profile.academics.transferStatus,
    financialNeedStatus: profile.academics.financialNeedStatus,
    meritStatus: profile.academics.meritStatus,
    eligibilityAttributes: profile.academics.eligibilityAttributes,
    major: profile.academics.major,
    minor: profile.academics.minor,
    academicYear: profile.academics.academicYear,
    careerGoals: profile.goals.careerGoal,
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
    hiddenOpportunityIds,
    dismissedOpportunityIds,
    ignoredCategories,
    careerRoadmapCategories: stagePlan.categories,
    careerRoadmapSignals: stagePlan.opportunitySignals,
    careerTargetOrganizations: stagePlan.targetOrganizations,
    skillPriorities: stagePlan.skills,
    underusedCategories,
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
  if (opportunity.verification_status === "temporarily_closed") return "Check the official source for the next application cycle before planning next steps.";
  if (opportunity.verification_status === "needs_review") return "Confirm current availability on the official source before adding this to your shortlist.";
  if (score.breakdown.deadlineDays !== null && score.breakdown.deadlineDays >= 0 && score.breakdown.deadlineDays <= 10 && (opportunity.metadata.verification?.deadlineVerified === true || opportunity.verification_status === "verified")) return "Review the official source today and apply before the deadline.";
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
  const careerFit = scoreCareerRoadmapFit(ranked.opportunity, profile.goals.careerGoal, profile.academics.timelineStage);
  const relationship = ranked.relationship ?? getOpportunityRelationship(ranked.opportunity, [ranked.opportunity]);
  return unique([
    `You are a ${profile.academics.timelineStage.toLowerCase()} ${profile.academics.major} student.`,
    ...ranked.score.reasons,
    ...ranked.milestoneReasons,
    ranked.roadmapBoost > 0 ? `Fits your roadmap priority: ${intelligence.category}.` : "",
    ranked.careerRoadmapBoost > 0 ? `Fits the ${careerFit.roadmap.label} progression for your current stage.` : "",
    relationship.prerequisites.length ? `Next step is clear: ${relationship.prerequisites[0]}.` : "",
    relationship.followUps.length ? "This can unlock stronger follow-up opportunities later." : "",
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
  const recommendationConfidence = clamp(score + (profile.student.completedProfile ? 8 : 0));
  return {
    id: `recommendation-milestone-${milestone.id}`,
    kind: "Milestone",
    title: milestone.title,
    description: milestone.description,
    reason: primaryReason(reasons),
    reasons,
    priority,
    confidence: recommendationConfidence,
    confidenceLevel: confidenceLevel(recommendationConfidence),
    confidenceBreakdown: {
      eligibilityConfidence: 100,
      metadataConfidence: 100,
      verificationConfidence: 100,
      recommendationConfidence,
      overallConfidence: recommendationConfidence,
      level: recommendationConfidence >= 78 ? "High" : recommendationConfidence >= 55 ? "Moderate" : "Low",
    },
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
    explainability: {
      whyThisUser: reasons[0],
      whyNow: reasons[1] ?? "This milestone matches the student's current academic stage.",
      whyThisOpportunity: reasons[2] ?? "This milestone supports the student's structured roadmap.",
      whyAboveAlternatives: `This is the highest-priority incomplete milestone with a structured score of ${score}.`,
      evidence: reasons,
    },
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

function rankOpportunity(profile: AdvisorProfile, opportunity: Opportunity, context: OpportunityStudentContext, milestones: readonly Milestone[], roadmapCategories: readonly string[], source: readonly Opportunity[]): RankedOpportunity {
  const score = scoreOpportunityIntelligence(opportunity, context);
  const connections = milestones.flatMap((milestone) => getMilestoneOpportunityConnections(milestone, [opportunity]));
  const milestoneReasons = unique(connections.flatMap((connection) => connection.reasons));
  const intelligence = getOpportunityIntelligence(opportunity);
  const roadmapBoost = roadmapCategories.includes(intelligence.category) || roadmapCategories.includes(opportunity.category) ? 10 : 0;
  const careerFit = scoreCareerRoadmapFit(opportunity, profile.goals.careerGoal, profile.academics.timelineStage);
  const careerRoadmapBoost = Math.min(24, careerFit.score);
  const advisorFit = careerAdvisorFit(profile, opportunity);
  const relationship: OpportunityRelationship | null = null;
  const relationshipBoost = 0;
  const savedBoost = profile.experience.savedOpportunityIds.includes(opportunity.id) ? 5 : 0;
  const activeApplicationBoost = progressForOpportunity(profile, opportunity.id) ? 7 : 0;
  const connectionBoost = Math.min(12, milestoneReasons.length * 6);
  const advisorBoost = advisorFit.shouldDoNext ? 6 : 0;
  const finalScore = Math.max(0, score.rawScore + roadmapBoost + careerRoadmapBoost + advisorBoost + relationshipBoost + savedBoost + activeApplicationBoost + connectionBoost);
  return { opportunity, score, milestoneReasons, roadmapBoost, careerRoadmapBoost, relationshipBoost, relationship, progressBoost: savedBoost + activeApplicationBoost, finalScore };
}

function qualityGateFailures(ranked: RankedOpportunity) {
  const failures: string[] = [];
  const { opportunity, score, finalScore } = ranked;
  if (!score.breakdown.schoolEligible) failures.push("Not eligible for the student's school.");
  if (recommendationConfig.verificationQuality.excludedStatuses.includes(opportunity.verification_status as never)) failures.push("Verification status excludes this opportunity from recommendations.");
  if (!score.breakdown.matchingYears.length && opportunity.academic_years.length && !opportunity.academic_years.includes("Any Year")) failures.push("Does not match the student's class year.");
  if (score.breakdown.gpaEligible === false) failures.push("Student GPA is below the listed GPA requirement.");
  if (score.breakdown.deadlineDays !== null && score.breakdown.deadlineDays < 0) failures.push("Deadline has passed.");
  if (score.positiveSignalCount < recommendationConfig.qualityGates.minimumPositiveSignals) failures.push("Fewer than two meaningful positive recommendation signals.");
  if (score.personalizedSignalCount < recommendationConfig.qualityGates.minimumPersonalizedSignals) failures.push("No strong student-specific relevance signal.");
  if (finalScore < recommendationConfig.qualityGates.minimumRecommendationScore) failures.push("Final recommendation score is below the quality gate.");
  if (!score.reasons.some((reason) => /matches|accepts|available|deadline|verified|gpa|supports|open to/i.test(reason))) failures.push("Missing factual explanation reasons.");
  if (ranked.finalScore < recommendationConfig.thresholds.worthReviewing) failures.push("Confidence is below the visible recommendation threshold.");
  if (ranked.score.confidence < recommendationConfig.confidence.mediumThreshold) failures.push("Professional advisor confidence is too low.");
  return failures;
}

function toOpportunityRecommendation(profile: AdvisorProfile, ranked: RankedOpportunity): RecommendationV1 {
  const opportunity = ranked.opportunity;
  const application = progressForOpportunity(profile, opportunity.id);
  const priority = recommendationPriority(ranked.finalScore, ranked.score.priority);
  const reasons = opportunityReasons(profile, ranked);
  const context = buildOpportunityStudentContext(profile);
  const eligibility = evaluateOpportunityEligibility(opportunity, context);
  const recommendationConfidence = clamp((ranked.score.confidence + ranked.finalScore) / 2);
  const confidenceBreakdown = buildOpportunityConfidence(opportunity, context, recommendationConfidence, eligibility);
  const applicableEvidence = eligibility.checks.filter((check) => check.applicable && check.proven).map((check) => check.evidence).filter(Boolean);
  return {
    id: `recommendation-opportunity-${opportunity.id}`,
    kind: "Opportunity",
    title: opportunity.title,
    description: opportunity.description,
    reason: primaryReason(reasons),
    reasons,
    priority,
    confidence: confidenceBreakdown.overallConfidence,
    confidenceLevel: confidenceLevel(confidenceBreakdown.overallConfidence),
    confidenceBreakdown,
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
    explainability: {
      whyThisUser: reasons.find((reason) => /major|class year|school|priority|career goal/i.test(reason)) ?? reasons[0],
      whyNow: reasons.find((reason) => /deadline|current priority|roadmap|current stage/i.test(reason)) ?? `It supports the ${profile.academics.timelineStage.toLowerCase()} stage of your roadmap.`,
      whyThisOpportunity: reasons.find((reason) => /verified|available|matches|accepts/i.test(reason)) ?? "It passed every applicable eligibility and data-quality check.",
      whyAboveAlternatives: `It passed every applicable eligibility gate and earned a structured quality score of ${ranked.finalScore}.`,
      evidence: applicableEvidence.slice(0, 8),
    },
  };
}

function shouldExcludeOpportunity(profile: AdvisorProfile, opportunity: Opportunity, context: OpportunityStudentContext) {
  if (!evaluateProfessionalRecommendationCandidate(opportunity, context).allowed) return true;
  if (recommendationConfig.verificationQuality.excludedStatuses.includes(opportunity.verification_status as never)) return true;
  if (!isSchoolEligible(opportunity, context)) return true;
  if (!opportunity.organization.trim() || !opportunity.eligibility.trim() || !opportunity.official_source_url.startsWith("https://")) return true;
  if (profile.experience.claimedOpportunityIds.includes(opportunity.id)) return true;
  if ((profile.future.hiddenOpportunityIds ?? []).includes(opportunity.id)) return true;
  if ((profile.future.dismissedOpportunityIds ?? []).includes(opportunity.id)) return true;
  if ((profile.future.recommendationFeedback ?? []).some((record) => record.recommendationId === `recommendation-opportunity-${opportunity.id}` && ["dismissed", "not-interested", "already-completed", "completed"].includes(record.feedbackType))) return true;
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
  const context = contextWithLearning(buildOpportunityStudentContext(profile), source);
  const prefiltered = source.filter((opportunity) => !shouldExcludeOpportunity(profile, opportunity, context));
  return prefiltered
    .map((opportunity) => rankOpportunity(profile, opportunity, context, activeMilestones, roadmap.opportunityPriorities, source))
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
    let bestIndex = -1;
    let bestScore = -Infinity;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const orgCount = organizationCounts.get(candidate.opportunity.organization) ?? 0;
      const categoryCount = categoryCounts.get(candidate.opportunity.category) ?? 0;
      const typeCount = typeCounts.get(candidate.opportunity.type) ?? 0;
      if (orgCount >= config.maxSameOrganization || categoryCount >= config.maxSameCategory || typeCount >= config.maxSameType) continue;
      let adjusted = candidate.finalScore;
      if (orgCount >= config.maxSameOrganizationBeforePenalty) adjusted -= config.organizationPenalty * orgCount;
      if (categoryCount >= config.maxSameCategoryBeforePenalty) adjusted -= config.categoryPenalty * categoryCount;
      if (typeCount >= config.maxSameTypeBeforePenalty) adjusted -= config.typePenalty * typeCount;
      if (adjusted > bestScore || (adjusted === bestScore && (bestIndex < 0 || candidate.opportunity.title.localeCompare(remaining[bestIndex].opportunity.title) < 0))) {
        bestScore = adjusted;
        bestIndex = index;
      }
    }
    if (bestIndex < 0) break;
    const [next] = remaining.splice(bestIndex, 1);
    selected.push(next);
    organizationCounts.set(next.opportunity.organization, (organizationCounts.get(next.opportunity.organization) ?? 0) + 1);
    categoryCounts.set(next.opportunity.category, (categoryCounts.get(next.opportunity.category) ?? 0) + 1);
    typeCounts.set(next.opportunity.type, (typeCounts.get(next.opportunity.type) ?? 0) + 1);
  }
  const selectedSource = ranked.map((item) => item.opportunity);
  return selected.map((item) => toOpportunityRecommendation(profile, { ...item, relationship: getOpportunityRelationship(item.opportunity, selectedSource) }));
}

export function rankOpportunityRecommendations(input: RecommendationEngineInput): RecommendationV1[] {
  const limit = input.limit ?? 24;
  const context = contextWithLearning(buildOpportunityStudentContext(input.advisorProfile), input.opportunities ?? catalogOpportunities);
  const ranked = rankAllOpportunities(input).filter((item) => qualityGateFailures(item).length === 0);
  const primary = ranked.filter((item) => !recommendationConfig.verificationQuality.suppressFromPremiumStatuses.includes(item.opportunity.verification_status as never) && !recommendationConfig.verificationQuality.nonActionableStatuses.includes(item.opportunity.verification_status as never));
  const fallback = ranked.filter((item) => !primary.includes(item));
  return diversityAdjustedOpportunityRecommendations(input.advisorProfile, primary.length >= limit ? primary : [...primary, ...fallback], limit)
    .filter((recommendation) => {
      const opportunity = (input.opportunities ?? catalogOpportunities).find((item) => item.id === recommendation.relatedOpportunityId);
      return opportunity ? auditFinalOpportunityRecommendation(recommendation, opportunity, context).approved : true;
    });
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
    health: buildRecommendationHealthMonitor(diversified, sourceForDiagnostics(input), contextWithLearning(buildOpportunityStudentContext(input.advisorProfile), input.opportunities ?? catalogOpportunities)),
  };
}

function sourceForDiagnostics(input: RecommendationEngineInput) {
  return [...(input.opportunities ?? catalogOpportunities)];
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
    weeklyStrategy: buildRecommendationWeeklyStrategy(recommendations),
    inputs: {
      major: input.advisorProfile.academics.major,
      year: input.advisorProfile.academics.academicYear,
      careerGoal: input.advisorProfile.goals.careerGoal,
      milestoneCount: milestoneRecommendations.length,
      opportunityCount: input.opportunities?.length ?? catalogOpportunities.length,
    },
  };
}
