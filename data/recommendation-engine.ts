import type { AdvisorProfile } from "./advisor-engine";
import { careerRoadmapForStage, scoreCareerRoadmapFit } from "./career-roadmaps";
import { advisorRuleKnowledgeReference, mergeKnowledgeReferences, milestoneKnowledgeReferences, opportunityKnowledgeReferences, type KnowledgeReferences } from "./knowledge-references";
import { getMilestoneOpportunityConnections, toMilestone, type Milestone } from "./milestone-engine";
import { buildOpportunityConfidence, type OpportunityConfidenceProfile } from "./opportunity-confidence";
import { opportunityEligibilityDataConfidence, opportunityVerificationConfidence } from "./opportunity-confidence";
import { evaluateOpportunityEligibility } from "./opportunity-eligibility";
import { normalizeOpportunityEligibility } from "./opportunity-eligibility-model";
import { getOpportunityIntelligence, isSchoolEligible, scoreOpportunityIntelligence, getDeadlineDays, type OpportunityPriority, type OpportunityScore, type OpportunityStudentContext } from "./opportunity-intelligence";
import { getOpportunityRelationship, type OpportunityRelationship } from "./opportunity-relationships";
import { opportunities as catalogOpportunities, type Opportunity } from "./opportunities";
import { auditFinalOpportunityRecommendation, buildRecommendationHealthMonitor, careerAdvisorFit, evaluateProfessionalRecommendationCandidate, validateOpportunityData, type RecommendationHealthMonitor } from "./recommendation-professional-pipeline";
import { getRoadmap, type RoadmapImportance, type RoadmapMilestone } from "./roadmap-engine";
import { buildRecommendationWeeklyStrategy, type RecommendationWeeklyStrategy } from "./recommendation-weekly-strategy";
import { labelForRecommendationScore, recommendationConfig } from "./recommendation-config";
import type { ApplicationRecord, StudentProgress } from "./student-progress";

export type RecommendationKind = "Opportunity" | "Milestone" | "Next Action";
export type RecommendationTier = "excellent" | "strong" | "explore";

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
  tier: RecommendationTier;
  portfolio?: {
    role: "core" | "exploration";
    canonicalCategory: string;
    semanticCluster: string;
    impactScore: number;
    exposureCount: number;
    premiumSignals: string[];
  };
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
  opportunityRecommendations: RecommendationV1[];
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
  canonicalCategory: string;
  semanticCluster: string;
  explorationCandidate: boolean;
  exposureCount: number;
  previousTop: boolean;
  rotationBoost: number;
  feedRole: "core" | "exploration";
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
  recommendationTier: RecommendationTier;
  eligibilityStatus: string;
  eligibilityEvidence: string[];
  dataConfidence: number;
  verificationConfidence: number;
  survivedFinalAudit: boolean;
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
  funnel: RecommendationCandidateFunnel;
};

