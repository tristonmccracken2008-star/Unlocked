import "server-only";
import type { CareerRecord } from "@/data/careers";
import type { Opportunity } from "@/data/opportunities";
import { classifyCatalogRecord } from "@/data/catalog-reliability";

const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function relatedOpportunities(career: CareerRecord, opportunities: readonly Opportunity[], limit = 6) {
  const terms = career.opportunityTerms.map(normalize).filter((term) => term.length > 2);
  return opportunities.flatMap((opportunity) => {
    if (!classifyCatalogRecord(opportunity).recommendationSafe) return [];
    const haystack = normalize(`${opportunity.title} ${opportunity.organization} ${opportunity.category} ${opportunity.tags.join(" ")} ${opportunity.majors.join(" ")}`);
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? term.split(" ").length + 1 : 0), 0);
    return score ? [{ opportunity, score }] : [];
  }).sort((a, b) => b.score - a.score || a.opportunity.title.localeCompare(b.opportunity.title)).slice(0, limit).map((item) => item.opportunity);
}
