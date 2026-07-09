import type { AdvisorProfile, AdvisorTimelineStage } from "./advisor-engine";

export type RoadmapImportance = "Critical" | "High" | "Recommended" | "Optional";
export type RoadmapCompletionStatus = "not_started" | "in_progress" | "completed" | "skipped";
export type RoadmapSemester = "Fall" | "Spring" | "Summer" | "Anytime";

export type RoadmapMilestone = {
  id: string;
  major: string;
  title: string;
  description: string;
  recommendedYear: AdvisorTimelineStage;
  recommendedSemester: RoadmapSemester;
  importance: RoadmapImportance;
  estimatedEffort: "Light" | "Moderate" | "Focused" | "Intensive";
  estimatedCompletionTime: string;
  relatedOpportunityCategories: string[];
  requiredSkills: string[];
  recommendedBefore: string[];
  recommendedAfter: string[];
  completionStatus: RoadmapCompletionStatus;
};

export type RoadmapResult = {
  currentStage: AdvisorTimelineStage;
  milestones: RoadmapMilestone[];
  upcomingMilestones: RoadmapMilestone[];
  completedMilestones: RoadmapMilestone[];
  recommendedMilestone: RoadmapMilestone;
  opportunityPriorities: string[];
};

type MilestoneTemplate = Omit<RoadmapMilestone, "completionStatus">;

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();
const unique = <T,>(items: T[]) => [...new Set(items.filter(Boolean))];

const generalMilestones: MilestoneTemplate[] = [
  {
    id: "general-resume",
    major: "General",
    title: "Create your first resume",
    description: "Build a simple one-page resume so you are ready for campus jobs, scholarships, clubs, and early internships.",
    recommendedYear: "Freshman",
    recommendedSemester: "Fall",
    importance: "High",
    estimatedEffort: "Light",
    estimatedCompletionTime: "1-2 hours",
    relatedOpportunityCategories: ["Career Resources", "Campus Jobs", "Internships"],
    requiredSkills: ["Writing", "Organization"],
    recommendedBefore: ["career fairs", "internship applications", "club leadership applications"],
    recommendedAfter: ["choosing your school and major"],
  },
  {
    id: "general-career-fair",
    major: "General",
    title: "Attend one career or opportunity fair",
    description: "Go early, even if you are only exploring. It helps you learn what employers, labs, and campus programs expect.",
    recommendedYear: "Freshman",
    recommendedSemester: "Fall",
    importance: "Recommended",
    estimatedEffort: "Light",
    estimatedCompletionTime: "1 day",
    relatedOpportunityCategories: ["Career Resources", "Internships", "Student Organizations"],
    requiredSkills: ["Communication", "Preparation"],
    recommendedBefore: ["serious internship recruiting"],
    recommendedAfter: ["creating your first resume"],
  },
  {
    id: "general-first-experience",
    major: "General",
    title: "Get one meaningful first experience",
    description: "Choose one concrete experience: campus job, research assistant role, volunteer work, club project, or competition.",
    recommendedYear: "Sophomore",
    recommendedSemester: "Anytime",
    importance: "High",
    estimatedEffort: "Moderate",
    estimatedCompletionTime: "4-8 weeks",
    relatedOpportunityCategories: ["Campus Jobs", "Research", "Student Organizations", "Competitions"],
    requiredSkills: ["Follow-through", "Communication"],
    recommendedBefore: ["junior-year internship recruiting"],
    recommendedAfter: ["building a basic resume"],
  },
  {
    id: "general-internship-pipeline",
    major: "General",
    title: "Build an internship application pipeline",
    description: "Track roles, deadlines, referrals, and follow-ups so applications do not depend on memory.",
    recommendedYear: "Junior",
    recommendedSemester: "Fall",
    importance: "Critical",
    estimatedEffort: "Focused",
    estimatedCompletionTime: "2-4 weeks",
    relatedOpportunityCategories: ["Internships", "Career Resources", "Co-ops"],
    requiredSkills: ["Planning", "Interviewing"],
    recommendedBefore: ["peak recruiting deadlines"],
    recommendedAfter: ["one meaningful first experience"],
  },
  {
    id: "general-postgrad-plan",
    major: "General",
    title: "Choose your post-graduation plan",
    description: "Decide whether your next step is employment, graduate school, fellowship, service, or another bridge opportunity.",
    recommendedYear: "Senior",
    recommendedSemester: "Fall",
    importance: "Critical",
    estimatedEffort: "Focused",
    estimatedCompletionTime: "2-3 weeks",
    relatedOpportunityCategories: ["Career Resources", "Fellowships", "Graduate School"],
    requiredSkills: ["Decision-making", "Writing"],
    recommendedBefore: ["final semester applications"],
    recommendedAfter: ["internship or project experience"],
  },
];

