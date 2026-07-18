import "server-only";

import { filterOpportunities, type Opportunity, type OpportunityDifficulty, type OpportunityType } from "@/data/opportunities";
import type { DiscoverCatalogPayload, DiscoverSortMode } from "@/data/opportunity-listing";

export type DiscoverCatalogQuery = {
  query: string;
  type: OpportunityType | "All";
  category: string;
  major: string;
  school: string;
  paid: string;
  remote: string;
  difficulty: Exclude<OpportunityDifficulty, null> | "All";
  freshmanFriendly: boolean;
  deadline: string;
  sort: DiscoverSortMode;
  limit: number;
};

type DiscoverIndex = {
  searchTextById: Map<string, string>;
  facets: DiscoverCatalogPayload["facets"];
};

const quickFilters: { label: string; type?: OpportunityType; category?: string }[] = [
  { label: "All" },
  { label: "Scholarships", type: "Scholarship" },
  { label: "Internships", type: "Career", category: "Internships" },
  { label: "AI Tools", type: "AI" },
  { label: "Research", type: "Research" },
  { label: "Benefits", type: "Benefit" },
  { label: "Software", category: "Software" },
  { label: "Career", type: "Career" },
];

const indexBySource = new WeakMap<readonly Opportunity[], DiscoverIndex>();

function normalizedSearchText(item: Opportunity) {
  const metadata = item.metadata;
  return [
    item.title,
    item.organization,
    item.description,
    item.type,
    item.category,
    item.eligibility,
    item.location,
    ...item.tags,
    ...item.majors,
    ...item.academic_years,
    metadata.department,
    metadata.researchArea,
    metadata.offerType,
    ...(metadata.careerPaths ?? []),
    ...(metadata.skillsGained ?? []),
    ...(metadata.bestUseCases ?? []),
    ...(metadata.recommendedMajors ?? []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function discoverIndex(source: readonly Opportunity[]) {
  const cached = indexBySource.get(source);
  if (cached) return cached;
  const index: DiscoverIndex = {
    searchTextById: new Map(source.map((item) => [item.id, normalizedSearchText(item)])),
    facets: {
      categories: [...new Set(source.map((item) => item.category))].sort(),
      majors: [...new Set(source.flatMap((item) => item.majors).filter((item) => item !== "Any Major"))].sort(),
      typeCounts: Object.fromEntries(quickFilters.map((filter) => [
        filter.label,
        filter.label === "All" ? source.length : source.filter((item) => (!filter.type || item.type === filter.type) && (!filter.category || item.category === filter.category)).length,
      ])),
    },
  };
  indexBySource.set(source, index);
  return index;
}

function relevanceScore(item: Opportunity) {
  let score = 0;
  if (item.featured) score += 40;
  if (item.verification_status === "verified") score += 25;
  if (item.academic_years.includes("Any Year") || item.academic_years.includes("First year") || item.category === "Freshman Programs") score += 12;
  if (item.application_deadline) score += 8;
  if (item.estimated_value) score += Math.min(12, Math.log10(Math.max(item.estimated_value, 1)) * 2);
  if (item.verification_status === "needs_review") score -= 10;
  if (item.verification_status === "archived") score -= 100;
  return score;
}

function sortOpportunities(items: Opportunity[], sort: DiscoverSortMode) {
  const next = [...items];
  if (sort === "Relevant") return next.sort((a, b) => relevanceScore(b) - relevanceScore(a) || b.date_added.localeCompare(a.date_added) || a.title.localeCompare(b.title));
  if (sort === "Newest") return next.sort((a, b) => b.date_added.localeCompare(a.date_added) || a.title.localeCompare(b.title));
  if (sort === "Deadline") return next.sort((a, b) => (a.application_deadline ?? "9999-12-31").localeCompare(b.application_deadline ?? "9999-12-31") || a.title.localeCompare(b.title));
  return next.sort((a, b) => a.title.localeCompare(b.title));
}

export function buildDiscoverCatalog(source: readonly Opportunity[], query: DiscoverCatalogQuery): DiscoverCatalogPayload {
  const index = discoverIndex(source);
  const normalizedQuery = query.query.trim().toLowerCase();
  const structuredMatches = filterOpportunities({
    types: query.type === "All" ? undefined : [query.type],
    category: query.category,
    major: query.major,
    school: query.school === "All" ? undefined : query.school,
    paid: query.paid === "All" ? undefined : query.paid === "Paid",
    remote: query.remote === "All" ? undefined : query.remote === "Remote",
    difficulty: query.difficulty,
    freshmanFriendly: query.freshmanFriendly,
    deadline: query.deadline === "All" ? undefined : query.deadline as "published" | "upcoming" | "rolling" | "not_announced",
  }, source);
  const filtered = normalizedQuery ? structuredMatches.filter((item) => index.searchTextById.get(item.id)?.includes(normalizedQuery)) : structuredMatches;
  const sorted = sortOpportunities(filtered, query.sort);
  return {
    opportunities: sorted.slice(0, query.limit),
    total: sorted.length,
    limit: query.limit,
    facets: index.facets,
  };
}
