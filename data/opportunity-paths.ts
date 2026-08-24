import type { OpportunityType } from "./opportunities";

export const opportunityPathVersion = 1 as const;

export type OpportunityPathRule = {
  opportunityIds?: readonly string[];
  types?: readonly OpportunityType[];
  categories?: readonly string[];
  majors?: readonly string[];
  tags?: readonly string[];
  careerPaths?: readonly string[];
};

export type OpportunityPathStage = {
  id: string;
  name: string;
  description: string;
  experienceTypes: readonly string[];
  rules: readonly OpportunityPathRule[];
  discoverHref: string;
  mappingPriority?: number;
};

export type OpportunityPathDefinition = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  profileAliases: readonly string[];
  relatedPathIds: readonly string[];
  stages: readonly OpportunityPathStage[];
};

const researchRules = [{ types: ["Research"] }] as const;
const competitionRules = [{ categories: ["Competitions"] }] as const;
const internshipRules = [{ categories: ["Internships", "Finance Internships", "Government Internships"] }] as const;

export const opportunityPaths = [
  {
    id: "quantitative-data",
    name: "Quantitative Finance & Data",
    shortName: "Quant & Data",
    description: "Explore modeling, data, research, finance programs, and quantitative internships.",
    profileAliases: ["Quantitative Finance", "Quantitative Trading", "Data Science", "Statistics", "Applied Mathematics"],
    relatedPathIds: ["software-cybersecurity", "finance-business", "research-graduate-study"],
    stages: [
      { id: "model", name: "Model and compete", description: "Competitions and applied programs where quantitative work becomes visible.", experienceTypes: ["Modeling competitions", "Data challenges", "Technical training"], rules: [{ categories: ["Competitions", "Technical Training"], tags: ["Modeling", "Data Science", "AI", "Analytics"] }], discoverHref: "/opportunities?category=Competitions" },
      { id: "research", name: "Research and analysis", description: "Structured research that uses mathematics, statistics, computing, or data analysis.", experienceTypes: ["Undergraduate research", "National-lab research", "Research grants"], rules: [{ ...researchRules[0], majors: ["Mathematics", "Applied Mathematics", "Statistics", "Data Science", "Computer Science", "Economics"] }], discoverHref: "/opportunities?type=Research&major=Data%20Science" },
      { id: "exposure", name: "Industry exposure", description: "Programs that introduce finance, markets, consulting, or analytical work.", experienceTypes: ["Early insight programs", "Career preparation", "Finance programs"], rules: [{ categories: ["Career Resources", "Certifications"], careerPaths: ["Consulting", "Finance", "Business"] }], discoverHref: "/opportunities?type=Career&category=Career%20Resources" },
      { id: "intern", name: "Quantitative internships", description: "Internships where data, markets, modeling, or analytical work is central.", experienceTypes: ["Finance internships", "Data internships", "Analytical roles"], rules: [{ ...internshipRules[0], careerPaths: ["Investment Banking", "Asset Management", "Financial Technology", "Data and Analytics", "Data Analysis"] }], discoverHref: "/opportunities?type=Career&category=Internships&major=Mathematics" },
      { id: "support", name: "Funding and support", description: "Scholarships and fellowships that support quantitative or technical study.", experienceTypes: ["STEM scholarships", "Research grants", "Graduate fellowships"], rules: [{ types: ["Scholarship"], majors: ["Mathematics", "Statistics", "Data Science", "Computer Science", "Finance", "Economics"] }], discoverHref: "/opportunities?type=Scholarship&major=Mathematics" },
    ],
  },
  {
    id: "software-cybersecurity",
    name: "Software Engineering & Cybersecurity",
    shortName: "Software & Cybersecurity",
    description: "Explore technical competitions, training, research, internships, and funding.",
    profileAliases: ["Software Engineering", "Computer Science", "Cybersecurity", "Information Technology", "Technology"],
    relatedPathIds: ["quantitative-data", "research-graduate-study"],
    stages: [
      { id: "practice", name: "Practice and compete", description: "Programs where you can apply technical skills before an internship.", experienceTypes: ["Cybersecurity competitions", "Hackathons", "Technical training"], rules: [{ categories: ["Competitions", "Cybersecurity Training", "Technical Training"], majors: ["Computer Science", "Software Engineering", "Cybersecurity", "Information Technology"] }], discoverHref: "/opportunities?category=Competitions&major=Computer%20Science" },
      { id: "research", name: "Technical research", description: "Research experiences involving software, computation, security, or engineering.", experienceTypes: ["Computational research", "National-lab research", "Research internships"], rules: [{ ...researchRules[0], majors: ["Computer Science", "Software Engineering", "Cybersecurity", "Computer Engineering", "Data Science"] }], discoverHref: "/opportunities?type=Research&major=Computer%20Science" },
      { id: "experience", name: "Industry experience", description: "Internships and co-ops that put technical work into a professional setting.", experienceTypes: ["Software internships", "Cybersecurity roles", "Technical co-ops"], rules: [{ categories: ["Internships", "Government Internships"], majors: ["Computer Science", "Software Engineering", "Cybersecurity", "Computer Engineering", "Information Technology"] }], discoverHref: "/opportunities?type=Career&category=Internships&major=Computer%20Science" },
      { id: "support", name: "Funding and programs", description: "Scholarships and structured programs for technical study and experience.", experienceTypes: ["STEM scholarships", "Technical fellowships", "Career programs"], rules: [{ types: ["Scholarship"], majors: ["Computer Science", "Software Engineering", "Cybersecurity", "Computer Engineering"] }, { categories: ["Career Resources", "Certifications"], careerPaths: ["Technology"] }], discoverHref: "/opportunities?type=Scholarship&major=Computer%20Science" },
    ],
  },
  {
    id: "research-graduate-study",
    name: "Research & Graduate Study",
    shortName: "Research",
    description: "Explore research experiences, grants, national laboratories, and graduate fellowships.",
    profileAliases: ["Academic Research", "Research", "Graduate School", "Academia", "Natural Sciences"],
    relatedPathIds: ["quantitative-data", "software-cybersecurity", "public-policy-service"],
    stages: [
      { id: "begin", name: "Begin research", description: "Programs that introduce research practice, collaboration, and scientific communication.", experienceTypes: ["Undergraduate research", "Faculty projects", "Research internships"], rules: researchRules, discoverHref: "/opportunities?type=Research" },
      { id: "labs", name: "National laboratories", description: "Research and technical programs hosted by public laboratories and agencies.", experienceTypes: ["National-lab internships", "Government research", "Technical traineeships"], rules: [{ types: ["Research"], categories: ["Government & National Labs", "National Laboratory Research"] }], discoverHref: "/opportunities?type=Research&query=national%20laboratory", mappingPriority: 30 },
      { id: "international", name: "International research", description: "Research programs that add cross-institutional or international experience.", experienceTypes: ["Visiting research", "International internships", "Independent investigation"], rules: [{ types: ["Research"], tags: ["International"] }], discoverHref: "/opportunities?type=Research&query=international", mappingPriority: 20 },
      { id: "fund", name: "Fund and continue", description: "Grants and fellowships that support research or further study.", experienceTypes: ["Research grants", "Graduate fellowships", "Funded study"], rules: [{ categories: ["Research Grants", "Fellowships", "Graduate Fellowships"] }, { types: ["Scholarship"], careerPaths: ["Research", "Graduate School"] }], discoverHref: "/opportunities?category=Fellowships" },
    ],
  },
  {
    id: "public-policy-service",
    name: "Public Policy & Service",
    shortName: "Policy & Service",
    description: "Explore policy research, government internships, public service, and international programs.",
    profileAliases: ["Public Policy", "Law", "Government", "Public Service", "International Relations"],
    relatedPathIds: ["research-graduate-study", "journalism-public-humanities", "finance-business"],
    stages: [
      { id: "explore", name: "Explore public service", description: "Programs that introduce government, service, and public institutions.", experienceTypes: ["Public-service programs", "Leadership programs", "International study"], rules: [{ categories: ["Leadership Programs", "Public Service"] }, { types: ["Scholarship"], careerPaths: ["Public Service", "International Relations"] }], discoverHref: "/opportunities?query=public%20service" },
      { id: "analyze", name: "Policy research and analysis", description: "Opportunities centered on research, writing, economics, and public problems.", experienceTypes: ["Policy research", "Think-tank internships", "Science policy"], rules: [{ categories: ["Public Policy"], careerPaths: ["Public Policy", "Government", "Economics", "Environmental Policy"] }], discoverHref: "/opportunities?type=Career&category=Public%20Policy" },
      { id: "government", name: "Government experience", description: "Internships with public agencies, legislatures, and international institutions.", experienceTypes: ["Government internships", "Congressional programs", "International affairs"], rules: [{ categories: ["Government Internships", "Public Service"], careerPaths: ["Government", "Public Policy", "Foreign Service", "International Relations"] }], discoverHref: "/opportunities?type=Career&query=government", mappingPriority: 20 },
      { id: "fellowships", name: "Fellowships and service", description: "Longer-form programs that support service, leadership, or international work.", experienceTypes: ["Public-service fellowships", "National service", "International fellowships"], rules: [{ categories: ["Fellowships", "Leadership Programs"], careerPaths: ["Public Service", "Government", "International Affairs", "Leadership"] }], discoverHref: "/opportunities?category=Fellowships&query=public%20service" },
    ],
  },
  {
    id: "finance-business",
    name: "Finance & Business",
    shortName: "Finance & Business",
    description: "Explore finance programs, analytical experience, internships, and business scholarships.",
    profileAliases: ["Investment Banking", "Finance", "Business", "Consulting", "Accounting", "Economics"],
    relatedPathIds: ["quantitative-data", "public-policy-service"],
    stages: [
      { id: "prepare", name: "Build professional foundations", description: "Career programs that develop communication, interviewing, and professional context.", experienceTypes: ["Career preparation", "Business certificates", "Early insight programs"], rules: [{ categories: ["Career Resources", "Certifications"], careerPaths: ["Business", "Consulting"] }], discoverHref: "/opportunities?type=Career&category=Career%20Resources" },
      { id: "analyze", name: "Develop analytical experience", description: "Competitions and research that build modeling, economics, or analytical evidence.", experienceTypes: ["Modeling competitions", "Economics research", "Finance projects"], rules: [{ ...competitionRules[0], majors: ["Economics", "Finance", "Accounting", "Business", "Mathematics", "Statistics"] }, { types: ["Research"], majors: ["Economics", "Finance", "Accounting", "Business", "Mathematics", "Statistics"] }], discoverHref: "/opportunities?category=Competitions&major=Economics" },
      { id: "intern", name: "Finance and business internships", description: "Professional experience in finance, markets, consulting, or business operations.", experienceTypes: ["Finance internships", "Business internships", "Consulting programs"], rules: [{ categories: ["Finance Internships", "Internships"], careerPaths: ["Investment Banking", "Asset Management", "Finance", "Business", "Consulting", "Development Finance"] }], discoverHref: "/opportunities?type=Career&category=Internships&major=Finance" },
      { id: "support", name: "Scholarships and fellowships", description: "Funding and programs connected to business, finance, economics, or leadership.", experienceTypes: ["Business scholarships", "Finance scholarships", "Leadership fellowships"], rules: [{ types: ["Scholarship"], majors: ["Finance", "Accounting", "Business", "Economics"] }, { categories: ["Fellowships"], careerPaths: ["Business", "Leadership"] }], discoverHref: "/opportunities?type=Scholarship&major=Finance" },
    ],
  },
  {
    id: "journalism-public-humanities",
    name: "Journalism & Public Humanities",
    shortName: "Journalism & Humanities",
    description: "Explore writing, archives, museums, public programs, and media-related internships.",
    profileAliases: ["Journalism", "Communications", "Media", "Humanities", "Publishing", "Museums"],
    relatedPathIds: ["public-policy-service", "research-graduate-study"],
    stages: [
      { id: "research", name: "Research and archives", description: "Experiences centered on source material, archives, history, and public records.", experienceTypes: ["Archival research", "Digital humanities", "Library programs"], rules: [{ categories: ["Museums & Archives", "Education & Libraries"], careerPaths: ["Archives", "Libraries", "Public History", "Publishing"] }], discoverHref: "/opportunities?query=archives" },
      { id: "public", name: "Museums and public humanities", description: "Programs that translate culture, history, art, and research for public audiences.", experienceTypes: ["Museum internships", "Public programming", "Cultural heritage"], rules: [{ categories: ["Museums & Archives", "Museums & Arts"], careerPaths: ["Museums", "Public Humanities", "Cultural Heritage", "Arts Administration"] }], discoverHref: "/opportunities?query=museum", mappingPriority: 20 },
      { id: "write", name: "Writing and public communication", description: "Internships where writing, reporting, communications, or public affairs is central.", experienceTypes: ["Journalism internships", "Communications roles", "Policy writing"], rules: [{ categories: ["Public Policy", "Internships"], majors: ["Journalism", "Communications", "English"], careerPaths: ["Communications", "Journalism", "Publishing"] }], discoverHref: "/opportunities?type=Career&major=Journalism" },
      { id: "fellowships", name: "Fellowships and funded programs", description: "Programs that support independent projects, international work, or further study.", experienceTypes: ["Journalism fellowships", "Humanities fellowships", "International programs"], rules: [{ categories: ["Fellowships"], majors: ["Journalism", "Communications", "English", "History", "Fine Arts"] }], discoverHref: "/opportunities?category=Fellowships&major=Journalism" },
    ],
  },
] as const satisfies readonly OpportunityPathDefinition[];

export type OpportunityPathId = (typeof opportunityPaths)[number]["id"];

export const opportunityPathIds = opportunityPaths.map((path) => path.id) as OpportunityPathId[];

export function getOpportunityPath(pathId: string) {
  return opportunityPaths.find((path) => path.id === pathId);
}

export type FollowedOpportunityPath = {
  pathId: OpportunityPathId;
  followedAt: string;
  updatedAt: string;
  version: number;
};

export type OpportunityPathPreferences = Record<string, FollowedOpportunityPath>;

export function normalizeOpportunityPathPreferences(value: OpportunityPathPreferences | null | undefined): OpportunityPathPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: OpportunityPathPreferences = {};
  for (const [pathId, record] of Object.entries(value).slice(0, opportunityPathIds.length)) {
    if (!opportunityPathIds.includes(pathId as OpportunityPathId) || !record || record.pathId !== pathId) continue;
    if (!Number.isFinite(Date.parse(record.followedAt)) || !Number.isFinite(Date.parse(record.updatedAt))) continue;
    result[pathId] = {
      pathId: pathId as OpportunityPathId,
      followedAt: new Date(record.followedAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
      version: Number.isInteger(record.version) && record.version >= 0 ? record.version : 0,
    };
  }
  return result;
}
