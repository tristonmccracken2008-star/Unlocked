import type { OpportunityType } from "./opportunities";

export const opportunityExplorerVersion = 1 as const;

export type ExplorerRule = {
  types?: readonly OpportunityType[];
  categories?: readonly string[];
  majors?: readonly string[];
  tags?: readonly string[];
  careerPaths?: readonly string[];
  terms?: readonly string[];
};

export type ExplorerLandscapeDefinition = {
  id: string;
  name: string;
  description: string;
  rules: readonly ExplorerRule[];
  discoverHref: string;
};

export type ExplorerAreaDefinition = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  aliases: readonly string[];
  adjacentAreaIds: readonly string[];
  pathId?: string;
  landscapes: readonly ExplorerLandscapeDefinition[];
};

export type ExplorerExperienceDefinition = {
  id: string;
  name: string;
  description: string;
  rules: readonly ExplorerRule[];
  discoverHref: string;
};

const internship = [{ categories: ["Internships", "Finance Internships", "Government Internships"] }] as const;
const research = [{ types: ["Research"] }] as const;
const scholarship = [{ types: ["Scholarship"] }] as const;

export const explorerAreas: readonly ExplorerAreaDefinition[] = [
  {
    id: "computer-science", name: "Computer Science", shortName: "Computing", description: "Software, security, data, research, and technical programs.",
    aliases: ["Computer Science", "Software Engineering", "Information Systems", "Information Technology", "AI", "Machine Learning", "Data Science"],
    adjacentAreaIds: ["mathematics-data", "engineering", "public-policy-service", "business-finance"], pathId: "software-cybersecurity",
    landscapes: [
      { id: "software", name: "Software engineering", description: "Internships and programs centered on building software and technical systems.", rules: [{ ...internship[0], majors: ["Computer Science", "Software Engineering", "Computer Engineering"] }], discoverHref: "/opportunities?type=Career&category=Internships&major=Computer%20Science" },
      { id: "cybersecurity", name: "Cybersecurity", description: "Competitions, government programs, internships, and training involving security.", rules: [{ majors: ["Cybersecurity"] }, { terms: ["cybersecurity", "cyber security", "digital forensics", "cryptography"] }], discoverHref: "/opportunities?major=Cybersecurity" },
      { id: "ai-data", name: "AI & data", description: "Research, challenges, and programs using data, statistics, or machine learning.", rules: [{ majors: ["Data Science", "Statistics", "Machine Learning"] }, { tags: ["AI", "Data Science", "Analytics"] }], discoverHref: "/opportunities?major=Data%20Science" },
      { id: "technical-research", name: "Technical research", description: "Work with universities, agencies, and laboratories on computing questions.", rules: [{ ...research[0], majors: ["Computer Science", "Data Science", "Computer Engineering"] }], discoverHref: "/opportunities?type=Research&major=Computer%20Science" },
      { id: "technical-competitions", name: "Competitions", description: "Team and individual challenges where technical work becomes visible.", rules: [{ categories: ["Competitions", "Hackathons"], majors: ["Computer Science", "Data Science", "Cybersecurity", "Any Major"] }], discoverHref: "/opportunities?category=Competitions" },
      { id: "government-technology", name: "Government technology", description: "Technical work in public agencies, national laboratories, and civic institutions.", rules: [{ categories: ["Government & National Labs", "Government Internships", "National Laboratory Research"], majors: ["Computer Science", "Data Science", "Engineering", "Any Major"] }], discoverHref: "/opportunities?category=Government%20%26%20National%20Labs" },
    ],
  },
  {
    id: "mathematics-data", name: "Mathematics & Data", shortName: "Math & Data", description: "Research, modeling, competitions, data, and quantitative programs.",
    aliases: ["Mathematics", "Applied Mathematics", "Statistics", "Actuarial Science", "Data Science", "Quantitative Finance", "Quantitative Trading"],
    adjacentAreaIds: ["computer-science", "business-finance", "research-science", "public-policy-service"], pathId: "quantitative-data",
    landscapes: [
      { id: "mathematics-research", name: "Research", description: "Programs where mathematics, statistics, or modeling support investigation.", rules: [{ ...research[0], majors: ["Mathematics", "Applied Mathematics", "Statistics", "Data Science"] }], discoverHref: "/opportunities?type=Research&major=Mathematics" },
      { id: "modeling-competitions", name: "Competitions", description: "Modeling and data challenges that turn quantitative work into evidence.", rules: [{ categories: ["Competitions"], terms: ["mathematical", "modeling", "data", "cyber"] }], discoverHref: "/opportunities?category=Competitions" },
      { id: "quantitative-finance", name: "Quantitative finance", description: "Programs connecting mathematics, data, markets, and financial analysis.", rules: [{ categories: ["Finance Internships"] }, { careerPaths: ["Quantitative Finance", "Finance", "Financial Technology", "Investment Banking", "Asset Management"] }], discoverHref: "/opportunities?category=Finance%20Internships&major=Mathematics" },
      { id: "data-computing", name: "Data & computing", description: "Technical programs where quantitative reasoning supports computing and analysis.", rules: [{ majors: ["Data Science", "Statistics", "Mathematics"], tags: ["Data Science", "Analytics", "AI"] }], discoverHref: "/opportunities?major=Data%20Science" },
      { id: "math-support", name: "Scholarships & support", description: "Funding for students studying mathematics, statistics, data, or related fields.", rules: [{ ...scholarship[0], majors: ["Mathematics", "Statistics", "Data Science", "Any Major"] }], discoverHref: "/opportunities?type=Scholarship&major=Mathematics" },
    ],
  },
  {
    id: "engineering", name: "Engineering", shortName: "Engineering", description: "Technical research, laboratories, competitions, internships, and funding.",
    aliases: ["Engineering", "Mechanical Engineering", "Electrical Engineering", "Civil Engineering", "Chemical Engineering", "Aerospace Engineering", "Biomedical Engineering", "Computer Engineering"],
    adjacentAreaIds: ["computer-science", "mathematics-data", "research-science"],
    landscapes: [
      { id: "engineering-research", name: "Research & laboratories", description: "University, agency, and national-laboratory work in applied science and engineering.", rules: [{ ...research[0], majors: ["Engineering", "Mechanical Engineering", "Electrical Engineering", "Computer Engineering", "Any Major"] }], discoverHref: "/opportunities?type=Research&major=Engineering" },
      { id: "engineering-internships", name: "Internships", description: "Professional programs where students contribute to technical projects.", rules: [{ ...internship[0], majors: ["Engineering", "Mechanical Engineering", "Electrical Engineering", "Computer Engineering", "Any Major"] }], discoverHref: "/opportunities?type=Career&category=Internships&major=Engineering" },
      { id: "national-labs", name: "National laboratories", description: "Research and technical programs inside national scientific institutions.", rules: [{ categories: ["Government & National Labs", "National Laboratory Research"] }], discoverHref: "/opportunities?category=Government%20%26%20National%20Labs" },
      { id: "engineering-competitions", name: "Competitions", description: "Build, model, test, and present work through structured challenges.", rules: [{ categories: ["Competitions", "Hackathons"], majors: ["Engineering", "Computer Science", "Any Major"] }], discoverHref: "/opportunities?category=Competitions&major=Engineering" },
      { id: "engineering-funding", name: "Scholarships", description: "Funding tied to technical study, public service, or future research.", rules: [{ ...scholarship[0], majors: ["Engineering", "Computer Science", "Mathematics", "Any Major"] }], discoverHref: "/opportunities?type=Scholarship&major=Engineering" },
    ],
  },
  {
    id: "research-science", name: "Research & Science", shortName: "Research", description: "Faculty, laboratory, field, and funded research experiences.",
    aliases: ["Research", "Graduate School", "Biology", "Chemistry", "Physics", "Environmental Science", "Natural Sciences", "Pre-med"],
    adjacentAreaIds: ["engineering", "mathematics-data", "public-policy-service", "humanities-communication"], pathId: "research-graduate-study",
    landscapes: [
      { id: "undergraduate-research", name: "Undergraduate research", description: "Structured research with faculty, universities, and research institutions.", rules: research, discoverHref: "/opportunities?type=Research" },
      { id: "laboratory-programs", name: "Laboratory programs", description: "Scientific work in national laboratories and specialized research centers.", rules: [{ categories: ["National Laboratory Research", "Government & National Labs"] }], discoverHref: "/opportunities?category=National%20Laboratory%20Research" },
      { id: "research-grants", name: "Research grants", description: "Funding that supports a student-led project, fieldwork, or investigation.", rules: [{ categories: ["Research Grants", "Grants"] }], discoverHref: "/opportunities?category=Research%20Grants" },
      { id: "science-internships", name: "Science internships", description: "Applied work with agencies, museums, laboratories, and scientific organizations.", rules: [{ ...internship[0], majors: ["Biology", "Chemistry", "Physics", "Environmental Science", "Natural Sciences", "Any Major"] }], discoverHref: "/opportunities?category=Internships&major=Biology" },
      { id: "science-communication", name: "Science communication", description: "Programs that connect research with education, writing, or public audiences.", rules: [{ careerPaths: ["Science Communication", "Education", "Museums"] }], discoverHref: "/opportunities?query=Science%20Communication" },
    ],
  },
  {
    id: "business-finance", name: "Business, Finance & Economics", shortName: "Business & Finance", description: "Finance, analysis, leadership, early insight, and professional programs.",
    aliases: ["Business", "Finance", "Economics", "Accounting", "Marketing", "Consulting", "Investment Banking", "Entrepreneurship"],
    adjacentAreaIds: ["mathematics-data", "public-policy-service", "computer-science"], pathId: "finance-business",
    landscapes: [
      { id: "finance-internships", name: "Finance internships", description: "Programs in markets, banking, analysis, and financial institutions.", rules: [{ categories: ["Finance Internships"] }, { ...internship[0], majors: ["Finance", "Economics", "Business", "Accounting"] }], discoverHref: "/opportunities?category=Finance%20Internships" },
      { id: "early-insight", name: "Early insight programs", description: "Programs that introduce professional fields before traditional recruiting.", rules: [{ categories: ["Career Resources", "Freshman Programs", "Certifications"] }, { terms: ["career ready", "early insight", "discovery program"] }], discoverHref: "/opportunities?category=Career%20Resources" },
      { id: "economic-research", name: "Economic research", description: "Research and policy programs using economics, data, and analysis.", rules: [{ ...research[0], majors: ["Economics", "Finance", "Mathematics", "Statistics"] }, { careerPaths: ["Economic Policy", "Economics Research"] }], discoverHref: "/opportunities?type=Research&major=Economics" },
      { id: "business-leadership", name: "Leadership programs", description: "Structured programs focused on professional development and leadership practice.", rules: [{ categories: ["Leadership Programs", "Fellowships", "Career Resources"], majors: ["Business", "Economics", "Finance", "Any Major"] }], discoverHref: "/opportunities?category=Leadership%20Programs" },
      { id: "business-funding", name: "Scholarships", description: "Funding for business, finance, economics, or broadly eligible students.", rules: [{ ...scholarship[0], majors: ["Business", "Finance", "Economics", "Accounting", "Any Major"] }], discoverHref: "/opportunities?type=Scholarship&major=Business" },
    ],
  },
  {
    id: "public-policy-service", name: "Public Policy & Service", shortName: "Policy & Service", description: "Government, policy, public-service, international, and civic programs.",
    aliases: ["Public Policy", "Political Science", "Government", "Public Service", "International Relations", "Law", "Nonprofit"],
    adjacentAreaIds: ["humanities-communication", "business-finance", "computer-science", "research-science"], pathId: "public-policy-service",
    landscapes: [
      { id: "government-programs", name: "Government programs", description: "Internships and structured programs within public agencies and institutions.", rules: [{ categories: ["Government Internships", "Government & National Labs", "Public Service"] }], discoverHref: "/opportunities?category=Government%20Internships" },
      { id: "policy-research", name: "Policy research", description: "Programs involving public questions, writing, evidence, and analysis.", rules: [{ categories: ["Public Policy"] }, { careerPaths: ["Public Policy", "Economic Policy", "Policy Research"] }], discoverHref: "/opportunities?category=Public%20Policy" },
      { id: "public-service", name: "Public service", description: "Experiences that support communities, public institutions, and civic work.", rules: [{ categories: ["Public Service"] }, { careerPaths: ["Public Service", "Government"] }], discoverHref: "/opportunities?category=Public%20Service" },
      { id: "policy-fellowships", name: "Fellowships", description: "Structured programs that may combine service, study, funding, or professional experience.", rules: [{ categories: ["Fellowships", "Graduate Fellowships"], careerPaths: ["Public Policy", "Government", "Public Service", "International Affairs"] }], discoverHref: "/opportunities?category=Fellowships" },
      { id: "international-programs", name: "International programs", description: "Programs involving international institutions, study, policy, or cross-cultural work.", rules: [{ categories: ["Study Abroad", "Study Abroad Scholarships"] }, { careerPaths: ["International Affairs", "Foreign Service", "International Relations"] }], discoverHref: "/opportunities?category=Study%20Abroad" },
    ],
  },
  {
    id: "humanities-communication", name: "Humanities, Writing & Culture", shortName: "Humanities & Writing", description: "Writing, archives, museums, research, communications, and public work.",
    aliases: ["English", "History", "Humanities", "Writing", "Journalism", "Communications", "Philosophy", "Museums", "Archives", "Fine Arts"],
    adjacentAreaIds: ["public-policy-service", "research-science", "business-finance"], pathId: "journalism-public-humanities",
    landscapes: [
      { id: "museums-archives", name: "Museums & archives", description: "Research, collections, education, and public programs in cultural institutions.", rules: [{ categories: ["Museums & Archives", "Museums & Arts", "Education & Libraries"] }, { careerPaths: ["Museums", "Archives", "Public History", "Cultural Heritage"] }], discoverHref: "/opportunities?category=Museums%20%26%20Archives" },
      { id: "writing-communications", name: "Writing & communications", description: "Programs where writing, editing, storytelling, or public communication is central.", rules: [{ majors: ["English", "Journalism", "Communications"] }, { careerPaths: ["Writing", "Journalism", "Communications", "Publishing"] }], discoverHref: "/opportunities?major=English" },
      { id: "humanities-research", name: "Humanities research", description: "Archival, cultural, historical, and interdisciplinary research programs.", rules: [{ ...research[0], majors: ["English", "History", "Humanities", "Fine Arts", "Any Major"] }], discoverHref: "/opportunities?type=Research&major=History" },
      { id: "cultural-public-service", name: "Public service & policy", description: "Apply research and communication skills in civic and policy settings.", rules: [{ categories: ["Public Service", "Public Policy"], majors: ["English", "History", "Communications", "Political Science", "Any Major"] }], discoverHref: "/opportunities?category=Public%20Service" },
      { id: "humanities-fellowships", name: "Fellowships", description: "Structured study, cultural, public-service, and professional programs.", rules: [{ categories: ["Fellowships", "Graduate Fellowships"], majors: ["English", "History", "Humanities", "Communications", "Any Major"] }], discoverHref: "/opportunities?category=Fellowships" },
    ],
  },
] as const;

