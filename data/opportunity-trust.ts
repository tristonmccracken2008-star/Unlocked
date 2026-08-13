import { resolveOpportunityLifecycle, safeOfficialUrl } from "./opportunity-lifecycle";
import type { Opportunity } from "./opportunities";

export type OpportunityTrustState = "verified" | "official_source" | "unconfirmed" | "potentially_stale" | "unavailable";

export type OpportunityFieldTrust = {
  state: OpportunityTrustState;
  label: string;
  detail: string;
  checkedAt?: string;
  sourceUrl?: string;
};

export type OpportunityTrustProjection = {
  source: OpportunityFieldTrust;
  deadline: OpportunityFieldTrust & { displayValue: string };
  eligibility: OpportunityFieldTrust;
  requirements: OpportunityFieldTrust;
  lifecycle: ReturnType<typeof resolveOpportunityLifecycle>;
  verifiedRequirements: string[];
};

const criticalFreshnessDays = {
  deadline: 120,
  eligibility: 366,
  requirements: 366,
} as const;

const genericRequirementPatterns = [
  /^start at .+ official website/i,
  /^search for the current office/i,
  /^confirm eligibility, deadlines, and application/i,
];

function ageDays(value: string | undefined, now: Date) {
  const timestamp = value ? Date.parse(value.length === 10 ? `${value}T12:00:00.000Z` : value) : Number.NaN;
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((now.getTime() - timestamp) / 86_400_000)) : null;
}

