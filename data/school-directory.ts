import curatedSchoolsJson from "./db/schools.json";
import institutionsJson from "./db/institutions.json";
import type { School, SchoolRecord } from "./schemas";

function normalizeAlias(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").replace(/[.,]/g, "").replace(/[-_\s]+/g, " ");
}

function generatedAliases(school: SchoolRecord) {
  const words = school.name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter((word) => word && !["of", "the", "at", "and"].includes(word.toLowerCase()));
  const acronym = words.map((word) => word[0]).join("").toUpperCase();
  const domainStem = school.domain.split(".")[0];
  const candidates = [...(school.aliases ?? []), domainStem];
  if (acronym.length >= 2 && acronym.length <= 8) candidates.push(acronym);
  const official = new Set([normalizeAlias(school.name), normalizeAlias(school.domain)]);
  return [...new Map(candidates.filter(Boolean).map((alias) => [normalizeAlias(alias), alias.trim()])).entries()]
    .filter(([normalized]) => !official.has(normalized))
    .map(([, alias]) => alias);
}

const curatedSchools = curatedSchoolsJson as SchoolRecord[];
const importedSchools = institutionsJson as SchoolRecord[];
const curatedDomains = new Set(curatedSchools.map((school) => school.domain));
const records = [...curatedSchools, ...importedSchools.filter((school) => !curatedDomains.has(school.domain))];

export const schoolDirectory: School[] = records.map((school) => ({
  ...school,
  aliases: generatedAliases(school),
  benefitSlugs: [],
}));

export type { School } from "./schemas";
