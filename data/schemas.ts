export type Category = "AI" | "Software" | "Streaming" | "Shopping" | "Finance" | "Travel" | "Campus" | "Other";
export type VerificationStatus = "verified_recently" | "needs_review" | "expired" | "community_submitted";
export type BenefitScope = "national" | "school";

export type SchoolRecord = {
  slug: string;
  name: string;
  aliases: string[];
  domain: string;
  location: string;
  initials: string;
};

export type BenefitRecord = {
  slug: string;
  name: string;
  provider: string;
  description: string;
  category: Category;
  value?: string;
  annualValue?: number;
  eligibility: string;
  verified: string;
  verifiedAt: string;
  status: VerificationStatus;
  reviewScore: number;
  claimUrl: string;
  sourceId: string;
  scope: BenefitScope;
  verificationMethod: string;
  claimSteps: string[];
  renewalNotes: string;
  featured?: boolean;
};

export type CategoryRecord = { id: string; name: Category; slug: string };
export type SourceRecord = { id: string; benefitId: string; provider: string; url: string; lastVerified: string };
export type SchoolBenefitRecord = { schoolId: string; benefitId: string };

export type Benefit = BenefitRecord & { sourceUrl: string; value: string; annualValue: number };
export type School = SchoolRecord & { benefitSlugs: string[] };

const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export function assertSchool(value: unknown): asserts value is SchoolRecord {
  if (!isObject(value) || !isText(value.slug) || !isText(value.name) || !isText(value.domain) || !value.domain.endsWith(".edu") || !Array.isArray(value.aliases)) throw new Error("Invalid school record");
}
export function assertBenefit(value: unknown): asserts value is BenefitRecord {
  const statuses: VerificationStatus[] = ["verified_recently", "needs_review", "expired", "community_submitted"];
  if (!isObject(value) || !isText(value.slug) || !isText(value.name) || !isText(value.category) || !isText(value.eligibility) || !isText(value.sourceId) || !isText(value.verifiedAt) || !isText(value.claimUrl) || !statuses.includes(value.status as VerificationStatus) || !Number.isInteger(value.reviewScore) || (value.reviewScore as number) < 0 || (value.reviewScore as number) > 100) throw new Error("Invalid benefit record");
}
export function assertSource(value: unknown): asserts value is SourceRecord {
  if (!isObject(value) || !isText(value.id) || !isText(value.benefitId) || !isText(value.url) || !isText(value.lastVerified)) throw new Error("Invalid source record");
}
export function assertRelationship(value: unknown): asserts value is SchoolBenefitRecord {
  if (!isObject(value) || !isText(value.schoolId) || !isText(value.benefitId)) throw new Error("Invalid school-benefit relationship");
}
