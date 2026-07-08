import curatedSchoolsJson from "./db/schools.json";
import institutionsJson from "./db/institutions.json";
import categoriesJson from "./db/categories.json";
import { filterOpportunities } from "./opportunities";
import { assertSchool, type Benefit, type BenefitScope, type Category, type CategoryRecord, type School, type SchoolRecord, type VerificationConfidence, type VerificationStatus } from "./schemas";

const curatedSchoolRecords = curatedSchoolsJson as unknown[];
const institutionRecords = institutionsJson as unknown[];
curatedSchoolRecords.forEach(assertSchool);
institutionRecords.forEach(assertSchool);

function assertUnique<T>(records: T[], key: (record: T) => string, label: string) {
  const seen = new Set<string>();
  for (const record of records) {
    const value = key(record).trim().toLowerCase();
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
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
  return [...new Map(candidates.filter(Boolean).map((alias) => [normalizeAlias(alias), alias.trim()])).entries()].filter(([normalized]) => !official.has(normalized)).map(([, alias]) => alias);
}

function confidenceFor(status: VerificationStatus, score: number): VerificationConfidence {
  if (status === "verified" && score >= 85) return "high";
  if (status !== "expired" && score >= 65) return "moderate";
  return "low";
}

export const categoryRecords = categoriesJson as CategoryRecord[];
export const categories = ["All", ...categoryRecords.map((item) => item.name)] as const;

export const benefits: Benefit[] = filterOpportunities({ types: ["Benefit"] }).map((item) => {
  const reviewScore = item.metadata.reviewScore ?? 0;
  const status = item.verification_status;
  return {
    opportunityId: item.id,
    slug: item.metadata.legacySlug ?? item.id,
    name: item.title,
    provider: item.organization,
    description: item.description,
    category: item.category as Category,
    value: item.metadata.valueLabel ?? "Unknown",
    annualValue: item.estimated_value ?? 0,
    eligibility: item.eligibility,
    eligibilityNotes: item.metadata.eligibilityNotes ?? [item.eligibility],
    verified: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${item.last_verified}T00:00:00Z`)),
    verifiedAt: item.last_verified,
    status,
    reviewScore,
    claimUrl: item.metadata.claimUrl ?? item.official_source,
    sourceUrl: item.official_source,
    scope: item.school_scope === "National" ? "national" : "school",
    verificationMethod: item.metadata.verificationMethod ?? "See official source",
    claimSteps: item.metadata.claimSteps ?? [],
    renewalNotes: item.metadata.renewalNotes ?? "Review the official source for current terms.",
    featured: item.featured,
    verificationConfidence: confidenceFor(status, reviewScore),
  };
});

const curatedSchools = curatedSchoolRecords as SchoolRecord[];
const importedSchools = institutionRecords as SchoolRecord[];
const curatedDomains = new Set(curatedSchools.map((school) => school.domain));
const rawSchools = [...curatedSchools, ...importedSchools.filter((school) => !curatedDomains.has(school.domain))];
assertUnique(rawSchools, (school) => school.slug, "school slug");
assertUnique(rawSchools, (school) => school.domain, "school domain");

const nationalBenefitIds = benefits.filter((benefit) => benefit.scope === "national").map((benefit) => benefit.slug);
export const schools: School[] = rawSchools.map((school) => ({
  ...school,
  aliases: generatedAliases(school),
  benefitSlugs: [...nationalBenefitIds, ...benefits.filter((benefit) => benefit.scope === "school" && filterOpportunities({ types: ["Benefit"], school: school.slug }).some((item) => item.id === benefit.opportunityId)).map((benefit) => benefit.slug)],
}));

export const getSchool = (slug: string) => schools.find((school) => school.slug === slug);
export const getBenefit = (slug: string) => benefits.find((item) => item.slug === slug);
export const getSchoolBenefits = (school: School) => benefits.filter((item) => item.scope === "national" || filterOpportunities({ types: ["Benefit"], school: school.slug }).some((opportunity) => opportunity.id === item.opportunityId));
export const formatValueTotal = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export type { Benefit, BenefitScope, Category, School, VerificationConfidence, VerificationStatus } from "./schemas";
