import toolsJson from "./db/ai-tools.json";

export const aiToolCategories = ["All", "General Assistant", "Coding", "Research", "Writing", "Design", "Audio & Video", "Productivity", "Machine Learning"] as const;
export const aiOfferTypes = ["All", "free_for_everyone", "student_discount", "free_with_edu", "university_specific", "no_verified_student_offer"] as const;
export type AIToolCategory = Exclude<(typeof aiToolCategories)[number], "All">;
export type AIOfferType = Exclude<(typeof aiOfferTypes)[number], "All">;
export type AIToolVerificationStatus = "verified_recently" | "needs_review";

export type AITool = {
  slug: string;
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

const tools = toolsJson as AITool[];
const seen = new Set<string>();
for (const tool of tools) {
  if (seen.has(tool.slug)) throw new Error(`Duplicate AI tool slug: ${tool.slug}`);
  seen.add(tool.slug);
  if (!tool.officialSourceUrl.startsWith("https://")) throw new Error(`AI tool source must use HTTPS: ${tool.slug}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tool.lastVerifiedAt)) throw new Error(`Invalid AI tool verification date: ${tool.slug}`);
  if (!aiToolCategories.includes(tool.category)) throw new Error(`Invalid AI tool category: ${tool.slug}`);
  if (!aiOfferTypes.includes(tool.offerType)) throw new Error(`Invalid AI tool offer type: ${tool.slug}`);
}
if (tools.length < 30) throw new Error("AI tool catalog must contain at least 30 records");

export const aiTools = tools;
export const aiOfferLabels: Record<AIOfferType, string> = {
  free_for_everyone: "Free for everyone",
  student_discount: "Student discount",
  free_with_edu: "Free with .edu",
  university_specific: "University-specific",
  no_verified_student_offer: "No verified student offer",
};
