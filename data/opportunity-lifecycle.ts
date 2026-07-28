import type { Opportunity } from "./opportunities";
import {
  opportunityLifecycleSchemaVersion,
  type OpportunityDateKind,
  type OpportunityDatePrecision,
  type OpportunityLifecycleConfidence,
  type OpportunityLifecycleDate,
  type OpportunityLifecycleEvent,
  type OpportunityLifecycleEventType,
  type OpportunityLifecycleEvidence,
  type OpportunityLifecycleEvidenceSource,
  type OpportunityLifecycleIssue,
  type OpportunityLifecycleMetadata,
  type OpportunityLifecycleReason,
  type OpportunityLifecycleSnapshot,
  type OpportunityLifecycleState,
  type OpportunityRecurrence,
} from "./opportunity-lifecycle-types";

export * from "./opportunity-lifecycle-types";

const closingSoonDays = 21;
const maximumLifecycleEvents = 24;
const highSensitivityDays = 45;
const mediumSensitivityDays = 120;
const lowerSensitivityDays = 365;
const explicitConfidence = new Set<OpportunityLifecycleConfidence>(["confirmed", "strong"]);
const actionableStates = new Set<OpportunityLifecycleState>(["open", "rolling"]);
const blockedRecommendationStates = new Set<OpportunityLifecycleState>(["unknown", "temporarily_closed", "closed", "canceled", "archived"]);

function dateOnly(value: string | undefined | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function isoTimestamp(value: string | undefined | null) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
}

function todayUtc(now: Date) {
  return now.toISOString().slice(0, 10);
}

function ageDays(value: string | undefined, now: Date) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((now.getTime() - timestamp) / 86_400_000)) : null;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function normalizeOpportunityDate(
  kind: OpportunityDateKind,
  sourceValue: string | undefined | null,
  options: {
    timezone?: string;
    estimated?: boolean;
    verifiedAt?: string;
    sourceUrl?: string;
    precision?: OpportunityDatePrecision;
  } = {},
): OpportunityLifecycleDate | undefined {
  if (!sourceValue?.trim()) return undefined;
  const raw = sourceValue.trim();
  const normalizedDate = dateOnly(raw);
  const normalizedTimestamp = normalizedDate ? undefined : isoTimestamp(raw);
  const precision = options.precision ?? (normalizedDate ? "date" : normalizedTimestamp ? "timestamp" : "unknown");
  return {
    kind,
    sourceValue: raw,
    normalizedValue: normalizedDate ?? normalizedTimestamp,
    timezone: options.timezone,
    precision,
    estimated: options.estimated ?? (precision === "month" || precision === "season"),
    verifiedAt: dateOnly(options.verifiedAt) ?? isoTimestamp(options.verifiedAt),
    sourceUrl: safeOfficialUrl(options.sourceUrl) ? options.sourceUrl : undefined,
  };
}

export function safeOfficialUrl(value: string | undefined | null) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function legacyEvidence(item: Opportunity, confidence: OpportunityLifecycleConfidence, value: string): OpportunityLifecycleEvidence {
  return {
    id: `legacy:${item.id}:${stableHash(value)}`,
    source: "legacy_record",
    observedAt: `${item.last_verified}T00:00:00.000Z`,
    value,
    sourceUrl: safeOfficialUrl(item.official_source) ? item.official_source : undefined,
    confidence,
  };
}

function inferredRecurrence(item: Opportunity): OpportunityRecurrence | undefined {
  const explicit = item.metadata.lifecycle?.recurrence;
  if (explicit) return explicit;
  if (!item.recurring) return undefined;
  const season = item.metadata.applicationSeason?.toLowerCase() ?? "";
  const type: OpportunityRecurrence["type"] = item.metadata.deadlineType === "rolling"
    ? "rolling_cohort"
    : /spring|summer|fall|winter/.test(season)
      ? "seasonal"
      : "annual";
  return { type, confidence: item.verification_status === "verified" ? "limited" : "estimated" };
}

function legacyFinalDeadline(item: Opportunity) {
  return normalizeOpportunityDate("final_deadline", item.application_deadline, {
    verifiedAt: item.last_verified,
    sourceUrl: item.official_source,
    precision: dateOnly(item.application_deadline) ? "date" : undefined,
  });
}