export type RecommendationCandidateFunnel = {
  totalCatalog: number;
  verificationEligible: number;
  educationLevelEligible: number;
  schoolEligible: number;
  classYearEligible: number;
  gpaEligible: number;
  citizenshipEligible: number;
  statusDeadlineEligible: number;
  confidenceEligible: number;
  rankingEligible: number;
  diversitySelected: number;
  finalRecommendations: number;
  tierCounts: Record<RecommendationTier, number>;
  fallbackAttempted: boolean;
  topRejectionReasons: { reason: string; count: number }[];
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
const defaultProfessionalCandidateIndex = catalogOpportunities.filter((opportunity) => validateOpportunityData(opportunity).allowed);

const unique = <T,>(items: T[]) => [...new Set(items.filter(Boolean))];

function deterministicRotationBoost(id: string, key: string) {
  let hash = 2166136261;
  for (const character of `${key}:${id}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % (recommendationConfig.diversity.rotationRange + 1);
}

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
    preferredCategories: profile.goals.preferredOpportunityTypes,
    careerRoadmapSignals: stagePlan.opportunitySignals,
    careerTargetOrganizations: stagePlan.targetOrganizations,
    skillPriorities: stagePlan.skills,
    underusedCategories,
  };
}

function contextWithLearning(context: OpportunityStudentContext, source: readonly Opportunity[]) {
  const opportunityById = new Map(source.map((item) => [item.id, item]));
  const categoryFor = (id: string) => opportunityById.get(id)?.category;
  const organizationFor = (id: string) => opportunityById.get(id)?.organization;
  return {
    ...context,
    savedCategories: unique((context.savedOpportunityIds ?? []).map(categoryFor).filter((item): item is string => Boolean(item))),
    viewedCategories: unique((context.viewedOpportunityIds ?? []).map(categoryFor).filter((item): item is string => Boolean(item))),
    completedCategories: unique((context.completedOpportunityIds ?? []).map(categoryFor).filter((item): item is string => Boolean(item))),
    interactedOrganizations: unique((context.viewedOpportunityIds ?? []).map(organizationFor).filter((item): item is string => Boolean(item))),
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
    tier: "strong",
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
  const learnedCategory = [...(context.savedCategories ?? []), ...(context.viewedCategories ?? []), ...(context.preferredCategories ?? [])]
    .some((category) => [opportunity.category, opportunity.type, intelligence.category].includes(category));
  // Exploration is category-level discovery, not weak personalization. A candidate can
  // still match the student's major or goals while broadening beyond their stated mix.
  const directlyAligned = score.breakdown.matchingCurrentPriority || roadmapBoost > 0;
  const explorationCandidate = !learnedCategory
    && !directlyAligned
    && score.personalizedSignalCount >= 1
    && score.positiveSignalCount >= recommendationConfig.qualityGates.minimumPositiveSignals;
  const exposureCount = profile.future.recommendationExposureCounts?.[opportunity.id] ?? 0;
  const previousTop = (profile.future.previousTopOpportunityIds ?? []).includes(opportunity.id);
  const rotationBoost = deterministicRotationBoost(opportunity.id, profile.future.feedRotationKey ?? "stable");
  return {
    opportunity,
    score,
    milestoneReasons,
    roadmapBoost,
    careerRoadmapBoost,
    relationshipBoost,
    relationship,
    progressBoost: savedBoost + activeApplicationBoost,
    finalScore,
    canonicalCategory: intelligence.category,
    semanticCluster: intelligence.semanticCluster,
    explorationCandidate,
    exposureCount,
    previousTop,
    rotationBoost,
    feedRole: "core",
  };
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

function toOpportunityRecommendation(profile: AdvisorProfile, ranked: RankedOpportunity, context: OpportunityStudentContext, forcedTier?: RecommendationTier): RecommendationV1 {
  const opportunity = ranked.opportunity;
  const application = progressForOpportunity(profile, opportunity.id);
  const priority = recommendationPriority(ranked.finalScore, ranked.score.priority);
  const reasons = opportunityReasons(profile, ranked);
  const eligibility = evaluateOpportunityEligibility(opportunity, context);
  const recommendationConfidence = clamp((ranked.score.confidence + ranked.finalScore) / 2);
  const confidenceBreakdown = buildOpportunityConfidence(opportunity, context, recommendationConfidence, eligibility);
  const applicableEvidence = eligibility.checks.filter((check) => check.applicable && check.proven).map((check) => check.evidence).filter(Boolean);
  const intelligence = getOpportunityIntelligence(opportunity);
  const premiumSignals = unique([
    intelligence.freshness === "New" ? "New" : "",
    opportunity.featured ? "Editor's Pick" : "",
    ranked.score.breakdown.deadlineDays !== null && ranked.score.breakdown.deadlineDays >= 0 && ranked.score.breakdown.deadlineDays <= 14 ? "Deadline Soon" : "",
    intelligence.impactScore >= 45 ? "High Impact" : "",
    opportunity.difficulty === "Highly Competitive" ? "Highly Selective" : opportunity.difficulty === "Competitive" ? "Competitive" : "",
    ranked.feedRole === "exploration" ? "Worth Discovering" : "",
  ]).slice(0, 2);
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
    tier: forcedTier ?? (eligibility.actionable && ranked.finalScore >= recommendationConfig.thresholds.excellent ? "excellent" : eligibility.actionable ? "strong" : "explore"),
    portfolio: {
      role: ranked.feedRole,
      canonicalCategory: ranked.canonicalCategory,
      semanticCluster: ranked.semanticCluster,
      impactScore: intelligence.impactScore,
      exposureCount: ranked.exposureCount,
      premiumSignals,
    },
    knowledgeReferences: mergeKnowledgeReferences(
      opportunityKnowledgeReferences(opportunity),
      advisorRuleKnowledgeReference("opportunity_recommendation_v1"),
    ),
    explainability: {
      whyThisUser: reasons.find((reason) => /major|class year|school|priority|career goal/i.test(reason)) ?? reasons[0],
      whyNow: reasons.find((reason) => /deadline|current priority|roadmap|current stage/i.test(reason)) ?? `It supports the ${profile.academics.timelineStage.toLowerCase()} stage of your roadmap.`,
      whyThisOpportunity: reasons.find((reason) => /verified|available|matches|accepts/i.test(reason)) ?? "It passed every applicable eligibility and data-quality check.",
      whyAboveAlternatives: `It passed every applicable eligibility gate and strengthened the feed's mix of value, relevance, and variety with a structured score of ${ranked.finalScore}.`,
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
  if (profile.experience.savedOpportunityIds.includes(opportunity.id)) return true;
  if ((profile.future.hiddenOpportunityIds ?? []).includes(opportunity.id)) return true;
  if ((profile.future.dismissedOpportunityIds ?? []).includes(opportunity.id)) return true;
  if ((profile.future.recommendationFeedback ?? []).some((record) => record.recommendationId === `recommendation-opportunity-${opportunity.id}` && ["dismissed", "not-interested", "already-completed", "completed"].includes(record.feedbackType))) return true;
  const trackerRecord = profile.experience.tracked[opportunity.id];
  if (trackerRecord && ["Saved", "Interested", "Applying", "Submitted", "Interview", "Accepted", "Rejected", "Completed"].includes(trackerRecord.status)) return true;
  const application = progressForOpportunity(profile, opportunity.id);
  return Boolean(application && terminalApplicationStatuses.has(application.status));
}

function rankAllOpportunities(input: RecommendationEngineInput, context: OpportunityStudentContext) {
  const { advisorProfile: profile, progress } = input;
  const requestedSource = input.opportunities ?? catalogOpportunities;
  const source = requestedSource === catalogOpportunities ? defaultProfessionalCandidateIndex : requestedSource;
  const roadmap = getRoadmap(profile, progress);
  const activeMilestones = roadmap.upcomingMilestones.slice(0, 4).map((milestone) => toMilestone(milestone, progress));
  const prefiltered = source.filter((opportunity) => !shouldExcludeOpportunity(profile, opportunity, context));
  return prefiltered
    .map((opportunity) => rankOpportunity(profile, opportunity, context, activeMilestones, roadmap.opportunityPriorities, source))
    .sort((a, b) => b.finalScore - a.finalScore || priorityWeight[b.score.priority] - priorityWeight[a.score.priority] || a.opportunity.title.localeCompare(b.opportunity.title));
}

function diversityAdjustedOpportunityRecommendations(profile: AdvisorProfile, ranked: RankedOpportunity[], context: OpportunityStudentContext, limit: number, forcedTier?: RecommendationTier) {
  const config = recommendationConfig.diversity;
  const selected: RankedOpportunity[] = [];
  const remaining = [...ranked];
  const organizationCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  const semanticClusterCounts = new Map<string, number>();
  const explorationTarget = Math.min(limit, Math.max(1, Math.round(limit * config.explorationShare)));
  let explorationCount = 0;
  while (selected.length < limit && remaining.length) {
    const choose = (allowSemanticRepeat: boolean) => {
      let bestIndex = -1;
      let bestScore = -Infinity;
      const slotsLeft = limit - selected.length;
      const explorationNeeded = Math.max(0, explorationTarget - explorationCount);
      const canForceExploration = slotsLeft <= explorationNeeded && remaining.some((candidate) => candidate.explorationCandidate);
      for (let index = 0; index < remaining.length; index += 1) {
        const candidate = remaining[index];
        const orgCount = organizationCounts.get(candidate.opportunity.organization) ?? 0;
        const categoryCount = categoryCounts.get(candidate.canonicalCategory) ?? 0;
        const typeCount = typeCounts.get(candidate.opportunity.type) ?? 0;
        const semanticCount = semanticClusterCounts.get(candidate.semanticCluster) ?? 0;
        if (orgCount >= config.maxSameOrganization || categoryCount >= config.maxSameCategory || typeCount >= config.maxSameType) continue;
        if (!allowSemanticRepeat && semanticCount >= config.maxSameSemanticCluster) continue;
        if (canForceExploration && !candidate.explorationCandidate) continue;
        const stableTop = selected.length < config.stableTopSlots;
        let adjusted = candidate.finalScore;
        if (orgCount >= config.maxSameOrganizationBeforePenalty) adjusted -= config.organizationPenalty * orgCount;
        if (categoryCount >= config.maxSameCategoryBeforePenalty) adjusted -= config.categoryPenalty * categoryCount;
        if (typeCount >= config.maxSameTypeBeforePenalty) adjusted -= config.typePenalty * typeCount;
        if (semanticCount) adjusted -= config.semanticClusterPenalty * semanticCount;
        if (stableTop && candidate.previousTop) adjusted += config.previousTopContinuityBoost;
        if (!stableTop) {
          adjusted -= Math.min(15, candidate.exposureCount * config.repeatExposurePenalty);
          adjusted += candidate.rotationBoost;
          if (explorationCount < explorationTarget && candidate.explorationCandidate) adjusted += config.explorationBoost;
        }
        if (adjusted > bestScore || (adjusted === bestScore && (bestIndex < 0 || candidate.opportunity.title.localeCompare(remaining[bestIndex].opportunity.title) < 0))) {
          bestScore = adjusted;
          bestIndex = index;
        }
      }
      return bestIndex;
    };
    let bestIndex = choose(false);
    if (bestIndex < 0) bestIndex = choose(true);
    if (bestIndex < 0) break;
    const [next] = remaining.splice(bestIndex, 1);
    const feedRole = selected.length >= config.stableTopSlots && next.explorationCandidate && explorationCount < explorationTarget ? "exploration" : "core";
    selected.push({ ...next, feedRole });
    if (feedRole === "exploration") explorationCount += 1;
    organizationCounts.set(next.opportunity.organization, (organizationCounts.get(next.opportunity.organization) ?? 0) + 1);
    categoryCounts.set(next.canonicalCategory, (categoryCounts.get(next.canonicalCategory) ?? 0) + 1);
    typeCounts.set(next.opportunity.type, (typeCounts.get(next.opportunity.type) ?? 0) + 1);
    semanticClusterCounts.set(next.semanticCluster, (semanticClusterCounts.get(next.semanticCluster) ?? 0) + 1);
  }
  const selectedSource = ranked.map((item) => item.opportunity);
  return selected.map((item) => toOpportunityRecommendation(profile, { ...item, relationship: getOpportunityRelationship(item.opportunity, selectedSource) }, context, forcedTier));
}

function balancedRecommendationPortfolio(profile: AdvisorProfile, candidates: RecommendationV1[], source: readonly Opportunity[], limit: number, primaryId?: string) {
  const config = recommendationConfig.diversity;
  const opportunityById = new Map(source.map((opportunity) => [opportunity.id, opportunity]));
  const remaining = [...candidates];
  const selected: RecommendationV1[] = [];
  const organizations = new Map<string, number>();
  const categories = new Map<string, number>();
  const types = new Map<string, number>();
  const semanticClusters = new Map<string, number>();

  const selectCandidate = (candidate: RecommendationV1) => {
    selected.push(candidate);
    const opportunity = candidate.relatedOpportunityId ? opportunityById.get(candidate.relatedOpportunityId) : undefined;
    if (!opportunity || !candidate.portfolio) return;
    organizations.set(opportunity.organization, (organizations.get(opportunity.organization) ?? 0) + 1);
    categories.set(candidate.portfolio.canonicalCategory, (categories.get(candidate.portfolio.canonicalCategory) ?? 0) + 1);
    types.set(opportunity.type, (types.get(opportunity.type) ?? 0) + 1);
    semanticClusters.set(candidate.portfolio.semanticCluster, (semanticClusters.get(candidate.portfolio.semanticCluster) ?? 0) + 1);
  };

  const primaryIndex = primaryId ? remaining.findIndex((candidate) => candidate.id === primaryId) : -1;
  if (primaryIndex >= 0) selectCandidate(remaining.splice(primaryIndex, 1)[0]);

  while (selected.length < limit && remaining.length) {
    const choose = (allowSemanticRepeat: boolean) => {
      let bestIndex = -1;
      let bestScore = -Infinity;
      for (let index = 0; index < remaining.length; index += 1) {
        const candidate = remaining[index];
        const opportunity = candidate.relatedOpportunityId ? opportunityById.get(candidate.relatedOpportunityId) : undefined;
        const portfolio = candidate.portfolio;
        if (!opportunity || !portfolio) continue;
        const organizationCount = organizations.get(opportunity.organization) ?? 0;
        const categoryCount = categories.get(portfolio.canonicalCategory) ?? 0;
        const typeCount = types.get(opportunity.type) ?? 0;
        const semanticCount = semanticClusters.get(portfolio.semanticCluster) ?? 0;
        if (organizationCount >= config.maxSameOrganization || categoryCount >= config.maxSameCategory || typeCount >= config.maxSameType) continue;
        if (!allowSemanticRepeat && semanticCount >= config.maxSameSemanticCluster) continue;
        const stableTop = selected.length < config.stableTopSlots;
        const previousTop = (profile.future.previousTopOpportunityIds ?? []).includes(opportunity.id);
        let adjusted = candidate.score;
        if (stableTop && previousTop) adjusted += config.previousTopContinuityBoost;
        if (!stableTop) {
          adjusted -= Math.min(15, portfolio.exposureCount * config.repeatExposurePenalty);
          adjusted += deterministicRotationBoost(opportunity.id, profile.future.feedRotationKey ?? "stable");
        }
        adjusted -= categoryCount * config.categoryPenalty;
        adjusted -= semanticCount * config.semanticClusterPenalty;
        if (adjusted > bestScore || (adjusted === bestScore && (bestIndex < 0 || candidate.title.localeCompare(remaining[bestIndex].title) < 0))) {
          bestIndex = index;
          bestScore = adjusted;
        }
      }
      return bestIndex;
    };
    let bestIndex = choose(false);
    if (bestIndex < 0) bestIndex = choose(true);
    if (bestIndex < 0) break;
    selectCandidate(remaining.splice(bestIndex, 1)[0]);
  }

  const explorationTarget = Math.min(Math.max(0, selected.length - config.stableTopSlots), Math.round(selected.length * config.explorationShare));
  const preferredExploration = selected.map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate, index }) => index >= config.stableTopSlots && candidate.portfolio?.role === "exploration");
  const fallbackExploration = selected.map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate, index }) => index >= config.stableTopSlots && candidate.tier === "explore" && candidate.portfolio?.role !== "exploration");
  const explorationIndexes = new Set([...preferredExploration, ...fallbackExploration].slice(0, explorationTarget).map(({ index }) => index));
  return selected.map((candidate, index) => {
    if (!candidate.portfolio) return candidate;
    const role: "core" | "exploration" = explorationIndexes.has(index) ? "exploration" : "core";
    const premiumSignals = unique([
      role === "exploration" ? "Worth Discovering" : "",
      ...candidate.portfolio.premiumSignals.filter((signal) => signal !== "Worth Discovering"),
    ]).slice(0, 2);
    return { ...candidate, portfolio: { ...candidate.portfolio, role, premiumSignals } };
  });
}

