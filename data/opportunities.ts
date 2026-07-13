import catalogJson from "./db/opportunities.json";
import { canonicalOpportunity } from "./opportunity-enrichment";
import { auditOpportunity } from "./opportunity-quality";

export const opportunityTypes = ["Benefit", "AI", "Career", "Research", "Scholarship"] as const;
export const opportunityCategories = ["All", "Internships", "Freshman Programs", "Hackathons", "Competitions", "Fellowships", "Conferences", "Leadership Programs", "Career Resources", "Campus Jobs", "Co-ops", "Student Organizations", "Certifications", "Grants", "Study Abroad"] as const;
export const opportunityMajors = ["All", "Any Major", "Accounting", "Actuarial Science", "Aerospace Engineering", "Analytics", "Anthropology", "Applied Mathematics", "Architecture", "Astronomy", "Biology", "Biomedical Engineering", "Business", "Chemical Engineering", "Chemistry", "Civil Engineering", "Communications", "Computer Engineering", "Computer Science", "Criminal Justice", "Cybersecurity", "Data Science", "Design", "Earth Science", "Economics", "Education", "Electrical Engineering", "Engineering", "English", "Entrepreneurship", "Environmental Engineering", "Environmental Science", "Fashion Design", "Finance", "Fine Arts", "Game Design", "Geology", "Graphic Design", "History", "Hospitality Management", "Human Resources", "Human-Computer Interaction", "Industrial Design", "Industrial Engineering", "Information Systems", "Information Technology", "Interior Design", "International Relations", "Journalism", "Kinesiology", "Languages", "Linguistics", "Machine Learning", "Management", "Marine Science", "Marketing", "Materials Science", "Mathematics", "Mechanical Engineering", "Music", "Natural Sciences", "Neuroscience", "Nuclear Engineering", "Nursing", "Operations Management", "Philosophy", "Physics", "Political Science", "Pre-med", "Psychology", "Public Health", "Public Policy", "Religious Studies", "Social Sciences", "Social Work", "Sociology", "Software Engineering", "Statistics", "Supply Chain Management", "Theatre", "Urban Studies", "User Experience Design"] as const;
export const academicYears = ["All", "First year", "Second year", "Third year", "Fourth year", "Graduate student"] as const;
export type OpportunityType = (typeof opportunityTypes)[number];
export type OpportunityCategory = Exclude<(typeof opportunityCategories)[number], "All">;
export type Compensation = "Paid" | "Unpaid" | "Varies";
export type WorkMode = "Remote" | "Hybrid" | "In Person" | "Varies";
export type OpportunityScope = "National" | "School Specific";
export type VerificationStatus = "verified" | "needs_review" | "temporarily_closed" | "expired" | "broken_source" | "archived" | "incomplete" | "community_reported";
export type DeadlineType = "fixed" | "rolling" | "varies" | "not_announced" | "current_cycle_closed" | "no_deadline" | "unknown";
export type OpportunityVerification = {
  status: VerificationStatus;
  lastVerifiedAt?: string;
  verifiedCycle?: string;
  officialSourceUrl?: string;
  applicationUrlVerified?: boolean;
  deadlineVerified?: boolean;
  eligibilityVerified?: boolean;
  sourceReachable?: boolean;
  sourceAuditStatus?: number | null;
  notes?: string;
};
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
  deadlineType?: DeadlineType;
  compensation?: "Paid" | "Unpaid" | "Varies";
  workMode?: "Remote" | "Hybrid" | "In Person" | "Varies";
  professor?: string | null;
  department?: string;
  researchArea?: string;
  stipendAmount?: number | null;
  semesters?: string[];
  awardAmountLabel?: string;
  renewable?: boolean | null;
  applicationRequirements?: string[];
  estimatedApplicationTime?: "15-30 minutes" | "1-2 hours" | "3-5 hours" | "1-2 weeks" | "Unknown";
  estimatedAcceptanceRate?: string;
  estimatedCompetitiveness?: string;
  applicationSeason?: string;
  internshipDuration?: string;
  salaryEstimate?: string;
  skillsGained?: string[];
  careerPaths?: string[];
  expectedROI?: string;
  recommendedMajors?: string[];
  recommendedClassYears?: string[];
  citizenship?: string;
  internationalEligibility?: string;
  discountAmount?: string;
  verificationRequired?: string;
  howToRedeem?: string;
  limitations?: string;
  pricing?: string;
  freeTier?: string;
  bestUseCases?: string[];
  verification?: OpportunityVerification;
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
  official_source_url: string;
  verification_status: VerificationStatus;
  last_verified: string;
  deadline: string | null;
  reviewer_notes: string;
  estimated_value_note: string;
  date_added: string;
  difficulty: OpportunityDifficulty;
  prestige: OpportunityPrestige;
  icon: string | null;
  featured: boolean;
  hidden_gem: boolean;
  metadata: OpportunityMetadata;
};

export type OpportunityWithQuality = Opportunity & {
  contentComplete: boolean;
  completenessScore: number;
  missingContentFields: string[];
  canonical: ReturnType<typeof canonicalOpportunity>;
};