function legacyIdentity(item: Opportunity) {
  return {
    identityId: item.metadata.lifecycle?.identity.identityId || item.id,
    cycleId: item.metadata.lifecycle?.cycle.cycleId || `legacy:${item.metadata.eligibilityRules?.applicationCycle ?? item.metadata.applicationSeason ?? item.application_deadline ?? "undated"}`,
  };
}

function resolveExplicit(item: Opportunity, now: Date) {
  const lifecycle = item.metadata.lifecycle;
  if (!lifecycle?.state || !lifecycle.confidence || !lifecycle.reason) return null;
  const state = lifecycle.state;
  const effectiveAt = lifecycle.effectiveAt ?? lifecycle.review?.reviewedAt ?? `${item.last_verified}T00:00:00.000Z`;
  return { state, confidence: lifecycle.confidence, reason: lifecycle.reason, effectiveAt };
}

function resolveLegacy(item: Opportunity, now: Date): {
  state: OpportunityLifecycleState;
  confidence: OpportunityLifecycleConfidence;
  reason: OpportunityLifecycleReason;
  effectiveAt: string;
} {
  const effectiveAt = `${item.last_verified}T00:00:00.000Z`;
  if (item.verification_status === "archived") return { state: "archived", confidence: "confirmed", reason: "record_archived", effectiveAt };
  if (item.verification_status === "temporarily_closed") return { state: "temporarily_closed", confidence: "strong", reason: "official_status_closed", effectiveAt };
  if (item.verification_status === "expired") return { state: "closed", confidence: "strong", reason: "deadline_passed", effectiveAt };
  if (item.verification_status === "broken_source") return { state: "unknown", confidence: "unknown", reason: "source_removed", effectiveAt };

  const availability = item.metadata.eligibilityRules?.availability;
  if (availability === "closed" || item.metadata.deadlineType === "current_cycle_closed") {
    return { state: item.recurring ? "temporarily_closed" : "closed", confidence: item.verification_status === "verified" ? "strong" : "limited", reason: "official_status_closed", effectiveAt };
  }

  const deadline = dateOnly(item.application_deadline);
  if (deadline && item.metadata.deadlineType === "fixed") {
    if (deadline < todayUtc(now)) return { state: "closed", confidence: item.metadata.verification?.deadlineVerified ? "confirmed" : "strong", reason: "deadline_passed", effectiveAt: `${deadline}T23:59:59.999Z` };
    if (item.verification_status === "verified") return { state: "open", confidence: item.metadata.verification?.deadlineVerified ? "confirmed" : "strong", reason: "deadline_future", effectiveAt };
  }

  if (availability === "rolling" && item.verification_status === "verified") return { state: "rolling", confidence: "strong", reason: "rolling_confirmed", effectiveAt };
  if (availability === "open" && item.verification_status === "verified") return { state: item.metadata.deadlineType === "rolling" ? "rolling" : "open", confidence: "strong", reason: item.metadata.deadlineType === "rolling" ? "rolling_confirmed" : "official_status_open", effectiveAt };

  if (item.metadata.deadlineType === "rolling" && item.verification_status === "verified") {
    return { state: "rolling", confidence: "strong", reason: "rolling_confirmed", effectiveAt };
  }
  if (item.metadata.deadlineType === "no_deadline" && item.verification_status === "verified" && ["AI", "Benefit"].includes(item.type)) {
    return { state: "open", confidence: "strong", reason: "manually_verified", effectiveAt };
  }
  return {
    state: "unknown",
    confidence: item.recurring ? "estimated" : "unknown",
    reason: item.recurring ? "recurring_pattern" : "insufficient_current_evidence",
    effectiveAt,
  };
}

function isDeadlineClosingSoon(deadline: OpportunityLifecycleDate | undefined, now: Date, confidence: OpportunityLifecycleConfidence) {
  if (!deadline?.normalizedValue || deadline.estimated || !explicitConfidence.has(confidence)) return false;
  const deadlineDate = deadline.normalizedValue.slice(0, 10);
  const days = Math.ceil((new Date(`${deadlineDate}T23:59:59.999Z`).getTime() - now.getTime()) / 86_400_000);
  return days >= 0 && days <= closingSoonDays;
}

function lifecycleDatePassed(value: OpportunityLifecycleDate | undefined, now: Date) {
  if (!value?.normalizedValue || value.estimated) return false;
  if (value.precision === "timestamp") return new Date(value.normalizedValue).getTime() <= now.getTime();
  if (value.precision === "date") return value.normalizedValue.slice(0, 10) < todayUtc(now);
  return false;
}

