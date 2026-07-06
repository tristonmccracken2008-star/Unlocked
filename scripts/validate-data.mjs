import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, "data/db", file), "utf8"));
const curated = read("schools.json");
const imported = read("institutions.json");
const benefits = read("benefits.json");
const relationships = read("school-benefits.json");

function normalize(value) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/^.*@/, "").replace(/[/?#].*$/, "").replace(/[.,]/g, "").replace(/[-_\s]+/g, " ");
}

function generatedAliases(school) {
  const words = school.name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter((word) => word && !["of", "the", "at", "and"].includes(word.toLowerCase()));
  const acronym = words.map((word) => word[0]).join("").toUpperCase();
  const candidates = [...(school.aliases ?? []), school.domain.split(".")[0]];
  if (acronym.length >= 2 && acronym.length <= 8) candidates.push(acronym);
  return [...new Set(candidates.filter(Boolean))];
}

const curatedDomains = new Set(curated.map((school) => school.domain));
const schools = [...curated, ...imported.filter((school) => !curatedDomains.has(school.domain))].map((school) => ({ ...school, aliases: generatedAliases(school) }));
const failures = [];
const seenSlugs = new Set();
const seenDomains = new Set();
const termsBySchool = new Map();

for (const school of schools) {
  if (seenSlugs.has(school.slug)) failures.push(`Duplicate school slug: ${school.slug}`);
  if (seenDomains.has(school.domain)) failures.push(`Duplicate school domain: ${school.domain}`);
  seenSlugs.add(school.slug);
  seenDomains.add(school.domain);
  const terms = [school.name, school.domain, school.slug, ...school.aliases].map(normalize).filter(Boolean);
  termsBySchool.set(school.slug, terms);
}

function search(query) {
  const normalized = normalize(query);
  const exact = schools.filter((school) => termsBySchool.get(school.slug).some((term) => term === normalized));
  if (exact.length) return exact;
  return schools.filter((school) => termsBySchool.get(school.slug).some((term) => term.includes(normalized)));
}

for (const school of schools) {
  const requiredTerms = [school.name, school.domain, school.slug, ...school.aliases];
  for (const term of requiredTerms) {
    if (!search(term).some((result) => result.slug === school.slug)) failures.push(`Search term did not find ${school.slug}: ${term}`);
  }
}

const benefitById = new Map(benefits.map((benefit) => [benefit.slug, benefit]));
for (const relation of relationships) {
  const benefit = benefitById.get(relation.benefitId);
  if (!benefit) failures.push(`Relationship references missing benefit: ${relation.benefitId}`);
  else if (benefit.scope !== "school") failures.push(`National benefit is manually linked: ${relation.benefitId}`);
}

const northeastern = schools.find((school) => school.slug === "northeastern-university");
if (!northeastern) failures.push("Northeastern University is missing from the school registry");
const northeasternSpecific = relationships.filter((relation) => relation.schoolId === "northeastern-university");
if (northeasternSpecific.length) failures.push("Northeastern has unreviewed school-specific relationships");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

const searchTermCount = [...termsBySchool.values()].reduce((sum, terms) => sum + terms.length, 0);
console.log(`Validated ${schools.length} schools and ${searchTermCount} searchable names, domains, slugs, abbreviations, and aliases.`);
console.log(`Validated ${relationships.length} official school-specific benefit relationships; Northeastern currently has 0.`);
