import type { AdvisorTimelineStage } from "./advisor-engine";
import type { Opportunity } from "./opportunities";

export type CareerRoadmap = {
  id: string;
  label: string;
  aliases: string[];
  progression: Record<AdvisorTimelineStage, {
    focus: string;
    categories: string[];
    skills: string[];
    targetOrganizations: string[];
    opportunitySignals: string[];
  }>;
};

const generalStage = {
  Freshman: { focus: "build foundation and test interests", categories: ["Scholarships", "Research", "Freshman Programs", "Student Organizations", "Career Resources"], skills: ["Resume", "Communication", "Research"], targetOrganizations: [], opportunitySignals: ["freshman", "first year", "intro", "explore"] },
  Sophomore: { focus: "turn exploration into evidence", categories: ["Research", "Internships", "Competitions", "Career Resources", "Certifications"], skills: ["Portfolio", "Networking", "Applications"], targetOrganizations: [], opportunitySignals: ["sophomore", "research", "internship", "career fair"] },
  Junior: { focus: "convert experience into competitive applications", categories: ["Internships", "Co-ops", "Fellowships", "Conferences", "Career Resources"], skills: ["Interviewing", "Networking", "Technical depth"], targetOrganizations: [], opportunitySignals: ["junior", "internship", "summer analyst", "interview"] },
  Senior: { focus: "finish strong and transition into the next role", categories: ["Career Resources", "Fellowships", "Graduate School", "Certifications", "Scholarships"], skills: ["Interviewing", "Professional communication", "Portfolio"], targetOrganizations: [], opportunitySignals: ["full time", "fellowship", "graduate", "senior"] },
  "Recent Graduate": { focus: "convert college evidence into career momentum", categories: ["Career Resources", "Fellowships", "Certifications", "Conferences"], skills: ["Interviewing", "Networking", "Professional communication"], targetOrganizations: [], opportunitySignals: ["graduate", "early career", "fellowship", "certification"] },
} satisfies CareerRoadmap["progression"];

