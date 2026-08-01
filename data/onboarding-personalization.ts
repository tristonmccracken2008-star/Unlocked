import {
  careerPathOptions,
  categorySignalsForOpportunityTypes,
  compensationOptions,
  currentGoalOptions,
  fieldInterestOptions,
  isExplorationChoice,
  locationFormatOptions,
  onboardingSchemaVersion,
  onboardingSelectionLimits,
  opportunityTypeOptions,
  timeCommitmentOptions,
  type CareerPathInterest,
  type CompensationPreference,
  type FieldInterest,
  type LocationFormatPreference,
  type OpportunityTypeInterest,
  type TimeCommitmentPreference,
} from "./onboarding-options";
import type { StudentProfile } from "./student-profile";

export type OnboardingPersonalization = {
  opportunityTypeInterests: OpportunityTypeInterest[];
  fieldInterests: FieldInterest[];
  goals: string[];
  specificCareerInterests: CareerPathInterest[];
  locationFormats: LocationFormatPreference[];
  compensationPreference: CompensationPreference;
  timeCommitments: TimeCommitmentPreference[];
};

const legacyPriorityGoalMap: Record<string, string> = {
  "Finding an internship": "Finding my first internship",
  "Finding research": "Finding research experience",
  "Finding scholarships": "Finding scholarships or financial support",
  "Exploring opportunities": "Exploring possible careers",
  "Preparing for future applications": "Building professional experience",
};

const legacyOpportunityMap: Array<[OpportunityTypeInterest, readonly string[]]> = [
  ["Internships", ["Internships"]],
  ["Jobs and part-time work", ["Campus Jobs"]],
  ["Scholarships and grants", ["Scholarships", "Scholarship", "Grants"]],
  ["Research", ["Research"]],
  ["Fellowships and academic programs", ["Fellowships"]],
  ["Competitions", ["Competitions", "Hackathons"]],
  ["Career-development programs", ["Career Resources", "Leadership Programs"]],
  ["Campus and student resources", ["Student Organizations", "Student Benefits"]],
  ["Software and student benefits", ["AI", "AI Tools", "Benefit", "Software Benefits"]],
];

