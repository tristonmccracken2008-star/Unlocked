import type { Opportunity } from "./opportunities";
import { getMajorPathway, type MajorPathway } from "./major-pathways";
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
const tokenize = (value: string) => normalize(value).split(" ").filter((token) => token.length > 2);

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

function deadlineDays(item: Opportunity) {
  if (!item.application_deadline) return null;
  const today = new Date();
  const deadline = new Date(`${item.application_deadline}T23:59:59Z`);
  return Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
}

function majorMatches(profile: AdvisorProfile, item: Opportunity) {
  const major = normalize(profile.academics.major);
  return item.majors.includes("Any Major") || item.majors.some((itemMajor) => {
    const normalized = normalize(itemMajor);
    return major.includes(normalized) || normalized.includes(major);
  });
}

function goalMatches(profile: AdvisorProfile, item: Opportunity) {
  const text = normalize([item.title, item.description, item.category, item.organization, ...item.tags].join(" "));
  return unique([...tokenize(profile.goals.careerGoal), ...profile.goals.interests.flatMap(tokenize)]).filter((token) => text.includes(token));
}

export function explainOpportunityRecommendation(profile: AdvisorProfile, item: Opportunity): AdvisorRecommendation {
  const days = deadlineDays(item);
  const matchesMajor = majorMatches(profile, item);
  const matchesYear = item.academic_years.includes("Any Year") || item.academic_years.includes(profile.academics.academicYear);
  const matchesSchool = item.school_scope === "National" || item.schools.includes(profile.school.slug);
  const matchedGoals = goalMatches(profile, item);
  const categoryPriority = profile.pathway.bestOpportunityCategories.includes(item.category);
  let score = 28;
  if (matchesMajor) score += 18;
  if (matchesYear) score += 14;
  if (matchesSchool) score += 12;
  if (matchedGoals.length) score += Math.min(12, matchedGoals.length * 4);
  if (categoryPriority) score += 10;
  if (item.verification_status === "verified") score += 8;
  if (typeof item.estimated_value === "number" && item.estimated_value > 0) score += Math.min(8, Math.ceil(item.estimated_value / 1000));
  if (days !== null && days >= 0 && days <= 21) score += 8;
  if (item.difficulty === "Highly Competitive") score -= 4;
  const confidence = Math.min(98, Math.max(20, score));
  const priority: AdvisorRecommendationPriority = days !== null && days >= 0 && days <= 14 ? "Critical" : confidence >= 82 ? "High" : confidence >= 60 ? "Recommended" : "Optional";
  const reasons = [
    `You are a ${profile.academics.timelineStage.toLowerCase()} ${profile.academics.major} student.`,
    matchesYear ? `This opportunity accepts ${profile.academics.academicYear.toLowerCase()} students.` : `This opportunity may not explicitly list ${profile.academics.academicYear.toLowerCase()} eligibility.`,
    matchesMajor ? "Your major matches the listed eligibility." : "Your major is not an explicit match, so review eligibility carefully.",
    matchesSchool ? item.school_scope === "National" ? "This is a national opportunity." : `This is available at ${profile.school.name}.` : `This does not appear to be available at ${profile.school.name}.`,
  ];
  if (matchedGoals[0]) reasons.push(`It aligns with your interest in ${matchedGoals[0]}.`);
  if (days !== null && days >= 0) reasons.push(`Applications close in ${days} day${days === 1 ? "" : "s"}.`);
  if (item.estimated_value) reasons.push(`The estimated value is $${item.estimated_value.toLocaleString("en-US")}.`);
  if (item.difficulty) reasons.push(`Competitiveness is marked ${item.difficulty.toLowerCase()}.`);
  return {
    id: `advisor-opportunity-${item.id}`,
    type: "Opportunity",
    title: item.title,
    description: item.description,
    priority,
    confidence,
    reasons,
    categories: [item.category],
  };
}
