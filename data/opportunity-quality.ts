import type { Opportunity } from "./opportunities";

export type OpportunityQualityCheck = {
  id: string;
  contentComplete: boolean;
  completenessScore: number;
  missingFields: string[];
  duplicateKey: string;
  hasKnownValue: boolean;
  hasHowToClaimOrApply: boolean;
  hasWhyItMatters: boolean;
};

const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

export function opportunityDuplicateKey(item: Opportunity) {
  return normalized(`${item.type} ${item.title} ${item.organization}`);
}

export function opportunityHasKnownValue(item: Opportunity) {
  return typeof item.estimated_value === "number" || text(item.metadata.valueLabel) || text(item.metadata.awardAmountLabel) || text(item.metadata.studentOffer);
}

export function opportunityHasHowToClaimOrApply(item: Opportunity) {
  return Boolean(item.metadata.claimSteps?.length || item.metadata.applicationRequirements?.length || text(item.metadata.claimUrl) || text(item.official_source));
}

export function opportunityHasWhyItMatters(item: Opportunity) {
  return Boolean(item.description.length >= 60 && (item.tags.length > 0 || item.majors.length > 0 || text(item.category)));
}

export function auditOpportunity(item: Opportunity): OpportunityQualityCheck {
  const checks: [string, boolean][] = [
    ["official_source", text(item.official_source) && item.official_source.startsWith("https://")],
    ["official_source_url", text(item.official_source_url) && item.official_source_url.startsWith("https://")],
    ["estimated_value_or_unknown", opportunityHasKnownValue(item) || item.estimated_value === null],
    ["eligibility", text(item.eligibility)],
    ["category", text(item.category)],
    ["description", text(item.description) && item.description.length >= 40],
    ["why_it_matters_inputs", opportunityHasWhyItMatters(item)],
    ["how_to_claim_or_apply", opportunityHasHowToClaimOrApply(item)],
    ["verification_status", text(item.verification_status)],
    ["last_verified", /^\d{4}-\d{2}-\d{2}$/.test(item.last_verified)],
    ["deadline", item.deadline === null || /^\d{4}-\d{2}-\d{2}$/.test(item.deadline)],
    ["reviewer_notes", text(item.reviewer_notes)],
  ];
  const missingFields = checks.filter(([, passed]) => !passed).map(([field]) => field);
  return {
    id: item.id,
    contentComplete: missingFields.length === 0,
    completenessScore: Math.round(((checks.length - missingFields.length) / checks.length) * 100),
    missingFields,
    duplicateKey: opportunityDuplicateKey(item),
    hasKnownValue: opportunityHasKnownValue(item),
    hasHowToClaimOrApply: opportunityHasHowToClaimOrApply(item),
    hasWhyItMatters: opportunityHasWhyItMatters(item),
  };
}

export function auditOpportunities(items: Opportunity[]) {
  const checks = items.map(auditOpportunity);
  const duplicateGroups = new Map<string, string[]>();
  for (const check of checks) duplicateGroups.set(check.duplicateKey, [...(duplicateGroups.get(check.duplicateKey) ?? []), check.id]);
  const duplicates = [...duplicateGroups.entries()].filter(([, ids]) => ids.length > 1).map(([key, ids]) => ({ key, ids }));
  return {
    checks,
    duplicates,
    incomplete: checks.filter((check) => !check.contentComplete),
    completeCount: checks.filter((check) => check.contentComplete).length,
  };
}
