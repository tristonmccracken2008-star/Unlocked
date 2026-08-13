import { isCanonicalCatalogOpportunity } from "./opportunity-catalog-canonical";
import { normalizeOpportunityEligibility } from "./opportunity-eligibility-model";
import { resolveOpportunityLifecycle, safeOfficialUrl } from "./opportunity-lifecycle";
import type { Opportunity } from "./opportunities";
import { projectOpportunityTrust } from "./opportunity-trust";

export type OpportunityTrustAuditIssue = { opportunityId: string; code: string; severity: "error" | "review"; message: string };
export type OpportunityTrustCoverage = {
  totalRecords: number; canonicalRecords: number; verifiedRecords: number; activeRecords: number;
  recommendationSafeRecords: number; safeSourceRecords: number; explicitlyVerifiedSourceRecords: number;
  confirmedDeadlineRecords: number; unconfirmedDeadlineRecords: number; verifiedEligibilityRecords: number;
  verifiedRequirementRecords: number; staleCriticalRecords: number; invalidSourceRecords: number; reviewRequiredRecords: number;
};

export function auditOpportunityTrust(opportunities: readonly Opportunity[], now = new Date()) {
  const issues: OpportunityTrustAuditIssue[] = [];
  const canonicalIdentities = opportunities.filter((item) => isCanonicalCatalogOpportunity(item.id));
  const canonical = canonicalIdentities.filter((item) => item.verification_status !== "archived");
  let activeRecords = 0, recommendationSafeRecords = 0, safeSourceRecords = 0, explicitlyVerifiedSourceRecords = 0;
  let confirmedDeadlineRecords = 0, unconfirmedDeadlineRecords = 0, verifiedEligibilityRecords = 0;
  let verifiedRequirementRecords = 0, staleCriticalRecords = 0, invalidSourceRecords = 0;
  for (const item of canonical) {
    const trust = projectOpportunityTrust(item, now);
    const lifecycle = trust.lifecycle;
    const canonicalEligibility = normalizeOpportunityEligibility(item);
    const safeSource = safeOfficialUrl(item.official_source_url) && item.official_source_url === item.official_source;
    if (lifecycle.actionable) activeRecords += 1;
    if (lifecycle.recommendationEligible && canonicalEligibility.recommendationEligibilityStatus === "eligible_for_ranking") recommendationSafeRecords += 1;
    if (safeSource) safeSourceRecords += 1;
    if (trust.source.checkedAt && item.metadata.verification?.applicationUrlVerified === true) explicitlyVerifiedSourceRecords += 1;
    if (trust.deadline.state === "verified") confirmedDeadlineRecords += 1; else unconfirmedDeadlineRecords += 1;
    if (trust.eligibility.state === "verified") verifiedEligibilityRecords += 1;
    if (trust.verifiedRequirements.length) verifiedRequirementRecords += 1;
    if ([trust.deadline.state, trust.eligibility.state, trust.requirements.state].includes("potentially_stale")) staleCriticalRecords += 1;
    if (!safeSource) { invalidSourceRecords += 1; issues.push({ opportunityId: item.id, code: "invalid_source", severity: "error", message: "Canonical opportunity is missing a matching safe HTTPS source." }); }
    if (item.verification_status === "verified" && item.metadata.deadlineType === "fixed" && item.metadata.verification?.deadlineVerified !== true) issues.push({ opportunityId: item.id, code: "unsupported_verified_deadline", severity: "error", message: "Verified fixed deadline lacks explicit deadline evidence." });
    if (item.metadata.verification?.deadlineVerified === true && !safeSource) issues.push({ opportunityId: item.id, code: "deadline_without_source", severity: "error", message: "Deadline is marked verified without a safe source." });
    if (trust.verifiedRequirements.length && item.metadata.verification?.eligibilityVerified !== true) issues.push({ opportunityId: item.id, code: "requirements_without_evidence", severity: "error", message: "Requirements are presented as verified without explicit supporting evidence." });
    if (lifecycle.state === "archived" && !["archived", "expired"].includes(item.verification_status)) issues.push({ opportunityId: item.id, code: "archived_state_mismatch", severity: "error", message: "Archived lifecycle state conflicts with the catalog verification state." });
    if (item.verification_status === "verified" && trust.eligibility.state !== "verified") issues.push({ opportunityId: item.id, code: "partial_verification", severity: "review", message: "Record is verified, but eligibility is not explicitly verified." });
    if (trust.deadline.state === "potentially_stale" || trust.eligibility.state === "potentially_stale") issues.push({ opportunityId: item.id, code: "stale_critical_field", severity: "review", message: "A critical field needs current-cycle review." });
  }
  for (const item of canonicalIdentities.filter((candidate) => candidate.verification_status === "archived")) {
    if (resolveOpportunityLifecycle(item, now).state !== "archived") issues.push({ opportunityId: item.id, code: "archived_state_mismatch", severity: "error", message: "Archived catalog record remains active in lifecycle projection." });
  }
  const reviewRequiredRecords = new Set(issues.filter((issue) => issue.severity === "review").map((issue) => issue.opportunityId)).size;
  const coverage: OpportunityTrustCoverage = {
    totalRecords: opportunities.length, canonicalRecords: canonical.length,
    verifiedRecords: canonical.filter((item) => item.verification_status === "verified").length,
    activeRecords, recommendationSafeRecords, safeSourceRecords, explicitlyVerifiedSourceRecords,
    confirmedDeadlineRecords, unconfirmedDeadlineRecords, verifiedEligibilityRecords, verifiedRequirementRecords,
    staleCriticalRecords, invalidSourceRecords, reviewRequiredRecords,
  };
  return { coverage, issues };
}
