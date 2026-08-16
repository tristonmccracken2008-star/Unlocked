import "server-only";

import { isCanonicalCatalogOpportunity } from "@/data/opportunity-catalog-canonical";
import { filterOpportunities, type Opportunity, type OpportunityDifficulty, type OpportunityType } from "@/data/opportunities";
import { resolveOpportunityLifecycle, type OpportunityLifecycleSnapshot } from "@/data/opportunity-lifecycle";
import { discoverExplorationPaths, type DiscoverCatalogPayload, type DiscoverRecovery, type DiscoverSortMode, type OpportunityListing } from "@/data/opportunity-listing";
import { projectOpportunityTrust } from "@/data/opportunity-trust";

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
  documentsById: Map<string, SearchDocument>;
  vocabulary: string[];
  vocabularySet: Set<string>;
  preparedQueries: Map<string, PreparedSearchQuery>;
  facets: DiscoverCatalogPayload["facets"];
};

type SearchDocument = {
  title: string;
  organization: string;
  titleTokens: Set<string>;
  organizationTokens: Set<string>;
  categoryTokens: Set<string>;
  subjectTokens: Set<string>;
  detailTokens: Set<string>;
  allTokens: Set<string>;
};

type PreparedSearchTerm = {
  token: string;
  synonyms: string[];
  typos: string[];
};

