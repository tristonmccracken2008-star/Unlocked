import { normalizeOpportunityEligibility } from "./opportunity-eligibility-model";
import { resolveOpportunityLifecycle, safeOfficialUrl } from "./opportunity-lifecycle";
import { opportunityPaths } from "./opportunity-paths";
import { recommendationOpportunityClass } from "./recommendation-portfolio-policy";
import { auditRecommendationSafety, type CatalogBlocker } from "./recommendation-safe-catalog";
import type { Opportunity, OpportunityEligibilityEvidenceField, OpportunitySourceReference } from "./opportunities";
import { opportunityMatchesPathStage } from "../lib/opportunity-paths";

export const catalogHealthStates = ["SAFE", "NEAR_SAFE", "NEEDS_RESEARCH", "STALE", "BLOCKED", "ARCHIVE_CANDIDATE", "DUPLICATE_CANDIDATE"] as const;
export type CatalogHealthState = (typeof catalogHealthStates)[number];
export const catalogQueueTiers = ["recertify_stale", "one_critical_blocker", "two_critical_blockers", "coverage_gap", "deeper_research", "archive_or_duplicate_review", "none"] as const;
export type CatalogQueueTier = (typeof catalogQueueTiers)[number];
export type CatalogSourceTier = "tier_1_official" | "tier_2_official_document" | "discovery_only" | "missing";
export type CatalogCoverageGap = "scholarship" | "transfer" | "humanities" | "social_sciences" | "arts_design" | "competition" | "fellowship" | "first_year" | "international";

export type CatalogDuplicateGroup = { canonicalId: string; ids: string[]; reasons?: string[] };
export type CatalogReliabilityRecord = {
  id: string;
  title: string;
  organization: string;
  normalizedOrganization: string;
  canonicalUrl: string | null;
  identityId: string;
  cycleId: string;
  lifecycle: ReturnType<typeof resolveOpportunityLifecycle>["state"];
  lifecycleConfidence: ReturnType<typeof resolveOpportunityLifecycle>["confidence"];
  recommendationSafe: boolean;
  state: CatalogHealthState;
  blockers: CatalogBlocker[];
  criticalBlockers: CatalogBlocker[];
  missingEvidenceFields: OpportunityEligibilityEvidenceField[];
  sourceTier: CatalogSourceTier;
  queueTier: CatalogQueueTier;
  coverageGaps: CatalogCoverageGap[];
  review: {
    due: boolean;
    nextReviewAt: string | null;
    lifecycleCadenceDays: number;
    eligibilityCadenceDays: number;
    organizationCadenceDays: number;
  };
  duplicateOf: string | null;
};

export type CatalogReliabilityOptions = {
  now?: Date;
  duplicateGroups?: readonly CatalogDuplicateGroup[];
};

const criticalBlockers = new Set<CatalogBlocker>([
  "duplicate_uncertainty", "lifecycle_unknown", "application_not_actionable", "closed_or_archived",
  "missing_official_source", "weak_source_evidence", "eligibility_not_reviewed", "missing_eligibility_evidence",
  "incomplete_academic_level", "unknown_citizenship", "unknown_geographic_restrictions",
  "missing_deadline_verification", "contradictory_metadata", "insufficient_structured_metadata",
]);

const coverageGapOrder: CatalogCoverageGap[] = ["scholarship", "transfer", "humanities", "social_sciences", "arts_design", "competition", "fellowship", "first_year", "international"];
const queueTierOrder = new Map(catalogQueueTiers.map((tier, index) => [tier, index]));

