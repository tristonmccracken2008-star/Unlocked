import type { Opportunity } from "./opportunities";
import { getMajorPathway, type MajorPathway } from "./major-pathways";
import { scoreOpportunityIntelligence } from "./opportunity-intelligence";
import type { School } from "./schemas";
import type { StudentActivity, TrackedOpportunity } from "./student-activity";
import { isCompletedStudentProfile, type StudentProfile } from "./student-profile";

export type AdvisorTimelineStage = "Freshman" | "Sophomore" | "Junior" | "Senior" | "Recent Graduate";
export type AdvisorRecommendationPriority = "Critical" | "High" | "Recommended" | "Optional";
export type AdvisorRecommendationType = "Focus" | "Opportunity Category" | "Opportunity";

export type AdvisorProfile = {
  student: {
    firstName?: string;
    lastName?: string;
    completedProfile: boolean;
  };
  school: {
    slug: string;
    name: string;
    location: string;
    domain: string;
  };
  academics: {
    major: string;
    minor?: string;
    graduationYear?: string;
    academicYear: string;
    timelineStage: AdvisorTimelineStage;
  };
  goals: {
    careerGoal: string;
    interests: string[];
    topics: string[];
    clubs?: string;
  };
  experience: {
    savedOpportunityIds: string[];
    viewedOpportunityIds: string[];
    claimedOpportunityIds: string[];
    tracked: Record<string, TrackedOpportunity>;
    savedCount: number;
    completedCount: number;
    currentExperienceLevel: "Starting" | "Building" | "Active" | "Advanced";
  };
  pathway: MajorPathway;
  future: {
    advisorInterview?: Record<string, unknown>;
    roadmapMilestones?: string[];
    weeklyDigestPreferences?: Record<string, unknown>;
    applicationTracking?: Record<string, unknown>;
  };
};

export type AdvisorRecommendation = {
  id: string;
  type: AdvisorRecommendationType;
  title: string;
  description: string;
  priority: AdvisorRecommendationPriority;
  confidence: number;
  reasons: string[];
  categories: string[];
};

export type AdvisorEngineResult = {
  profile: AdvisorProfile;
  stage: AdvisorTimelineStage;
  focus: string;
  categoriesThatMatterNow: string[];
  prioritizedOpportunityCategories: AdvisorRecommendation[];
  recommendations: AdvisorRecommendation[];
};

const unique = <T,>(items: T[]) => [...new Set(items.filter(Boolean))];
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();

export function advisorTimelineStage(academicYear: string): AdvisorTimelineStage {
  if (academicYear === "Second year") return "Sophomore";
  if (academicYear === "Third year") return "Junior";
  if (academicYear === "Fourth year") return "Senior";
  if (academicYear === "Graduate student") return "Recent Graduate";
  return "Freshman";
}

function currentExperienceLevel(activity?: StudentActivity): AdvisorProfile["experience"]["currentExperienceLevel"] {
  const saved = activity?.saved?.length ?? 0;
  const completed = activity?.claimed?.length ?? 0;
  const tracked = Object.keys(activity?.tracked ?? {}).length;
  if (completed >= 3 || tracked >= 8) return "Advanced";
  if (completed >= 1 || tracked >= 4 || saved >= 6) return "Active";
  if (saved >= 2 || tracked >= 1) return "Building";
  return "Starting";
}

export function createAdvisorProfile(input: { profile: StudentProfile; school: School; activity?: StudentActivity }): AdvisorProfile {
  const { profile, school, activity } = input;
  const tracked = activity?.tracked ?? {};
  const interests = unique([profile.interests, ...(profile.topics ?? [])].flatMap((item) => item.split(",").map((part) => part.trim())));
  const goals = unique([profile.careerGoal, ...(profile.goals ?? [])].flatMap((item) => item.split(",").map((part) => part.trim())));
  return {
    student: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      completedProfile: isCompletedStudentProfile(profile),
    },
    school: {
      slug: school.slug,
      name: school.name,
      location: school.location,
      domain: school.domain,
    },
    academics: {
      major: profile.major,
      minor: profile.minor,
      graduationYear: profile.graduationYear,
      academicYear: profile.year,
      timelineStage: advisorTimelineStage(profile.year),
    },
    goals: {
      careerGoal: profile.careerGoal,
      interests,
      topics: profile.topics ?? interests,
      clubs: profile.clubs,
    },
    experience: {
      savedOpportunityIds: activity?.saved ?? [],
      viewedOpportunityIds: activity?.viewed ?? [],
      claimedOpportunityIds: activity?.claimed ?? [],
      tracked,
      savedCount: activity?.saved?.length ?? 0,
      completedCount: activity?.claimed?.length ?? 0,
      currentExperienceLevel: currentExperienceLevel(activity),
    },
    pathway: getMajorPathway(profile.major),
    future: {},
  };
}

function priorityForCategory(stage: AdvisorTimelineStage, category: string, index: number): AdvisorRecommendationPriority {
  if (stage === "Junior" && ["Internships", "Co-ops", "Research", "Fellowships"].includes(category)) return "Critical";
  if (stage === "Senior" && ["Internships", "Fellowships", "Career Resources"].includes(category)) return "Critical";
  if (stage === "Freshman" && ["Freshman Programs", "Student Organizations", "Research", "Campus Jobs"].includes(category)) return "High";
  if (index <= 1) return "High";
  if (index <= 3) return "Recommended";
  return "Optional";
}

