import type { Opportunity } from "../opportunities";
import type { StudentActivity } from "../student-activity";
import type { StudentProfile } from "../student-profile";
import type { StudentProgress } from "../student-progress";

export const openLineModelVersion = "open-line-data-v1";

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
  branchKey: string;
  importance: number;
  shareable: boolean;
  publicSafe: boolean;
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
  summary: {
    currentDirection?: string;
    strongestProgressLevel: ProgressLevel;
    meaningfulEventCount: number;
    validationCount: number;
  };
};

export type PublicPathEvent = Omit<PathEvent, "opportunityId" | "organizationId" | "careerDirection">;

export type PublicPathprint = {
  version: string;
  signature: string;
  origin: PublicPathEvent;
  events: PublicPathEvent[];
  branches: Array<Omit<PathBranch, "key" | "label"> & { id: string }>;
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
};

export type OpenLineHorizonSource = {
  id: string;
  title: string;
  rationale: string;
  branchKey?: string;
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
};