export type OpportunityFilters = {
  types?: OpportunityType[];
  category?: string;
  major?: string;
  school?: string;
  academicYear?: string;
  paid?: boolean | null;
  remote?: boolean | null;
  deadline?: "published" | "upcoming" | "rolling" | "not_announced";
  difficulty?: Exclude<OpportunityDifficulty, null> | "All";
  freshmanFriendly?: boolean;
  featured?: boolean;
  hiddenGem?: boolean;
  query?: string;
};

const majorFamilies: Record<string, string[]> = {
  Engineering: ["Aerospace Engineering", "Biomedical Engineering", "Chemical Engineering", "Civil Engineering", "Computer Engineering", "Electrical Engineering", "Environmental Engineering", "Industrial Engineering", "Materials Science", "Mechanical Engineering", "Nuclear Engineering", "Software Engineering"],
  "Computer Science": ["Software Engineering", "Cybersecurity", "Information Systems", "Information Technology", "Game Design", "Human-Computer Interaction", "Data Science", "Machine Learning"],
  "Data Science": ["Statistics", "Analytics", "Information Systems", "Machine Learning", "Mathematics"],
  Mathematics: ["Applied Mathematics", "Statistics", "Actuarial Science", "Data Science"],
  "Natural Sciences": ["Biology", "Chemistry", "Physics", "Environmental Science", "Neuroscience", "Geology", "Earth Science", "Marine Science", "Pre-med", "Nursing", "Public Health", "Kinesiology"],
  Business: ["Accounting", "Economics", "Finance", "Marketing", "Management", "Entrepreneurship", "Operations Management", "Supply Chain Management", "Hospitality Management", "Human Resources"],
  Design: ["Architecture", "Fine Arts", "Graphic Design", "Industrial Design", "Interior Design", "Fashion Design", "User Experience Design"],
  "Social Sciences": ["Psychology", "Political Science", "Sociology", "Anthropology", "International Relations", "Public Policy", "Criminal Justice", "Social Work", "Urban Studies", "Education", "Communications", "Journalism", "English", "History", "Philosophy", "Religious Studies", "Languages", "Linguistics", "Music", "Theatre", "Fine Arts"],
};

function majorMatchesFilter(itemMajors: string[], selectedMajor: string) {
  if (selectedMajor === "All") return true;
  if (itemMajors.includes("Any Major") || itemMajors.includes(selectedMajor)) return true;
  const selected = selectedMajor.toLowerCase();
  return itemMajors.some((major) => {
    const family = majorFamilies[major] ?? [];
    return family.includes(selectedMajor) || major.toLowerCase().includes(selected) || selected.includes(major.toLowerCase());
  });
}

export const opportunities = (catalogJson as Opportunity[]).map((item) => {
  const quality = auditOpportunity(item);
  return { ...item, canonical: canonicalOpportunity(item), contentComplete: quality.contentComplete, completenessScore: quality.completenessScore, missingContentFields: quality.missingFields };
}) as OpportunityWithQuality[];
const seen = new Set<string>();
const verificationStatuses: VerificationStatus[] = ["verified", "needs_review", "temporarily_closed", "expired", "broken_source", "archived", "incomplete", "community_reported"];
const deadlineTypes: DeadlineType[] = ["fixed", "rolling", "varies", "not_announced", "current_cycle_closed", "no_deadline", "unknown"];
for (const item of opportunities) {
  if (seen.has(item.id)) throw new Error(`Duplicate opportunity id: ${item.id}`);
  seen.add(item.id);
  if (!opportunityTypes.includes(item.type)) throw new Error(`Invalid opportunity type: ${item.id}`);
  if (!verificationStatuses.includes(item.verification_status)) throw new Error(`Invalid opportunity verification status: ${item.id}`);
  if (!item.metadata.deadlineType || !deadlineTypes.includes(item.metadata.deadlineType)) throw new Error(`Invalid opportunity deadline type: ${item.id}`);
  if (item.metadata.deadlineType === "fixed" && !item.application_deadline) throw new Error(`Fixed deadline requires an exact application deadline: ${item.id}`);
  if (item.metadata.deadlineType === "unknown" && item.application_deadline) throw new Error(`Unknown deadline cannot include an exact application deadline: ${item.id}`);
  if (!item.official_source.startsWith("https://")) throw new Error(`Opportunity source must use HTTPS: ${item.id}`);
  if (item.official_source_url !== item.official_source) throw new Error(`Opportunity source fields do not match: ${item.id}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.last_verified)) throw new Error(`Invalid verification date: ${item.id}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date_added)) throw new Error(`Invalid date added: ${item.id}`);
  if (item.school_scope === "School Specific" && !item.schools.length) throw new Error(`School-specific opportunity has no school: ${item.id}`);
  if (item.application_deadline && !/^\d{4}-\d{2}-\d{2}$/.test(item.application_deadline)) throw new Error(`Invalid application deadline: ${item.id}`);
  if (item.deadline !== item.application_deadline) throw new Error(`Opportunity deadline fields do not match: ${item.id}`);
  if (!item.reviewer_notes.trim()) throw new Error(`Opportunity reviewer notes are required: ${item.id}`);
  if (item.estimated_value === null && !/unknown|not documented|not published/i.test(item.estimated_value_note)) throw new Error(`Unknown value must be explicit: ${item.id}`);
}