function fieldCheckedAt(opportunity: Opportunity, field: "deadline" | "eligibility") {
  return opportunity.metadata.lifecycle?.fieldVerifiedAt?.[field]
    ?? opportunity.metadata.verification?.lastVerifiedAt
    ?? opportunity.last_verified;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value.slice(0, 10)}T12:00:00.000Z`));
}

function sourceProjection(opportunity: Opportunity): OpportunityFieldTrust {
  const sourceUrl = safeOfficialUrl(opportunity.official_source_url) ? opportunity.official_source_url : undefined;
  const verification = opportunity.metadata.verification;
  if (!sourceUrl || verification?.sourceReachable === false || opportunity.verification_status === "broken_source") {
    return { state: "unavailable", label: "Source needs review", detail: "UnlockED does not currently have a reliable source link." };
  }
  const explicitlyOfficial = safeOfficialUrl(verification?.officialSourceUrl)
    && verification?.officialSourceUrl === opportunity.official_source_url;
  if (explicitlyOfficial || verification?.applicationUrlVerified === true) {
    return { state: "official_source", label: `Official source from ${opportunity.organization}`, detail: `This link is attributed to ${opportunity.organization}.`, checkedAt: opportunity.last_verified, sourceUrl };
  }
  return { state: "unconfirmed", label: "Provider source not independently confirmed", detail: "Use the linked provider page to confirm current terms.", checkedAt: opportunity.last_verified, sourceUrl };
}

function deadlineDisplay(opportunity: Opportunity, verified: boolean) {
  const type = opportunity.metadata.deadlineType;
  if (type === "current_cycle_closed") return "Applications currently closed";
  if (type === "no_deadline" && verified) return "No application deadline";
  if (type === "rolling" && verified) return "Rolling";
  if (type === "varies") return verified ? "Deadline varies by listing" : "Deadline not confirmed";
  if (type === "not_announced") return "Deadline not announced";
  if (type === "unknown") return "Deadline not confirmed";
  if (opportunity.application_deadline && verified) return formatDate(opportunity.application_deadline);
  return "Deadline not confirmed";
}

export function verifiedApplicationRequirements(opportunity: Opportunity) {
  const source = sourceProjection(opportunity);
  if (opportunity.verification_status !== "verified"
    || opportunity.metadata.verification?.eligibilityVerified !== true
    || source.state !== "official_source") return [];
  return [...new Set(opportunity.metadata.applicationRequirements ?? [])]
    .filter((requirement) => !genericRequirementPatterns.some((pattern) => pattern.test(requirement)))
    .slice(0, 20);
}

export function projectOpportunityTrust(opportunity: Opportunity, now = new Date()): OpportunityTrustProjection {
  const source = sourceProjection(opportunity);
  const lifecycle = resolveOpportunityLifecycle(opportunity, now);
  const deadlineCheckedAt = fieldCheckedAt(opportunity, "deadline");
  const eligibilityCheckedAt = fieldCheckedAt(opportunity, "eligibility");
  const deadlineAge = ageDays(deadlineCheckedAt, now);
  const eligibilityAge = ageDays(eligibilityCheckedAt, now);
  const deadlineExplicitlyVerified = opportunity.verification_status === "verified"
    && opportunity.metadata.verification?.deadlineVerified === true
    && source.state === "official_source";
  const deadlineStale = deadlineExplicitlyVerified && deadlineAge !== null && deadlineAge > criticalFreshnessDays.deadline
    && !["no_deadline", "rolling"].includes(opportunity.metadata.deadlineType ?? "");
  const deadlineState: OpportunityTrustState = deadlineStale
    ? "potentially_stale"
    : deadlineExplicitlyVerified ? "verified"
      : ["not_announced", "unknown"].includes(opportunity.metadata.deadlineType ?? "") ? "unavailable" : "unconfirmed";
  const deadline: OpportunityTrustProjection["deadline"] = {
    state: deadlineState,
    label: deadlineState === "verified" ? `Verified from ${opportunity.organization}`
      : deadlineState === "potentially_stale" ? "Check the current deadline"
        : deadlineState === "unavailable" ? "Deadline unavailable"
          : "Deadline not confirmed",
    detail: deadlineState === "verified" ? "The current deadline is supported by the official source."
      : deadlineState === "potentially_stale" ? "This date was previously verified, but should be checked for the current cycle."
        : "UnlockED does not have enough current evidence to present an official deadline.",
    displayValue: deadlineDisplay(opportunity, deadlineState === "verified"),
    checkedAt: deadlineCheckedAt,
    sourceUrl: source.sourceUrl,
  };

  const eligibilityExplicitlyVerified = opportunity.verification_status === "verified"
    && opportunity.metadata.verification?.eligibilityVerified === true
    && source.state === "official_source";
  const eligibilityStale = eligibilityExplicitlyVerified && eligibilityAge !== null && eligibilityAge > criticalFreshnessDays.eligibility;
  const eligibility: OpportunityFieldTrust = eligibilityStale ? {
    state: "potentially_stale", label: "Check current eligibility", detail: "These requirements were previously verified but may have changed for the current cycle.", checkedAt: eligibilityCheckedAt, sourceUrl: source.sourceUrl,
  } : eligibilityExplicitlyVerified ? {
    state: "verified", label: `Verified from ${opportunity.organization}`, detail: "These listed eligibility requirements are supported by the official source.", checkedAt: eligibilityCheckedAt, sourceUrl: source.sourceUrl,
  } : {
    state: "unconfirmed", label: "Eligibility not fully confirmed", detail: "UnlockED has not verified every eligibility requirement. A recommendation is not a guarantee of eligibility.", checkedAt: eligibilityCheckedAt, sourceUrl: source.sourceUrl,
  };

  const verifiedRequirements = verifiedApplicationRequirements(opportunity);
  const requirements: OpportunityFieldTrust = verifiedRequirements.length ? {
    state: eligibilityStale ? "potentially_stale" : "verified",
    label: eligibilityStale ? "Check current requirements" : `Verified from ${opportunity.organization}`,
    detail: eligibilityStale ? "These materials were previously verified but should be checked for the current cycle." : "These application materials are supported by the official source.",
    checkedAt: eligibilityCheckedAt,
    sourceUrl: source.sourceUrl,
  } : {
    state: "unconfirmed",
    label: "Requirements not verified",
    detail: "UnlockED has not verified a complete official requirements list for this opportunity.",
    checkedAt: eligibilityCheckedAt,
    sourceUrl: source.sourceUrl,
  };
  return { source, deadline, eligibility, requirements, lifecycle, verifiedRequirements };
}

export const opportunityTrustFreshnessPolicy = criticalFreshnessDays;
