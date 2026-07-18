import categoriesJson from "./db/categories.json";
import { filterOpportunities } from "./opportunities";
import { schoolDirectory } from "./school-directory";
import type { Benefit, BenefitScope, Category, CategoryRecord, School, VerificationConfidence, VerificationStatus } from "./schemas";

function confidenceFor(status: VerificationStatus, score: number): VerificationConfidence {
  if (status === "verified" && score >= 85) return "high";
  if (status !== "expired" && score >= 65) return "moderate";
  return "low";
}

export const categoryRecords = categoriesJson as CategoryRecord[];
export const categories = ["All", ...categoryRecords.map((item) => item.name)] as const;

const benefitOpportunities = filterOpportunities({ types: ["Benefit"] });
const benefitOpportunityById = new Map(benefitOpportunities.map((item) => [item.id, item]));

export const benefits: Benefit[] = benefitOpportunities.map((item) => {
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

const nationalBenefitIds = benefits.filter((benefit) => benefit.scope === "national").map((benefit) => benefit.slug);
const schoolBenefitIds = new Map<string, string[]>();
for (const benefit of benefits) {
  if (benefit.scope !== "school") continue;
  const opportunity = benefitOpportunityById.get(benefit.opportunityId);
  for (const schoolSlug of opportunity?.schools ?? []) {
    const current = schoolBenefitIds.get(schoolSlug) ?? [];
    current.push(benefit.slug);
    schoolBenefitIds.set(schoolSlug, current);
  }
}
export const schools: School[] = schoolDirectory.map((school) => ({
  ...school,
  benefitSlugs: [...nationalBenefitIds, ...(schoolBenefitIds.get(school.slug) ?? [])],
}));

export const getSchool = (slug: string) => schools.find((school) => school.slug === slug);
export const getBenefit = (slug: string) => benefits.find((item) => item.slug === slug);
export const getSchoolBenefits = (school: School) => {
  const eligibleIds = new Set(schoolBenefitIds.get(school.slug) ?? []);
  return benefits.filter((item) => item.scope === "national" || eligibleIds.has(item.slug));
};
export const formatValueTotal = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export type { Benefit, BenefitScope, Category, School, VerificationConfidence, VerificationStatus } from "./schemas";
