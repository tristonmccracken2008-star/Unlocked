import type { Opportunity, OpportunityDifficulty, OpportunityType, VerificationStatus } from "./opportunities";
import { recommendationConfig } from "./recommendation-config";

export type OpportunityWorkMode = "Remote" | "Hybrid" | "In Person" | "Varies" | "Unknown";
export type OpportunityPayStatus = "Paid" | "Unpaid" | "Varies" | "Unknown";
export type OpportunityCompetitiveness = "Open" | "Selective" | "Competitive" | "Highly Competitive" | "Unknown";
export type OpportunityPriority = "Critical" | "High" | "Recommended" | "Optional";

export type OpportunityStudentContext = {
  schoolSlug?: string;
  schoolName?: string;
  major?: string;
  minor?: string;
  academicYear?: string;
  careerGoals?: string;
  currentPriority?: string;
  interests?: string[];
  gpaStatus?: "reported" | "none_yet" | "nonstandard";
  gpa?: number;
  savedOpportunityIds?: string[];
  viewedOpportunityIds?: string[];
  activeOpportunityIds?: string[];
  completedOpportunityIds?: string[];
  rejectedOpportunityIds?: string[];
  acceptedOpportunityIds?: string[];
  savedCategories?: string[];
  completedCategories?: string[];
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
  matchingMinor: string[];
  matchingCareerGoals: string[];
  matchingInterests: string[];
  matchingCurrentPriority: boolean;
  matchingYears: string[];
  schoolEligible: boolean;
  gpaRequirement: number | null;
  gpaEligible: boolean | null;
  deadlineDays: number | null;
};

export type OpportunityScore = {
  opportunityId: string;
  score: number;
  priority: OpportunityPriority;
  difficulty: OpportunityCompetitiveness;
  confidence: number;
  signals: OpportunityRankingSignal[];
  positiveSignalCount: number;
  reasons: string[];
  breakdown: OpportunityMatchBreakdown;
};