function confidenceForCategory(profile: AdvisorProfile, category: string, index: number) {
  let score = 52;
  if (profile.pathway.bestOpportunityCategories.includes(category)) score += 18;
  if (profile.student.completedProfile) score += 10;
  if (profile.goals.interests.some((interest) => normalize(category).includes(normalize(interest)) || normalize(interest).includes(normalize(category)))) score += 8;
  if (profile.experience.currentExperienceLevel !== "Starting") score += 6;
  score += Math.max(0, 8 - index * 2);
  return Math.min(96, Math.max(35, score));
}

function currentFocus(profile: AdvisorProfile) {
  const pathway = profile.pathway;
  if (profile.academics.timelineStage === "Sophomore") return pathway.sophomorePriorities[0];
  if (profile.academics.timelineStage === "Junior") return pathway.juniorPriorities[0];
  if (profile.academics.timelineStage === "Senior" || profile.academics.timelineStage === "Recent Graduate") return pathway.seniorPriorities[0];
  return pathway.freshmanPriorities[0];
}

function categoryReasons(profile: AdvisorProfile, category: string, priority: AdvisorRecommendationPriority) {
  const pathwayMatch = profile.pathway.bestOpportunityCategories.includes(category);
  const reasons = [
    `You are a ${profile.academics.timelineStage.toLowerCase()} ${profile.academics.major} student.`,
    pathwayMatch ? `${category} is one of the strongest categories for the ${profile.pathway.major} pathway.` : `${category} is important for students in the ${profile.academics.timelineStage} timeline stage.`,
  ];
  if (priority === "Critical") reasons.push("Your timeline makes this category time-sensitive right now.");
  if (profile.experience.currentExperienceLevel === "Starting") reasons.push("You have not saved many opportunities yet, so this is a practical starting point.");
  if (profile.goals.careerGoal) reasons.push(`It supports your stated goal: ${profile.goals.careerGoal}.`);
  return reasons;
}

export function runAdvisorEngine(profile: AdvisorProfile): AdvisorEngineResult {
  const focus = currentFocus(profile);
  const stageCategories: Record<AdvisorTimelineStage, string[]> = {
    Freshman: ["Freshman Programs", "Student Organizations", "Campus Jobs", "Research"],
    Sophomore: ["Internships", "Research", "Competitions", "Career Resources"],
    Junior: ["Internships", "Co-ops", "Fellowships", "Research"],
    Senior: ["Career Resources", "Fellowships", "Internships", "Scholarships"],
    "Recent Graduate": ["Career Resources", "Fellowships", "Certifications", "Internships"],
  };
  const categoriesThatMatterNow = unique([...profile.pathway.bestOpportunityCategories, ...stageCategories[profile.academics.timelineStage]]).slice(0, 6);
  const prioritizedOpportunityCategories = categoriesThatMatterNow.map((category, index) => {
    const priority = priorityForCategory(profile.academics.timelineStage, category, index);
    return {
      id: `advisor-category-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      type: "Opportunity Category" as const,
      title: category,
      description: `Prioritize ${category.toLowerCase()} while your current focus is to ${focus}.`,
      priority,
      confidence: confidenceForCategory(profile, category, index),
      reasons: categoryReasons(profile, category, priority),
      categories: [category],
    };
  });
  const focusRecommendation: AdvisorRecommendation = {
    id: "advisor-focus",
    type: "Focus",
    title: "Top advisor focus",
    description: `Focus next on this: ${focus}.`,
    priority: profile.academics.timelineStage === "Junior" || profile.academics.timelineStage === "Senior" ? "High" : "Recommended",
    confidence: profile.student.completedProfile ? 90 : 72,
    reasons: [
      `Your profile lists ${profile.academics.major} as your major.`,
      `Your current timeline stage is ${profile.academics.timelineStage}.`,
      `This focus comes from the structured ${profile.pathway.major} major pathway.`,
    ],
    categories: categoriesThatMatterNow.slice(0, 3),
  };
  return {
    profile,
    stage: profile.academics.timelineStage,
    focus,
    categoriesThatMatterNow,
    prioritizedOpportunityCategories,
    recommendations: [focusRecommendation, ...prioritizedOpportunityCategories],
  };
}

export function explainOpportunityRecommendation(profile: AdvisorProfile, item: Opportunity): AdvisorRecommendation {
  const scored = scoreOpportunityIntelligence(item, {
    schoolSlug: profile.school.slug,
    schoolName: profile.school.name,
    major: profile.academics.major,
    academicYear: profile.academics.academicYear,
    careerGoals: profile.goals.careerGoal,
    interests: profile.goals.interests,
    savedOpportunityIds: profile.experience.savedOpportunityIds,
    viewedOpportunityIds: profile.experience.viewedOpportunityIds,
  });
  return {
    id: `advisor-opportunity-${item.id}`,
    type: "Opportunity",
    title: item.title,
    description: item.description,
    priority: scored.priority,
    confidence: scored.confidence,
    reasons: [`You are a ${profile.academics.timelineStage.toLowerCase()} ${profile.academics.major} student.`, ...scored.reasons],
    categories: [item.category],
  };
}
