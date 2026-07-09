export type AcademicYear = "First year" | "Second year" | "Third year" | "Fourth year" | "Graduate student";

export type MajorPathway = {
  major: string;
  aliases: string[];
  commonCareerPaths: string[];
  freshmanPriorities: string[];
  sophomorePriorities: string[];
  juniorPriorities: string[];
  seniorPriorities: string[];
  bestOpportunityCategories: string[];
  keySkillsToBuild: string[];
  commonMistakesToAvoid: string[];
};

export type AdvisorInsight = {
  pathway: MajorPathway;
  academicYear: AcademicYear;
  priority: string;
  whyThisMatters: string;
  bestOpportunityCategories: string[];
  keySkillsToBuild: string[];
};

const generalPathway: MajorPathway = {
  major: "General College Success",
  aliases: ["undecided", "exploratory", "undeclared", "general studies"],
  commonCareerPaths: ["Internships", "Research", "Campus leadership", "Graduate school", "Early career roles"],
  freshmanPriorities: ["learn what opportunities exist, build study systems, and apply to beginner-friendly programs"],
  sophomorePriorities: ["choose a direction, build one strong project or experience, and start meeting advisors and alumni"],
  juniorPriorities: ["apply for internships, research roles, leadership programs, and funded summer opportunities"],
  seniorPriorities: ["convert experience into applications, recommendations, interviews, and post-graduation plans"],
  bestOpportunityCategories: ["Career Resources", "Campus Jobs", "Student Organizations", "Scholarships", "Internships"],
  keySkillsToBuild: ["Clear writing", "Networking", "Time management", "Interviewing", "Project follow-through"],
  commonMistakesToAvoid: ["waiting until junior year to look for opportunities", "only applying to famous programs", "missing campus resources", "not asking for help early"],
};

