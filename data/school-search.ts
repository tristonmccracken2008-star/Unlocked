import type { School } from "./schemas";

export function normalizeSchoolQuery(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/^.*@/, "").replace(/[/?#].*$/, "").replace(/[.,]/g, "").replace(/[-_\s]+/g, " ");
}

export function getSchoolSearchTerms(school: School) {
  return [school.name, school.domain, school.slug, ...school.aliases].map(normalizeSchoolQuery);
}

export function findSchoolMatches(schools: School[], query: string, limit = 8) {
  const normalized = normalizeSchoolQuery(query);
  if (!normalized) return [];
  return schools.map((school, index) => {
    const terms = getSchoolSearchTerms(school);
    const score = terms.some((term) => term === normalized) ? 0 : terms.some((term) => term.startsWith(normalized)) ? 1 : terms.some((term) => term.includes(normalized)) ? 2 : 3;
    return { school, score, index };
  }).filter((result) => result.score < 3).sort((a, b) => a.score - b.score || a.index - b.index).slice(0, limit).map((result) => result.school);
}

export function findExactSchoolMatches(schools: School[], query: string) {
  const normalized = normalizeSchoolQuery(query);
  if (!normalized) return [];
  return schools.filter((school) => getSchoolSearchTerms(school).some((term) => term === normalized));
}
