import curatedSchoolsJson from "./db/schools.json";
import institutionsJson from "./db/institutions.json";
import benefitsJson from "./db/benefits.json";
import sourcesJson from "./db/sources.json";
import categoriesJson from "./db/categories.json";
import relationshipsJson from "./db/school-benefits.json";
import { assertBenefit, assertRelationship, assertSchool, assertSource, type Benefit, type BenefitRecord, type Category, type CategoryRecord, type School, type SchoolBenefitRecord, type SchoolRecord, type SourceRecord, type VerificationConfidence } from "./schemas";

const curatedSchoolRecords = curatedSchoolsJson as unknown[];
const institutionRecords = institutionsJson as unknown[];
const benefitRecords = benefitsJson as unknown[];
const sourceRecords = sourcesJson as unknown[];
const relationshipRecords = relationshipsJson as unknown[];
curatedSchoolRecords.forEach(assertSchool);
institutionRecords.forEach(assertSchool);
benefitRecords.forEach(assertBenefit);
sourceRecords.forEach(assertSource);
relationshipRecords.forEach(assertRelationship);

function assertUnique<T>(records: T[], key: (record: T) => string, label: string) {
  const seen = new Set<string>();
  for (const record of records) {
    const value = key(record).trim().toLowerCase();
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

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

const curatedSchools = curatedSchoolRecords as SchoolRecord[];
const importedSchools = institutionRecords as SchoolRecord[];
const curatedDomains = new Set(curatedSchools.map((school) => school.domain));
const rawSchools = [...curatedSchools, ...importedSchools.filter((school) => !curatedDomains.has(school.domain))];
const rawBenefits = benefitRecords as BenefitRecord[];
export const sources = sourceRecords as SourceRecord[];
export const schoolBenefits = relationshipRecords as SchoolBenefitRecord[];
export const categoryRecords = categoriesJson as CategoryRecord[];

assertUnique(rawSchools, (school) => school.slug, "school slug");
assertUnique(rawSchools, (school) => school.domain, "school domain");
assertUnique(rawBenefits, (benefit) => benefit.slug, "benefit slug");
assertUnique(rawBenefits, (benefit) => `${benefit.provider}:${benefit.name}`, "provider benefit");
assertUnique(sources, (source) => source.id, "source id");
assertUnique(categoryRecords, (category) => category.id, "category id");
assertUnique(categoryRecords, (category) => category.slug, "category slug");
assertUnique(schoolBenefits, (relation) => `${relation.schoolId}:${relation.benefitId}`, "school-benefit relationship");

const categoryById = new Map(categoryRecords.map((category) => [category.id, category.name]));
const sourceById = new Map(sources.map((source) => [source.id, source]));

function confidenceFor(item: BenefitRecord): VerificationConfidence {
  if (item.status === "verified_recently" && item.reviewScore >= 85) return "high";
  if (item.status !== "expired" && item.reviewScore >= 65) return "moderate";
  return "low";
}

export const benefits: Benefit[] = rawBenefits.map((item) => {
  const category = categoryById.get(item.categoryId) as Category | undefined;
  if (!category) throw new Error(`Unknown category for benefit: ${item.slug} -> ${item.categoryId}`);
  const source = sourceById.get(item.sourceId);
  if (!source || source.benefitId !== item.slug) throw new Error(`Missing source for benefit: ${item.slug}`);
  if (!source.url.startsWith("https://") || !item.claimUrl.startsWith("https://")) throw new Error(`Non-HTTPS URL for benefit: ${item.slug}`);
  if (!isIsoDate(item.verifiedAt) || !isIsoDate(source.lastVerified) || item.verifiedAt !== source.lastVerified) throw new Error(`Verification date mismatch for benefit: ${item.slug}`);
  return { ...item, category, value: item.value ?? "Unknown", annualValue: item.annualValue ?? 0, sourceUrl: source.url, verificationConfidence: confidenceFor(item) };
});

const benefitIds = new Set(benefits.map((item) => item.slug));
const schoolIds = new Set(rawSchools.map((item) => item.slug));
for (const relation of schoolBenefits) {
  if (!schoolIds.has(relation.schoolId) || !benefitIds.has(relation.benefitId)) throw new Error(`Broken relationship: ${relation.schoolId} -> ${relation.benefitId}`);
  if (benefits.find((benefit) => benefit.slug === relation.benefitId)?.scope !== "school") throw new Error(`National benefits must not be linked manually: ${relation.benefitId}`);
}

const nationalBenefitIds = benefits.filter((benefit) => benefit.scope === "national").map((benefit) => benefit.slug);
export const schools: School[] = rawSchools.map((school) => ({
  ...school,
  aliases: generatedAliases(school),
  benefitSlugs: [...nationalBenefitIds, ...schoolBenefits.filter((relation) => relation.schoolId === school.slug).map((relation) => relation.benefitId)],
}));

export const categories = ["All", ...categoryRecords.map((item) => item.name)] as const;
export const getSchool = (slug: string) => schools.find((school) => school.slug === slug);
export const getBenefit = (slug: string) => benefits.find((item) => item.slug === slug);
export const getSchoolBenefits = (school: School) => school.benefitSlugs.map(getBenefit).filter((item): item is Benefit => Boolean(item));
export const formatValueTotal = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export type { Benefit, BenefitScope, Category, School, VerificationConfidence, VerificationStatus } from "./schemas";