type PreparedSearchQuery = {
  normalized: string;
  terms: PreparedSearchTerm[];
  exactAlias: boolean;
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
const canonicalSourceBySource = new WeakMap<readonly Opportunity[], readonly Opportunity[]>();
const lifecycleBySource = new WeakMap<readonly Opportunity[], { date: string; snapshots: Map<string, OpportunityLifecycleSnapshot> }>();

function canonicalSource(source: readonly Opportunity[]) {
  const cached = canonicalSourceBySource.get(source);
  if (cached) return cached;
  const canonical = source.filter((item) => isCanonicalCatalogOpportunity(item.id) && !["archived", "broken_source"].includes(item.verification_status));
  canonicalSourceBySource.set(source, canonical);
  return canonical;
}

const synonymGroups = [
  ["ai", "artificial intelligence", "machine learning", "ml"],
  ["computer science", "cs", "software engineering", "swe"],
  ["quant", "quantitative finance", "quantitative trading"],
  ["intern", "internship", "internships", "co-op", "coop"],
  ["scholarship", "scholarships", "grant", "award", "funding"],
  ["freshman", "first year", "first-year"],
  ["first gen", "first generation", "first-generation"],
  ["research", "lab", "laboratory", "undergraduate research"],
  ["remote", "virtual", "online"],
  ["competition", "challenge", "hackathon", "contest", "cash prize", "prize"],
  ["biology", "biological science", "life science", "pre-med"],
  ["economics", "econ"],
  ["finance", "financial services"],
  ["investment banking", "ib"],
  ["consulting", "strategy consulting", "management consulting"],
  ["data science", "data analytics", "analytics", "statistics"],
  ["medicine", "medical", "healthcare", "clinical", "pre-med"],
  ["environment", "environmental", "climate", "sustainability"],
  ["student benefit", "student discount", "perk"],
  ["fellowship", "fellowships", "early insight program"],
] as const;

const exactQueryAliases = new Map<string, string>([
  ["money for college", "scholarship"],
  ["college money", "scholarship"],
  ["student discounts", "student benefit"],
  ["summer lab", "summer research"],
  ["reu", "research experience undergraduates"],
]);

function normalizeText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function stem(token: string) {
  if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 6 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function tokenize(value: string) {
  return normalizeText(value).split(" ").filter((token) => token.length > 1).map(stem);
}

const synonymTokens = new Map<string, Set<string>>();
for (const group of synonymGroups) {
  const expanded = new Set(group.flatMap((value) => tokenize(value)));
  for (const value of group) {
    synonymTokens.set(normalizeText(value), expanded);
    for (const token of tokenize(value)) {
      const current = synonymTokens.get(token) ?? new Set<string>();
      for (const candidate of expanded) current.add(candidate);
      synonymTokens.set(token, current);
    }
  }
}

function tokenSet(values: readonly (string | undefined)[]) {
  return new Set(values.filter((value): value is string => Boolean(value)).flatMap(tokenize));
}

function searchDocument(item: Opportunity): SearchDocument {
  const metadata = item.metadata;
  const titleTokens = tokenSet([item.title]);
  const organizationTokens = tokenSet([item.organization]);
  const categoryTokens = tokenSet([item.type, item.category]);
  const subjectTokens = tokenSet([
    ...item.tags,
    ...item.majors,
    ...item.academic_years,
    item.remote === true ? "remote virtual online" : item.remote === false ? "in person onsite" : undefined,
    item.paid === true ? "paid compensation stipend" : item.paid === false ? "unpaid" : undefined,
    item.recurring ? "recurring annual" : undefined,
    item.metadata.deadlineType?.replaceAll("_", " "),
    ...(metadata.careerPaths ?? []),
    ...(metadata.skillsGained ?? []),
    ...(metadata.bestUseCases ?? []),
    ...(metadata.recommendedMajors ?? []),
  ]);
  const detailTokens = tokenSet([
    item.description,
    item.eligibility,
    item.location,
    metadata.department,
    metadata.researchArea,
    metadata.offerType,
    metadata.awardAmountLabel,
    metadata.valueLabel,
    item.estimated_value_note,
  ]);
  return {
    title: normalizeText(item.title),
    organization: normalizeText(item.organization),
    titleTokens,
    organizationTokens,
    categoryTokens,
    subjectTokens,
    detailTokens,
    allTokens: new Set([...titleTokens, ...organizationTokens, ...categoryTokens, ...subjectTokens, ...detailTokens]),
  };
}

function discoverIndex(source: readonly Opportunity[]) {
  const cached = indexBySource.get(source);
  if (cached) return cached;
  const documentsById = new Map(source.map((item) => [item.id, searchDocument(item)]));
  const vocabulary = [...new Set([...documentsById.values()].flatMap((document) => [...document.allTokens]))];
  const index: DiscoverIndex = {
    documentsById,
    vocabulary,
    vocabularySet: new Set(vocabulary),
    preparedQueries: new Map(),
    facets: {
      categories: [...new Set(source.map((item) => item.category))].sort(),
      majors: [...new Set(source.flatMap((item) => item.majors).filter((item) => item !== "Any Major"))].sort(),
      typeCounts: Object.fromEntries(quickFilters.map((filter) => [
        filter.label,
        filter.label === "All" ? source.length : source.filter((item) => (!filter.type || item.type === filter.type) && (!filter.category || item.category === filter.category)).length,
      ])),
      explorationCounts: Object.fromEntries(discoverExplorationPaths.map((path) => [
        path.label,
        source.filter((item) => (!path.type || item.type === path.type) && (!path.category || item.category === path.category)).length,
      ])),
    },
  };
  indexBySource.set(source, index);
  return index;
}

function lifecycleIndex(source: readonly Opportunity[], now: Date) {
  const date = now.toISOString().slice(0, 10);
  const cached = lifecycleBySource.get(source);
  if (cached?.date === date) return cached.snapshots;
  const snapshots = new Map(source.map((item) => [item.id, resolveOpportunityLifecycle(item, now)]));
  lifecycleBySource.set(source, { date, snapshots });
  return snapshots;
}

function qualityScore(item: Opportunity, lifecycle: OpportunityLifecycleSnapshot, today: string, recentVerificationCutoff: string) {
  let score = 0;
  if (item.featured) score += 40;
  if (item.verification_status === "verified") score += 25;
  if (item.metadata.verification?.eligibilityVerified) score += 8;
  if (item.metadata.verification?.deadlineVerified) score += 6;
  if (item.eligibility.trim().length >= 24) score += 6;
  if (item.description.trim().length >= 80) score += 4;
  if (item.official_source.startsWith("https://")) score += 4;
  if (item.academic_years.includes("Any Year") || item.academic_years.includes("First year") || item.category === "Freshman Programs") score += 12;
  if (item.application_deadline && item.application_deadline >= today && projectOpportunityTrust(item).deadline.state === "verified") score += 8;
  if (item.last_verified >= recentVerificationCutoff) score += 6;
  if (item.estimated_value) score += Math.min(12, Math.log10(Math.max(item.estimated_value, 1)) * 2);
  if (item.verification_status === "needs_review") score -= 10;
  if (lifecycle.actionable) score += 18;
  if (["closed", "temporarily_closed", "canceled"].includes(lifecycle.state)) score -= 250;
  if (lifecycle.state === "unknown") score -= 80;
  if (["expired", "archived", "broken_source"].includes(item.verification_status)) score -= 10_000;
  return score;
}

function editDistanceWithin(left: string, right: string, maximum: number) {
  if (Math.abs(left.length - right.length) > maximum) return false;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = current[0];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(current[rightIndex - 1] + 1, previous[rightIndex] + 1, previous[rightIndex - 1] + cost);
      rowMinimum = Math.min(rowMinimum, current[rightIndex]);
    }
    if (rowMinimum > maximum) return false;
    previous = current;
  }
  return previous[right.length] <= maximum;
}