function exploreGateFailures(ranked: RankedOpportunity, context: OpportunityStudentContext) {
  const failures: string[] = [];
  const eligibility = evaluateOpportunityEligibility(ranked.opportunity, context);
  const canonical = normalizeOpportunityEligibility(ranked.opportunity);
  if (!eligibility.eligible) failures.push(...eligibility.failures);
  if (canonical.recommendationEligibilityStatus !== "eligible_for_ranking") failures.push(`Recommendation eligibility status is ${canonical.recommendationEligibilityStatus}.`);
  if (ranked.score.positiveSignalCount < 1) failures.push("No useful recommendation signal.");
  if (ranked.finalScore < 24) failures.push("Explore score is below the safe fallback floor.");
  if (ranked.score.confidence < recommendationConfig.confidence.mediumThreshold) failures.push("Explore confidence is too low.");
  return failures;
}

export function rankOpportunityRecommendations(input: RecommendationEngineInput): RecommendationV1[] {
  const limit = input.limit ?? 24;
  const source = input.opportunities ?? catalogOpportunities;
  const context = contextWithLearning(buildOpportunityStudentContext(input.advisorProfile), source);
  const allRanked = rankAllOpportunities(input, context);
  const strict = allRanked.filter((item) => qualityGateFailures(item).length === 0 && evaluateOpportunityEligibility(item.opportunity, context).actionable);
  const strictRecommendations = diversityAdjustedOpportunityRecommendations(input.advisorProfile, strict, context, limit);
  const strictIds = new Set(strictRecommendations.map((item) => item.relatedOpportunityId));
  const explore = allRanked.filter((item) => !strictIds.has(item.opportunity.id) && exploreGateFailures(item, context).length === 0);
  const exploreRecommendations = diversityAdjustedOpportunityRecommendations(input.advisorProfile, explore, context, limit, "explore");
  const portfolio = balancedRecommendationPortfolio(
    input.advisorProfile,
    [...strictRecommendations, ...exploreRecommendations],
    source,
    limit,
    strictRecommendations[0]?.id,
  );
  const opportunityById = new Map(source.map((opportunity) => [opportunity.id, opportunity]));
  return portfolio
    .filter((recommendation) => {
      const opportunity = recommendation.relatedOpportunityId ? opportunityById.get(recommendation.relatedOpportunityId) : undefined;
      return opportunity ? auditFinalOpportunityRecommendation(recommendation, opportunity, context).approved : true;
    });
}