function lifecycleDateReached(value: OpportunityLifecycleDate | undefined, now: Date) {
  if (!value?.normalizedValue || value.estimated) return false;
  if (value.precision === "timestamp") return new Date(value.normalizedValue).getTime() <= now.getTime();
  if (value.precision === "date") return value.normalizedValue.slice(0, 10) <= todayUtc(now);
  return false;
}

function stateLabel(state: OpportunityLifecycleSnapshot["displayState"], recurrence: OpportunityRecurrence | undefined) {
  switch (state) {
    case "open": return "Applications open";
    case "closing_soon": return "Closing soon";
    case "rolling": return "Rolling applications";
    case "upcoming": return "Opening soon";
    case "temporarily_closed": return recurrence ? "Expected to return" : "Temporarily closed";
    case "closed": return recurrence ? "Current cycle closed" : "Closed";
    case "reopened": return "Applications reopened";
    case "canceled": return "Canceled";
    case "archived": return "Archived";
    default: return "Current status not confirmed";
  }
}

function meaningfulReopen(events: readonly OpportunityLifecycleEvent[]) {
  return [...events].reverse().find((event) => event.type === "application_reopened");
}

function fieldFreshnessIssues(item: Opportunity, now: Date, state: OpportunityLifecycleState) {
  const lifecycle = item.metadata.lifecycle;
  const fieldDates = lifecycle?.fieldVerifiedAt ?? {};
  const issues: OpportunityLifecycleIssue[] = [];
  const check = (field: string, value: string | undefined, threshold: number, severity: OpportunityLifecycleIssue["severity"]) => {
    const age = ageDays(value ?? item.last_verified, now);
    if (age !== null && age > threshold) issues.push({ code: `${field}_stale`, field, severity, message: `${field} was last checked ${age} days ago.` });
  };
  check("state", fieldDates.state, highSensitivityDays, state === "open" || state === "rolling" ? "unsafe_to_present_as_open" : "review_soon");
  check("deadline", fieldDates.deadline, highSensitivityDays, "likely_stale");
  check("applicationUrl", fieldDates.applicationUrl, highSensitivityDays, "likely_stale");
  check("eligibility", fieldDates.eligibility, mediumSensitivityDays, "review_soon");
  check("programDates", fieldDates.programDates, mediumSensitivityDays, "review_soon");
  check("description", fieldDates.description, lowerSensitivityDays, "review_soon");
  const sourceCheck = lifecycle?.sourceChecks?.at(-1);
  if (sourceCheck && ["not_found", "expired_page", "unsafe_protocol", "malformed", "unrelated_redirect"].includes(sourceCheck.classification)) {
    issues.push({
      code: `source_${sourceCheck.classification}`,
      field: "applicationUrl",
      severity: ["unsafe_protocol", "malformed", "unrelated_redirect"].includes(sourceCheck.classification) ? "broken_source" : "likely_stale",
      message: "The latest stored source check requires review.",
    });
  }
  return issues;
}

function evidenceConflict(item: Opportunity, state: OpportunityLifecycleState) {
  const values = (item.metadata.lifecycle?.evidence ?? []).filter((evidence) => explicitConfidence.has(evidence.confidence)).map((evidence) => evidence.value.toLowerCase());
  const saysOpen = values.some((value) => /\b(open|accepting)\b/.test(value));
  const saysClosed = values.some((value) => /\b(closed|canceled|cancelled)\b/.test(value));
  return saysOpen && saysClosed || saysClosed && ["open", "rolling"].includes(state);
}

