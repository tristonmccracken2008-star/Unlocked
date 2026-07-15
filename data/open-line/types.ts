import type { Opportunity } from "../opportunities";
import type { StudentActivity } from "../student-activity";
import type { StudentProfile } from "../student-profile";
import type { StudentProgress } from "../student-progress";

export const openLineModelVersion = "open-line-data-v1";
export const openLineBranchRulesVersion = "open-line-branches-v1";
export const openLineNarrativeRulesVersion = "open-line-narratives-v1";

export type JourneyEventType =
  | "opportunity_viewed"
  | "opportunity_saved"
  | "opportunity_chosen"
  | "application_started"
  | "application_submitted"
  | "interview_reached"
  | "accepted"
  | "opportunity_completed"
  | "skill_evidence_created"
  | "goal_selected"
  | "goal_changed"
  | "direction_paused"
  | "direction_closed";

export type ProgressLevel = "exploration" | "intention" | "action" | "commitment" | "validation";

export type JourneyEventSource = "journey_status" | "saved_opportunity" | "profile" | "milestone" | "manual_evidence";

export type JourneyEvent = {
  id: string;
  userId: string;
  type: JourneyEventType;
  occurredAt: string;
  opportunityId?: string;
  organizationId?: string;
  category?: string;
  careerDirection?: string;
  previousCareerDirection?: string;
  skillIds?: string[];
  source: JourneyEventSource;
  evidence?: {
    label: string;
    referenceId?: string;
  };
  visibility: "private" | "shareable";
  publicSafe: boolean;
};

export type PathEventKind = "origin" | "explored" | "chosen" | "active" | "submitted" | "validated" | "accepted" | "completed" | "paused" | "closed" | "future";

export type PathEvent = {
  id: string;
  kind: PathEventKind;
  occurredAt: string | null;
  progressLevel: ProgressLevel;
  title: string;
  narrative: string;
  whatChanged?: string;
  opportunityId?: string;
  organizationId?: string;
  careerDirection?: string;
  category?: string;
  /** Canonical semantic direction before the primary path is projected to `main`. */
  directionKey?: string;
  branchKey: string;
  importance: number;
  shareable: boolean;
  publicSafe: boolean;
  narrativeMomentId?: string;
  narrativeTemplateKey?: string;
  publicNarrative?: {
    title: string;
    narrative: string;
    whatChanged?: string;
  };
};

export type NarrativeMomentKind =
  | "origin"
  | "exploration"
  | "direction"
  | "action"
  | "commitment"
  | "validation"
  | "experience"
  | "reflection"
  | "transition";

export type NarrativeStoryType =
  | "origin"
  | "direction"
  | "expansion"
  | "commitment"
  | "validation"
  | "acceptance"
  | "experience"
  | "skill"
  | "rejoin"
  | "pause"
  | "closed_opportunity"
  | "waypoint"
  | "horizon"
  | "exploration"
  | "action";

export type NarrativeExplanationSource =
  | "event_type"
  | "branch_transition"
  | "validation_evidence"
  | "rejoin_evidence"
  | "opportunity_metadata"
  | "roadmap_metadata"
  | "skill_evidence"
  | "safe_fallback";

export type NarrativeTemplateParameters = Record<string, string | number>;

export type NarrativeText = {
  title: string;
  body: string;
  explanation?: string;
  titleTemplateKey: string;
  bodyTemplateKey: string;
  explanationTemplateKey?: string;
  parameters: NarrativeTemplateParameters;
};

export type NarrativeEventCopy = NarrativeText & {
  eventId: string;
  publicCopy: NarrativeText;
  confidence: number;
  explanationSource: NarrativeExplanationSource;
};

export type NarrativeMoment = NarrativeText & {
  id: string;
  kind: NarrativeMomentKind;
  storyType: NarrativeStoryType;
  occurredAt: string | null;
  evidenceEventIds: string[];
  publicSafe: boolean;
  confidence: number;
  explanationSource: NarrativeExplanationSource;
  branchKey?: string;
  publicCopy: NarrativeText;
};

export type NarrativeWaypointMeaning = {
  id: string;
  title: string;
  whyItMatters: string;
  estimatedMinutes?: number;
  impact: "low" | "medium" | "high";
  sourceOpportunityId?: string;
  source: "recommendation" | "roadmap";
  confidence: number;
  explanationSource: NarrativeExplanationSource;
  templateKey: string;
  parameters: NarrativeTemplateParameters;
};

export type NarrativeHorizonMeaning = {
  id: string;
  title: string;
  rationale: string;
  branchKey?: string;
  confidence: number;
  explanationSource: NarrativeExplanationSource;
  templateKey: string;
  parameters: NarrativeTemplateParameters;
};

