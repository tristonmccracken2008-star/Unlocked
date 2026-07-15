import type { Opportunity } from "../opportunities";
import type { ApplicationStatus } from "../student-progress";
import type { OpportunityTrackerStatus } from "../student-activity";
import { slug, stableId, validTimestamp } from "./stable";
import type { IgnoredJourneyEventReason, JourneyEvent, JourneyEventType, JourneyNormalizationResult, OpenLineInput, ProgressLevel } from "./types";

export const progressLevelForEvent: Record<JourneyEventType, ProgressLevel> = {
  opportunity_viewed: "exploration",
  opportunity_saved: "exploration",
  opportunity_chosen: "intention",
  goal_selected: "intention",
  goal_changed: "intention",
  direction_paused: "intention",
  direction_resumed: "intention",
  direction_closed: "intention",
  application_started: "action",
  application_submitted: "commitment",
  interview_reached: "validation",
  accepted: "validation",
  opportunity_completed: "validation",
  skill_evidence_created: "validation",
};

export const journeyEventImportance: Record<JourneyEventType, number> = {
  opportunity_viewed: 5,
  opportunity_saved: 10,
  direction_closed: 12,
  direction_paused: 15,
  direction_resumed: 20,
  goal_selected: 18,
  goal_changed: 20,
  opportunity_chosen: 25,
  application_started: 45,
  application_submitted: 65,
  interview_reached: 80,
  skill_evidence_created: 84,
  accepted: 92,
  opportunity_completed: 96,
};

const ignoredReasons: IgnoredJourneyEventReason[] = [
  "duplicate_semantic_event",
  "missing_timestamp",
  "missing_opportunity_metadata",
  "missing_milestone_label",
  "invalid_direction_record",
  "invalid_evidence_record",
  "exploration_does_not_create_branch",
];

type CandidateEvent = Omit<JourneyEvent, "id" | "userId">;

function eventDiagnostics() {
  return Object.fromEntries(ignoredReasons.map((reason) => [reason, 0])) as Record<IgnoredJourneyEventReason, number>;
}

function categoryLabel(opportunity: Opportunity | undefined) {
  if (!opportunity) return undefined;
  if (opportunity.type === "Research") return "research";
  if (opportunity.type === "Scholarship") return "scholarship";
  if (opportunity.type === "Benefit") return "student benefit";
  if (opportunity.type === "AI") return "AI tool";
  if (/internship/i.test(opportunity.category)) return "internship";
  return opportunity.category.trim().toLowerCase() || opportunity.type.toLowerCase();
}

function organizationId(opportunity: Opportunity | undefined) {
  return opportunity?.organization ? `organization:${slug(opportunity.organization)}` : undefined;
}

function eventPrivacy(type: JourneyEventType) {
  if (["application_submitted", "interview_reached", "accepted", "opportunity_completed"].includes(type)) return { visibility: "shareable" as const, publicSafe: true };
  return { visibility: "private" as const, publicSafe: false };
}

function trackerEventType(status: OpportunityTrackerStatus): JourneyEventType | null {
  if (status === "Interested") return "opportunity_chosen";
  if (status === "Applying") return "application_started";
  if (status === "Submitted") return "application_submitted";
  if (status === "Interview") return "interview_reached";
  if (status === "Accepted") return "accepted";
  if (status === "Rejected") return "direction_closed";
  if (status === "Completed") return "opportunity_completed";
  return null;
}

function transitionEventType(transition: import("../student-activity").JourneyProgressTransition): JourneyEventType {
  if (transition === "choose") return "opportunity_chosen";
  if (transition === "start") return "application_started";
  if (transition === "submit") return "application_submitted";
  if (transition === "interview") return "interview_reached";
  if (transition === "accept") return "accepted";
  if (transition === "complete") return "opportunity_completed";
  if (transition === "pause") return "direction_paused";
  if (transition === "resume") return "direction_resumed";
  return "direction_closed";
}

