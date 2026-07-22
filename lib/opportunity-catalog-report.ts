import "server-only";

import { opportunities } from "@/data/opportunities";
import { buildOpportunityCatalogIndex, type OpportunityBehaviorSignal } from "@/data/opportunity-platform";
import { getOpportunityEngagementSignals } from "./analytics-store";

const countBy = (values: string[]) => [...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>()).entries()]
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));

export async function getOpportunityCatalogReport() {
  const engagement = await getOpportunityEngagementSignals();
  const behavior = new Map<string, OpportunityBehaviorSignal>(engagement);
  const index = buildOpportunityCatalogIndex(opportunities, { behavior });
  const profiles = [...index.profiles.values()];
  const gaps = countBy(profiles.flatMap((profile) => [
    ...profile.eligibility.criticalUnknowns.map((field) => `Eligibility: ${field.replaceAll("_", " ")}`),
    ...profile.enrichment.missingFields.map((field) => `Metadata: ${field.replaceAll("_", " ")}`),
    ...profile.freshness.reviewReasons.map((reason) => `Freshness: ${reason}`),
  ]));
  const byCategory = countBy(opportunities.map((item) => item.category));
  const byMajor = countBy(opportunities.flatMap((item) => item.majors));
  const byYear = countBy(opportunities.flatMap((item) => item.academic_years));
  const byOrganization = countBy(opportunities.map((item) => item.organization));
  const reviewQueue = profiles
    .filter((profile) => profile.confidence.tier !== "high_confidence")
    .sort((left, right) => right.recommendationGateReasons.length - left.recommendationGateReasons.length || left.opportunityId.localeCompare(right.opportunityId))
    .slice(0, 30)
    .map((profile) => ({ id: profile.opportunityId, reasons: profile.recommendationGateReasons, confidenceTier: profile.confidence.tier }));
  return {
    version: index.version,
    generatedAt: index.generatedAt,
    totals: {
      records: opportunities.length,
      verified: opportunities.filter((item) => item.verification_status === "verified").length,
      partiallyVerified: profiles.filter((profile) => profile.confidence.tier === "partially_verified").length,
      needsReview: profiles.filter((profile) => profile.confidence.tier === "needs_review").length,
      excluded: profiles.filter((profile) => profile.confidence.tier === "excluded").length,
      recommendationEligible: profiles.filter((profile) => profile.recommendationEligible).length,
      duplicateGroups: index.duplicateGroups.length,
      duplicateRecords: index.duplicateGroups.reduce((sum, group) => sum + group.ids.length - 1, 0),
      expired: profiles.filter((profile) => profile.freshness.state === "expired").length,
      missingDeadlines: opportunities.filter((item) => ["unknown", "not_announced"].includes(item.metadata.deadlineType ?? "")).length,
      missingEligibility: profiles.filter((profile) => profile.eligibility.criticalUnknowns.length > 0).length,
      missingLogos: profiles.filter((profile) => !profile.enrichment.logo).length,
      behaviorSamples: [...behavior.values()].reduce((sum, signal) => sum + signal.shown + signal.opened + signal.saved + signal.applied + signal.dismissed + signal.accepted, 0),
    },
    coverage: { byCategory, byMajor, byYear, byOrganization },
    gaps: gaps.slice(0, 20),
    duplicateGroups: index.duplicateGroups,
    reviewQueue,
  };
}
