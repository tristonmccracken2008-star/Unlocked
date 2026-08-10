import type { Opportunity } from "./opportunities";
import { resolveOpportunityLifecycle, safeOfficialUrl } from "./opportunity-lifecycle";
import type {
  OpportunityChangeEvent,
  OpportunityChangeField,
  OpportunityChangeImportance,
  OpportunityChangeType,
} from "./opportunity-changelog-types";

const maximumStoredEvents = 40;
const trustedSources = new Set(["official_status", "official_deadline", "official_opening_date", "official_application_page", "structured_source", "manual_review"]);
const trustedConfidence = new Set(["confirmed", "strong"]);

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function semanticText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedUrl(value: string | null | undefined) {
  try {
    const url = new URL(value ?? "");
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|source$)/i.test(key)) url.searchParams.delete(key);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLocaleLowerCase();
  } catch {
    return semanticText(value);
  }
}

function compactList(values: readonly string[] | null | undefined) {
  return [...new Set((values ?? []).map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

function listValue(values: readonly string[] | null | undefined) {
  return compactList(values).join(" · ");
}

function comparableList(values: readonly string[] | null | undefined) {
  return compactList(values).map(semanticText).sort().join("|");
}

function dateValue(value: string | null | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : value?.trim() || undefined;
}

function eligibilityParts(item: Opportunity) {
  const rules = item.metadata.eligibilityRules;
  return [
    item.school_scope,
    ...item.schools,
    ...item.majors,
    ...item.academic_years,
    ...(rules?.institutionTypes ?? []),
    ...(rules?.enrollmentStatuses ?? []),
    ...(rules?.degreeLevels ?? []),
    ...(rules?.classYears ?? []),
    ...(rules?.majors ?? []),
    ...(rules?.specificSchoolIds ?? []),
    ...(rules?.citizenshipStatuses ?? []),
    rules?.externalStudents,
    rules?.minimumGpa?.toString(),
    rules?.financialNeedRequired?.toString(),
    semanticText(item.eligibility),
  ].filter((value): value is string => Boolean(value)).map(semanticText);
}

function setDirection(before: readonly string[], after: readonly string[]) {
  const left = new Set(before);
  const right = new Set(after);
  const added = [...right].some((value) => !left.has(value));
  const removed = [...left].some((value) => !right.has(value));
  if (added && !removed) return "expanded" as const;
  if (removed && !added) return "tightened" as const;
  return "updated" as const;
}

function sourceContext(item: Opportunity, field: OpportunityChangeField, now: Date) {
  const lifecycle = resolveOpportunityLifecycle(item, now);
  const evidence = [...lifecycle.evidence].reverse().find((item) => trustedSources.has(item.source));
  const source = item.metadata.lifecycle?.review ? "manual_review" as const : evidence?.source ?? "legacy_record" as const;
  const confidence = item.metadata.lifecycle?.confidence ?? evidence?.confidence ?? lifecycle.confidence;
  const verification = item.metadata.verification;
  const fieldVerified = field === "deadline" ? verification?.deadlineVerified
    : field === "eligibility" || field === "requirements" ? verification?.eligibilityVerified
      : field === "application_url" ? verification?.applicationUrlVerified
        : true;
  const authoritative = item.verification_status === "verified"
    && trustedConfidence.has(confidence)
    && trustedSources.has(source)
    && fieldVerified !== false;
  return { lifecycle, source, confidence, authoritative };
}

function changePolicy(type: OpportunityChangeType): { importance: OpportunityChangeImportance; calendarImpact: boolean; workspaceImpact: boolean } {
  if (["deadline_moved_earlier", "deadline_removed", "applications_closed", "opportunity_canceled", "eligibility_tightened"].includes(type)) return { importance: "critical", calendarImpact: type.startsWith("deadline"), workspaceImpact: true };
  if (["deadline_announced", "deadline_extended", "eligibility_expanded", "eligibility_updated", "award_changed", "compensation_changed", "location_changed", "work_mode_changed", "program_dates_changed", "applications_reopened", "cycle_updated", "requirements_changed", "opening_date_changed"].includes(type)) return { importance: "important", calendarImpact: type.startsWith("deadline"), workspaceImpact: ["deadline_announced", "deadline_extended", "requirements_changed", "applications_reopened", "cycle_updated"].includes(type) };
  return { importance: "informational", calendarImpact: false, workspaceImpact: type === "application_process_changed" || type === "application_url_changed" };
}

type Candidate = { field: OpportunityChangeField; changeType: OpportunityChangeType; previousValue?: string; newValue?: string };

function candidateEvents(before: Opportunity, after: Opportunity, now: Date): Candidate[] {
  const candidates: Candidate[] = [];
  const beforeLifecycle = resolveOpportunityLifecycle(before, now);
  const afterLifecycle = resolveOpportunityLifecycle(after, now);
  const beforeDeadline = dateValue(beforeLifecycle.finalDeadline?.normalizedValue ?? before.application_deadline);
  const afterDeadline = dateValue(afterLifecycle.finalDeadline?.normalizedValue ?? after.application_deadline);
  if (beforeDeadline !== afterDeadline) {
    const beforeTime = beforeDeadline ? Date.parse(`${beforeDeadline}T12:00:00.000Z`) : Number.NaN;
    const afterTime = afterDeadline ? Date.parse(`${afterDeadline}T12:00:00.000Z`) : Number.NaN;
    const changeType = !beforeDeadline ? "deadline_announced" : !afterDeadline ? "deadline_removed" : afterTime < beforeTime ? "deadline_moved_earlier" : "deadline_extended";
    candidates.push({ field: "deadline", changeType, previousValue: beforeDeadline, newValue: afterDeadline });
  }
  const beforeOpening = dateValue(beforeLifecycle.openingDate?.normalizedValue);
  const afterOpening = dateValue(afterLifecycle.openingDate?.normalizedValue);
  if (beforeOpening !== afterOpening) candidates.push({ field: "opening_date", changeType: "opening_date_changed", previousValue: beforeOpening, newValue: afterOpening });

  const beforeEligibility = eligibilityParts(before);
  const afterEligibility = eligibilityParts(after);
  if (beforeEligibility.slice().sort().join("|") !== afterEligibility.slice().sort().join("|")) {
    const direction = setDirection(beforeEligibility, afterEligibility);
    candidates.push({ field: "eligibility", changeType: direction === "expanded" ? "eligibility_expanded" : direction === "tightened" ? "eligibility_tightened" : "eligibility_updated", previousValue: before.eligibility, newValue: after.eligibility });
  }

  const beforeAward = before.estimated_value?.toString() ?? before.metadata.awardAmountLabel ?? before.estimated_value_note;
  const afterAward = after.estimated_value?.toString() ?? after.metadata.awardAmountLabel ?? after.estimated_value_note;
  if (semanticText(beforeAward) !== semanticText(afterAward)) candidates.push({ field: "award", changeType: "award_changed", previousValue: beforeAward, newValue: afterAward });
  const beforeCompensation = [before.metadata.compensation, before.metadata.stipendAmount, before.metadata.salaryEstimate, before.paid].filter((value) => value !== undefined && value !== null).join(" · ");
  const afterCompensation = [after.metadata.compensation, after.metadata.stipendAmount, after.metadata.salaryEstimate, after.paid].filter((value) => value !== undefined && value !== null).join(" · ");
  if (semanticText(beforeCompensation) !== semanticText(afterCompensation)) candidates.push({ field: "compensation", changeType: "compensation_changed", previousValue: beforeCompensation, newValue: afterCompensation });
  if (semanticText(before.location) !== semanticText(after.location)) candidates.push({ field: "location", changeType: "location_changed", previousValue: before.location, newValue: after.location });
  const beforeMode = before.metadata.workMode ?? (before.remote === true ? "Remote" : before.remote === false ? "In person" : "Varies");
  const afterMode = after.metadata.workMode ?? (after.remote === true ? "Remote" : after.remote === false ? "In person" : "Varies");
  if (semanticText(beforeMode) !== semanticText(afterMode)) candidates.push({ field: "work_mode", changeType: "work_mode_changed", previousValue: beforeMode, newValue: afterMode });
  const beforeProgramDates = listValue([before.metadata.internshipDuration ?? "", before.metadata.applicationSeason ?? "", ...(before.metadata.semesters ?? []), beforeLifecycle.programStartDate?.normalizedValue ?? "", beforeLifecycle.programEndDate?.normalizedValue ?? ""]);
  const afterProgramDates = listValue([after.metadata.internshipDuration ?? "", after.metadata.applicationSeason ?? "", ...(after.metadata.semesters ?? []), afterLifecycle.programStartDate?.normalizedValue ?? "", afterLifecycle.programEndDate?.normalizedValue ?? ""]);
  if (semanticText(beforeProgramDates) !== semanticText(afterProgramDates)) candidates.push({ field: "program_dates", changeType: "program_dates_changed", previousValue: beforeProgramDates, newValue: afterProgramDates });

  if (beforeLifecycle.cycleId !== afterLifecycle.cycleId) candidates.push({ field: "cycle", changeType: "cycle_updated", previousValue: beforeLifecycle.cycleId, newValue: afterLifecycle.cycleId });
  if (beforeLifecycle.state !== afterLifecycle.state) {
    const changeType = afterLifecycle.state === "canceled" ? "opportunity_canceled"
      : ["closed", "temporarily_closed", "archived"].includes(afterLifecycle.state) ? "applications_closed"
        : afterLifecycle.state === "open" && ["closed", "temporarily_closed"].includes(beforeLifecycle.state) ? "applications_reopened"
          : afterLifecycle.state === "open" ? "applications_opened"
            : null;
    if (changeType) candidates.push({ field: "application_status", changeType, previousValue: beforeLifecycle.label, newValue: afterLifecycle.label });
  }

  const beforeRequirements = compactList(before.metadata.applicationRequirements);
  const afterRequirements = compactList(after.metadata.applicationRequirements);
  if (comparableList(beforeRequirements) !== comparableList(afterRequirements)) candidates.push({ field: "requirements", changeType: "requirements_changed", previousValue: listValue(beforeRequirements), newValue: listValue(afterRequirements) });
  if (comparableList(before.metadata.claimSteps) !== comparableList(after.metadata.claimSteps)) candidates.push({ field: "application_process", changeType: "application_process_changed", previousValue: listValue(before.metadata.claimSteps), newValue: listValue(after.metadata.claimSteps) });
  if (normalizedUrl(before.official_source_url) !== normalizedUrl(after.official_source_url)) candidates.push({ field: "application_url", changeType: "application_url_changed", previousValue: before.official_source_url, newValue: after.official_source_url });
  return candidates;
}

export function detectMeaningfulOpportunityChanges(before: Opportunity, after: Opportunity, now = new Date()): OpportunityChangeEvent[] {
  const afterLifecycle = resolveOpportunityLifecycle(after, now);
  return candidateEvents(before, after, now).flatMap((candidate): OpportunityChangeEvent[] => {
    const trust = sourceContext(after, candidate.field, now);
    if (!trust.authoritative) return [];
    const policy = changePolicy(candidate.changeType);
    const idempotencyKey = [afterLifecycle.identityId, afterLifecycle.cycleId, candidate.field, candidate.changeType, semanticText(candidate.previousValue), semanticText(candidate.newValue)].join(":");
    return [{
      id: `opportunity-change-${stableHash(idempotencyKey)}`,
      opportunityId: after.id,
      identityId: afterLifecycle.identityId,
      cycleId: afterLifecycle.cycleId,
      field: candidate.field,
      changeType: candidate.changeType,
      previousValue: candidate.previousValue,
      newValue: candidate.newValue,
      detectedAt: now.toISOString(),
      effectiveAt: afterLifecycle.effectiveAt,
      source: trust.source,
      sourceUrl: safeOfficialUrl(after.official_source_url) ? after.official_source_url : undefined,
      confidence: trust.confidence,
      importance: policy.importance,
      userRelevant: true,
      notificationEligible: policy.importance !== "informational" || ["application_url_changed", "application_process_changed"].includes(candidate.changeType),
      calendarImpact: policy.calendarImpact,
      workspaceImpact: policy.workspaceImpact,
      idempotencyKey,
    }];
  });
}

export function appendOpportunityChanges(existing: readonly OpportunityChangeEvent[] = [], additions: readonly OpportunityChangeEvent[] = []) {
  const byKey = new Map<string, OpportunityChangeEvent>();
  for (const event of [...existing, ...additions]) byKey.set(event.idempotencyKey, event);
  return [...byKey.values()].sort((left, right) => left.detectedAt.localeCompare(right.detectedAt)).slice(-maximumStoredEvents);
}

export function opportunityWithDetectedChanges(before: Opportunity | undefined, after: Opportunity, now = new Date()) {
  if (!before) return { opportunity: after, events: [] as OpportunityChangeEvent[] };
  const events = detectMeaningfulOpportunityChanges(before, after, now);
  const changelog = appendOpportunityChanges(before.metadata.changelog, events);
  if (!changelog.length) return { opportunity: after, events };
  return {
    opportunity: { ...after, metadata: { ...after.metadata, changelog } },
    events,
  };
}

export function recentOpportunityChanges(item: Opportunity, limit = 4) {
  return [...(item.metadata.changelog ?? [])]
    .filter((event) => event.userRelevant && trustedConfidence.has(event.confidence) && trustedSources.has(event.source))
    .sort((left, right) => right.detectedAt.localeCompare(left.detectedAt))
    .slice(0, Math.max(0, Math.min(limit, 8)));
}

export function requirementAddedByRecentChange(item: Opportunity, requirement: string, now = new Date()) {
  const target = semanticText(requirement);
  return recentOpportunityChanges(item, 8).some((event) => event.field === "requirements"
    && now.getTime() - Date.parse(event.detectedAt) <= 30 * 86_400_000
    && (event.newValue ?? "").split(" · ").some((value) => semanticText(value) === target)
    && !(event.previousValue ?? "").split(" · ").some((value) => semanticText(value) === target));
}

export function opportunityChangeLabel(event: OpportunityChangeEvent) {
  const labels: Record<OpportunityChangeType, string> = {
    deadline_announced: "Deadline announced",
    deadline_extended: "Deadline extended",
    deadline_moved_earlier: "Deadline moved earlier",
    deadline_removed: "Deadline removed",
    opening_date_changed: "Opening date updated",
    eligibility_expanded: "Eligibility expanded",
    eligibility_tightened: "Eligibility tightened",
    eligibility_updated: "Eligibility updated",
    award_changed: "Award updated",
    compensation_changed: "Compensation updated",
    location_changed: "Location updated",
    work_mode_changed: "Format updated",
    program_dates_changed: "Program dates updated",
    applications_opened: "Applications opened",
    applications_reopened: "Applications reopened",
    applications_closed: "Applications closed",
    opportunity_canceled: "Opportunity canceled",
    cycle_updated: "New application cycle",
    requirements_changed: "Application materials updated",
    application_process_changed: "Application process updated",
    application_url_changed: "Official application link updated",
  };
  return labels[event.changeType];
}

function displayChangeValue(value: string | undefined) {
  if (!value) return "Not listed";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00.000Z`));
  return value.replace(/\s+/g, " ").trim().slice(0, 220);
}

export function opportunityChangeSummary(event: OpportunityChangeEvent) {
  const before = displayChangeValue(event.previousValue);
  const after = displayChangeValue(event.newValue);
  if (event.changeType === "applications_reopened") return event.cycleId ? `Applications reopened for ${event.cycleId.split(":").at(-1)}.` : "Applications are accepting submissions again.";
  if (event.changeType === "applications_opened") return "Applications are now open.";
  if (event.changeType === "applications_closed") return "Applications are no longer open for the current cycle.";
  if (event.changeType === "opportunity_canceled") return "The provider canceled this opportunity.";
  if (event.changeType === "eligibility_expanded") return `Eligibility now includes more students. ${after}`;
  if (event.changeType === "eligibility_tightened") return `Eligibility requirements became more restrictive. ${after}`;
  if (event.changeType === "eligibility_updated") return `Current eligibility: ${after}`;
  if (event.changeType === "requirements_changed") return `Current materials: ${after}`;
  if (event.changeType === "cycle_updated") return `The current application cycle changed to ${after}.`;
  if (!event.previousValue) return after;
  if (!event.newValue) return `${before} is no longer listed.`;
  return `${before} → ${after}`;
}