export function resolveOpportunityLifecycle(item: Opportunity, now = new Date()): OpportunityLifecycleSnapshot {
  const identity = legacyIdentity(item);
  const explicit = resolveExplicit(item, now);
  let resolved = explicit ?? resolveLegacy(item, now);
  const lifecycle = item.metadata.lifecycle;
  const finalDeadline = lifecycle?.finalDeadline ?? legacyFinalDeadline(item);
  const openingDate = lifecycle?.openingDate;
  const recurrence = inferredRecurrence(item);
  const events = (lifecycle?.events ?? []).slice(-maximumLifecycleEvents);
  const evidence = lifecycle?.evidence?.length ? lifecycle.evidence : [legacyEvidence(item, resolved.confidence, resolved.reason)];
  const today = todayUtc(now);

  if (openingDate?.normalizedValue && !openingDate.estimated && openingDate.normalizedValue.slice(0, 10) > today && resolved.state !== "canceled" && resolved.state !== "archived") {
    resolved = { state: "upcoming", confidence: resolved.confidence === "unknown" ? "strong" : resolved.confidence, reason: "opening_date_future", effectiveAt: resolved.effectiveAt };
  }
  if (resolved.state === "upcoming" && lifecycleDateReached(openingDate, now) && explicitConfidence.has(resolved.confidence)) {
    resolved = { ...resolved, state: "open", reason: "opening_date_reached", effectiveAt: openingDate?.normalizedValue ?? resolved.effectiveAt };
  }
  if (["open", "upcoming"].includes(resolved.state) && lifecycleDatePassed(finalDeadline, now) && explicitConfidence.has(resolved.confidence) && resolved.reason !== "official_status_open") {
    resolved = { ...resolved, state: "closed", reason: "deadline_passed", effectiveAt: finalDeadline?.normalizedValue ?? resolved.effectiveAt };
  }

  const issues = fieldFreshnessIssues(item, now, resolved.state);
  if (resolved.state === "open" && lifecycleDatePassed(finalDeadline, now) && resolved.reason === "official_status_open") {
    issues.push({ code: "deadline_status_conflict", field: "deadline", severity: "conflicting_evidence", message: "The official status says open after the recorded deadline; review the current deadline." });
    resolved = { ...resolved, state: "unknown", confidence: "unknown", reason: "conflicting_evidence" };
  }
  if (evidenceConflict(item, resolved.state)) {
    issues.push({ code: "status_evidence_conflict", field: "state", severity: "conflicting_evidence", message: "Current evidence contains conflicting lifecycle signals." });
    resolved = { ...resolved, state: "unknown", confidence: "unknown", reason: "conflicting_evidence" };
  }
  if ((resolved.state === "open" || resolved.state === "rolling") && issues.some((issue) => issue.severity === "unsafe_to_present_as_open")) {
    resolved = { ...resolved, state: "unknown", confidence: "limited", reason: "insufficient_current_evidence" };
  }

  const reopen = meaningfulReopen(events);
  const displayState = reopen && resolved.state === "open"
    ? "reopened"
    : resolved.state === "open" && isDeadlineClosingSoon(finalDeadline, now, resolved.confidence)
      ? "closing_soon"
      : resolved.state;
  const sourceSafe = safeOfficialUrl(item.official_source_url)
    && (!item.metadata.claimUrl || safeOfficialUrl(item.metadata.claimUrl));
  const unsafeEvidence = issues.some((issue) => ["conflicting_evidence", "broken_source", "unsafe_to_present_as_open"].includes(issue.severity));
  const actionable = actionableStates.has(resolved.state) && explicitConfidence.has(resolved.confidence) && sourceSafe && !unsafeEvidence;
  const recommendationEligible = actionable && !blockedRecommendationStates.has(resolved.state);

  return {
    identityId: identity.identityId,
    cycleId: identity.cycleId,
    state: resolved.state,
    displayState,
    confidence: resolved.confidence,
    reason: resolved.reason,
    effectiveAt: resolved.effectiveAt,
    actionable,
    recommendationEligible,
    recurring: Boolean(recurrence),
    reopened: Boolean(reopen && resolved.state === "open"),
    label: stateLabel(displayState, recurrence),
    actionLabel: actionable ? "View official application" : "View official source",
    actionAllowed: sourceSafe,
    openingDate,
    priorityDeadline: lifecycle?.priorityDeadline,
    finalDeadline,
    programStartDate: lifecycle?.programStartDate,
    programEndDate: lifecycle?.programEndDate,
    decisionDate: lifecycle?.decisionDate,
    recurrence,
    evidence,
    events,
    issues,
  };
}

function stateEventType(before: OpportunityLifecycleSnapshot, after: OpportunityLifecycleSnapshot): OpportunityLifecycleEventType | null {
  if (before.state !== after.state) {
    if (after.state === "open" && ["closed", "temporarily_closed", "upcoming"].includes(before.state)) return before.state === "upcoming" ? "application_opened" : "application_reopened";
    if (after.state === "closed" || after.state === "temporarily_closed") return "application_closed";
    if (after.state === "canceled") return "opportunity_canceled";
    if (after.state === "archived") return "cycle_archived";
  }
  return null;
}