export function filterOpportunities(filters: OpportunityFilters = {}, source: readonly Opportunity[] = opportunities) {
  const query = filters.query?.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  return source.filter((item) => {
    if (filters.types?.length && !filters.types.includes(item.type)) return false;
    if (filters.category && filters.category !== "All" && item.category !== filters.category) return false;
    if (filters.major && !majorMatchesFilter(item.majors, filters.major)) return false;
    if (filters.school && item.school_scope === "School Specific" && !item.schools.includes(filters.school)) return false;
    if (filters.academicYear && filters.academicYear !== "All" && !item.academic_years.includes("Any Year") && !item.academic_years.includes(filters.academicYear)) return false;
    if (filters.paid !== undefined && filters.paid !== null && item.paid !== filters.paid) return false;
    if (filters.remote !== undefined && filters.remote !== null && item.remote !== filters.remote) return false;
    if (filters.deadline === "published" && !item.application_deadline) return false;
    if (filters.deadline === "upcoming" && (!item.application_deadline || item.application_deadline < today)) return false;
    if (filters.deadline === "rolling" && !["rolling", "varies"].includes(item.metadata.deadlineType ?? "")) return false;
    if (filters.deadline === "not_announced" && item.application_deadline) return false;
    if (filters.difficulty && filters.difficulty !== "All" && item.difficulty !== filters.difficulty) return false;
    if (filters.freshmanFriendly && !item.academic_years.includes("Any Year") && !item.academic_years.includes("First year") && item.category !== "Freshman Programs") return false;
    if (filters.featured !== undefined && item.featured !== filters.featured) return false;
    if (filters.hiddenGem !== undefined && item.hidden_gem !== filters.hiddenGem) return false;
    if (query && !`${item.title} ${item.organization} ${item.description} ${item.category} ${item.tags.join(" ")} ${canonicalOpportunity(item).searchText}`.toLowerCase().includes(query)) return false;
    return true;
  });
}

export const getOpportunity = (id: string) => opportunities.find((item) => item.id === id);
export const getOpportunityByLegacySlug = (type: OpportunityType, slug: string) => opportunities.find((item) => item.type === type && item.metadata.legacySlug === slug);
export function getRelatedOpportunities(item: Opportunity, limit = 5, source: readonly Opportunity[] = opportunities) {
  const tokens = new Set(`${item.title} ${item.category} ${item.tags.join(" ")}`.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 3));
  return source.filter((candidate) => candidate.id !== item.id && !["expired", "archived", "broken_source"].includes(candidate.verification_status)).map((candidate) => {
    const candidateTokens = new Set(`${candidate.title} ${candidate.category} ${candidate.tags.join(" ")}`.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 3));
    const tokenOverlap = [...tokens].filter((token) => candidateTokens.has(token)).length;
    const majorOverlap = item.majors.filter((major) => major !== "Any Major" && candidate.majors.includes(major)).length;
    const adjacentSoftware = (item.type === "AI" && candidate.type === "Benefit" && candidate.category === "Software") || (item.type === "Benefit" && item.category === "Software" && candidate.type === "AI");
    const score = tokenOverlap * 3 + majorOverlap * 2 + (candidate.category === item.category ? 6 : 0) + (candidate.type === item.type ? 4 : 0) + (candidate.organization === item.organization ? 2 : 0) + (candidate.school_scope === item.school_scope ? 1 : 0) + (adjacentSoftware ? 5 : 0) + (candidate.featured ? 1 : 0);
    return { candidate, score };
  }).sort((a,b) => b.score - a.score || Number(b.candidate.verification_status === "verified") - Number(a.candidate.verification_status === "verified") || a.candidate.title.localeCompare(b.candidate.title)).slice(0,limit).map(({candidate}) => candidate);
}
export const careerOpportunities = filterOpportunities({ types: ["Career"] });
export const researchOpportunities = filterOpportunities({ types: ["Research"] });
export const scholarshipOpportunities = filterOpportunities({ types: ["Scholarship"] });

export function deadlineLabel(item: Opportunity) {
  if (item.application_deadline) return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${item.application_deadline}T00:00:00Z`));
  if (item.metadata.deadlineType === "rolling") return "Rolling";
  if (item.metadata.deadlineType === "varies") return item.type === "Scholarship" ? "Deadline varies" : "Varies by role or site";
  if (item.metadata.deadlineType === "current_cycle_closed") return "Applications currently closed";
  if (item.metadata.deadlineType === "no_deadline") return "No application deadline";
  if (item.metadata.deadlineType === "unknown") return "Deadline unknown";
  return "Not announced";
}