function tokenScore(token: string, document: SearchDocument, allowPrefix = true) {
  if (document.titleTokens.has(token)) return 160;
  if (document.organizationTokens.has(token)) return 130;
  if (document.categoryTokens.has(token)) return 95;
  if (document.subjectTokens.has(token)) return 70;
  if (document.detailTokens.has(token)) return 28;
  if (allowPrefix && token.length >= 3) {
    for (const candidate of document.allTokens) {
      if (candidate.startsWith(token) || token.startsWith(candidate)) return 34;
    }
  }
  return 0;
}

function prepareSearchQuery(query: string, index: DiscoverIndex): PreparedSearchQuery {
  const normalizedInput = normalizeText(query);
  const cached = index.preparedQueries.get(normalizedInput);
  if (cached) return cached;
  const normalized = exactQueryAliases.get(normalizedInput) ?? normalizedInput;
  const exactAlias = normalized !== normalizedInput;
  const terms = tokenize(normalized).map((token) => {
    const synonyms = exactAlias ? [] : [...(synonymTokens.get(token) ?? [])].filter((candidate) => candidate !== token);
    const known = index.vocabularySet.has(token) || index.vocabulary.some((candidate) => candidate.startsWith(token));
    const typos: string[] = [];
    if (!known && token.length >= 4) {
      const maximum = token.length >= 6 ? 2 : 1;
      for (const candidate of index.vocabulary) {
        if (candidate.length < 4 || !editDistanceWithin(token, candidate, maximum)) continue;
        typos.push(candidate);
        if (typos.length >= 24) break;
      }
    }
    return { token, synonyms, typos };
  });
  const prepared = { normalized, terms, exactAlias };
  if (index.preparedQueries.size >= 128) index.preparedQueries.delete(index.preparedQueries.keys().next().value!);
  index.preparedQueries.set(normalizedInput, prepared);
  return prepared;
}

function searchScore(query: PreparedSearchQuery, document: SearchDocument) {
  if (!query.normalized) return 0;
  let score = 0;
  const exactTitle = document.title === query.normalized;
  const titlePhrase = document.title.includes(query.normalized);
  const exactOrganization = document.organization === query.normalized;
  const organizationPhrase = document.organization.includes(query.normalized);
  if (exactTitle) score += 5_000;
  else if (titlePhrase) score += 1_400;
  if (exactOrganization) score += 1_800;
  else if (organizationPhrase) score += 900;

  let directMatches = 0;
  for (const term of query.terms) {
    const directMatch = tokenScore(term.token, document);
    const synonymMatch = Math.max(0, ...term.synonyms.map((candidate) => Math.floor(tokenScore(candidate, document, false) * 0.55)));
    const typoMatch = Math.max(0, ...term.typos.map((candidate) => Math.floor(tokenScore(candidate, document, false) * 0.35)));
    const tokenMatch = Math.max(directMatch, synonymMatch, typoMatch);
    if (tokenMatch > 0) directMatches += 1;
    score += tokenMatch;
  }
  const requiredMatches = query.terms.length <= 3 ? query.terms.length : Math.ceil(query.terms.length * 0.75);
  if (!exactTitle && !titlePhrase && !exactOrganization && !organizationPhrase && directMatches < requiredMatches) return 0;
  if (query.terms.length && directMatches === query.terms.length) score += 260;
  return score;
}