export type NarrativeSuppressionReason =
  | "saved_only"
  | "low_value_exploration"
  | "merged_exploration"
  | "duplicate_moment"
  | "insufficient_evidence"
  | "private_public_projection";

export type NarrativeMergeReason = "exploration_sequence";

export type NarrativeDiagnostics = {
  sourceEventCount: number;
  momentCount: number;
  suppressedMoments: Array<{ opaqueEventId: string; reason: NarrativeSuppressionReason }>;
  mergedNarratives: Array<{ opaqueMomentId: string; eventCount: number; reason: NarrativeMergeReason }>;
  explanationSources: Array<{ source: NarrativeExplanationSource; count: number }>;
  deterministicSignature: string;
};

export type OpenLineNarrativeResult = {
  version: string;
  signature: string;
  origin: NarrativeMoment;
  eventNarratives: NarrativeEventCopy[];
  moments: NarrativeMoment[];
  waypoint?: NarrativeWaypointMeaning;
  horizon: NarrativeHorizonMeaning[];
  diagnostics: NarrativeDiagnostics;
};

export type PublicNarrativeMoment = Pick<NarrativeMoment, "id" | "kind" | "storyType" | "occurredAt" | "title" | "body" | "explanation" | "confidence">;

export type PublicOpenLineNarrativeResult = {
  version: string;
  signature: string;
  origin: Pick<NarrativeText, "title" | "body" | "explanation">;
  moments: PublicNarrativeMoment[];
};

export type JourneyDirectionKind =
  | "career"
  | "academic"
  | "experience"
  | "skill"
  | "opportunity_category"
  | "personal_goal";

export type JourneyDirectionState = "exploring" | "active" | "paused" | "closed" | "rejoined";

export type JourneyDirection = {
  key: string;
  kind: JourneyDirectionKind;
  label: string;
  state: JourneyDirectionState;
  startedAt: string;
  lastMeaningfulActivityAt: string;
  endedAt?: string;
  eventIds: string[];
  evidenceEventIds: string[];
  parentDirectionKey?: string;
  rejoinTargetKey?: string;
  confidence: number;
  publicSafe: boolean;
};

export type DirectionTransition = "continued" | "expanded" | "shifted" | "paused" | "closed" | "rejoined";

export type DirectionTransitionRecord = {
  id: string;
  type: DirectionTransition;
  directionKey: string;
  occurredAt: string;
  supportingEventIds: string[];
  previousDirectionKey?: string;
  explanation: string;
};

export type RejoinReason = "shared_goal" | "shared_skill" | "experience_completed" | "direction_synthesis";

export type RejoinEvidence = {
  id: string;
  sourceBranchKeys: string[];
  targetBranchKey: string;
  reason: RejoinReason;
  supportingEventIds: string[];
  supportingSkillIds?: string[];
  confidence: number;
  explanation: string;
};

export type ValidationEvidenceType = "interview" | "acceptance" | "award" | "completed_experience" | "verified_skill_evidence";

export type ValidationEvidence = {
  eventId: string;
  type: ValidationEvidenceType;
  externalSourceId?: string;
  organizationId?: string;
  occurredAt: string;
  confidence: number;
  publicSafe: boolean;
};

export type IgnoredDirectionCandidateReason =
  | "insufficient_evidence"
  | "saved_only"
  | "duplicate_alias"
  | "private"
  | "low_confidence"
  | "display_limit";

export type BranchIntelligenceDiagnostics = {
  sourceDirectionCount: number;
  visibleDirectionCount: number;
  primaryDirectionKey?: string;
  visibleBranchKeys: string[];
  collapsedBranchKeys: string[];
  rejoinCount: number;
  validationCount: number;
  skillStrandCount: number;
  ignoredCandidates: Array<{ opaqueKey: string; reason: IgnoredDirectionCandidateReason }>;
  deterministicSignature: string;
};

export type BranchEventAssignment = {
  eventId: string;
  directionKey: string;
};

export type BranchIntelligenceResult = {
  version: string;
  signature: string;
  primaryDirectionKey?: string;
  directions: JourneyDirection[];
  secondaryDirectionKeys: string[];
  visibleSecondaryDirectionKeys: string[];
  eventAssignments: BranchEventAssignment[];
  transitions: DirectionTransitionRecord[];
  rejoins: RejoinEvidence[];
  validationEvidence: ValidationEvidence[];
  diagnostics: BranchIntelligenceDiagnostics;
};

export type PathBranch = {
  key: string;
  label: string;
  eventIds: string[];
  startedAt: string;
  endedAt?: string;
  state: "active" | "paused" | "closed" | "rejoined";
};

