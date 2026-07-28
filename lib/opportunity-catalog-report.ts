import "server-only";

import { opportunities } from "@/data/opportunities";
import { buildOpportunityCatalogIndex, type OpportunityBehaviorSignal } from "@/data/opportunity-platform";
import { getOpportunityEngagementSignals } from "./analytics-store";
import { resolveOpportunityLifecycle } from "@/data/opportunity-lifecycle";
import { opportunityReportSummary } from "./opportunity-report-store";

const countBy = (values: string[]) => [...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>()).entries()]
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));

export async function getOpportunityCatalogReport() {
  const engagement = await getOpportunityEngagementSignals();
  const behavior = new Map<string, OpportunityBehaviorSignal>(engagement);
  const index = buildOpportunityCatalogIndex(opportunities, { behavior });
  const profiles = [...index.profiles.values()];
  const lifecycle = opportunities.map((opportunity) => ({ opportunity, snapshot: resolveOpportunityLifecycle(opportunity) }));
  const reports = await opportunityReportSummary();
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
      lifecycle: Object.fromEntries(["open", "upcoming", "rolling", "temporarily_closed", "closed", "canceled", "archived", "unknown"].map((state) => [state, lifecycle.filter((item) => item.snapshot.state === state).length])),
      closingSoon: lifecycle.filter((item) => item.snapshot.displayState === "closing_soon").length,
      recurring: lifecycle.filter((item) => item.snapshot.recurring).length,
      lifecycleConflicts: lifecycle.filter((item) => item.snapshot.issues.some((issue) => issue.severity === "conflicting_evidence")).length,
      lifecycleStale: lifecycle.filter((item) => item.snapshot.issues.length > 0).length,
      lifecycleReports: reports.reduce((sum, report) => sum + report.total, 0),
    },
    coverage: { byCategory, byMajor, byYear, byOrganization },
    gaps: gaps.slice(0, 20),
    duplicateGroups: index.duplicateGroups,
    reviewQueue,
    lifecycleReviewQueue: lifecycle
      .filter((item) => item.snapshot.state === "unknown" || item.snapshot.issues.length)
      .sort((left, right) => right.snapshot.issues.length - left.snapshot.issues.length || left.opportunity.id.localeCompare(right.opportunity.id))
      .slice(0, 50)
      .map((item) => ({
        id: item.opportunity.id,
        organization: item.opportunity.organization,
        state: item.snapshot.state,
        confidence: item.snapshot.confidence,
        issues: item.snapshot.issues,
        reports: reports.find((report) => report.opportunityId === item.opportunity.id),
      })),
  };
}
