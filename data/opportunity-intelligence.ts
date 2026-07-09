import type { Opportunity, OpportunityDifficulty, OpportunityType, VerificationStatus } from "./opportunities";

export type OpportunityWorkMode = "Remote" | "Hybrid" | "In Person" | "Varies" | "Unknown";
export type OpportunityPayStatus = "Paid" | "Unpaid" | "Varies" | "Unknown";
export type OpportunityCompetitiveness = "Open" | "Selective" | "Competitive" | "Highly Competitive" | "Unknown";
export type OpportunityPriority = "Critical" | "High" | "Recommended" | "Optional";

export type OpportunityStudentContext = {
  schoolSlug?: string;
  schoolName?: string;
  major?: string;
  academicYear?: string;
  careerGoals?: string;
  interests?: string[];
  savedOpportunityIds?: string[];
  viewedOpportunityIds?: string[];
};

export type OpportunityIntelligence = {
  id: string;
  title: string;
  organization: string;
  category: string;
  subcategory: string;
  opportunityType: OpportunityType;
  officialSource: string;
  deadline: string | null;
  deadlineType: "fixed" | "rolling" | "varies" | "not_announced";
  applicationDifficulty: OpportunityDifficulty;
  estimatedApplicationTime: "15-30 minutes" | "1-2 hours" | "3-5 hours" | "1-2 weeks" | "Unknown";
  eligibility: string;
  classYears: string[];
  supportedMajors: string[];
  careerPaths: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  location: string;
  workMode: OpportunityWorkMode;
  payStatus: OpportunityPayStatus;
  estimatedValue: number | null;
  competitiveness: OpportunityCompetitiveness;
  tags: string[];
  verificationStatus: VerificationStatus;
  qualityScore: number;
};

export type OpportunityMatchBreakdown = {
  matchingMajors: string[];
  matchingCareerGoals: string[];
  matchingYears: string[];
  schoolEligible: boolean;
  deadlineDays: number | null;
};