function reviewRecord(ranked: RankedOpportunity, finalRank: number | null, context: OpportunityStudentContext): RecommendationReviewRecord {
  const failures = qualityGateFailures(ranked);
  const eligibility = evaluateOpportunityEligibility(ranked.opportunity, context);
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
    recommendationTier: eligibility.actionable && ranked.finalScore >= recommendationConfig.thresholds.excellent ? "excellent" : eligibility.actionable ? "strong" : "explore",
    eligibilityStatus: eligibility.canonical.recommendationEligibilityStatus,
    eligibilityEvidence: eligibility.checks.filter((check) => check.applicable && check.proven).map((check) => check.evidence).filter(Boolean).slice(0, 8),
    dataConfidence: opportunityEligibilityDataConfidence(ranked.opportunity),
    verificationConfidence: opportunityVerificationConfidence(ranked.opportunity),
    survivedFinalAudit: finalRank !== null,
  };
}

export function buildRecommendationDiagnosticReport(input: RecommendationEngineInput): RecommendationDiagnosticReport {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const context = contextWithLearning(buildOpportunityStudentContext(input.advisorProfile), input.opportunities ?? catalogOpportunities);
  const allRanked = rankAllOpportunities(input, context);
  const eligibleRanked = allRanked.filter((item) => qualityGateFailures(item).length === 0);
  const diversified = rankOpportunityRecommendations(input);
  const finalIds = new Map(diversified.map((item, index) => [item.relatedOpportunityId, index + 1]));
  const finalRankingOrder = allRanked.filter((item) => finalIds.has(item.opportunity.id)).sort((a, b) => (finalIds.get(a.opportunity.id) ?? 999) - (finalIds.get(b.opportunity.id) ?? 999)).map((item) => reviewRecord(item, finalIds.get(item.opportunity.id) ?? null, context));
  const filteredRecommendations = allRanked.filter((item) => qualityGateFailures(item).length > 0 && exploreGateFailures(item, context).length > 0).slice(0, 20).map((item) => reviewRecord(item, null, context));
  const competingOpportunities = allRanked.filter((item) => !finalIds.has(item.opportunity.id) && (qualityGateFailures(item).length === 0 || exploreGateFailures(item, context).length === 0)).slice(0, 10).map((item) => reviewRecord(item, null, context));
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
    health: buildRecommendationHealthMonitor(diversified, sourceForDiagnostics(input), context),
    funnel: buildRecommendationCandidateFunnel(input),
  };
}