export const careerRoadmaps: CareerRoadmap[] = [
  { id: "quantitative-finance", label: "Quantitative Finance", aliases: ["quant", "quantitative trading", "trading", "quantitative finance", "hedge fund"], progression: {
    Freshman: { focus: "build math, coding, and competition evidence", categories: ["Competitions", "Research", "Freshman Programs", "AI Tools", "Career Resources"], skills: ["Python", "Probability", "Statistics", "Financial Modeling"], targetOrganizations: ["Jane Street", "Citadel", "SIG", "Hudson River Trading"], opportunitySignals: ["quant", "trading", "math", "data", "statistics", "python"] },
    Sophomore: { focus: "add trading exposure and technical interview readiness", categories: ["Internships", "Competitions", "Research", "Conferences"], skills: ["Algorithms", "Probability", "Market intuition", "Communication"], targetOrganizations: ["Jane Street", "Citadel", "SIG", "Two Sigma"], opportunitySignals: ["quant", "trading", "insight", "markets", "technical"] },
    Junior: { focus: "prioritize elite internship recruiting", categories: ["Internships", "Career Resources", "Competitions", "Conferences"], skills: ["Interviewing", "Probability", "Programming", "Networking"], targetOrganizations: ["Jane Street", "Citadel", "SIG", "Hudson River Trading", "Two Sigma"], opportunitySignals: ["quant", "trading", "summer analyst", "internship"] },
    Senior: { focus: "convert internship evidence into full-time recruiting", categories: ["Career Resources", "Fellowships", "Conferences", "Certifications"], skills: ["Interviewing", "Professional communication", "Portfolio"], targetOrganizations: ["Jane Street", "Citadel", "SIG", "Hudson River Trading"], opportunitySignals: ["full time", "trading", "quant", "graduate"] },
    "Recent Graduate": generalStage["Recent Graduate"],
  } },
  { id: "software-engineering", label: "Software Engineering", aliases: ["software", "software engineering", "developer", "computer science", "swe"], progression: {
    Freshman: { focus: "build visible projects and freshman-friendly applications", categories: ["Freshman Programs", "AI Tools", "Competitions", "Internships", "Career Resources"], skills: ["Programming", "GitHub", "Portfolio Building", "Algorithms"], targetOrganizations: ["Google", "Microsoft", "Meta", "GitHub"], opportunitySignals: ["software", "coding", "developer", "github", "programming", "freshman"] },
    Sophomore: { focus: "ship projects and apply to exploratory internships", categories: ["Internships", "Competitions", "AI Tools", "Research", "Certifications"], skills: ["Algorithms", "System design basics", "Teamwork", "Portfolio"], targetOrganizations: ["Google", "Microsoft", "Meta", "Amazon"], opportunitySignals: ["software", "internship", "step", "explore", "engineering"] },
    Junior: { focus: "prioritize internship recruiting and interview preparation", categories: ["Internships", "Career Resources", "Competitions", "Conferences"], skills: ["Algorithms", "Interviewing", "Backend", "Frontend"], targetOrganizations: ["Google", "Microsoft", "Meta", "Amazon", "Apple"], opportunitySignals: ["software engineer", "internship", "technical interview"] },
    Senior: { focus: "convert experience into full-time roles", categories: ["Career Resources", "Conferences", "Certifications", "Fellowships"], skills: ["Interviewing", "Portfolio", "Professional communication"], targetOrganizations: ["Google", "Microsoft", "Meta", "Amazon"], opportunitySignals: ["new grad", "full time", "software"] },
    "Recent Graduate": generalStage["Recent Graduate"],
  } },
  { id: "medicine", label: "Medicine", aliases: ["medicine", "pre-med", "premed", "doctor", "healthcare", "medical"], progression: {
    Freshman: { focus: "start clinical exposure and research habits early", categories: ["Research", "Student Organizations", "Scholarships", "Campus Jobs", "Career Resources"], skills: ["Clinical Exposure", "Research", "Communication"], targetOrganizations: ["NIH", "Mayo Clinic", "AAMC"], opportunitySignals: ["medical", "clinical", "health", "biology", "research", "volunteer"] },
    Sophomore: { focus: "deepen research, volunteering, and shadowing", categories: ["Research", "Internships", "Scholarships", "Conferences"], skills: ["Research", "Patient exposure", "Leadership"], targetOrganizations: ["NIH", "AAMC"], opportunitySignals: ["clinical", "research", "health", "medicine"] },
    Junior: { focus: "prepare application evidence and meaningful clinical stories", categories: ["Research", "Fellowships", "Career Resources", "Scholarships"], skills: ["Interview stories", "Research", "Communication"], targetOrganizations: ["NIH", "AAMC"], opportunitySignals: ["medical school", "research", "clinical", "fellowship"] },
    Senior: { focus: "finish application preparation and transition planning", categories: ["Career Resources", "Research", "Fellowships", "Scholarships"], skills: ["Interviewing", "Professional communication", "Reflection"], targetOrganizations: ["AAMC", "NIH"], opportunitySignals: ["medical school", "gap year", "clinical"] },
    "Recent Graduate": generalStage["Recent Graduate"],
  } },
  { id: "investment-banking", label: "Investment Banking", aliases: ["investment banking", "banking", "finance", "wall street"], progression: {
    Freshman: { focus: "learn finance basics and join early insight programs", categories: ["Freshman Programs", "Career Resources", "Student Organizations", "Competitions"], skills: ["Excel", "Financial Modeling", "Networking"], targetOrganizations: ["Goldman Sachs", "Morgan Stanley", "JPMorgan", "Bank of America"], opportunitySignals: ["finance", "banking", "insight", "excel", "modeling"] },
    Sophomore: { focus: "network and pursue sophomore programs", categories: ["Internships", "Career Resources", "Competitions", "Conferences"], skills: ["Networking", "Financial Modeling", "Interviewing"], targetOrganizations: ["Goldman Sachs", "Morgan Stanley", "JPMorgan"], opportunitySignals: ["summer analyst", "finance", "banking", "sophomore"] },
    Junior: { focus: "prioritize summer analyst recruiting", categories: ["Internships", "Career Resources", "Conferences"], skills: ["Interviewing", "Valuation", "Networking"], targetOrganizations: ["Goldman Sachs", "Morgan Stanley", "JPMorgan", "Bank of America"], opportunitySignals: ["summer analyst", "investment banking", "finance internship"] },
    Senior: { focus: "convert banking evidence into full-time recruiting", categories: ["Career Resources", "Certifications", "Conferences"], skills: ["Interviewing", "Professional communication"], targetOrganizations: ["Goldman Sachs", "Morgan Stanley", "JPMorgan"], opportunitySignals: ["full time", "analyst", "banking"] },
    "Recent Graduate": generalStage["Recent Graduate"],
  } },
  { id: "data-science", label: "Data Science", aliases: ["data science", "data analytics", "analytics", "machine learning", "ai research"], progression: {
    Freshman: { focus: "build Python, statistics, and project evidence", categories: ["AI Tools", "Research", "Competitions", "Certifications"], skills: ["Python", "Statistics", "SQL", "Portfolio Building"], targetOrganizations: ["Google", "Microsoft", "NASA", "MIT"], opportunitySignals: ["data", "analytics", "machine learning", "python", "statistics"] },
    Sophomore: { focus: "turn projects into research or internship applications", categories: ["Research", "Internships", "Competitions", "Certifications"], skills: ["Machine Learning", "SQL", "Research", "Communication"], targetOrganizations: ["Google", "Microsoft", "NASA"], opportunitySignals: ["data", "research", "machine learning", "analytics"] },
    Junior: { focus: "prioritize internships that produce measurable project outcomes", categories: ["Internships", "Research", "Competitions", "Conferences"], skills: ["Machine Learning", "Experimentation", "Interviewing"], targetOrganizations: ["Google", "Microsoft", "Meta"], opportunitySignals: ["data scientist", "machine learning", "analytics internship"] },
    Senior: { focus: "package portfolio evidence for full-time data roles", categories: ["Career Resources", "Certifications", "Conferences", "Fellowships"], skills: ["Portfolio", "Interviewing", "Communication"], targetOrganizations: ["Google", "Microsoft", "Meta"], opportunitySignals: ["data", "new grad", "machine learning"] },
    "Recent Graduate": generalStage["Recent Graduate"],
  } },
];

