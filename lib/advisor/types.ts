import type { Opportunity } from "@/data/opportunities";
import type { StudentProfile } from "@/data/student-profile";

export const advisorEngineVersion = "advisor-brain-v0.4";
export const advisorSourceSnapshotVersion = "advisor-brain-v0.4:2026-07-10";

export type AdvisorCareerId = "career.quantitative-trader" | "career.software-engineer" | "career.physician" | "career.general-exploration";
export type AdvisorAcademicStage = "incoming-first-year" | "first-year" | "second-year" | "third-year" | "fourth-year" | "recent-graduate";
export type FeedbackType = "helpful" | "not-relevant" | "already-completed" | "too-expensive" | "too-time-consuming" | "completed" | "dismissed" | "dont-enjoy-this" | "prefer-research" | "prefer-industry" | "not-interested";

export type RawAdvisorProfile = Partial<StudentProfile> & {
  studentId?: string;
  userId?: string;
  academicStage?: string;
  classYear?: string;
  studentYear?: string;
  majors?: string[];
  intendedMajors?: string[];
  careerGoals?: string[] | string;
  targetCareers?: string[] | string;
  weeklyAvailableHours?: number | string;
  hoursPerWeek?: number | string;
  constraints?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  completedDependencyNodes?: string[];
  [key: string]: unknown;
};

export type NormalizedAdvisorProfile = {
  studentId: string;
  academicStage: AdvisorAcademicStage;
  majorIds: string[];
  careerGoals: string[];
  weeklyAvailableHours: number;
  signals: Record<string, number>;
  constraints: Record<string, unknown>;
  preferences: Record<string, unknown>;
  completedDependencyNodes?: string[];
  normalization: {
    unresolvedMajors: string[];
    unresolvedCareerGoals: string[];
    sourceVersion: string;
  };
};

export type ReadinessResult = {
  careerId: AdvisorCareerId;
  overallScore: number;
  dimensionScores: Record<string, number>;
  gaps: {
    signal: string;
    current: number;
    target: number;
    dimension: string;
    gapRatio: number;
    estimatedReadinessGain: number;
  }[];
  confidence: number;
};

export type AdvisorAction = {
  actionId: string;
  signal: string;
  title: string;
  estimatedReadinessGain: number;
  weeklyHoursSuggested: number;
  priorityScore: number;
  reason: string;
  coaching: RecommendationCoaching;
  suppressed?: boolean;
  adaptationReason?: string;
};

export type SemesterPlanItem = {
  sequence: number;
  actionId: string;
  title: string;
  weeklyHours: number;
  successEvidence: string;
  reason: string;
};

export type AdvisorOpportunity = {
  opportunityId: string;
  title: string;
  opportunityType: string;
  careerIds: AdvisorCareerId[];
  eligibility: {
    academicStages?: AdvisorAcademicStage[];
    majorIds?: string[];
    hardRequirements?: string[];
    minimumGpa?: number;
    workAuthorization?: string[];
  };
  requiredSignals?: Record<string, number>;
  developmentSignals?: Record<string, number>;
  deadline: string | null;
  sourceConfidence: "high" | "medium" | "low";
  verifiedAt: string | null;
  sourceOpportunity?: Opportunity;
};

export type DeadlineUrgency = {
  label: "unknown" | "closed" | "immediate" | "high" | "medium" | "low";
  score: number;
  daysRemaining: number | null;
  reason: string;
};

export type EligibilityResult = {
  eligible: boolean;
  reasons: string[];
  confidence: "high" | "medium";
};

export type RankedAdvisorOpportunity = {
  opportunityId: string;
  title: string;
  score: number;
  classification: "target" | "stretch" | "developmental";
  eligibility: EligibilityResult;
  deadlineUrgency: DeadlineUrgency;
  sourceConfidence: "high" | "medium" | "low";
  explanation: string[];
  coaching: RecommendationCoaching;
};

export type RecommendationCoaching = {
  title: string;
  recommendation: string;
  simpleExplanation: string;
  learnMore: string;
  whyThisApplies: string;
  whyThis: string;
  whyNow: string;
  whyRankedAboveAlternatives: string;
  whyBeforeOthers: string;
  notRankedFirst: string;
  prerequisites: string[];
  estimatedTime: string;
  difficulty: "Low" | "Moderate" | "High";
  skillsDeveloped: string[];
  evidenceProduced: string;
  firstStep: string;
  completionChecklist: string[];
  supportingKnowledgeSourceIds: string[];
  impactLabel: "Foundational" | "High impact" | "Helpful" | "Optional";
  alternativePaths: string[];
  alternatives: {
    title: string;
    whyChoose: string;
    advantages: string;
    tradeoffs: string;
    bestFit: string;
    timeCommitment: string;
    unlocks: string;
  }[];
  whatHappensNext: string;
  howDoIStart: string[];
  successEvidence: string;
  informationDrawer: {
    whatIsThis: string;
    whyItMatters: string;
    whoBenefitsMost: string;
    skillsDeveloped: string[];
    difficulty: "Low" | "Moderate" | "High";
    typicalTimeCommitment: string;
    commonMisconceptions: string[];
    examples: string[];
    relatedCareers: string[];
    relatedOpportunities: string[];
  };
  unlockChain: string[];
  trustBasis: ("Employer expectations" | "Academic guidance" | "Prerequisite relationships" | "Recruiting norms" | "Verified opportunity source" | "Incomplete profile evidence")[];
};

export type DependencySequenceItem = string;

export type AdvisorFeedbackRecord = {
  recommendationId: string;
  studentId: string;
  actionId: string;
  signal?: string;
  feedbackType: FeedbackType;
  reason?: string;
  createdAt: string;
  outcomeEvidence?: Record<string, unknown> | null;
};

export type RecommendationAuditRecord = {
  recommendationId: string;
  studentId: string;
  careerId: AdvisorCareerId;
  engineVersion: string;
  generatedAt: string;
  profileHash: string;
  profileVersion: string;
  selectedCareerFramework: AdvisorCareerId;
  selectedMajorFramework: string;
  inputHash: string;
  outputHash: string;
  confidence: number;
  topActionIds: string[];
  sourceSnapshotVersion: string;
};

export type AdvisorOutput = {
  careerId: AdvisorCareerId;
  profileHash: string;
  profileVersion: string;
  recommendationVersion: string;
  generatedAt: string;
  selectedCareerFramework: AdvisorCareerId;
  selectedMajorFramework: string;
  overallReadiness: number;
  dimensionScores: Record<string, number>;
  highestRoiActions: AdvisorAction[];
  semesterPlan: SemesterPlanItem[];
  matchedOpportunities: RankedAdvisorOpportunity[];
  confidence: number;
  advisorExplanation: string[];
  careerCalendar: { term: string; action: string; urgency: string; urgencyScore: number }[];
  dependencySequence: DependencySequenceItem[];
  feedbackPreferences: {
    avoidHighCostActions: boolean;
    avoidHighTimeActions: boolean;
    dismissedSignals: string[];
  };
  engineVersion: string;
  sourceSnapshotVersion: string;
  recommendationId: string;
  auditRecord: RecommendationAuditRecord;
};

export type AdvisorAccountData = {
  normalizedProfiles: NormalizedAdvisorProfile[];
  recommendationSnapshots: AdvisorOutput[];
  auditRecords: RecommendationAuditRecord[];
  feedbackRecords: AdvisorFeedbackRecord[];
  completedActionEvidence: AdvisorFeedbackRecord[];
  updatedAt: string;
};
