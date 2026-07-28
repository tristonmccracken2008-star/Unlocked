export const opportunityLifecycleSchemaVersion = 1;

export type OpportunityLifecycleState =
  | "unknown"
  | "upcoming"
  | "open"
  | "rolling"
  | "temporarily_closed"
  | "closed"
  | "canceled"
  | "archived";

export type OpportunityLifecycleDisplayState =
  | OpportunityLifecycleState
  | "closing_soon"
  | "reopened";

export type OpportunityLifecycleConfidence =
  | "confirmed"
  | "strong"
  | "limited"
  | "estimated"
  | "unknown";

export type OpportunityLifecycleReason =
  | "official_status_open"
  | "official_status_closed"
  | "deadline_future"
  | "deadline_passed"
  | "opening_date_future"
  | "opening_date_reached"
  | "rolling_confirmed"
  | "manually_verified"
  | "recurring_pattern"
  | "insufficient_current_evidence"
  | "source_removed"
  | "canceled_by_organization"
  | "record_archived"
  | "conflicting_evidence";

export type OpportunityDatePrecision = "timestamp" | "date" | "month" | "season" | "unknown";
export type OpportunityDateKind =
  | "application_open"
  | "priority_deadline"
  | "final_deadline"
  | "program_start"
  | "program_end"
  | "decision"
  | "expected_opening";

export type OpportunityLifecycleDate = {
  kind: OpportunityDateKind;
  sourceValue: string;
  normalizedValue?: string;
  timezone?: string;
  precision: OpportunityDatePrecision;
  estimated: boolean;
  verifiedAt?: string;
  sourceUrl?: string;
};

export type OpportunityLifecycleEvidenceSource =
  | "official_status"
  | "official_deadline"
  | "official_opening_date"
  | "official_application_page"
  | "structured_source"
  | "manual_review"
  | "historical_pattern"
  | "legacy_record";

export type OpportunityLifecycleEvidence = {
  id: string;
  source: OpportunityLifecycleEvidenceSource;
  observedAt: string;
  value: string;
  sourceUrl?: string;
  confidence: OpportunityLifecycleConfidence;
};

export type OpportunityRecurrenceType =
  | "annual"
  | "semester"
  | "quarterly"
  | "monthly"
  | "irregular"
  | "rolling_cohort"
  | "seasonal";

export type OpportunityRecurrence = {
  type: OpportunityRecurrenceType;
  confidence: OpportunityLifecycleConfidence;
  typicalOpeningMonth?: number;
  typicalDeadlineMonth?: number;
  nextExpectedCycle?: string;
  officialStatement?: string;
};

export type OpportunityLifecycleEventType =
  | "application_opened"
  | "deadline_announced"
  | "deadline_changed"
  | "application_closed"
  | "application_reopened"
  | "opportunity_canceled"
  | "application_url_changed"
  | "eligibility_changed"
  | "program_dates_changed"
  | "cycle_created"
  | "cycle_archived"
  | "confidence_changed";

export type OpportunityLifecycleEvent = {
  id: string;
  opportunityIdentityId: string;
  cycleId: string;
  type: OpportunityLifecycleEventType;
  previousValue?: string;
  newValue?: string;
  effectiveAt: string;
  detectedAt: string;
  evidenceSource: OpportunityLifecycleEvidenceSource;
  confidence: OpportunityLifecycleConfidence;
  idempotencyKey: string;
};

export type OpportunitySourceCheckClassification =
  | "official_application"
  | "official_information"
  | "equivalent_redirect"
  | "organization_homepage"
  | "unrelated_redirect"
  | "authentication_required"
  | "expired_page"
  | "not_found"
  | "temporary_error"
  | "unsafe_protocol"
  | "malformed";

export type OpportunitySourceCheck = {
  url: string;
  checkedAt: string;
  classification: OpportunitySourceCheckClassification;
  status?: number;
  redirectUrl?: string;
};

export type OpportunityLifecycleMetadata = {
  schemaVersion: typeof opportunityLifecycleSchemaVersion;
  migrationId?: string;
  identity: {
    identityId: string;
    aliases?: string[];
    successorOf?: string;
    supersededBy?: string;
  };
  cycle: {
    cycleId: string;
    label?: string;
    previousCycleId?: string;
  };
  state?: OpportunityLifecycleState;
  confidence?: OpportunityLifecycleConfidence;
  reason?: OpportunityLifecycleReason;
  effectiveAt?: string;
  openingDate?: OpportunityLifecycleDate;
  priorityDeadline?: OpportunityLifecycleDate;
  finalDeadline?: OpportunityLifecycleDate;
  programStartDate?: OpportunityLifecycleDate;
  programEndDate?: OpportunityLifecycleDate;
  decisionDate?: OpportunityLifecycleDate;
  recurrence?: OpportunityRecurrence;
  evidence?: OpportunityLifecycleEvidence[];
  events?: OpportunityLifecycleEvent[];
  sourceChecks?: OpportunitySourceCheck[];
  fieldVerifiedAt?: Partial<Record<
    "state" | "deadline" | "applicationUrl" | "openingDate" | "eligibility" | "award" | "location" | "programDates" | "description",
    string
  >>;
  review?: {
    note: string;
    reviewedAt: string;
    reviewer: string;
  };
};

export type OpportunityLifecycleIssueSeverity =
  | "review_soon"
  | "likely_stale"
  | "conflicting_evidence"
  | "broken_source"
  | "unsafe_to_present_as_open";

export type OpportunityLifecycleIssue = {
  code: string;
  severity: OpportunityLifecycleIssueSeverity;
  field: string;
  message: string;
};

export type OpportunityLifecycleSnapshot = {
  identityId: string;
  cycleId: string;
  state: OpportunityLifecycleState;
  displayState: OpportunityLifecycleDisplayState;
  confidence: OpportunityLifecycleConfidence;
  reason: OpportunityLifecycleReason;
  effectiveAt: string;
  actionable: boolean;
  recommendationEligible: boolean;
  recurring: boolean;
  reopened: boolean;
  label: string;
  actionLabel: "View official application" | "View official source";
  actionAllowed: boolean;
  openingDate?: OpportunityLifecycleDate;
  priorityDeadline?: OpportunityLifecycleDate;
  finalDeadline?: OpportunityLifecycleDate;
  programStartDate?: OpportunityLifecycleDate;
  programEndDate?: OpportunityLifecycleDate;
  decisionDate?: OpportunityLifecycleDate;
  recurrence?: OpportunityRecurrence;
  evidence: OpportunityLifecycleEvidence[];
  events: OpportunityLifecycleEvent[];
  issues: OpportunityLifecycleIssue[];
};
