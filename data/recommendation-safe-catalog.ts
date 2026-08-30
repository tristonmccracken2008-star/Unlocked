import { normalizeOpportunityEligibility } from "./opportunity-eligibility-model";
import { resolveOpportunityLifecycle, safeOfficialUrl } from "./opportunity-lifecycle";
import { validateOpportunityData } from "./recommendation-professional-pipeline";
import type { Opportunity, OpportunityEligibilityEvidenceField } from "./opportunities";

export type CatalogBlocker =
  | "duplicate_uncertainty"
  | "lifecycle_unknown"
  | "application_not_actionable"
  | "closed_or_archived"
  | "missing_official_source"
  | "weak_source_evidence"
  | "eligibility_not_reviewed"
  | "missing_eligibility_evidence"
  | "incomplete_academic_level"
  | "unknown_citizenship"
  | "unknown_geographic_restrictions"
  | "missing_deadline_verification"
  | "contradictory_metadata"
  | "insufficient_structured_metadata"
  | "other";

export type RecommendationSafetyAudit = {
  id: string;
  safe: boolean;
  blockers: CatalogBlocker[];
  gateReasons: string[];
  missingEvidenceFields: OpportunityEligibilityEvidenceField[];
  sourceAuthority: "official" | "unconfirmed" | "missing";
  lifecycle: ReturnType<typeof resolveOpportunityLifecycle>;
  queuePriority: "safe" | "one_critical_blocker" | "two_critical_blockers" | "coverage_gap" | "stale_or_deeper_research";
  estimatedEffort: "low" | "medium" | "high";
};

const criticalEvidenceFields: OpportunityEligibilityEvidenceField[] = [
  "academic_level", "institution_type", "enrollment_status", "school_restriction",
  "external_student_eligibility", "class_year", "major", "citizenship", "residency",
  "gpa", "age", "financial_need", "invitation", "application_status",
];

function blockerForReason(reason: string): CatalogBlocker {
  if (/Superseded|duplicate/i.test(reason)) return "duplicate_uncertainty";
  if (/Lifecycle.*unknown/i.test(reason)) return "lifecycle_unknown";
  if (/Lifecycle|temporarily closed/i.test(reason)) return "application_not_actionable";
  if (/archived|expired|deadline has passed/i.test(reason)) return "closed_or_archived";
  if (/source/i.test(reason)) return "missing_official_source";
  if (/positively verified|manual review|verification is explicitly incomplete|recommendation eligibility status|details need manual review/i.test(reason)) return "eligibility_not_reviewed";
  if (/citizenship/i.test(reason)) return "unknown_citizenship";
  if (/external_student|institution_type/i.test(reason)) return "unknown_geographic_restrictions";
  if (/academic|education_level|enrollment_status|class_year/i.test(reason)) return "incomplete_academic_level";
  if (/Critical eligibility|unknown or variable/i.test(reason)) return "missing_eligibility_evidence";
  if (/verification confidence/i.test(reason)) return "weak_source_evidence";
  if (/too thin|eligibility evidence confidence|structured/i.test(reason)) return "insufficient_structured_metadata";
  return "other";
}

const underservedPattern = /scholar|transfer|humanit|social|art|design|writing|journal|competition|fellow/i;
const queuePriorityOrder: Record<RecommendationSafetyAudit["queuePriority"], number> = {
  safe: -1,
  one_critical_blocker: 0,
  two_critical_blockers: 1,
  coverage_gap: 2,
  stale_or_deeper_research: 3,
};

export function auditRecommendationSafety(opportunity: Opportunity, now?: Date): RecommendationSafetyAudit {
  const gate = validateOpportunityData(opportunity, now);
  const lifecycle = resolveOpportunityLifecycle(opportunity, now);
  const canonical = normalizeOpportunityEligibility(opportunity);
  const evidence = opportunity.metadata.eligibilityRules?.fieldEvidence ?? {};
  const supportedFields = new Set(opportunity.metadata.sourceReferences?.flatMap((reference) => reference.supports) ?? []);
  const missingEvidenceFields = criticalEvidenceFields.filter((field) => (!evidence[field] || evidence[field]?.state === "unreviewed") && !supportedFields.has(field));
  const sourceAuthority = !safeOfficialUrl(opportunity.official_source_url)
    ? "missing"
    : opportunity.metadata.verification?.officialSourceUrl === opportunity.official_source_url
      ? "official"
      : "unconfirmed";
  const blockers = new Set<CatalogBlocker>(gate.reasons.map(blockerForReason));
  if (!lifecycle.recommendationEligible) blockers.add(lifecycle.state === "unknown" ? "lifecycle_unknown" : "application_not_actionable");
  if (canonical.criticalUnknowns.length) blockers.add("missing_eligibility_evidence");
  if (sourceAuthority === "missing") blockers.add("missing_official_source");
  else if (sourceAuthority === "unconfirmed") blockers.add("weak_source_evidence");
  if (opportunity.metadata.deadlineType === "fixed" && opportunity.metadata.verification?.deadlineVerified !== true) blockers.add("missing_deadline_verification");
  if (lifecycle.issues.some((issue) => issue.severity === "conflicting_evidence")) blockers.add("contradictory_metadata");
  const effort = gate.allowed ? "low" : sourceAuthority === "official" && canonical.criticalUnknowns.length <= 1 ? "low" : sourceAuthority === "official" ? "medium" : "high";
  const criticalBlockerCount = blockers.size;
  const queuePriority: RecommendationSafetyAudit["queuePriority"] = gate.allowed
    ? "safe"
    : criticalBlockerCount === 1
    ? "one_critical_blocker"
    : criticalBlockerCount === 2
      ? "two_critical_blockers"
      : underservedPattern.test(`${opportunity.type} ${opportunity.category} ${opportunity.majors.join(" ")}`)
        ? "coverage_gap"
        : "stale_or_deeper_research";
  return { id: opportunity.id, safe: gate.allowed, blockers: [...blockers].sort(), gateReasons: gate.reasons, missingEvidenceFields, sourceAuthority, lifecycle, queuePriority, estimatedEffort: effort };
}

export function buildRecommendationSafeCatalogAudit(opportunities: Opportunity[]) {
  const records = opportunities.map((opportunity) => auditRecommendationSafety(opportunity));
  const countBy = <T extends string>(values: T[]) => Object.fromEntries([...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<T, number>())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
  const queue = records.filter((record) => !record.safe && !["closed", "archived", "canceled"].includes(record.lifecycle.state))
    .sort((left, right) => queuePriorityOrder[left.queuePriority] - queuePriorityOrder[right.queuePriority] || left.id.localeCompare(right.id));
  return {
    totals: { records: records.length, recommendationSafe: records.filter((record) => record.safe).length, needsReview: records.filter((record) => !record.safe).length },
    blockerCounts: countBy(records.flatMap((record) => record.blockers)),
    lifecycleCounts: countBy(records.map((record) => record.lifecycle.state)),
    queue,
    records,
  };
}