const majorMilestones: Record<string, MilestoneTemplate[]> = {
  "computer science": [
    {
      id: "cs-first-project",
      major: "Computer Science",
      title: "Build your first technical project",
      description: "Create a small working project you can explain clearly. It becomes proof of effort before internships or research.",
      recommendedYear: "Freshman",
      recommendedSemester: "Fall",
      importance: "High",
      estimatedEffort: "Moderate",
      estimatedCompletionTime: "2-4 weeks",
      relatedOpportunityCategories: ["Internships", "Hackathons", "AI Tools"],
      requiredSkills: ["Programming fundamentals", "Git"],
      recommendedBefore: ["technical club applications", "freshman internship applications"],
      recommendedAfter: ["intro programming coursework"],
    },
    {
      id: "cs-technical-org",
      major: "Computer Science",
      title: "Join a technical organization",
      description: "Find a community where you can build, practice interviews, meet older students, and learn recruiting timelines.",
      recommendedYear: "Freshman",
      recommendedSemester: "Fall",
      importance: "Recommended",
      estimatedEffort: "Light",
      estimatedCompletionTime: "1-2 weeks",
      relatedOpportunityCategories: ["Student Organizations", "Competitions", "Hackathons"],
      requiredSkills: ["Participation"],
      recommendedBefore: ["hackathons", "project teams"],
      recommendedAfter: ["choosing a technical interest"],
    },
    {
      id: "cs-freshman-internships",
      major: "Computer Science",
      title: "Apply to freshman-friendly technical programs",
      description: "Many early programs close before students expect. A small project and resume make you ready to apply.",
      recommendedYear: "Freshman",
      recommendedSemester: "Spring",
      importance: "High",
      estimatedEffort: "Focused",
      estimatedCompletionTime: "2-3 weeks",
      relatedOpportunityCategories: ["Freshman Programs", "Internships", "Career Resources"],
      requiredSkills: ["Resume writing", "Basic coding"],
      recommendedBefore: ["summer applications"],
      recommendedAfter: ["building a first technical project"],
    },
    {
      id: "cs-interview-practice",
      major: "Computer Science",
      title: "Start technical interview practice",
      description: "Practice data structures and problem solving before internship recruiting becomes urgent.",
      recommendedYear: "Sophomore",
      recommendedSemester: "Spring",
      importance: "High",
      estimatedEffort: "Focused",
      estimatedCompletionTime: "6-10 weeks",
      relatedOpportunityCategories: ["Career Resources", "Internships", "Competitions"],
      requiredSkills: ["Data structures", "Problem solving"],
      recommendedBefore: ["junior internship recruiting"],
      recommendedAfter: ["shipping one or two projects"],
    },
  ],
  biology: [
    {
      id: "bio-volunteer",
      major: "Biology / Pre-Med",
      title: "Start consistent volunteering",
      description: "Choose a service role you can sustain. Consistency matters more than collecting disconnected activities.",
      recommendedYear: "Freshman",
      recommendedSemester: "Fall",
      importance: "High",
      estimatedEffort: "Moderate",
      estimatedCompletionTime: "8-12 weeks",
      relatedOpportunityCategories: ["Student Organizations", "Campus Jobs", "Healthcare"],
      requiredSkills: ["Reliability", "Communication"],
      recommendedBefore: ["clinical applications", "medical school planning"],
      recommendedAfter: ["settling into coursework"],
    },
    {
      id: "bio-shadow",
      major: "Biology / Pre-Med",
      title: "Arrange physician shadowing or clinical exposure",
      description: "Early exposure helps you test your interest in medicine before you overcommit to a path.",
      recommendedYear: "Freshman",
      recommendedSemester: "Spring",
      importance: "Recommended",
      estimatedEffort: "Moderate",
      estimatedCompletionTime: "3-6 weeks",
      relatedOpportunityCategories: ["Campus Jobs", "Research", "Student Organizations"],
      requiredSkills: ["Professional outreach"],
      recommendedBefore: ["clinical volunteering", "pre-med applications"],
      recommendedAfter: ["meeting your academic advisor"],
    },
    {
      id: "bio-research-lab",
      major: "Biology / Pre-Med",
      title: "Explore undergraduate research labs",
      description: "Research experience helps you understand science beyond coursework and can open paid summer programs.",
      recommendedYear: "Sophomore",
      recommendedSemester: "Fall",
      importance: "High",
      estimatedEffort: "Focused",
      estimatedCompletionTime: "4-8 weeks",
      relatedOpportunityCategories: ["Research", "Fellowships", "Scholarships"],
      requiredSkills: ["Scientific writing", "Lab readiness"],
      recommendedBefore: ["summer research applications"],
      recommendedAfter: ["intro lab coursework"],
    },
  ],
  economics: [
    {
      id: "econ-excel",
      major: "Economics",
      title: "Learn Excel for analysis",
      description: "Excel is still a baseline skill for finance, consulting, policy, and analytics roles.",
      recommendedYear: "Freshman",
      recommendedSemester: "Fall",
      importance: "High",
      estimatedEffort: "Light",
      estimatedCompletionTime: "1-2 weeks",
      relatedOpportunityCategories: ["Certifications", "Career Resources", "Internships"],
      requiredSkills: ["Spreadsheets"],
      recommendedBefore: ["finance club projects", "early insight programs"],
      recommendedAfter: ["intro economics coursework"],
    },
    {
      id: "econ-finance-club",
      major: "Economics",
      title: "Join a finance, consulting, or policy club",
      description: "A focused club gives you recruiting context, project experience, and older students who know deadlines.",
      recommendedYear: "Freshman",
      recommendedSemester: "Fall",
      importance: "Recommended",
      estimatedEffort: "Light",
      estimatedCompletionTime: "1-3 weeks",
      relatedOpportunityCategories: ["Student Organizations", "Leadership Programs", "Competitions"],
      requiredSkills: ["Participation", "Curiosity"],
      recommendedBefore: ["early insight applications"],
      recommendedAfter: ["learning basic Excel"],
    },
    {
      id: "econ-networking",
      major: "Economics",
      title: "Start structured networking",
      description: "Early conversations help you understand which paths need applications long before junior year.",
      recommendedYear: "Sophomore",
      recommendedSemester: "Fall",
      importance: "High",
      estimatedEffort: "Moderate",
      estimatedCompletionTime: "4-6 weeks",
      relatedOpportunityCategories: ["Career Resources", "Internships", "Conferences"],
      requiredSkills: ["Outreach", "Follow-up"],
      recommendedBefore: ["finance and consulting recruiting"],
      recommendedAfter: ["joining a career-focused club"],
    },
  ],
};