export type OpportunityScore = {
  opportunityId: string;
  score: number;
  priority: OpportunityPriority;
  difficulty: OpportunityCompetitiveness;
  confidence: number;
  reasons: string[];
  breakdown: OpportunityMatchBreakdown;
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();
const unique = <T,>(values: T[]) => [...new Set(values.filter(Boolean))];
const tokens = (value: string) => normalize(value).split(" ").filter((token) => token.length > 2);

const careerPathSignals: Record<string, string[]> = {
  "Software Engineering": ["software", "coding", "developer", "computer science", "programming", "github"],
  "Data and Analytics": ["data", "analytics", "statistics", "machine learning", "quantitative"],
  Research: ["research", "lab", "faculty", "paper", "academic"],
  Finance: ["finance", "banking", "investment", "accounting", "market"],
  "Health and Medicine": ["medical", "medicine", "clinical", "health", "biology", "pre med"],
  "Public Service": ["policy", "government", "law", "nonprofit", "public"],
  Design: ["design", "portfolio", "creative", "ux", "studio"],
  Business: ["business", "marketing", "management", "operations", "entrepreneurship"],
  Engineering: ["engineering", "manufacturing", "hardware", "cad", "systems"],
};

const skillSignals: Record<string, string[]> = {
  Python: ["python", "data science", "machine learning", "ai"],
  SQL: ["sql", "database", "analytics"],
  Writing: ["writing", "essay", "proposal", "policy", "journalism"],
  Research: ["research", "lab", "faculty", "study"],
  Leadership: ["leadership", "mentor", "ambassador", "student government"],
  Communication: ["communication", "presentation", "interview", "networking"],
  "Financial Modeling": ["finance", "investment", "banking", "modeling"],
  "Clinical Exposure": ["clinical", "patient", "medicine", "health"],
  "Portfolio Building": ["portfolio", "design", "project", "github"],
};

function searchableText(item: Opportunity) {
  return normalize([item.title, item.organization, item.category, item.description, item.eligibility, item.location, ...item.majors, ...item.tags, item.metadata.department ?? "", item.metadata.researchArea ?? ""].join(" "));
}

function inferSubcategory(item: Opportunity) {
  return item.metadata.researchArea ?? item.metadata.department ?? item.metadata.offerType ?? item.metadata.studentOffer ?? item.category;
}

function inferCareerPaths(item: Opportunity) {
  const text = searchableText(item);
  const inferred = Object.entries(careerPathSignals).filter(([, terms]) => terms.some((term) => text.includes(normalize(term)))).map(([path]) => path);
  if (item.type === "Scholarship") inferred.push("Funding");
  if (item.type === "Research") inferred.push("Research");
  if (item.type === "AI") inferred.push("Software Engineering", "Data and Analytics");
  return unique(inferred.length ? inferred : [item.type === "Benefit" ? "Student Support" : item.category]);
}

function inferSkills(item: Opportunity) {
  const text = searchableText(item);
  return unique(Object.entries(skillSignals).filter(([, terms]) => terms.some((term) => text.includes(normalize(term)))).map(([skill]) => skill));
}

function workMode(item: Opportunity): OpportunityWorkMode {
  if (item.metadata.workMode) return item.metadata.workMode;
  if (item.remote === true) return "Remote";
  if (item.remote === false) return "In Person";
  return "Unknown";
}

function payStatus(item: Opportunity): OpportunityPayStatus {
  if (item.metadata.compensation) return item.metadata.compensation;
  if (item.paid === true) return "Paid";
  if (item.paid === false) return "Unpaid";
  return "Unknown";
}

export function getOpportunityDifficulty(item: Opportunity): OpportunityCompetitiveness {
  if (item.difficulty === "Highly Competitive" || item.prestige === "Very High") return "Highly Competitive";
  if (item.difficulty === "Competitive" || item.prestige === "High") return "Competitive";
  if (item.difficulty === "Open") return "Open";
  if (item.prestige === "Established") return "Selective";
  return "Unknown";
}

function estimatedApplicationTime(item: Opportunity): OpportunityIntelligence["estimatedApplicationTime"] {
  if (item.metadata.applicationRequirements && item.metadata.applicationRequirements.length >= 3) return "3-5 hours";
  if (item.difficulty === "Highly Competitive" || item.category === "Fellowships") return "1-2 weeks";
  if (["Scholarship", "Research", "Career"].includes(item.type)) return "1-2 hours";
  if (item.type === "Benefit" || item.type === "AI") return "15-30 minutes";
  return "Unknown";
}

function qualityScore(item: Opportunity) {
  let score = 40;
  if (item.verification_status === "verified") score += 25;
  if (item.verification_status === "needs_review") score += 10;
  if (item.official_source_url.startsWith("https://")) score += 10;
  if (item.description.length >= 120) score += 8;
  if (item.eligibility.length >= 40) score += 6;
  if (item.application_deadline || ["rolling", "varies"].includes(item.metadata.deadlineType ?? "")) score += 5;
  if (item.estimated_value !== null || /unknown|not documented|not published/i.test(item.estimated_value_note)) score += 4;
  if (item.verification_status === "expired") score = 0;
  return Math.min(100, score);
}

export function getOpportunityIntelligence(item: Opportunity): OpportunityIntelligence {
  const requiredSkills = inferSkills(item);
  return {
    id: item.id,
    title: item.title,
    organization: item.organization,
    category: item.category,
    subcategory: inferSubcategory(item),
    opportunityType: item.type,
    officialSource: item.official_source_url,
    deadline: item.application_deadline,
    deadlineType: item.metadata.deadlineType ?? (item.application_deadline ? "fixed" : "not_announced"),
    applicationDifficulty: item.difficulty,
    estimatedApplicationTime: estimatedApplicationTime(item),
    eligibility: item.eligibility,
    classYears: item.academic_years,
    supportedMajors: item.majors,
    careerPaths: inferCareerPaths(item),
    requiredSkills,
    preferredSkills: unique([...requiredSkills, ...item.tags.filter((tag) => tag.length <= 28)]).slice(0, 8),
    location: item.location,
    workMode: workMode(item),
    payStatus: payStatus(item),
    estimatedValue: item.estimated_value,
    competitiveness: getOpportunityDifficulty(item),
    tags: item.tags,
    verificationStatus: item.verification_status,
    qualityScore: qualityScore(item),
  };
}

export function getMatchingMajors(item: Opportunity, context: OpportunityStudentContext) {
  if (!context.major) return [];
  const major = normalize(context.major);
  if (item.majors.includes("Any Major")) return ["Any Major"];
  return item.majors.filter((itemMajor) => {
    const candidate = normalize(itemMajor);
    return major.includes(candidate) || candidate.includes(major);
  });
}

export function getMatchingCareerGoals(item: Opportunity, context: OpportunityStudentContext) {
  const text = searchableText(item);
  const terms = unique([...(context.interests ?? []).flatMap(tokens), ...tokens(context.careerGoals ?? "")]);
  return terms.filter((term) => text.includes(term)).slice(0, 8);
}

export function getMatchingYears(item: Opportunity, context: OpportunityStudentContext) {
  if (!context.academicYear) return [];
  if (item.academic_years.includes("Any Year")) return ["Any Year"];
  return item.academic_years.filter((year) => year === context.academicYear);
}

export function getDeadlineDays(item: Opportunity, now = new Date()) {
  if (!item.application_deadline) return null;
  const deadline = new Date(`${item.application_deadline}T23:59:59Z`);
  return Math.ceil((deadline.getTime() - now.getTime()) / 86400000);
}

function isSchoolEligible(item: Opportunity, context: OpportunityStudentContext) {
  return item.school_scope === "National" || Boolean(context.schoolSlug && item.schools.includes(context.schoolSlug));
}

export function getOpportunityPriority(item: Opportunity, context: OpportunityStudentContext): OpportunityPriority {
  const score = scoreOpportunityIntelligence(item, context);
  return score.priority;
}

export function scoreOpportunityIntelligence(item: Opportunity, context: OpportunityStudentContext): OpportunityScore {
  const matchingMajors = getMatchingMajors(item, context);
  const matchingCareerGoals = getMatchingCareerGoals(item, context);
  const matchingYears = getMatchingYears(item, context);
  const schoolEligible = isSchoolEligible(item, context);
  const deadlineDays = getDeadlineDays(item);
  const intelligence = getOpportunityIntelligence(item);
  let score = 0;
  if (schoolEligible) score += item.school_scope === "School Specific" ? 18 : 10;
  else score -= 40;
  if (matchingMajors.length) score += matchingMajors.includes("Any Major") ? 8 : 22;
  if (matchingCareerGoals.length) score += Math.min(18, matchingCareerGoals.length * 4);
  if (matchingYears.length) score += matchingYears.includes("Any Year") ? 8 : 18;
  if (deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 14) score += 18;
  else if (deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 45) score += 10;
  else if (deadlineDays !== null && deadlineDays < 0) score -= 35;
  score += Math.round(intelligence.qualityScore * 0.18);
  if (item.estimated_value && item.estimated_value >= 1000) score += 8;
  if (item.difficulty === "Open") score += 5;
  if (item.difficulty === "Highly Competitive") score -= 4;
  if (item.verification_status === "expired") score = -100;
  const normalizedScore = Math.max(0, Math.min(100, score));
  const priority: OpportunityPriority = deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 10 && normalizedScore >= 55 ? "Critical" : normalizedScore >= 78 ? "High" : normalizedScore >= 50 ? "Recommended" : "Optional";
  return {
    opportunityId: item.id,
    score: normalizedScore,
    priority,
    difficulty: intelligence.competitiveness,
    confidence: Math.max(20, Math.min(98, normalizedScore + Math.round(intelligence.qualityScore * 0.12))),
    reasons: getRecommendationReasons(item, context),
    breakdown: { matchingMajors, matchingCareerGoals, matchingYears, schoolEligible, deadlineDays },
  };
}

export function getRecommendationReasons(item: Opportunity, context: OpportunityStudentContext) {
  const matchingMajors = getMatchingMajors(item, context);
  const matchingCareerGoals = getMatchingCareerGoals(item, context);
  const matchingYears = getMatchingYears(item, context);
  const schoolEligible = isSchoolEligible(item, context);
  const deadlineDays = getDeadlineDays(item);
  const reasons: string[] = [];
  if (matchingMajors.length) reasons.push(matchingMajors.includes("Any Major") ? "Open to students in any major." : `Matches your major: ${matchingMajors[0]}.`);
  if (matchingCareerGoals.length) reasons.push(`Matches your career goal or interests: ${matchingCareerGoals.slice(0, 2).join(", ")}.`);
  if (matchingYears.length) reasons.push(matchingYears.includes("Any Year") ? "Accepts students in any class year." : `Accepts ${matchingYears[0].toLowerCase()} students.`);
  if (schoolEligible) reasons.push(item.school_scope === "National" ? "Available nationally." : `Available at ${context.schoolName ?? "your school"}.`);
  if (deadlineDays !== null && deadlineDays >= 0) reasons.push(`Deadline is in ${deadlineDays} day${deadlineDays === 1 ? "" : "s"}.`);
  if (item.verification_status === "verified") reasons.push("Verified from an official source.");
  if (!reasons.length) reasons.push("Included for review because it is in the opportunity catalog, but profile-specific matches are limited.");
  return reasons;
}