export type PathWaypoint = {
  id: string;
  title: string;
  whyItMatters: string;
  estimatedMinutes?: number;
  impact: "low" | "medium" | "high";
  sourceOpportunityId?: string;
  source: "recommendation" | "roadmap";
};

export type PathPossibility = {
  id: string;
  title: string;
  rationale: string;
  branchKey?: string;
};

export type Pathprint = {
  version: string;
  signature: string;
  userId: string;
  generatedAt: string;
  origin: PathEvent;
  events: PathEvent[];
  branches: PathBranch[];
  currentWaypoint?: PathWaypoint;
  horizon: PathPossibility[];
  branchIntelligence?: BranchIntelligenceResult;
  narrative?: OpenLineNarrativeResult;
  summary: {
    currentDirection?: string;
    strongestProgressLevel: ProgressLevel;
    meaningfulEventCount: number;
    validationCount: number;
  };
};

export type PublicPathEvent = Omit<PathEvent, "opportunityId" | "organizationId" | "careerDirection" | "directionKey" | "narrativeMomentId" | "narrativeTemplateKey" | "publicNarrative">;

export type PublicPathprint = {
  version: string;
  signature: string;
  origin: PublicPathEvent;
  events: PublicPathEvent[];
  branches: Array<Omit<PathBranch, "key" | "label"> & { id: string }>;
  narrative?: PublicOpenLineNarrativeResult;
  summary: Pick<Pathprint["summary"], "strongestProgressLevel" | "meaningfulEventCount" | "validationCount">;
};

export type DirectionHistoryRecord = {
  id?: string;
  type: "goal_selected" | "goal_changed" | "direction_paused" | "direction_closed";
  occurredAt: string;
  careerDirection: string;
  previousCareerDirection?: string;
  visibility?: "private" | "shareable";
};

export type ManualEvidenceRecord = {
  id: string;
  occurredAt: string;
  label: string;
  skillIds: string[];
  opportunityId?: string;
  category?: string;
  visibility?: "private" | "shareable";
  publicSafe?: boolean;
};

export type MilestoneDefinition = {
  id: string;
  title: string;
  category?: string;
  requiredSkills?: string[];
};

export type OpenLineWaypointSource = {
  type: "recommendation" | "roadmap";
  id: string;
  title: string;
  whyItMatters: string;
  estimatedTime?: string;
  impact?: string;
  sourceOpportunityId?: string;
  relatedOpportunityCategories?: string[];
  requiredSkills?: string[];
  recommendedBefore?: string[];
  unlocks?: string[];
};

export type OpenLineHorizonSource = {
  id: string;
  title: string;
  rationale: string;
  branchKey?: string;
  sourceOpportunityId?: string;
  requiredSkills?: string[];
  prerequisiteMilestoneIds?: string[];
};

export type OpenLineInput = {
  userId: string;
  profile?: StudentProfile | null;
  activity?: StudentActivity | null;
  savedRecords?: readonly { opportunityId: string; savedAt: string }[];
  progress?: StudentProgress | null;
  opportunities?: readonly Opportunity[];
  directionHistory?: readonly DirectionHistoryRecord[];
  manualEvidence?: readonly ManualEvidenceRecord[];
  milestoneDefinitions?: readonly MilestoneDefinition[];
  currentWaypoint?: OpenLineWaypointSource | null;
  horizon?: readonly OpenLineHorizonSource[];
  generatedAt?: string;
};

export type IgnoredJourneyEventReason =
  | "duplicate_semantic_event"
  | "missing_timestamp"
  | "missing_opportunity_metadata"
  | "missing_milestone_label"
  | "invalid_direction_record"
  | "invalid_evidence_record"
  | "exploration_does_not_create_branch";

export type JourneyNormalizationDiagnostics = {
  sourceEventCount: number;
  ignored: Record<IgnoredJourneyEventReason, number>;
};

export type JourneyNormalizationResult = {
  events: JourneyEvent[];
  diagnostics: JourneyNormalizationDiagnostics;
};

export type OpenLineDiagnostics = {
  sourceEventCount: number;
  normalizedEventCount: number;
  pathEventCount: number;
  branchCount: number;
  currentWaypointSource: PathWaypoint["source"] | "none";
  ignoredEvents: Array<{ reason: IgnoredJourneyEventReason; count: number }>;
  privacyExclusions: {
    privateEventCount: number;
    publicUnsafeEventCount: number;
    excludedSensitiveFields: string[];
  };
  branchIntelligence?: BranchIntelligenceDiagnostics;
  narrative?: NarrativeDiagnostics;
};