function checksPass(opportunity: Opportunity, context: OpportunityStudentContext, keys: readonly string[]) {
  return evaluateOpportunityEligibility(opportunity, context).checks
    .filter((check) => keys.includes(check.key))
    .every((check) => !check.applicable || check.proven);
}

export function buildRecommendationCandidateFunnel(input: RecommendationEngineInput): RecommendationCandidateFunnel {
  const source = [...(input.opportunities ?? catalogOpportunities)];
  const context = contextWithLearning(buildOpportunityStudentContext(input.advisorProfile), source);
  const rejectionCounts = new Map<string, number>();
  for (const opportunity of source) {
    const gate = evaluateProfessionalRecommendationCandidate(opportunity, context);
    if (!gate.allowed) for (const reason of gate.reasons) rejectionCounts.set(reason, (rejectionCounts.get(reason) ?? 0) + 1);
  }
  const verificationEligible = source.filter((opportunity) => opportunity.verification_status === "verified" && !recommendationConfig.verificationQuality.excludedStatuses.includes(opportunity.verification_status as never));
  const educationLevelEligible = verificationEligible.filter((opportunity) => checksPass(opportunity, context, ["critical_metadata", "institution_type", "enrollment_status", "degree_level"]));
  const schoolEligible = educationLevelEligible.filter((opportunity) => checksPass(opportunity, context, ["school_restrictions", "host_institution", "external_student_eligibility"]));
  const classYearEligible = schoolEligible.filter((opportunity) => checksPass(opportunity, context, ["class_year", "major_requirements"]));
  const gpaEligible = classYearEligible.filter((opportunity) => checksPass(opportunity, context, ["gpa", "financial_need", "merit_status"]));
  const citizenshipEligible = gpaEligible.filter((opportunity) => checksPass(opportunity, context, ["citizenship", "work_authorization", "residency", "age", "transfer_status", "invitation_status", "demographic_eligibility"]));
  const statusDeadlineEligible = citizenshipEligible.filter((opportunity) => {
    const deadlineDays = getDeadlineDays(opportunity);
    return !["temporarily_closed", "expired", "archived", "broken_source", "incomplete"].includes(opportunity.verification_status)
      && (deadlineDays === null || deadlineDays >= 0);
  });
  const confidenceEligible = statusDeadlineEligible.filter((opportunity) => evaluateProfessionalRecommendationCandidate(opportunity, context).allowed);
  const ranked = rankAllOpportunities(input, context);
  const rankingEligible = ranked.filter((item) => qualityGateFailures(item).length === 0 || exploreGateFailures(item, context).length === 0);
  const selected = rankOpportunityRecommendations(input);
  const tierCounts = selected.reduce<Record<RecommendationTier, number>>((counts, item) => {
    counts[item.tier] += 1;
    return counts;
  }, { excellent: 0, strong: 0, explore: 0 });
  return {
    totalCatalog: source.length,
    verificationEligible: verificationEligible.length,
    educationLevelEligible: educationLevelEligible.length,
    schoolEligible: schoolEligible.length,
    classYearEligible: classYearEligible.length,
    gpaEligible: gpaEligible.length,
    citizenshipEligible: citizenshipEligible.length,
    statusDeadlineEligible: statusDeadlineEligible.length,
    confidenceEligible: confidenceEligible.length,
    rankingEligible: rankingEligible.length,
    diversitySelected: selected.length,
    finalRecommendations: selected.length,
    tierCounts,
    fallbackAttempted: selected.some((item) => item.tier === "explore"),
    topRejectionReasons: [...rejectionCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([reason, count]) => ({ reason, count })),
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
    opportunityRecommendations,
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
