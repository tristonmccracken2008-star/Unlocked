import type { OpportunityLifecycleConfidence, OpportunityLifecycleEvidenceSource } from "./opportunity-lifecycle-types";

export type OpportunityChangeField =
  | "deadline"
  | "opening_date"
  | "eligibility"
  | "award"
  | "compensation"
  | "location"
  | "work_mode"
  | "program_dates"
  | "application_status"
  | "cycle"
  | "requirements"
  | "application_process"
  | "application_url";

export type OpportunityChangeType =
  | "deadline_announced"
  | "deadline_extended"
  | "deadline_moved_earlier"
  | "deadline_removed"
  | "opening_date_changed"
  | "eligibility_expanded"
  | "eligibility_tightened"
  | "eligibility_updated"
  | "award_changed"
  | "compensation_changed"
  | "location_changed"
  | "work_mode_changed"
  | "program_dates_changed"
  | "applications_opened"
  | "applications_reopened"
  | "applications_closed"
  | "opportunity_canceled"
  | "cycle_updated"
  | "requirements_changed"
  | "application_process_changed"
  | "application_url_changed";

export type OpportunityChangeImportance = "critical" | "important" | "informational";

export type OpportunityChangeEvent = {
  id: string;
  opportunityId: string;
  identityId: string;
  cycleId: string;
  field: OpportunityChangeField;
  changeType: OpportunityChangeType;
  previousValue?: string;
  newValue?: string;
  detectedAt: string;
  effectiveAt: string;
  source: OpportunityLifecycleEvidenceSource;
  sourceUrl?: string;
  confidence: OpportunityLifecycleConfidence;
  importance: OpportunityChangeImportance;
  userRelevant: boolean;
  notificationEligible: boolean;
  calendarImpact: boolean;
  workspaceImpact: boolean;
  idempotencyKey: string;
};

export type OpportunityChangeDiagnostic = {
  id: string;
  opportunityId: string;
  eventIds: string[];
  processedAt: string;
  recipients: number;
  notificationsScheduled: number;
  calendarProjected: boolean;
  workspaceProjected: boolean;
  errorCategory?: string;
};