function unique(values: readonly string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function supported<T extends string>(values: readonly string[] | undefined, options: readonly T[]) {
  const allowed = new Set<string>(options);
  return unique(values).filter((value): value is T => allowed.has(value));
}

export function personalizationFromLegacyProfile(profile: StudentProfile | null | undefined): OnboardingPersonalization {
  if (!profile) return {
    opportunityTypeInterests: [],
    fieldInterests: [],
    goals: [],
    specificCareerInterests: [],
    locationFormats: ["no_preference"],
    compensationPreference: "no_preference",
    timeCommitments: ["no_preference"],
  };
  const preferred = unique(profile.preferredOpportunityTypes);
  const legacyTopics = unique(profile.topics?.length ? profile.topics : profile.interests.split(","));
  const legacySignals = [...new Set([...preferred, ...legacyTopics])];
  const opportunityTypeInterests = supported(profile.opportunityTypeInterests, opportunityTypeOptions);
  if (!opportunityTypeInterests.length) {
    for (const [label, aliases] of legacyOpportunityMap) {
      if (aliases.some((alias) => legacySignals.includes(alias))) opportunityTypeInterests.push(label);
    }
  }
  if (!opportunityTypeInterests.length) opportunityTypeInterests.push("Still exploring");
  // Legacy topics can overlap opportunity categories. Preserve the original values
  // instead of guessing which meaning the student intended.
  const fieldInterests = unique(profile.fieldInterests?.length ? profile.fieldInterests : legacyTopics) as FieldInterest[];
  if (!fieldInterests.length) fieldInterests.push("Still exploring");
  const goals = unique(profile.goals?.length ? profile.goals.filter((goal) => currentGoalOptions.includes(goal as never)) : []);
  const mappedPriority = profile.currentPriority ? legacyPriorityGoalMap[profile.currentPriority] : undefined;
  if (!goals.length && mappedPriority) goals.push(mappedPriority);
  if (!goals.length) goals.push("Still figuring it out");
  const specificCareerInterests = unique(profile.specificCareerInterests) as CareerPathInterest[];
  if (!specificCareerInterests.length && careerPathOptions.includes(profile.careerGoal as never) && !isExplorationChoice(profile.careerGoal)) specificCareerInterests.push(profile.careerGoal);
  return {
    opportunityTypeInterests,
    fieldInterests,
    goals,
    specificCareerInterests,
    locationFormats: supported(profile.locationFormats, locationFormatOptions.map((option) => option.value)).length
      ? supported(profile.locationFormats, locationFormatOptions.map((option) => option.value))
      : ["no_preference"],
    compensationPreference: compensationOptions.some((option) => option.value === profile.compensationPreference) ? profile.compensationPreference! : "no_preference",
    timeCommitments: supported(profile.timeCommitments, timeCommitmentOptions.map((option) => option.value)).length
      ? supported(profile.timeCommitments, timeCommitmentOptions.map((option) => option.value))
      : ["no_preference"],
  };
}

export function applyOnboardingPersonalization(profile: StudentProfile, answers: OnboardingPersonalization): StudentProfile {
  const fields = unique(answers.fieldInterests);
  const goals = unique(answers.goals);
  const careers = unique(answers.specificCareerInterests);
  const categorySignals = categorySignalsForOpportunityTypes(answers.opportunityTypeInterests);
  const careerGoal = careers.find((value) => !isExplorationChoice(value)) ?? (fields.includes("Still exploring") ? "Undecided" : "Exploring possible careers");
  const currentPriority = goals.find((value) => !isExplorationChoice(value)) ?? "Exploring opportunities";
  return {
    ...profile,
    careerGoal,
    interests: fields.join(", "),
    currentPriority,
    preferredOpportunityTypes: categorySignals,
    opportunityTypeInterests: unique(answers.opportunityTypeInterests) as OpportunityTypeInterest[],
    fieldInterests: fields as FieldInterest[],
    specificCareerInterests: careers as CareerPathInterest[],
    locationFormats: unique(answers.locationFormats) as LocationFormatPreference[],
    compensationPreference: answers.compensationPreference,
    timeCommitments: unique(answers.timeCommitments) as TimeCommitmentPreference[],
    goals,
    topics: fields,
    onboardingSchemaVersion,
    advisorInterview: {
      ...(profile.advisorInterview ?? {}),
      careerGoal,
      interests: fields,
      primaryGoals: goals,
      preferredOpportunityTypes: categorySignals,
      completedAt: profile.advisorInterview?.completedAt ?? profile.onboardingCompletedAt,
    },
  };
}

export function onboardingProfileV2Issues(profile: StudentProfile) {
  if (profile.onboardingSchemaVersion !== onboardingSchemaVersion) return [];
  const issues: string[] = [];
  const opportunityTypes = profile.opportunityTypeInterests ?? [];
  const fields = profile.fieldInterests ?? [];
  const goals = profile.goals ?? [];
  const careers = profile.specificCareerInterests ?? [];
  const locations = profile.locationFormats ?? [];
  const timeCommitments = profile.timeCommitments ?? [];
  if (!profile.schoolSlug.trim()) issues.push("school");
  if (!/^\d{4}$/.test(profile.graduationYear ?? "")) issues.push("graduationYear");
  if (profile.major.trim().length < 2) issues.push("major");
  if (profile.secondaryMajor?.trim().toLowerCase() === profile.major.trim().toLowerCase()) issues.push("secondaryMajor");
  if (!opportunityTypes.length || opportunityTypes.some((value) => !opportunityTypeOptions.includes(value as never)) || opportunityTypes.includes("Still exploring") && opportunityTypes.length > 1) issues.push("opportunityTypeInterests");
  if (!fields.length || fields.length > onboardingSelectionLimits.fieldInterests || fields.includes("Still exploring") && fields.length > 1) issues.push("fieldInterests");
  if (!goals.length || goals.length > onboardingSelectionLimits.currentGoals || goals.some((value) => !currentGoalOptions.includes(value as never)) || goals.includes("Still figuring it out") && goals.length > 1) issues.push("goals");
  if (careers.length > onboardingSelectionLimits.specificCareerInterests || careers.includes("Not sure yet") && careers.length > 1) issues.push("specificCareerInterests");
  if (!locations.length || locations.includes("no_preference") && locations.length > 1) issues.push("locationFormats");
  if (!profile.compensationPreference) issues.push("compensationPreference");
  if (!timeCommitments.length || timeCommitments.includes("no_preference") && timeCommitments.length > 1) issues.push("timeCommitments");
  return issues;
}

export function onboardingQuestionPurpose() {
  return [
    ["school", "School-specific eligibility and recommendations"],
    ["graduation-year", "Academic-stage eligibility"],
    ["academic-focus", "Major and minor eligibility plus field relevance"],
    ["opportunity-types", "Category prioritization and portfolio balance"],
    ["fields", "Academic-field relevance"],
    ["current-goals", "Current-goal relevance"],
    ["location-format", "Work-mode preference"],
    ["compensation", "Paid-opportunity preference"],
    ["time-commitment", "Program-duration preference"],
    ["career-paths", "Optional precise career-path relevance"],
  ] as const;
}

export { currentGoalOptions, fieldInterestOptions, opportunityTypeOptions };
