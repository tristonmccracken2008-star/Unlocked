import catalogJson from "./db/opportunities.json";

export const opportunityTypes = ["Benefit", "AI", "Career", "Research"] as const;
export const opportunityCategories = ["All", "Internships", "Freshman Programs", "Hackathons", "Competitions", "Fellowships", "Conferences", "Leadership Programs"] as const;
export const opportunityMajors = ["All", "Any Major", "Computer Science", "Mathematics", "Engineering", "Data Science", "Physics", "Natural Sciences", "Finance", "Business", "Design", "Social Sciences"] as const;
export const academicYears = ["All", "First year", "Second year", "Third year", "Fourth year", "Graduate student"] as const;
export type OpportunityType = (typeof opportunityTypes)[number];
export type OpportunityCategory = Exclude<(typeof opportunityCategories)[number], "All">;
export type Compensation = "Paid" | "Unpaid" | "Varies";
export type WorkMode = "Remote" | "Hybrid" | "In Person" | "Varies";
export type OpportunityScope = "National" | "School Specific";
export type VerificationStatus = "verified_recently" | "needs_review" | "expired" | "community_submitted";
export type OpportunityDifficulty = "Open" | "Competitive" | "Highly Competitive" | null;
export type OpportunityPrestige = "Established" | "High" | "Very High" | null;

export type OpportunityMetadata = {
  legacySlug?: string;
  valueLabel?: string;
  claimUrl?: string;
  verificationMethod?: string;
  claimSteps?: string[];
  renewalNotes?: string;
  eligibilityNotes?: string[];
  reviewScore?: number;
  studentOffer?: string;
  offerType?: string;
  deadlineType?: "fixed" | "rolling" | "varies" | "not_announced";
  compensation?: "Paid" | "Unpaid" | "Varies";
  workMode?: "Remote" | "Hybrid" | "In Person" | "Varies";
  professor?: string | null;
  department?: string;
  researchArea?: string;
  stipendAmount?: number | null;
  semesters?: string[];
};

export type Opportunity = {
  id: string;
  title: string;
  type: OpportunityType;
  category: string;
  description: string;
  organization: string;
  school_scope: OpportunityScope;
  schools: string[];
  majors: string[];
  academic_years: string[];
  eligibility: string;
  estimated_value: number | null;
  application_deadline: string | null;
  recurring: boolean;
  location: string;
  remote: boolean | null;
  paid: boolean | null;
  tags: string[];
  official_source: string;
  verification_status: VerificationStatus;
  last_verified: string;
  difficulty: OpportunityDifficulty;
  prestige: OpportunityPrestige;
  icon: string | null;
  featured: boolean;
  hidden_gem: boolean;
  metadata: OpportunityMetadata;
};

export type OpportunityFilters = {
  types?: OpportunityType[];
  major?: string;
  school?: string;
  academicYear?: string;
  paid?: boolean | null;
  remote?: boolean | null;
  deadline?: "published" | "upcoming" | "rolling" | "not_announced";
  featured?: boolean;
  hiddenGem?: boolean;
  query?: string;
};

export const opportunities = catalogJson as Opportunity[];
const seen = new Set<string>();
for (const item of opportunities) {
  if (seen.has(item.id)) throw new Error(`Duplicate opportunity id: ${item.id}`);
  seen.add(item.id);
  if (!opportunityTypes.includes(item.type)) throw new Error(`Invalid opportunity type: ${item.id}`);
  if (!item.official_source.startsWith("https://")) throw new Error(`Opportunity source must use HTTPS: ${item.id}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.last_verified)) throw new Error(`Invalid verification date: ${item.id}`);
  if (item.school_scope === "School Specific" && !item.schools.length) throw new Error(`School-specific opportunity has no school: ${item.id}`);
  if (item.application_deadline && !/^\d{4}-\d{2}-\d{2}$/.test(item.application_deadline)) throw new Error(`Invalid application deadline: ${item.id}`);
}

export function filterOpportunities(filters: OpportunityFilters = {}, source = opportunities) {
  const query = filters.query?.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  return source.filter((item) => {
    if (filters.types?.length && !filters.types.includes(item.type)) return false;
    if (filters.major && filters.major !== "All" && !item.majors.includes("Any Major") && !item.majors.includes(filters.major)) return false;
    if (filters.school && item.school_scope === "School Specific" && !item.schools.includes(filters.school)) return false;
    if (filters.academicYear && filters.academicYear !== "All" && !item.academic_years.includes("Any Year") && !item.academic_years.includes(filters.academicYear)) return false;
    if (filters.paid !== undefined && filters.paid !== null && item.paid !== filters.paid) return false;
    if (filters.remote !== undefined && filters.remote !== null && item.remote !== filters.remote) return false;
    if (filters.deadline === "published" && !item.application_deadline) return false;
    if (filters.deadline === "upcoming" && (!item.application_deadline || item.application_deadline < today)) return false;
    if (filters.deadline === "rolling" && !["rolling", "varies"].includes(item.metadata.deadlineType ?? "")) return false;
    if (filters.deadline === "not_announced" && item.application_deadline) return false;
    if (filters.featured !== undefined && item.featured !== filters.featured) return false;
    if (filters.hiddenGem !== undefined && item.hidden_gem !== filters.hiddenGem) return false;
    if (query && !`${item.title} ${item.organization} ${item.description} ${item.category} ${item.tags.join(" ")}`.toLowerCase().includes(query)) return false;
    return true;
  });
}

export const getOpportunity = (id: string) => opportunities.find((item) => item.id === id);
export const getOpportunityByLegacySlug = (type: OpportunityType, slug: string) => opportunities.find((item) => item.type === type && item.metadata.legacySlug === slug);
export const careerOpportunities = filterOpportunities({ types: ["Career"] });
export const researchOpportunities = filterOpportunities({ types: ["Research"] });

export function deadlineLabel(item: Opportunity) {
  if (item.application_deadline) return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${item.application_deadline}T00:00:00Z`));
  if (item.metadata.deadlineType === "rolling") return "Rolling";
  if (item.metadata.deadlineType === "varies") return "Varies by role or site";
  return "Not announced";
}