export const generalCareerRoadmap: CareerRoadmap = { id: "general", label: "General Career Exploration", aliases: ["undecided", "explore", "general"], progression: generalStage };

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();
const containsSignal = (text: string, signal: string) => ` ${text} `.includes(` ${normalize(signal)} `);

export function getCareerRoadmap(goal: string | undefined) {
  const normalized = normalize(goal ?? "");
  return careerRoadmaps.find((roadmap) => roadmap.aliases.some((alias) => normalized.includes(normalize(alias)))) ?? generalCareerRoadmap;
}

export function careerRoadmapForStage(goal: string | undefined, stage: AdvisorTimelineStage) {
  const roadmap = getCareerRoadmap(goal);
  return { roadmap, stagePlan: roadmap.progression[stage] };
}

export function scoreCareerRoadmapFit(item: Opportunity, goal: string | undefined, stage: AdvisorTimelineStage) {
  const { roadmap, stagePlan } = careerRoadmapForStage(goal, stage);
  const text = normalize([item.title, item.organization, item.category, item.type, item.description, item.eligibility, ...item.tags, ...item.majors].join(" "));
  const categoryMatch = stagePlan.categories.includes(item.category) || stagePlan.categories.includes(item.type);
  const signalMatches = stagePlan.opportunitySignals.filter((signal) => containsSignal(text, signal));
  const organizationMatch = stagePlan.targetOrganizations.some((org) => containsSignal(text, org));
  const skillMatches = stagePlan.skills.filter((skill) => containsSignal(text, skill));
  const score = (categoryMatch ? 12 : 0) + Math.min(18, signalMatches.length * 6) + (organizationMatch ? 10 : 0) + Math.min(10, skillMatches.length * 5);
  return { roadmap, stagePlan, score, categoryMatch, signalMatches, organizationMatch, skillMatches };
}