const aliases: Record<string, string> = {
  "computer science": "computer science",
  cs: "computer science",
  "software engineering": "computer science",
  biology: "biology",
  "pre med": "biology",
  "pre-med": "biology",
  medicine: "biology",
  economics: "economics",
  econ: "economics",
  finance: "economics",
};

function roadmapKey(profile: AdvisorProfile) {
  const major = normalize(profile.academics.major);
  const goal = normalize(profile.goals.careerGoal);
  return aliases[major] ?? Object.entries(aliases).find(([term]) => major.includes(term) || goal.includes(term))?.[1] ?? "general";
}

function withStatus(milestone: MilestoneTemplate, completedIds: Set<string>): RoadmapMilestone {
  return { ...milestone, completionStatus: completedIds.has(milestone.id) ? "completed" : "not_started" };
}

export function getCurrentStage(profile: AdvisorProfile) {
  return profile.academics.timelineStage;
}

export function getRoadmapMilestones(profile: AdvisorProfile) {
  const completedIds = new Set(profile.future.roadmapMilestones ?? []);
  const key = roadmapKey(profile);
  const templates = [...(majorMilestones[key] ?? []), ...generalMilestones];
  return templates.map((milestone) => withStatus(milestone, completedIds));
}

export function getCompletedMilestones(profile: AdvisorProfile) {
  return getRoadmapMilestones(profile).filter((milestone) => milestone.completionStatus === "completed");
}

function stageRank(stage: AdvisorTimelineStage) {
  return ["Freshman", "Sophomore", "Junior", "Senior", "Recent Graduate"].indexOf(stage);
}

function importanceRank(importance: RoadmapImportance) {
  return { Critical: 4, High: 3, Recommended: 2, Optional: 1 }[importance];
}

export function getUpcomingMilestones(profile: AdvisorProfile) {
  const current = stageRank(getCurrentStage(profile));
  return getRoadmapMilestones(profile).filter((milestone) => milestone.completionStatus !== "completed" && stageRank(milestone.recommendedYear) >= current - 1).sort((a, b) => {
    const stageDelta = Math.abs(stageRank(a.recommendedYear) - current) - Math.abs(stageRank(b.recommendedYear) - current);
    if (stageDelta) return stageDelta;
    return importanceRank(b.importance) - importanceRank(a.importance);
  });
}

export function getRecommendedMilestone(profile: AdvisorProfile) {
  const upcoming = getUpcomingMilestones(profile);
  return upcoming[0] ?? getRoadmapMilestones(profile).find((milestone) => milestone.completionStatus !== "completed") ?? withStatus(generalMilestones[0], new Set());
}

export function getRoadmap(profile: AdvisorProfile): RoadmapResult {
  const milestones = getRoadmapMilestones(profile);
  const upcomingMilestones = getUpcomingMilestones(profile);
  const completedMilestones = getCompletedMilestones(profile);
  const recommendedMilestone = getRecommendedMilestone(profile);
  return {
    currentStage: getCurrentStage(profile),
    milestones,
    upcomingMilestones,
    completedMilestones,
    recommendedMilestone,
    opportunityPriorities: unique(recommendedMilestone.relatedOpportunityCategories),
  };
}
