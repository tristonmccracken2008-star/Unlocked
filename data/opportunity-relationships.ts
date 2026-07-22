import { getOpportunityIntelligence } from "./opportunity-intelligence";
import type { Opportunity } from "./opportunities";

export type OpportunityRelationship = {
  opportunityId: string;
  prerequisites: string[];
  followUps: string[];
  alternatives: string[];
  easierVersion?: string;
  harderVersion?: string;
  careerProgression: string[];
};

type RelationshipIndex = {
  byId: Map<string, Opportunity>;
  byOrganization: Map<string, string[]>;
  byCategory: Map<string, string[]>;
  byCareerPath: Map<string, string[]>;
  bySkill: Map<string, string[]>;
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();
const has = (item: Opportunity, terms: string[]) => {
  const text = normalize([item.title, item.organization, item.category, item.type, item.description, item.eligibility, ...item.tags].join(" "));
  return terms.some((term) => text.includes(normalize(term)));
};

const addToIndex = (index: Map<string, string[]>, key: string, id: string) => {
  if (!key) return;
  index.set(key, [...(index.get(key) ?? []), id]);
};

const relationshipIndexes = new WeakMap<readonly Opportunity[], RelationshipIndex>();

export function buildOpportunityRelationshipIndex(source: readonly Opportunity[]): RelationshipIndex {
  const cached = relationshipIndexes.get(source);
  if (cached) return cached;
  const index: RelationshipIndex = {
    byId: new Map(),
    byOrganization: new Map(),
    byCategory: new Map(),
    byCareerPath: new Map(),
    bySkill: new Map(),
  };
  for (const item of source) {
    const intelligence = getOpportunityIntelligence(item);
    index.byId.set(item.id, item);
    addToIndex(index.byOrganization, normalize(item.organization), item.id);
    addToIndex(index.byCategory, normalize(item.category), item.id);
    for (const path of intelligence.careerPaths) addToIndex(index.byCareerPath, normalize(path), item.id);
    for (const skill of intelligence.requiredSkills) addToIndex(index.bySkill, normalize(skill), item.id);
  }
  relationshipIndexes.set(source, index);
  return index;
}

function relationshipCandidates(item: Opportunity, index: RelationshipIndex) {
  const intelligence = getOpportunityIntelligence(item);
  const ids = new Set<string>([
    ...(index.byOrganization.get(normalize(item.organization)) ?? []),
    ...(index.byCategory.get(normalize(item.category)) ?? []),
    ...intelligence.careerPaths.flatMap((path) => index.byCareerPath.get(normalize(path)) ?? []),
    ...intelligence.requiredSkills.flatMap((skill) => index.bySkill.get(normalize(skill)) ?? []),
  ]);
  ids.delete(item.id);
  return [...ids].map((id) => index.byId.get(id)).filter((candidate): candidate is Opportunity => Boolean(candidate));
}

export function buildOpportunityRelationship(item: Opportunity, source: readonly Opportunity[]): OpportunityRelationship {
  const intelligence = getOpportunityIntelligence(item);
  const index = buildOpportunityRelationshipIndex(source);
  const related = relationshipCandidates(item, index)
    .map((candidate) => ({ candidate, intel: getOpportunityIntelligence(candidate) }))
    .filter(({ candidate, intel }) => candidate.verification_status !== "archived" && candidate.verification_status !== "expired" && (
      candidate.organization === item.organization ||
      intel.careerPaths.some((path) => intelligence.careerPaths.includes(path)) ||
      intel.requiredSkills.some((skill) => intelligence.requiredSkills.includes(skill)) ||
      candidate.category === item.category
    ));
  const easier = related.find(({ candidate }) => candidate.difficulty === "Open" || candidate.academic_years.includes("First year") || candidate.academic_years.includes("Any Year"))?.candidate.id;
  const harder = related.find(({ candidate }) => candidate.difficulty === "Highly Competitive" || has(candidate, ["fellowship", "internship", "research"]))?.candidate.id;
  return {
    opportunityId: item.id,
    prerequisites: [
      has(item, ["internship", "research", "fellowship"]) ? "Resume or short experience summary" : "",
      has(item, ["python", "data", "machine learning", "software"]) ? "One project or technical example" : "",
      has(item, ["scholarship", "essay"]) ? "Eligibility and essay materials" : "",
    ].filter(Boolean),
    followUps: related.filter(({ candidate }) => candidate.category !== item.category || candidate.difficulty === "Highly Competitive").slice(0, 4).map(({ candidate }) => candidate.id),
    alternatives: related.filter(({ candidate }) => candidate.category === item.category || candidate.type === item.type).slice(0, 5).map(({ candidate }) => candidate.id),
    easierVersion: easier,
    harderVersion: harder,
    careerProgression: [
      ...intelligence.requiredSkills.slice(0, 2),
      intelligence.category,
      intelligence.careerPaths[0] ?? item.category,
    ].filter(Boolean),
  };
}

const relationshipCaches = new WeakMap<readonly Opportunity[], Map<string, OpportunityRelationship>>();

export function getOpportunityRelationship(item: Opportunity, source: readonly Opportunity[]) {
  let cache = relationshipCaches.get(source);
  if (!cache) {
    cache = new Map();
    relationshipCaches.set(source, cache);
  }
  const cached = cache.get(item.id);
  if (cached) return cached;
  const relationship = buildOpportunityRelationship(item, source);
  cache.set(item.id, relationship);
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return relationship;
}