function applicationEventType(status: ApplicationStatus): JourneyEventType {
  if (status === "saved") return "opportunity_saved";
  if (status === "interested") return "opportunity_chosen";
  if (status === "preparing" || status === "applying") return "application_started";
  if (status === "submitted") return "application_submitted";
  if (status === "interview") return "interview_reached";
  if (status === "accepted") return "accepted";
  if (status === "rejected") return "direction_closed";
  return "opportunity_completed";
}

function semanticKey(event: CandidateEvent) {
  const repeatedIdentity = event.type.startsWith("goal_") || event.type.startsWith("direction_") || event.type === "skill_evidence_created" ? event.occurredAt : "";
  return [event.type, event.opportunityId ?? "", event.careerDirection ?? "", event.evidence?.referenceId ?? event.evidence?.label ?? "", repeatedIdentity].join("|");
}

function compareEvents(a: JourneyEvent, b: JourneyEvent) {
  return a.occurredAt.localeCompare(b.occurredAt)
    || journeyEventImportance[a.type] - journeyEventImportance[b.type]
    || (a.opportunityId ?? "").localeCompare(b.opportunityId ?? "")
    || a.id.localeCompare(b.id);
}

export function normalizeJourneyEvents(input: OpenLineInput): JourneyNormalizationResult {
  const diagnostics = { sourceEventCount: 0, ignored: eventDiagnostics() };
  const candidates: CandidateEvent[] = [];
  const opportunities = new Map((input.opportunities ?? []).map((opportunity) => [opportunity.id, opportunity]));
  const savedRecords = new Map((input.savedRecords ?? []).map((record) => [record.opportunityId, record.savedAt]));
  const tracked = input.activity?.tracked ?? {};

  const ignore = (reason: IgnoredJourneyEventReason) => { diagnostics.ignored[reason] += 1; };
  const add = (candidate: Omit<CandidateEvent, "visibility" | "publicSafe"> & Partial<Pick<CandidateEvent, "visibility" | "publicSafe">>) => {
    diagnostics.sourceEventCount += 1;
    if (!validTimestamp(candidate.occurredAt)) { ignore("missing_timestamp"); return; }
    const privacy = eventPrivacy(candidate.type);
    candidates.push({ ...candidate, visibility: candidate.visibility ?? privacy.visibility, publicSafe: candidate.publicSafe ?? privacy.publicSafe });
  };

  for (const _id of [...new Set(input.activity?.viewed ?? [])].sort()) {
    diagnostics.sourceEventCount += 1;
    ignore("missing_timestamp");
  }

  for (const id of [...new Set(input.activity?.saved ?? [])].sort()) {
    if (tracked[id]) continue;
    const progressRecord = input.progress?.applications[id];
    const opportunity = opportunities.get(id);
    add({ type: "opportunity_saved", occurredAt: savedRecords.get(id) ?? progressRecord?.lastUpdated ?? "", opportunityId: id, organizationId: organizationId(opportunity), category: categoryLabel(opportunity), source: "saved_opportunity" });
  }

  for (const [id, savedAt] of [...savedRecords.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (tracked[id] || input.activity?.saved.includes(id)) continue;
    const opportunity = opportunities.get(id);
    add({ type: "opportunity_saved", occurredAt: savedAt, opportunityId: id, organizationId: organizationId(opportunity), category: categoryLabel(opportunity), source: "saved_opportunity" });
  }

  for (const [id, record] of Object.entries(tracked).sort(([a], [b]) => a.localeCompare(b))) {
    const opportunity = opportunities.get(id);
    const legacyRecord = record.version === undefined && record.history === undefined;
    add({ type: legacyRecord ? "opportunity_chosen" : "opportunity_saved", occurredAt: record.savedAt, opportunityId: id, organizationId: organizationId(opportunity), category: categoryLabel(opportunity), source: "journey_status" });
    if (!legacyRecord && record.history?.length) {
      for (const transition of record.history) {
        add({
          type: transitionEventType(transition.transition),
          occurredAt: transition.occurredAt,
          opportunityId: id,
          organizationId: organizationId(opportunity),
          category: categoryLabel(opportunity),
          source: "journey_status",
          evidence: { label: transition.transition, referenceId: transition.id },
        });
      }
    } else if (record.status !== "Saved") {
      const type = trackerEventType(record.status);
      if (type) add({ type, occurredAt: record.updatedAt, opportunityId: id, organizationId: organizationId(opportunity), category: categoryLabel(opportunity), source: "journey_status" });
    }
  }

  for (const id of [...new Set(input.activity?.claimed ?? [])].sort()) {
    diagnostics.sourceEventCount += 1;
    ignore("missing_timestamp");
  }

  for (const [id, record] of Object.entries(input.progress?.applications ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    const opportunity = opportunities.get(id);
    const type = applicationEventType(record.status);
    add({ type, occurredAt: record.lastUpdated, opportunityId: id, organizationId: organizationId(opportunity), category: categoryLabel(opportunity), source: "journey_status" });
  }

  const profile = input.profile as (OpenLineInput["profile"] & { updatedAt?: string }) | null | undefined;
  const profileTimestamp = profile?.updatedAt ?? profile?.advisorInterview?.completedAt ?? profile?.onboardingCompletedAt;
  if (profile?.careerGoal && profileTimestamp && !(input.directionHistory?.length)) {
    add({ type: "goal_selected", occurredAt: profileTimestamp, careerDirection: profile.careerGoal.trim(), source: "profile" });
  }

  for (const record of [...(input.directionHistory ?? [])].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || (a.id ?? "").localeCompare(b.id ?? ""))) {
    if (!record.careerDirection.trim() || !validTimestamp(record.occurredAt)) {
      diagnostics.sourceEventCount += 1;
      ignore("invalid_direction_record");
      continue;
    }
    add({
      type: record.type,
      occurredAt: record.occurredAt,
      careerDirection: record.careerDirection.trim(),
      previousCareerDirection: record.previousCareerDirection?.trim() || undefined,
      source: "profile",
      visibility: record.visibility ?? "private",
      publicSafe: false,
    });
  }

  const milestoneDefinitions = new Map((input.milestoneDefinitions ?? []).map((definition) => [definition.id, definition]));
  for (const record of Object.values(input.progress?.milestones ?? {}).sort((a, b) => a.milestoneId.localeCompare(b.milestoneId))) {
    if (record.status !== "completed") continue;
    const definition = milestoneDefinitions.get(record.milestoneId);
    if (!definition?.title) {
      diagnostics.sourceEventCount += 1;
      ignore("missing_milestone_label");
      continue;
    }
    add({
      type: "skill_evidence_created",
      occurredAt: record.completedDate ?? record.updatedAt,
      category: definition.category?.trim().toLowerCase(),
      skillIds: [...new Set(definition.requiredSkills ?? [])].sort(),
      source: "milestone",
      evidence: { label: definition.title, referenceId: record.milestoneId },
      visibility: "private",
      publicSafe: false,
    });
  }

  for (const record of [...(input.manualEvidence ?? [])].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id))) {
    if (!record.id || !record.label.trim() || !record.skillIds.length || !validTimestamp(record.occurredAt)) {
      diagnostics.sourceEventCount += 1;
      ignore("invalid_evidence_record");
      continue;
    }
    add({
      type: "skill_evidence_created",
      occurredAt: record.occurredAt,
      opportunityId: record.opportunityId,
      category: record.category?.trim().toLowerCase(),
      skillIds: [...new Set(record.skillIds.map((skill) => skill.trim()).filter(Boolean))].sort(),
      source: "manual_evidence",
      evidence: { label: record.label.trim(), referenceId: record.id },
      visibility: record.visibility ?? "private",
      publicSafe: Boolean(record.publicSafe && record.visibility === "shareable"),
    });
  }

  const seen = new Set<string>();
  const events: JourneyEvent[] = [];
  for (const candidate of candidates) {
    const key = semanticKey(candidate);
    if (seen.has(key)) { ignore("duplicate_semantic_event"); continue; }
    seen.add(key);
    events.push({ ...candidate, userId: input.userId, id: stableId("journey-event", input.userId, key, candidate.occurredAt) });
  }
  return { events: events.sort(compareEvents), diagnostics };
}