export const majorPathways: MajorPathway[] = [
  {
    major: "Computer Science",
    aliases: ["cs", "software engineering", "computer engineering", "computing"],
    commonCareerPaths: ["Software engineer", "Product engineer", "AI engineer", "Cybersecurity analyst", "Technical founder"],
    freshmanPriorities: ["build small projects, learn Git, and apply to freshman-friendly programs"],
    sophomorePriorities: ["ship portfolio projects, practice technical interviews, and look for first internships or research roles"],
    juniorPriorities: ["apply early for internships, strengthen systems knowledge, and show proof of impact"],
    seniorPriorities: ["convert internships and projects into full-time applications, referrals, and interview loops"],
    bestOpportunityCategories: ["Internships", "AI Tools", "Hackathons", "Research", "Certifications"],
    keySkillsToBuild: ["Programming fundamentals", "Data structures", "Git", "Debugging", "Technical communication"],
    commonMistakesToAvoid: ["only watching tutorials", "waiting too long to build projects", "ignoring communication skills", "applying without a clear portfolio"],
  },
  {
    major: "Mathematics",
    aliases: ["math", "applied mathematics", "statistics", "actuarial science"],
    commonCareerPaths: ["Data analyst", "Quantitative analyst", "Actuary", "Research assistant", "Teacher"],
    freshmanPriorities: ["strengthen proof skills, start coding, and explore applied math paths"],
    sophomorePriorities: ["add statistics or programming experience and look for research or tutoring roles"],
    juniorPriorities: ["apply for internships, REUs, actuarial programs, or analytics roles"],
    seniorPriorities: ["turn coursework and projects into a focused story for jobs or graduate programs"],
    bestOpportunityCategories: ["Research", "Internships", "Fellowships", "Certifications", "Career Resources"],
    keySkillsToBuild: ["Proof writing", "Python or R", "Statistics", "Modeling", "Clear explanations"],
    commonMistakesToAvoid: ["staying too theoretical without applied proof", "underusing faculty office hours", "missing summer research deadlines", "not learning a programming language"],
  },
  {
    major: "Economics",
    aliases: ["econ", "economic studies", "political economy"],
    commonCareerPaths: ["Analyst", "Consultant", "Policy researcher", "Finance associate", "Research assistant"],
    freshmanPriorities: ["learn spreadsheet basics, follow markets and policy, and join economics or consulting groups"],
    sophomorePriorities: ["build data analysis projects and seek research assistant or business roles"],
    juniorPriorities: ["apply for consulting, finance, policy, or analytics internships before deadlines close"],
    seniorPriorities: ["package writing, data, and internship experience into a clear job or graduate school plan"],
    bestOpportunityCategories: ["Internships", "Research", "Career Resources", "Competitions", "Conferences"],
    keySkillsToBuild: ["Excel", "Data analysis", "Writing", "Statistics", "Presentation"],
    commonMistakesToAvoid: ["treating economics as only coursework", "waiting to learn data tools", "missing early finance and consulting timelines", "not building writing samples"],
  },
  {
    major: "Finance",
    aliases: ["financial economics", "accounting", "investment", "business finance"],
    commonCareerPaths: ["Financial analyst", "Investment banking analyst", "Wealth management associate", "Corporate finance analyst", "Consultant"],
    freshmanPriorities: ["learn finance basics, join career clubs, and build a simple resume early"],
    sophomorePriorities: ["network with alumni, practice interviews, and apply to sophomore programs"],
    juniorPriorities: ["apply early for internships and keep a disciplined networking schedule"],
    seniorPriorities: ["convert internship, club, and project experience into full-time finance roles"],
    bestOpportunityCategories: ["Internships", "Career Resources", "Competitions", "Leadership Programs", "Certifications"],
    keySkillsToBuild: ["Excel", "Financial modeling", "Networking", "Interviewing", "Market awareness"],
    commonMistakesToAvoid: ["starting recruiting too late", "sending generic outreach", "ignoring smaller firms", "not practicing technical questions"],
  },
  {
    major: "Biology / Pre-Med",
    aliases: ["biology", "pre-med", "premed", "biochemistry", "neuroscience", "public health"],
    commonCareerPaths: ["Physician", "Clinical researcher", "Lab assistant", "Public health analyst", "Biotech associate"],
    freshmanPriorities: ["protect your GPA, find clinical exposure, and explore research or service opportunities"],
    sophomorePriorities: ["build consistent clinical, research, or volunteer experience while planning prerequisites"],
    juniorPriorities: ["prepare for exams, request recommendations, and apply for research or clinical programs"],
    seniorPriorities: ["finish applications, document experience clearly, and keep backup plans active"],
    bestOpportunityCategories: ["Research", "Campus Jobs", "Fellowships", "Scholarships", "Student Organizations"],
    keySkillsToBuild: ["Scientific writing", "Lab technique", "Patient communication", "Study systems", "Data literacy"],
    commonMistakesToAvoid: ["overloading science courses", "chasing too many activities", "starting clinical exposure late", "not tracking hours and reflections"],
  },
  {
    major: "Engineering",
    aliases: ["mechanical engineering", "electrical engineering", "civil engineering", "chemical engineering", "aerospace engineering", "biomedical engineering", "industrial engineering"],
    commonCareerPaths: ["Design engineer", "Manufacturing engineer", "Systems engineer", "Product engineer", "Research engineer"],
    freshmanPriorities: ["join a build team, learn CAD or coding basics, and look for hands-on projects"],
    sophomorePriorities: ["turn class skills into projects and apply for co-ops, labs, or technical internships"],
    juniorPriorities: ["apply early for internships, document project impact, and build technical interview confidence"],
    seniorPriorities: ["target full-time roles, licensure steps if relevant, and project stories with measurable outcomes"],
    bestOpportunityCategories: ["Co-ops", "Internships", "Research", "Competitions", "Certifications"],
    keySkillsToBuild: ["Problem solving", "CAD or simulation tools", "Technical writing", "Teamwork", "Project documentation"],
    commonMistakesToAvoid: ["only relying on coursework", "not joining hands-on teams", "weak project documentation", "missing co-op deadlines"],
  },
  {
    major: "Business",
    aliases: ["management", "entrepreneurship", "marketing", "supply chain", "information systems", "operations"],
    commonCareerPaths: ["Business analyst", "Marketing associate", "Operations analyst", "Founder", "Consultant"],
    freshmanPriorities: ["explore business functions, join one serious organization, and build communication habits"],
    sophomorePriorities: ["lead a project, learn analytics basics, and apply for internships or competitions"],
    juniorPriorities: ["apply for internships with a clear function, industry, and proof of ownership"],
    seniorPriorities: ["translate leadership, internships, and class projects into role-specific applications"],
    bestOpportunityCategories: ["Internships", "Leadership Programs", "Competitions", "Career Resources", "Student Organizations"],
    keySkillsToBuild: ["Communication", "Analytics", "Presentation", "Project ownership", "Customer thinking"],
    commonMistakesToAvoid: ["being too vague about goals", "joining too many clubs without impact", "ignoring analytics", "not tailoring resumes"],
  },
  {
    major: "Psychology",
    aliases: ["psych", "behavioral science", "cognitive science", "neuroscience"],
    commonCareerPaths: ["Research assistant", "Clinical support", "Human resources", "UX researcher", "Counseling or graduate study"],
    freshmanPriorities: ["learn research methods, explore helping professions, and look for campus service roles"],
    sophomorePriorities: ["join a lab, volunteer consistently, or build experience with people-focused work"],
    juniorPriorities: ["apply for research, clinical, HR, or UX-related internships and prepare graduate school materials if needed"],
    seniorPriorities: ["clarify whether you need graduate school and organize experience into a coherent path"],
    bestOpportunityCategories: ["Research", "Campus Jobs", "Internships", "Fellowships", "Student Organizations"],
    keySkillsToBuild: ["Research methods", "Writing", "Listening", "Statistics", "Ethical judgment"],
    commonMistakesToAvoid: ["assuming one path fits all psychology careers", "waiting to get research experience", "not learning statistics", "missing graduate school prerequisites"],
  },
  {
    major: "Data Science",
    aliases: ["analytics", "data analytics", "machine learning", "statistics", "ai"],
    commonCareerPaths: ["Data analyst", "Data scientist", "Machine learning engineer", "Business intelligence analyst", "Research analyst"],
    freshmanPriorities: ["learn Python, build simple dataset projects, and practice explaining findings"],
    sophomorePriorities: ["create portfolio projects and look for research, analytics, or campus data roles"],
    juniorPriorities: ["apply for data internships and show projects with clean methods and business context"],
    seniorPriorities: ["focus your portfolio, practice case interviews, and target roles by industry"],
    bestOpportunityCategories: ["Internships", "Research", "AI Tools", "Certifications", "Competitions"],
    keySkillsToBuild: ["Python", "SQL", "Statistics", "Visualization", "Model evaluation"],
    commonMistakesToAvoid: ["skipping statistics", "showing notebooks without explanation", "using messy data without context", "overclaiming AI skills"],
  },
  {
    major: "Political Science",
    aliases: ["government", "public policy", "international relations", "pre-law", "legal studies"],
    commonCareerPaths: ["Policy analyst", "Campaign staffer", "Legislative aide", "Law school", "Nonprofit program associate"],
    freshmanPriorities: ["read widely, write often, and join civic, debate, policy, or service groups"],
    sophomorePriorities: ["seek office, campaign, nonprofit, or research experience and build writing samples"],
    juniorPriorities: ["apply for policy internships, fellowships, research roles, and pre-law opportunities"],
    seniorPriorities: ["prepare applications for jobs, fellowships, law school, or public service programs"],
    bestOpportunityCategories: ["Internships", "Fellowships", "Research", "Leadership Programs", "Conferences"],
    keySkillsToBuild: ["Writing", "Research", "Public speaking", "Policy analysis", "Relationship building"],
    commonMistakesToAvoid: ["only discussing politics without practical work", "not saving writing samples", "waiting to build references", "missing fellowship deadlines"],
  },
];