function normalizedComparable(value: unknown) {
  if (typeof value === "string") return value.normalize("NFKC").replace(/\s+/g, " ").trim();
  return JSON.stringify(value ?? null);
}

export function createOpportunityLifecycleEvents(
  beforeItem: Opportunity,
  afterItem: Opportunity,
  detectedAt = new Date(),
): OpportunityLifecycleEvent[] {
  const before = resolveOpportunityLifecycle(beforeItem, detectedAt);
  const after = resolveOpportunityLifecycle(afterItem, detectedAt);
  const source: OpportunityLifecycleEvidenceSource = afterItem.metadata.lifecycle?.review ? "manual_review" : after.evidence[0]?.source ?? "legacy_record";
  const changes: Array<{ type: OpportunityLifecycleEventType; previousValue?: string; newValue?: string }> = [];
  const stateType = stateEventType(before, after);
  if (stateType) changes.push({ type: stateType, previousValue: before.state, newValue: after.state });
  if (before.finalDeadline?.normalizedValue !== after.finalDeadline?.normalizedValue) {
    changes.push({
      type: before.finalDeadline?.normalizedValue ? "deadline_changed" : "deadline_announced",
      previousValue: before.finalDeadline?.normalizedValue,
      newValue: after.finalDeadline?.normalizedValue,
    });
  }
  if (normalizedComparable(beforeItem.official_source_url) !== normalizedComparable(afterItem.official_source_url)) {
    changes.push({ type: "application_url_changed", previousValue: beforeItem.official_source_url, newValue: afterItem.official_source_url });
  }
  if (normalizedComparable(beforeItem.eligibility) !== normalizedComparable(afterItem.eligibility)) {
    changes.push({ type: "eligibility_changed", previousValue: beforeItem.eligibility, newValue: afterItem.eligibility });
  }
  const beforeProgramDates = [beforeItem.metadata.lifecycle?.programStartDate, beforeItem.metadata.lifecycle?.programEndDate, beforeItem.metadata.internshipDuration, beforeItem.metadata.semesters];
  const afterProgramDates = [afterItem.metadata.lifecycle?.programStartDate, afterItem.metadata.lifecycle?.programEndDate, afterItem.metadata.internshipDuration, afterItem.metadata.semesters];
  if (normalizedComparable(beforeProgramDates) !== normalizedComparable(afterProgramDates)) {
    changes.push({ type: "program_dates_changed", previousValue: normalizedComparable(beforeProgramDates), newValue: normalizedComparable(afterProgramDates) });
  }
  if (before.confidence !== after.confidence) changes.push({ type: "confidence_changed", previousValue: before.confidence, newValue: after.confidence });
  return changes.map(({ type, previousValue, newValue }) => {
    const idempotencyKey = [
      after.identityId,
      after.cycleId,
      type,
      previousValue ?? "",
      newValue ?? "",
      after.effectiveAt,
    ].join(":");
    return {
      id: `lifecycle-event-${stableHash(idempotencyKey)}`,
      opportunityIdentityId: after.identityId,
      cycleId: after.cycleId,
      type,
      previousValue,
      newValue,
      effectiveAt: after.effectiveAt,
      detectedAt: detectedAt.toISOString(),
      evidenceSource: source,
      confidence: after.confidence,
      idempotencyKey,
    };
  });
}

export function appendOpportunityLifecycleEvents(
  existing: readonly OpportunityLifecycleEvent[] = [],
  additions: readonly OpportunityLifecycleEvent[] = [],
) {
  const byKey = new Map<string, OpportunityLifecycleEvent>();
  for (const event of [...existing, ...additions]) byKey.set(event.idempotencyKey, event);
  return [...byKey.values()].sort((left, right) => left.detectedAt.localeCompare(right.detectedAt)).slice(-maximumLifecycleEvents);
}

