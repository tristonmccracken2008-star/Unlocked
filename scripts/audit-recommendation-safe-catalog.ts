import { buildRecommendationSafeCatalogAudit } from "../data/recommendation-safe-catalog";
import { normalizeOpportunityEligibility } from "../data/opportunity-eligibility-model";
import { validateOpportunityData } from "../data/recommendation-professional-pipeline";
import { opportunities } from "../data/opportunities";
import { opportunityPaths } from "../data/opportunity-paths";
import { opportunityMatchesPathStage } from "../lib/opportunity-paths";

const audit = buildRecommendationSafeCatalogAudit(opportunities);
const safe = opportunities.filter((opportunity) => validateOpportunityData(opportunity).allowed);
const countBy = (values: string[]) => Object.fromEntries([...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
const broadArea = (major: string) => {
  if (/computer|software|data|cyber|information|machine/i.test(major)) return "Computer Science / Data";
  if (/math|statistic|actuarial/i.test(major)) return "Mathematics";
  if (/engineer|physics|chemistry|environment|earth|astronomy/i.test(major)) return "Engineering / STEM";
  if (/econom|finance|account|business|marketing/i.test(major)) return "Economics / Finance / Business";
  if (/biology|pre-med|nursing|health|neuro|kinesiology/i.test(major)) return "Pre-med / Health";
  if (/politic|policy|psychology|social|international|sociology/i.test(major)) return "Social Sciences / Policy";
  if (/english|history|journal|communication|language|philosophy/i.test(major)) return "Humanities";
  if (/art|design|music|architecture/i.test(major)) return "Arts / Design";
  if (/any|undecided/i.test(major)) return "Broad / Undecided";
  return "Other";
};
const coverageMatrix = new Map<string, number>();
const uniqueBroadAreaCounts = new Map<string, number>();
for (const opportunity of safe) {
  const areas = new Set(opportunity.majors.map(broadArea));
  for (const area of areas) {
    uniqueBroadAreaCounts.set(area, (uniqueBroadAreaCounts.get(area) ?? 0) + 1);
    const key = `${area} × ${opportunity.type}`;
    coverageMatrix.set(key, (coverageMatrix.get(key) ?? 0) + 1);
  }
}
const coverageDeserts = [...coverageMatrix.entries()].filter(([, count]) => count <= 2).sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]));
const pathCoverage = Object.fromEntries(opportunityPaths.map((path) => [
  path.name,
  safe.filter((opportunity) => path.stages.some((stage) => opportunityMatchesPathStage(opportunity, stage))).length,
]).sort((left, right) => Number(right[1]) - Number(left[1]) || String(left[0]).localeCompare(String(right[0]))));

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  funnel: {
    total: opportunities.length,
    canonicalAndLifecycleActionable: audit.records.filter((record) => record.lifecycle.recommendationEligible).length,
    officialSourceConfirmed: audit.records.filter((record) => record.sourceAuthority === "official").length,
    eligibilityExplicitlyVerified: opportunities.filter((opportunity) => opportunity.metadata.verification?.eligibilityVerified === true).length,
    recommendationSafe: safe.length,
  },
  blockers: audit.blockerCounts,
  lifecycle: audit.lifecycleCounts,
  safeCoverage: {
    byType: countBy(safe.map((opportunity) => opportunity.type)),
    byCategory: countBy(safe.map((opportunity) => opportunity.category)),
    byYear: countBy(safe.flatMap((opportunity) => opportunity.academic_years)),
    byBroadArea: countBy(safe.flatMap((opportunity) => opportunity.majors.map(broadArea))),
    byUniqueBroadArea: Object.fromEntries([...uniqueBroadAreaCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))),
    byPath: pathCoverage,
    highValueSafe: safe.filter((opportunity) => ["Career", "Research", "Scholarship"].includes(opportunity.type)).length,
    internationalSafe: safe.filter((opportunity) => normalizeOpportunityEligibility(opportunity).citizenship.includes("international_allowed")).length,
    transferEligibility: countBy(safe.map((opportunity) => normalizeOpportunityEligibility(opportunity).transferEligibility)),
    transferSafe: safe.filter((opportunity) => ["transfer_specific", "explicitly_eligible"].includes(normalizeOpportunityEligibility(opportunity).transferEligibility)).length,
    matrix: Object.fromEntries([...coverageMatrix.entries()].sort((left, right) => left[0].localeCompare(right[0]))),
    deserts: Object.fromEntries(coverageDeserts),
  },
  highestPriorityReviewQueue: audit.queue.slice(0, 30).map((record) => ({ id: record.id, priorityBand: record.queuePriority, effort: record.estimatedEffort, lifecycle: record.lifecycle.state, blockers: record.blockers, missingEvidenceFields: record.missingEvidenceFields })),
}, null, 2));