export type OpportunityRankingSignal = {
  label: string;
  impact: "positive" | "negative" | "neutral";
  weight: number;
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

export function getMatchingMinor(item: Opportunity, context: OpportunityStudentContext) {
  if (!context.minor) return [];
  const minor = normalize(context.minor);
  if (item.majors.includes("Any Major")) return [];
  return item.majors.filter((itemMajor) => {
    const candidate = normalize(itemMajor);
    return minor.includes(candidate) || candidate.includes(minor);
  });
}

export function getMatchingCareerGoals(item: Opportunity, context: OpportunityStudentContext) {
  const text = searchableText(item);
  const terms = unique(tokens(context.careerGoals ?? ""));
  return terms.filter((term) => text.includes(term)).slice(0, 8);
}

export function getMatchingInterests(item: Opportunity, context: OpportunityStudentContext) {
  const text = searchableText(item);
  const terms = unique((context.interests ?? []).flatMap(tokens));
  return terms.filter((term) => text.includes(term)).slice(0, 8);
}

function currentPriorityMatches(item: Opportunity, priority?: string) {
  if (!priority) return false;
  const value = normalize(priority);
  const text = searchableText(item);
  if (value.includes("internship")) return text.includes("internship") || item.category === "Internships";
  if (value.includes("research")) return item.type === "Research" || text.includes("research") || text.includes("lab");
  if (value.includes("scholarship")) return item.type === "Scholarship" || text.includes("scholarship") || text.includes("award");
  if (value.includes("benefit")) return item.type === "Benefit" || item.type === "AI" || text.includes("benefit") || text.includes("software");
  if (value.includes("application")) return item.type === "Career" || text.includes("resume") || text.includes("career") || text.includes("fellowship");
  return false;
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

function gpaRequirement(item: Opportunity) {
  const text = `${item.eligibility} ${(item.metadata.applicationRequirements ?? []).join(" ")} ${(item.metadata.eligibilityNotes ?? []).join(" ")}`;
  const matches = [...text.matchAll(/(?:minimum|required|requires?|at least)?\s*(?:gpa)?\s*([2-4](?:\.\d{1,2})?)\s*(?:gpa)?/gi)].map((match) => Number(match[1])).filter((value) => Number.isFinite(value) && value >= 2 && value <= 4);
  return matches.length ? Math.max(...matches) : null;
}

function gpaEligible(item: Opportunity, context: OpportunityStudentContext) {
  const requirement = gpaRequirement(item);
  if (requirement === null) return null;
  if (context.gpaStatus !== "reported" || typeof context.gpa !== "number") return null;
  return context.gpa >= requirement;
}

export function getOpportunityPriority(item: Opportunity, context: OpportunityStudentContext): OpportunityPriority {
  const score = scoreOpportunityIntelligence(item, context);
  return score.priority;
}

export function scoreOpportunityIntelligence(item: Opportunity, context: OpportunityStudentContext): OpportunityScore {
  const weights = recommendationConfig.weights;
  const signals: OpportunityRankingSignal[] = [];
  const addSignal = (label: string, impact: OpportunityRankingSignal["impact"], weight: number) => {
    if (weight !== 0) signals.push({ label, impact, weight });
  };
  const matchingMajors = getMatchingMajors(item, context);
  const matchingMinor = getMatchingMinor(item, context);
  const matchingCareerGoals = getMatchingCareerGoals(item, context);
  const matchingInterests = getMatchingInterests(item, context);
  const matchingCurrentPriority = currentPriorityMatches(item, context.currentPriority);
  const matchingYears = getMatchingYears(item, context);
  const schoolEligible = isSchoolEligible(item, context);
  const deadlineDays = getDeadlineDays(item);
  const requirement = gpaRequirement(item);
  const meetsGpa = gpaEligible(item, context);
  const intelligence = getOpportunityIntelligence(item);
  let score = 0;
  const schoolWeight = schoolEligible ? item.school_scope === "School Specific" ? weights.schoolEligibleSpecific : weights.schoolEligibleNational : weights.wrongSchoolPenalty;
  score += schoolWeight;
  addSignal(schoolEligible ? item.school_scope === "School Specific" ? "School-specific eligibility matches" : "Available nationally" : "Not eligible for this school", schoolEligible ? "positive" : "negative", schoolWeight);
  if (matchingMajors.length) {
    const weight = matchingMajors.includes("Any Major") ? weights.majorAny : weights.majorExact;
    score += weight;
    addSignal(matchingMajors.includes("Any Major") ? "Open to any major" : `Major matches ${matchingMajors[0]}`, "positive", weight);
  }
  if (matchingMinor.length) {
    score += weights.minorExact;
    addSignal(`Minor connects with ${matchingMinor[0]}`, "positive", weights.minorExact);
  }
  if (matchingCareerGoals.length) {
    const weight = Math.min(weights.careerGoalMax, matchingCareerGoals.length * weights.careerGoalPerSignal);
    score += weight;
    addSignal(`Career goal matches ${matchingCareerGoals.slice(0, 2).join(", ")}`, "positive", weight);
  }
  if (matchingInterests.length) {
    const weight = Math.min(weights.interestMax, matchingInterests.length * weights.interestPerSignal);
    score += weight;
    addSignal(`Interest matches ${matchingInterests.slice(0, 2).join(", ")}`, "positive", weight);
  }
  if (matchingCurrentPriority) {
    score += weights.currentPriority;
    addSignal(`Current priority matches ${context.currentPriority}`, "positive", weights.currentPriority);
  }
  if (matchingYears.length) {
    const weight = matchingYears.includes("Any Year") ? weights.classYearAny : weights.classYearExact;
    score += weight;
    addSignal(matchingYears.includes("Any Year") ? "Open to any class year" : `Class year matches ${matchingYears[0]}`, "positive", weight);
  } else if (context.academicYear && !item.academic_years.includes("Any Year")) {
    score += weights.wrongClassYearPenalty;
    addSignal(`Does not list ${context.academicYear} eligibility`, "negative", weights.wrongClassYearPenalty);
  }
  if (requirement !== null && meetsGpa === true) {
    score += weights.gpaMeetsRequirement;
    addSignal(`GPA meets listed ${requirement.toFixed(1)} requirement`, "positive", weights.gpaMeetsRequirement);
  }
  if (requirement !== null && meetsGpa === false) {
    addSignal(`GPA is below listed ${requirement.toFixed(1)} requirement`, "negative", weights.wrongClassYearPenalty);
  }
  if (requirement !== null && context.gpaStatus === "none_yet") {
    score += weights.noGpaKnownRequirementPenalty;
    addSignal(`GPA requirement ${requirement.toFixed(1)} needs future confirmation`, "negative", weights.noGpaKnownRequirementPenalty);
  }
  if (deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 14) {
    score += weights.deadlineCritical;
    addSignal(`Deadline in ${deadlineDays} days`, "positive", weights.deadlineCritical);
  } else if (deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 45) {
    score += weights.deadlineSoon;
    addSignal(`Deadline in ${deadlineDays} days`, "positive", weights.deadlineSoon);
  } else if (deadlineDays !== null && deadlineDays < 0) {
    score += weights.deadlinePassedPenalty;
    addSignal("Deadline has passed", "negative", weights.deadlinePassedPenalty);
  }
  const qualityWeight = Math.round(intelligence.qualityScore * weights.qualityMultiplier);
  score += qualityWeight;
  addSignal(`Opportunity quality score ${intelligence.qualityScore}`, qualityWeight >= 10 ? "positive" : "neutral", qualityWeight);
  if (item.verification_status === "verified") {
    score += weights.verified;
    addSignal("Verified from official source", "positive", weights.verified);
  }
  if (item.verification_status === "needs_review") {
    score += weights.needsReview;
    addSignal("Needs review but not expired", "neutral", weights.needsReview);
  }
  if (item.estimated_value && item.estimated_value >= 1000) {
    score += weights.highValue;
    addSignal("High documented value", "positive", weights.highValue);
  }
  if (item.difficulty === "Open") {
    score += weights.openDifficulty;
    addSignal("Open application difficulty", "positive", weights.openDifficulty);
  }
  if (item.difficulty === "Highly Competitive") {
    score += weights.highlyCompetitivePenalty;
    addSignal("Highly competitive", "negative", weights.highlyCompetitivePenalty);
  }
  if (context.savedCategories?.includes(item.category)) {
    score += weights.savedSimilarCategory;
    addSignal(`Similar to saved ${item.category} opportunities`, "positive", weights.savedSimilarCategory);
  }
  if (context.completedCategories?.includes(item.category)) {
    score += weights.completedSimilarCategory;
    addSignal(`Similar to completed ${item.category} opportunities`, "positive", weights.completedSimilarCategory);
  }
  if (context.viewedOpportunityIds?.includes(item.id)) {
    score += weights.viewedPenalty;
    addSignal("Already opened recently", "negative", weights.viewedPenalty);
  }
  if (context.activeOpportunityIds?.includes(item.id)) {
    score += weights.activeTrackedPenalty;
    addSignal("Already active in Journey", "negative", weights.activeTrackedPenalty);
  }
  if (item.verification_status === "expired") {
    score = -100;
    addSignal("Expired verification status", "negative", -100);
  }
  const normalizedScore = Math.max(0, Math.min(100, score));
  const priority: OpportunityPriority = deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 10 && normalizedScore >= 55 ? "Critical" : normalizedScore >= 78 ? "High" : normalizedScore >= 50 ? "Recommended" : "Optional";
  return {
    opportunityId: item.id,
    score: normalizedScore,
    priority,
    difficulty: intelligence.competitiveness,
    confidence: Math.max(20, Math.min(98, normalizedScore + Math.round(intelligence.qualityScore * 0.12))),
    signals,
    positiveSignalCount: signals.filter((signal) => signal.impact === "positive" && signal.weight >= 8).length,
    reasons: getRecommendationReasons(item, context),
    breakdown: { matchingMajors, matchingMinor, matchingCareerGoals, matchingInterests, matchingCurrentPriority, matchingYears, schoolEligible, gpaRequirement: requirement, gpaEligible: meetsGpa, deadlineDays },
  };
}

export function getRecommendationReasons(item: Opportunity, context: OpportunityStudentContext) {
  const matchingMajors = getMatchingMajors(item, context);
  const matchingMinor = getMatchingMinor(item, context);
  const matchingCareerGoals = getMatchingCareerGoals(item, context);
  const matchingInterests = getMatchingInterests(item, context);
  const matchingCurrentPriority = currentPriorityMatches(item, context.currentPriority);
  const matchingYears = getMatchingYears(item, context);
  const schoolEligible = isSchoolEligible(item, context);
  const deadlineDays = getDeadlineDays(item);
  const requirement = gpaRequirement(item);
  const meetsGpa = gpaEligible(item, context);
  const reasons: string[] = [];
  if (matchingMajors.length) reasons.push(matchingMajors.includes("Any Major") ? "Open to students in any major." : `Matches your major: ${matchingMajors[0]}.`);
  if (matchingMinor.length) reasons.push(`Connects with your minor: ${matchingMinor[0]}.`);
  if (matchingCareerGoals.length) reasons.push(`Matches your career goal: ${matchingCareerGoals.slice(0, 2).join(", ")}.`);
  if (matchingInterests.length) reasons.push(`Matches your opportunity interests: ${matchingInterests.slice(0, 2).join(", ")}.`);
  if (matchingCurrentPriority && context.currentPriority) reasons.push(`Supports your current priority: ${context.currentPriority}.`);
  if (matchingYears.length) reasons.push(matchingYears.includes("Any Year") ? "Accepts students in any class year." : `Accepts ${matchingYears[0].toLowerCase()} students.`);
  if (schoolEligible) reasons.push(item.school_scope === "National" ? "Available nationally." : `Available at ${context.schoolName ?? "your school"}.`);
  if (requirement !== null && meetsGpa === true) reasons.push(`Your GPA meets the listed ${requirement.toFixed(1)} requirement.`);
  if (requirement !== null && context.gpaStatus === "none_yet") reasons.push(`This lists a ${requirement.toFixed(1)} GPA requirement, so confirm eligibility once you have a college GPA.`);
  if (deadlineDays !== null && deadlineDays >= 0) reasons.push(`Deadline is in ${deadlineDays} day${deadlineDays === 1 ? "" : "s"}.`);
  if (item.verification_status === "verified") reasons.push("Verified from an official source.");
  if (!reasons.length) reasons.push("Included for review because it is in the opportunity catalog, but profile-specific matches are limited.");
  return reasons;
}
