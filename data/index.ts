import schoolsJson from "./db/schools.json";
import benefitsJson from "./db/benefits.json";
import sourcesJson from "./db/sources.json";
import categoriesJson from "./db/categories.json";
import relationshipsJson from "./db/school-benefits.json";
import { assertBenefit, assertRelationship, assertSchool, assertSource, type Benefit, type BenefitRecord, type CategoryRecord, type School, type SchoolBenefitRecord, type SchoolRecord, type SourceRecord } from "./schemas";

const schoolRecords = schoolsJson as unknown[];
const benefitRecords = benefitsJson as unknown[];
const sourceRecords = sourcesJson as unknown[];
const relationshipRecords = relationshipsJson as unknown[];
schoolRecords.forEach(assertSchool); benefitRecords.forEach(assertBenefit); sourceRecords.forEach(assertSource); relationshipRecords.forEach(assertRelationship);

const rawSchools = schoolRecords as SchoolRecord[];
const rawBenefits = benefitRecords as BenefitRecord[];
export const sources = sourceRecords as SourceRecord[];
export const schoolBenefits = relationshipRecords as SchoolBenefitRecord[];
export const categoryRecords = categoriesJson as CategoryRecord[];
const sourceById = new Map(sources.map((source) => [source.id, source]));

export const benefits: Benefit[] = rawBenefits.map((item) => {
  const source = sourceById.get(item.sourceId);
  if (!source || source.benefitId !== item.slug) throw new Error(`Missing source for benefit: ${item.slug}`);
  return { ...item, value: item.value ?? "Unknown", annualValue: item.annualValue ?? 0, sourceUrl: source.url };
});

const benefitIds = new Set(benefits.map((item) => item.slug));
const schoolIds = new Set(rawSchools.map((item) => item.slug));
for (const relation of schoolBenefits) if (!schoolIds.has(relation.schoolId) || !benefitIds.has(relation.benefitId)) throw new Error(`Broken relationship: ${relation.schoolId} -> ${relation.benefitId}`);

export const schools: School[] = rawSchools.map((school) => ({ ...school, benefitSlugs: schoolBenefits.filter((relation) => relation.schoolId === school.slug).map((relation) => relation.benefitId) }));
export const categories = ["All", ...categoryRecords.map((item) => item.name)] as const;
export const getSchool = (slug: string) => schools.find((school) => school.slug === slug);
export const getBenefit = (slug: string) => benefits.find((item) => item.slug === slug);
export const getSchoolBenefits = (school: School) => school.benefitSlugs.map(getBenefit).filter((item): item is Benefit => Boolean(item));
export const formatValueTotal = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export type { Benefit, BenefitScope, Category, School, VerificationStatus } from "./schemas";