function scoreFor(item: Opportunity, query: PreparedSearchQuery, index: DiscoverIndex, scores: Map<string, number>) {
  const cached = scores.get(item.id);
  if (cached !== undefined) return cached;
  const score = searchScore(query, index.documentsById.get(item.id)!);
  scores.set(item.id, score);
  return score;
}

function sortOpportunities(items: Opportunity[], sort: DiscoverSortMode, index: DiscoverIndex, lifecycle: Map<string, OpportunityLifecycleSnapshot>, query: PreparedSearchQuery, searchScores: Map<string, number>, today: string) {
  const next = [...items];
  if (sort === "Relevant") {
    const recentVerificationCutoff = new Date(`${today}T00:00:00Z`);
    recentVerificationCutoff.setUTCDate(recentVerificationCutoff.getUTCDate() - 180);
    const cutoff = recentVerificationCutoff.toISOString().slice(0, 10);
    const scores = new Map(next.map((item) => [item.id, scoreFor(item, query, index, searchScores) + qualityScore(item, lifecycle.get(item.id)!, today, cutoff)]));
    return next.sort((a, b) => scores.get(b.id)! - scores.get(a.id)! || b.date_added.localeCompare(a.date_added) || a.title.localeCompare(b.title));
  }
  if (sort === "Newest") return next.sort((a, b) => b.date_added.localeCompare(a.date_added) || a.title.localeCompare(b.title));
  if (sort === "Deadline") return next.sort((a, b) => {
    const aDeadline = lifecycle.get(a.id)?.actionable && projectOpportunityTrust(a).deadline.state === "verified" ? a.application_deadline ?? "9999-12-30" : "9999-12-31";
    const bDeadline = lifecycle.get(b.id)?.actionable && projectOpportunityTrust(b).deadline.state === "verified" ? b.application_deadline ?? "9999-12-30" : "9999-12-31";
    return aDeadline.localeCompare(bDeadline) || a.title.localeCompare(b.title);
  });
  return next.sort((a, b) => a.title.localeCompare(b.title));
}

function contextualFacetCounts(source: readonly Opportunity[], query: DiscoverCatalogQuery, preparedQuery: PreparedSearchQuery, index: DiscoverIndex, lifecycle: Map<string, OpportunityLifecycleSnapshot>, searchScores: Map<string, number>) {
  const baseQuery = { ...query, type: "All" as const, category: "All" };
  const base = queryMatches(structuredMatches(source, baseQuery, lifecycle), preparedQuery, index, searchScores);
  return {
    typeCounts: Object.fromEntries(quickFilters.map((filter) => [
      filter.label,
      filter.label === "All" ? base.length : base.filter((item) => (!filter.type || item.type === filter.type) && (!filter.category || item.category === filter.category)).length,
    ])),
    explorationCounts: Object.fromEntries(discoverExplorationPaths.map((path) => [
      path.label,
      base.filter((item) => (!path.type || item.type === path.type) && (!path.category || item.category === path.category)).length,
    ])),
  };
}

function structuredMatches(source: readonly Opportunity[], query: DiscoverCatalogQuery, lifecycle: Map<string, OpportunityLifecycleSnapshot>) {
  const base = filterOpportunities({
    types: query.type === "All" ? undefined : [query.type],
    category: query.category,
    major: query.major,
    school: query.school === "All" ? undefined : query.school,
    paid: query.paid === "All" ? undefined : query.paid === "Paid",
    remote: query.remote === "All" ? undefined : query.remote === "Remote",
    difficulty: query.difficulty,
    freshmanFriendly: query.freshmanFriendly,
    deadline: ["published", "not_announced"].includes(query.deadline) ? query.deadline as "published" | "not_announced" : undefined,
  }, source);
  if (query.deadline === "All" || ["published", "not_announced"].includes(query.deadline)) return base;
  return base.filter((item) => {
    const snapshot = lifecycle.get(item.id)!;
    if (query.deadline === "open") return snapshot.displayState === "open" || snapshot.displayState === "closing_soon" || snapshot.displayState === "reopened";
    if (query.deadline === "upcoming") return snapshot.state === "upcoming";
    if (query.deadline === "rolling") return snapshot.state === "rolling";
    if (query.deadline === "closed") return ["closed", "temporarily_closed", "canceled"].includes(snapshot.state);
    if (query.deadline === "recurring") return snapshot.recurring;
    return true;
  });
}

