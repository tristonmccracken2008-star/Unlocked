import opportunitiesJson from "./db/opportunities.json";

export const opportunityCategories = ["All", "Internships", "Freshman Programs", "Undergraduate Research", "Hackathons", "Competitions", "Fellowships", "Conferences", "Leadership Programs"] as const;
export const opportunityMajors = ["All", "Any Major", "Computer Science", "Mathematics", "Engineering", "Data Science", "Physics", "Natural Sciences", "Finance", "Business", "Design", "Social Sciences"] as const;
export const academicYears = ["All", "First year", "Second year", "Third year", "Fourth year", "Graduate student"] as const;
export type OpportunityCategory = Exclude<(typeof opportunityCategories)[number], "All">;
export type OpportunityScope = "national" | "school";
export type DeadlineType = "fixed" | "rolling" | "varies" | "not_announced";
export type OpportunityDifficulty = "Open" | "Competitive" | "Highly Competitive";
export type OpportunityPrestige = "Established" | "High" | "Very High";
export type Compensation = "Paid" | "Unpaid" | "Varies";
export type WorkMode = "Remote" | "Hybrid" | "In Person" | "Varies";

export type Opportunity = {
  slug: string;
  title: string;
  organization: string;
  category: OpportunityCategory;
  description: string;
  eligibility: string;
  scope: OpportunityScope;
  schoolSlugs?: string[];
  majors: string[];
  academicYears: string[];
  applicationDeadline: string | null;
  deadlineType: DeadlineType;
  difficulty: OpportunityDifficulty;
  prestige: OpportunityPrestige;
  location: string;
  officialSourceUrl: string;
  lastVerifiedAt: string;
  compensation: Compensation;
  workMode: WorkMode;
};

export const opportunities = opportunitiesJson as Opportunity[];
const seen = new Set<string>();
for (const opportunity of opportunities) {
  if (seen.has(opportunity.slug)) throw new Error(`Duplicate opportunity slug: ${opportunity.slug}`);
  seen.add(opportunity.slug);
  if (!opportunityCategories.includes(opportunity.category)) throw new Error(`Invalid opportunity category: ${opportunity.slug}`);
  if (!opportunity.officialSourceUrl.startsWith("https://")) throw new Error(`Opportunity source must use HTTPS: ${opportunity.slug}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opportunity.lastVerifiedAt)) throw new Error(`Invalid opportunity verification date: ${opportunity.slug}`);
  if (opportunity.deadlineType === "fixed" && !opportunity.applicationDeadline) throw new Error(`Fixed deadline missing for opportunity: ${opportunity.slug}`);
  if (opportunity.scope === "school" && !opportunity.schoolSlugs?.length) throw new Error(`School-specific opportunity missing schools: ${opportunity.slug}`);
}
if (opportunities.length < 75) throw new Error("Opportunity catalog must contain at least 75 records");

export function deadlineLabel(opportunity: Opportunity) {
  if (opportunity.applicationDeadline) return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${opportunity.applicationDeadline}T00:00:00Z`));
  if (opportunity.deadlineType === "rolling") return "Rolling";
  if (opportunity.deadlineType === "varies") return "Varies by role or site";
  return "Not announced";
}
