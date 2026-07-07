import { filterOpportunities } from "./opportunities";

export const aiToolCategories = ["All", "General Assistant", "Coding", "Research", "Writing", "Design", "Audio & Video", "Productivity", "Machine Learning"] as const;
export const aiOfferTypes = ["All", "free_for_everyone", "student_discount", "free_with_edu", "university_specific", "no_verified_student_offer"] as const;
export type AIToolCategory = Exclude<(typeof aiToolCategories)[number], "All">;
export type AIOfferType = Exclude<(typeof aiOfferTypes)[number], "All">;
export type AIToolVerificationStatus = "verified_recently" | "needs_review";

export type AITool = {
  slug: string;
  opportunityId: string;
  name: string;
  company: string;
  description: string;
  studentOffer: string;
  eligibility: string;
  officialSourceUrl: string;
  lastVerifiedAt: string;
  category: AIToolCategory;
  offerType: AIOfferType;
  verificationStatus: AIToolVerificationStatus;
  estimatedAnnualValue: number | null;
};

export const aiTools: AITool[] = filterOpportunities({ types: ["AI"] }).map((item) => ({
  slug: item.metadata.legacySlug ?? item.id,
  opportunityId: item.id,
  name: item.title,
  company: item.organization,
  description: item.description,
  studentOffer: item.metadata.studentOffer ?? "No verified student-specific offer.",
  eligibility: item.eligibility,
  officialSourceUrl: item.official_source,
  lastVerifiedAt: item.last_verified,
  category: item.category as AIToolCategory,
  offerType: item.metadata.offerType as AIOfferType,
  verificationStatus: item.verification_status === "verified_recently" ? "verified_recently" : "needs_review",
  estimatedAnnualValue: item.estimated_value,
}));

export const aiOfferLabels: Record<AIOfferType, string> = {
  free_for_everyone: "Free for everyone",
  student_discount: "Student discount",
  free_with_edu: "Free with .edu",
  university_specific: "University-specific",
  no_verified_student_offer: "No verified student offer",
};