function queryMatches(items: readonly Opportunity[], query: PreparedSearchQuery, index: DiscoverIndex, searchScores: Map<string, number>) {
  if (!query.normalized) return [...items];
  return items.filter((item) => scoreFor(item, query, index, searchScores) > 0);
}

const recoveryLabels: Record<DiscoverRecovery["filter"], string> = {
  type: "Any opportunity type",
  category: "Any category",
  major: "Any major",
  school: "Any school",
  paid: "Any value",
  remote: "Any format",
  difficulty: "Any difficulty",
  freshmanFriendly: "Any class year",
  deadline: "Any deadline",
};

function zeroResultRecovery(source: readonly Opportunity[], query: DiscoverCatalogQuery, preparedQuery: PreparedSearchQuery, index: DiscoverIndex, lifecycle: Map<string, OpportunityLifecycleSnapshot>, searchScores: Map<string, number>) {
  const candidates: DiscoverRecovery[] = [];
  const possible: DiscoverRecovery["filter"][] = ["type", "category", "major", "school", "paid", "remote", "difficulty", "freshmanFriendly", "deadline"];
  for (const filter of possible) {
    const active = filter === "freshmanFriendly" ? query.freshmanFriendly : query[filter] !== "All";
    if (!active) continue;
    const relaxed: DiscoverCatalogQuery = {
      ...query,
      [filter]: filter === "freshmanFriendly" ? false : "All",
    };
    const count = queryMatches(structuredMatches(source, relaxed, lifecycle), preparedQuery, index, searchScores).length;
    if (count > 0) candidates.push({ filter, label: recoveryLabels[filter], resultCount: count });
  }
  return candidates.sort((left, right) => right.resultCount - left.resultCount || left.filter.localeCompare(right.filter))[0] ?? null;
}

export function buildDiscoverCatalog(source: readonly Opportunity[], query: DiscoverCatalogQuery): DiscoverCatalogPayload {
  const visibleSource = canonicalSource(source);
  const index = discoverIndex(visibleSource);
  const preparedQuery = prepareSearchQuery(query.query, index);
  const searchScores = new Map<string, number>();
  const now = new Date();
  const lifecycle = lifecycleIndex(visibleSource, now);
  const filtered = queryMatches(structuredMatches(visibleSource, query, lifecycle), preparedQuery, index, searchScores);
  const today = now.toISOString().slice(0, 10);
  const sorted = sortOpportunities(filtered, query.sort, index, lifecycle, preparedQuery, searchScores, today);
  const contextual = contextualFacetCounts(visibleSource, query, preparedQuery, index, lifecycle, searchScores);
  const listings: OpportunityListing[] = sorted.slice(0, query.limit).map((item) => {
    const snapshot = lifecycle.get(item.id)!;
    return {
      ...item,
      lifecyclePresentation: {
        state: snapshot.state,
        displayState: snapshot.displayState,
        confidence: snapshot.confidence,
        label: snapshot.label,
        actionable: snapshot.actionable,
        recommendationEligible: snapshot.recommendationEligible,
        recurring: snapshot.recurring,
        actionLabel: snapshot.actionLabel,
        actionAllowed: snapshot.actionAllowed,
      },
    };
  });
  return {
    opportunities: listings,
    total: sorted.length,
    limit: query.limit,
    recovery: sorted.length ? null : zeroResultRecovery(visibleSource, query, preparedQuery, index, lifecycle, searchScores),
    facets: {
      ...index.facets,
      ...contextual,
    },
  };
}
