import "server-only";

import { isCanonicalCatalogOpportunity } from "@/data/opportunity-catalog-canonical";
import { resolveOpportunityLifecycle } from "@/data/opportunity-lifecycle";
import { opportunities, type Opportunity } from "@/data/opportunities";
import { projectOpportunityTrust } from "@/data/opportunity-trust";

function overlap(left: readonly string[], right: readonly string[]) {
  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  return left.reduce((count, value) => count + Number(rightSet.has(value.toLowerCase())), 0);
}

export function findRelatedDiscoverOpportunities(item: Opportunity, source: readonly Opportunity[], limit = 3) {
  return source
    .filter((candidate) => candidate.id !== item.id && isCanonicalCatalogOpportunity(candidate.id))
    .map((candidate) => {
      const lifecycle = resolveOpportunityLifecycle(candidate);
      const trust = projectOpportunityTrust(candidate);
      if (["archived", "broken_source", "expired"].includes(candidate.verification_status)) return null;
      if (["closed", "temporarily_closed", "canceled"].includes(lifecycle.state)) return null;
      const tagOverlap = overlap(item.tags, candidate.tags);
      const majorOverlap = overlap(item.majors.filter((major) => major !== "Any Major"), candidate.majors);
      const careerOverlap = overlap(item.metadata.careerPaths ?? [], candidate.metadata.careerPaths ?? []);
      const score = Number(candidate.category === item.category) * 60
        + Number(candidate.type === item.type) * 35
        + Number(candidate.organization === item.organization) * 12
        + tagOverlap * 7
        + majorOverlap * 5
        + careerOverlap * 8
        + Number(candidate.verification_status === "verified") * 12
        + Number(trust.source.state === "official_source") * 8
        + Number(lifecycle.actionable) * 6;
      return score > 35 ? { candidate, score } : null;
    })
    .filter((entry): entry is { candidate: Opportunity; score: number } => Boolean(entry))
    .sort((left, right) => right.score - left.score || left.candidate.title.localeCompare(right.candidate.title) || left.candidate.id.localeCompare(right.candidate.id))
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

export function relatedDiscoverOpportunityIds(item: Opportunity, limit = 3) {
  return findRelatedDiscoverOpportunities(item, opportunities, limit).map((candidate) => candidate.id);
}