export function applyOpportunityLifecycleReview(
  current: Opportunity,
  next: Opportunity,
  review: {
    state: OpportunityLifecycleState;
    confidence: OpportunityLifecycleConfidence;
    reason: OpportunityLifecycleReason;
    reviewedAt: string;
    reviewer: string;
    note: string;
    openingDate?: string | null;
    recurrence?: OpportunityRecurrence | null;
  },
) {
  const base = next.metadata.lifecycle ?? lifecycleMetadataFromLegacy(next, new Date(`${review.reviewedAt}T12:00:00.000Z`));
  const reviewed: Opportunity = {
    ...next,
    recurring: Boolean(review.recurrence),
    metadata: {
      ...next.metadata,
      lifecycle: {
        ...base,
        schemaVersion: opportunityLifecycleSchemaVersion,
        migrationId: undefined,
        state: review.state,
        confidence: review.confidence,
        reason: review.reason,
        effectiveAt: `${review.reviewedAt}T12:00:00.000Z`,
        openingDate: normalizeOpportunityDate("application_open", review.openingDate, {
          verifiedAt: review.reviewedAt,
          sourceUrl: next.official_source,
        }),
        finalDeadline: legacyFinalDeadline(next),
        recurrence: review.recurrence ?? undefined,
        evidence: [{
          id: `review:${next.id}:${review.reviewedAt}:${stableHash(`${review.state}:${review.reason}:${review.note}`)}`,
          source: "manual_review",
          observedAt: `${review.reviewedAt}T12:00:00.000Z`,
          value: review.note,
          sourceUrl: safeOfficialUrl(next.official_source) ? next.official_source : undefined,
          confidence: review.confidence,
        }],
        fieldVerifiedAt: {
          ...base.fieldVerifiedAt,
          state: review.reviewedAt,
          deadline: review.reviewedAt,
          applicationUrl: review.reviewedAt,
          openingDate: review.openingDate ? review.reviewedAt : base.fieldVerifiedAt?.openingDate,
          eligibility: review.reviewedAt,
        },
        review: {
          note: review.note,
          reviewedAt: `${review.reviewedAt}T12:00:00.000Z`,
          reviewer: review.reviewer,
        },
      },
    },
  };
  const events = createOpportunityLifecycleEvents(current, reviewed, new Date(`${review.reviewedAt}T12:00:00.000Z`));
  reviewed.metadata.lifecycle!.events = appendOpportunityLifecycleEvents(base.events, events);
  return reviewed;
}

export function lifecycleMetadataFromLegacy(item: Opportunity, now = new Date()): OpportunityLifecycleMetadata {
  const snapshot = resolveOpportunityLifecycle({ ...item, metadata: { ...item.metadata, lifecycle: undefined } }, now);
  return {
    schemaVersion: opportunityLifecycleSchemaVersion,
    migrationId: "opportunity-lifecycle-v1",
    identity: { identityId: item.id },
    cycle: { cycleId: snapshot.cycleId },
    state: snapshot.state,
    confidence: snapshot.confidence,
    reason: snapshot.reason,
    effectiveAt: snapshot.effectiveAt,
    finalDeadline: snapshot.finalDeadline,
    recurrence: snapshot.recurrence,
    evidence: snapshot.evidence,
    events: [],
    fieldVerifiedAt: {
      state: item.last_verified,
      deadline: item.last_verified,
      applicationUrl: item.last_verified,
      eligibility: item.last_verified,
      description: item.last_verified,
    },
  };
}

export function migrateOpportunityLifecycleRecord(item: Opportunity, now = new Date()) {
  if (item.metadata.lifecycle?.schemaVersion === opportunityLifecycleSchemaVersion) return item;
  return { ...item, metadata: { ...item.metadata, lifecycle: lifecycleMetadataFromLegacy(item, now) } };
}

export function rollbackOpportunityLifecycleMigration(item: Opportunity) {
  if (item.metadata.lifecycle?.migrationId !== "opportunity-lifecycle-v1") return item;
  const { lifecycle: _lifecycle, ...metadata } = item.metadata;
  return { ...item, metadata };
}

export function lifecycleMigrationDistribution(items: readonly Opportunity[], now = new Date()) {
  const distribution: Record<string, number> = {
    open: 0,
    upcoming: 0,
    rolling: 0,
    temporarily_closed: 0,
    closed: 0,
    canceled: 0,
    archived: 0,
    unknown: 0,
    recurring: 0,
    conflicting: 0,
    stale: 0,
  };
  for (const item of items) {
    const snapshot = resolveOpportunityLifecycle(migrateOpportunityLifecycleRecord(item, now), now);
    distribution[snapshot.state] += 1;
    if (snapshot.recurring) distribution.recurring += 1;
    if (snapshot.issues.some((issue) => issue.severity === "conflicting_evidence")) distribution.conflicting += 1;
    if (snapshot.issues.length) distribution.stale += 1;
  }
  return distribution;
}
