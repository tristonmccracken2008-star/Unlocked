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

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();
const has = (item: Opportunity, terms: string[]) => {
  const text = normalize([item.title, item.organization, item.category, item.type, item.description, item.eligibility, ...item.tags].join(" "));
  return terms.some((term) => text.includes(normalize(term)));
};

export function buildOpportunityRelationship(item: Opportunity, source: readonly Opportunity[]): OpportunityRelationship {
  const intelligence = getOpportunityIntelligence(item);
  const related = source
    .filter((candidate) => candidate.id !== item.id)
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

const relationshipCache = new Map<string, OpportunityRelationship>();

export function getOpportunityRelationship(item: Opportunity, source: readonly Opportunity[]) {
  const key = `${item.id}:${source.length}`;
  const cached = relationshipCache.get(key);
  if (cached) return cached;
  const relationship = buildOpportunityRelationship(item, source);
  relationshipCache.set(key, relationship);
  if (relationshipCache.size > 500) relationshipCache.delete(relationshipCache.keys().next().value);
  return relationship;
}