export function canonicalizeCatalogUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeCatalogOrganization(value: string) {
  return value.normalize("NFKC").toLowerCase()
    .replace(/\bu\.?s\.?\b/g, "united states")
    .replace(/\bdept\.?\b/g, "department")
    .replace(/\bdoe\b/g, "department of energy")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function sourceTier(opportunity: Opportunity): CatalogSourceTier {
  const references = opportunity.metadata.sourceReferences ?? [];
  if (!safeOfficialUrl(opportunity.official_source_url)) return "missing";
  if (opportunity.metadata.verification?.officialSourceUrl === opportunity.official_source_url
    || references.some((source) => source.authority === "official_program" || source.authority === "authorized_application_platform")) return "tier_1_official";
  if (references.some((source) => ["official_organization", "official_institution"].includes(source.authority))) return "tier_2_official_document";
  return "discovery_only";
}

function coverageGapsFor(opportunity: Opportunity): CatalogCoverageGap[] {
  const canonical = normalizeOpportunityEligibility(opportunity);
  const text = `${opportunity.type} ${opportunity.category} ${opportunity.title} ${opportunity.majors.join(" ")} ${opportunity.tags.join(" ")}`.toLowerCase();
  const gaps = new Set<CatalogCoverageGap>();
  if (opportunity.type === "Scholarship") gaps.add("scholarship");
  if (["transfer_specific", "explicitly_eligible"].includes(canonical.transferEligibility)) gaps.add("transfer");
  if (/english|history|philosophy|language|literature|classics|religious|humanit|library|archive|museum/.test(text)) gaps.add("humanities");
  if (/social science|sociology|psychology|anthropology|political|public policy|international relations/.test(text)) gaps.add("social_sciences");
  if (/art|design|architecture|music|theatre|creative/.test(text)) gaps.add("arts_design");
  if (/competition|contest|challenge|award/.test(text)) gaps.add("competition");
  if (/fellowship|fellow program|fellow\b/.test(text)) gaps.add("fellowship");
  if (canonical.classYears.some((year) => /first|freshman|any year/i.test(year))) gaps.add("first_year");
  if (canonical.citizenship.includes("international_allowed")) gaps.add("international");
  return coverageGapOrder.filter((gap) => gaps.has(gap));
}

function reviewModel(opportunity: Opportunity, now: Date) {
  const nextReviewAt = opportunity.metadata.acquisition?.nextReviewAt ?? null;
  const nextReview = nextReviewAt ? new Date(`${nextReviewAt}T23:59:59.999Z`) : null;
  const due = Boolean(nextReview && Number.isFinite(nextReview.getTime()) && nextReview < now);
  const freshnessModel = opportunity.metadata.acquisition?.freshnessModel;
  return {
    due,
    nextReviewAt,
    lifecycleCadenceDays: freshnessModel === "rolling_program" ? 30 : 14,
    eligibilityCadenceDays: freshnessModel === "rolling_program" ? 90 : 180,
    organizationCadenceDays: 365,
  };
}

function duplicateIndex(groups: readonly CatalogDuplicateGroup[]) {
  const index = new Map<string, string>();
  for (const group of groups) for (const id of group.ids) if (id !== group.canonicalId) index.set(id, group.canonicalId);
  return index;
}

function queueTier(state: CatalogHealthState, blockerCount: number, gaps: CatalogCoverageGap[]): CatalogQueueTier {
  if (state === "STALE") return "recertify_stale";
  if (state === "DUPLICATE_CANDIDATE" || state === "ARCHIVE_CANDIDATE") return "archive_or_duplicate_review";
  if (state === "NEAR_SAFE" && blockerCount === 1) return "one_critical_blocker";
  if (state === "NEAR_SAFE" && blockerCount === 2) return "two_critical_blockers";
  if (gaps.length && blockerCount <= 4) return "coverage_gap";
  if (state === "SAFE") return "none";
  return "deeper_research";
}

export function classifyCatalogRecord(opportunity: Opportunity, options: CatalogReliabilityOptions = {}): CatalogReliabilityRecord {
  const now = options.now ?? new Date();
  const safety = auditRecommendationSafety(opportunity, now);
  const lifecycle = resolveOpportunityLifecycle(opportunity, now);
  const duplicateOf = duplicateIndex(options.duplicateGroups ?? []).get(opportunity.id) ?? null;
  const review = reviewModel(opportunity, now);
  const tier = sourceTier(opportunity);
  const critical = safety.blockers.filter((blocker) => criticalBlockers.has(blocker));
  const gaps = coverageGapsFor(opportunity);
  const archive = ["archived", "canceled"].includes(lifecycle.state) || ["archived", "broken_source", "expired"].includes(opportunity.verification_status);
  const maintainedEvidence = Boolean(opportunity.metadata.acquisition || opportunity.metadata.lifecycle?.review || opportunity.metadata.lifecycle?.evidence?.some((evidence) => evidence.source !== "legacy_record"));
  const stale = review.due || maintainedEvidence && lifecycle.issues.some((issue) => ["likely_stale", "broken_source", "unsafe_to_present_as_open"].includes(issue.severity));
  const nearSafe = !safety.safe && tier.startsWith("tier_") && critical.length > 0 && critical.length <= 2 && !["archived", "canceled"].includes(lifecycle.state);
  const state: CatalogHealthState = duplicateOf
    ? "DUPLICATE_CANDIDATE"
    : archive
      ? "ARCHIVE_CANDIDATE"
      : stale
        ? "STALE"
        : safety.safe
          ? "SAFE"
          : nearSafe
            ? "NEAR_SAFE"
            : tier === "missing" || safety.blockers.includes("contradictory_metadata")
              ? "BLOCKED"
              : "NEEDS_RESEARCH";
  return {
    id: opportunity.id,
    title: opportunity.title,
    organization: opportunity.organization,
    normalizedOrganization: normalizeCatalogOrganization(opportunity.organization),
    canonicalUrl: canonicalizeCatalogUrl(opportunity.official_source_url),
    identityId: lifecycle.identityId,
    cycleId: lifecycle.cycleId,
    lifecycle: lifecycle.state,
    lifecycleConfidence: lifecycle.confidence,
    recommendationSafe: safety.safe,
    state,
    blockers: safety.blockers,
    criticalBlockers: critical,
    missingEvidenceFields: safety.missingEvidenceFields,
    sourceTier: tier,
    queueTier: queueTier(state, critical.length, gaps),
    coverageGaps: gaps,
    review,
    duplicateOf,
  };
}

function countBy(values: readonly string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries([...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function fieldAreas(opportunity: Opportunity) {
  return coverageGapsFor(opportunity).filter((gap) => ["humanities", "social_sciences", "arts_design"].includes(gap));
}

function trustCoverage(opportunity: Opportunity) {
  const references = opportunity.metadata.sourceReferences ?? [];
  const supports = new Set(references.flatMap((reference: OpportunitySourceReference) => reference.supports));
  const lifecycle = opportunity.metadata.lifecycle;
  return {
    officialSource: sourceTier(opportunity).startsWith("tier_"),
    eligibility: Boolean(opportunity.metadata.verification?.eligibilityVerified && references.length),
    classYear: supports.has("class_year"),
    citizenship: supports.has("citizenship"),
    deadline: supports.has("deadline") || opportunity.metadata.verification?.deadlineVerified === true,
    lifecycle: Boolean(lifecycle?.evidence?.length || lifecycle?.review),
    requirements: supports.has("requirements"),
    compensation: supports.has("compensation"),
    programDates: supports.has("program_dates"),
    location: supports.has("location"),
  };
}

export function buildCatalogReliabilityReport(opportunities: readonly Opportunity[], options: CatalogReliabilityOptions = {}) {
  const now = options.now ?? new Date();
  const records = opportunities.map((opportunity) => classifyCatalogRecord(opportunity, { ...options, now }));
  const safe = opportunities.filter((_, index) => records[index].recommendationSafe);
  const trust = opportunities.map(trustCoverage);
  const queue = records.filter((record) => record.queueTier !== "none")
    .sort((left, right) => (queueTierOrder.get(left.queueTier) ?? 99) - (queueTierOrder.get(right.queueTier) ?? 99) || left.id.localeCompare(right.id));
  const fieldCounts = countBy(safe.flatMap(fieldAreas));
  const safeClass = safe.map((opportunity) => recommendationOpportunityClass(opportunity));
  const pathCoverage = Object.fromEntries(opportunityPaths.map((path) => [path.name, safe.filter((opportunity) => path.stages.some((stage) => opportunityMatchesPathStage(opportunity, stage))).length]));
  const trustTotals = Object.fromEntries(Object.keys(trust[0] ?? {}).map((key) => [key, trust.filter((item) => item[key as keyof typeof item]).length]));
  return {
    schemaVersion: "catalog-reliability-v2",
    asOf: now.toISOString().slice(0, 10),
    totals: {
      canonical: opportunities.length,
      recommendationSafe: safe.length,
      highValueSafe: safeClass.filter((value) => value !== "resource").length,
      staleSafe: records.filter((record) => record.recommendationSafe && record.state === "STALE").length,
    },
    healthStates: countBy(records.map((record) => record.state)),
    blockers: countBy(records.flatMap((record) => record.blockers)),
    lifecycle: countBy(records.map((record) => record.lifecycle)),
    sourceTiers: countBy(records.map((record) => record.sourceTier)),
    coverage: {
      byType: countBy(safe.map((opportunity) => opportunity.type)),
      byCategory: countBy(safe.map((opportunity) => opportunity.category)),
      byStudentStage: countBy(safe.flatMap((opportunity) => opportunity.academic_years)),
      byField: fieldCounts,
      byCoverageGap: countBy(safe.flatMap(coverageGapsFor)),
      internationalSafe: safe.filter((opportunity) => normalizeOpportunityEligibility(opportunity).citizenship.includes("international_allowed")).length,
      transferSafe: safe.filter((opportunity) => ["transfer_specific", "explicitly_eligible"].includes(normalizeOpportunityEligibility(opportunity).transferEligibility)).length,
      byPath: pathCoverage,
    },
    trustCoverage: trustTotals,
    review: {
      due: records.filter((record) => record.review.due).length,
      queueByTier: countBy(queue.map((record) => record.queueTier)),
      nearSafe: records.filter((record) => record.state === "NEAR_SAFE").length,
      stale: records.filter((record) => record.state === "STALE").length,
      duplicateCandidates: records.filter((record) => record.state === "DUPLICATE_CANDIDATE").length,
      archiveCandidates: records.filter((record) => record.state === "ARCHIVE_CANDIDATE").length,
    },
    queue,
    records,
  };
}