const pathways = [generalPathway, ...majorPathways];
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();

export function getMajorPathway(major: string) {
  const normalized = normalize(major);
  if (!normalized) return generalPathway;
  return majorPathways.find((pathway) => {
    const terms = [pathway.major, ...pathway.aliases].map(normalize);
    return terms.some((term) => normalized === term || normalized.includes(term) || term.includes(normalized));
  }) ?? generalPathway;
}

function priorityForYear(pathway: MajorPathway, academicYear: string) {
  if (academicYear === "Second year") return pathway.sophomorePriorities[0];
  if (academicYear === "Third year") return pathway.juniorPriorities[0];
  if (academicYear === "Fourth year" || academicYear === "Graduate student") return pathway.seniorPriorities[0];
  return pathway.freshmanPriorities[0];
}

function normalizedAcademicYear(value: string): AcademicYear {
  if (value === "Second year" || value === "Third year" || value === "Fourth year" || value === "Graduate student") return value;
  return "First year";
}

export function getAdvisorInsight(profile: { major: string; year: string }): AdvisorInsight {
  const pathway = getMajorPathway(profile.major);
  const academicYear = normalizedAcademicYear(profile.year);
  const priority = priorityForYear(pathway, academicYear);
  return {
    pathway,
    academicYear,
    priority,
    whyThisMatters: `${pathway.major === generalPathway.major ? "Most students find better opportunities when they build direction early." : `${pathway.major} opportunities reward visible preparation.`} The strongest applications usually connect your year, skills, interests, and recent proof of effort.`,
    bestOpportunityCategories: pathway.bestOpportunityCategories.slice(0, 3),
    keySkillsToBuild: pathway.keySkillsToBuild.slice(0, 3),
  };
}

export const allMajorPathways = pathways;