export const explorerExperienceTypes: readonly ExplorerExperienceDefinition[] = [
  { id: "research", name: "Research", description: "Work with faculty, laboratories, agencies, or research institutions on a defined question.", rules: research, discoverHref: "/opportunities?type=Research" },
  { id: "internships", name: "Internships", description: "Time-bound professional experience with an organization or team.", rules: internship, discoverHref: "/opportunities?category=Internships" },
  { id: "scholarships", name: "Scholarships", description: "Funding for study, participation, projects, or other verified educational costs.", rules: scholarship, discoverHref: "/opportunities?type=Scholarship" },
  { id: "fellowships", name: "Fellowships", description: "Structured programs that may provide funding, study, research, service, or professional experience.", rules: [{ categories: ["Fellowships", "Graduate Fellowships"] }], discoverHref: "/opportunities?category=Fellowships" },
  { id: "competitions", name: "Competitions", description: "Structured challenges where students build, analyze, present, or compete.", rules: [{ categories: ["Competitions", "Hackathons"] }], discoverHref: "/opportunities?category=Competitions" },
  { id: "public-service", name: "Public Service", description: "Programs in government, policy, civic institutions, and community-serving organizations.", rules: [{ categories: ["Public Service", "Public Policy", "Government Internships"] }], discoverHref: "/opportunities?category=Public%20Service" },
  { id: "programs", name: "Summer & Professional Programs", description: "Cohort-based learning, training, leadership, and early professional exposure.", rules: [{ categories: ["Career Resources", "Certifications", "Leadership Programs", "Freshman Programs", "Technical Training", "Cybersecurity Training"] }], discoverHref: "/opportunities?category=Career%20Resources" },
] as const;

export function explorerAreaById(id: string) {
  return explorerAreas.find((area) => area.id === id);
}
