export type Category = "AI" | "Software" | "Streaming" | "Shopping" | "Finance" | "Travel" | "Campus" | "Other";
export type VerificationStatus = "verified_recently" | "needs_review" | "expired" | "community_submitted";
export type BenefitScope = "national" | "school";
export type VerificationConfidence = "high" | "moderate" | "low";

export type SchoolRecord = {
  slug: string;
  name: string;
  aliases?: string[];
  domain: string;
  location: string;
  initials: string;
  website?: string;
  unitId?: string;
  sourceUrl?: string;
};

export type School = Omit<SchoolRecord, "aliases"> & { aliases: string[]; benefitSlugs: string[] };

export type Benefit = {
  opportunityId: string;
  slug: string;
  name: string;
  provider: string;
  description: string;
  category: Category;
  value: string;
  annualValue: number;
  eligibility: string;
  eligibilityNotes: string[];
  verified: string;
  verifiedAt: string;
  status: VerificationStatus;
  reviewScore: number;
  claimUrl: string;
  sourceUrl: string;
  scope: BenefitScope;
  verificationMethod: string;
  claimSteps: string[];
  renewalNotes: string;
  featured?: boolean;
  verificationConfidence: VerificationConfidence;
};

export type CategoryRecord = { id: string; name: Category; slug: string };

const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export function assertSchool(value: unknown): asserts value is SchoolRecord {
  if (!isObject(value) || !isText(value.slug) || !isText(value.name) || !isText(value.domain) || !value.domain.endsWith(".edu") || (value.aliases !== undefined && !Array.isArray(value.aliases))) throw new Error("Invalid school record");
}
