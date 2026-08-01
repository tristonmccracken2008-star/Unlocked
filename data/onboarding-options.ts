export const onboardingSchemaVersion = 2 as const;

export const opportunityTypeOptions = [
  "Internships",
  "Jobs and part-time work",
  "Scholarships and grants",
  "Research",
  "Fellowships and academic programs",
  "Competitions",
  "Career-development programs",
  "Campus and student resources",
  "Software and student benefits",
  "Still exploring",
] as const;

export const fieldInterestOptions = [
  "Computer Science and AI",
  "Engineering",
  "Business and Finance",
  "Medicine and Health",
  "Natural Sciences",
  "Social Sciences",
  "Law and Public Policy",
  "Arts, Design, and Media",
  "Education",
  "Environment and Sustainability",
  "Entrepreneurship",
  "Humanities",
  "Other",
  "Still exploring",
] as const;

export const currentGoalOptions = [
  "Finding my first internship",
  "Building professional experience",
  "Finding scholarships or financial support",
  "Finding research experience",
  "Exploring possible careers",
  "Preparing for graduate or professional school",
  "Building technical or practical skills",
  "Finding a job during school",
  "Building a project or business",
  "Growing my network",
  "Still figuring it out",
] as const;

export const careerPathOptions = [
  "Software Engineering",
  "Data Science",
  "Quantitative Finance",
  "Product Management",
  "Investment Banking",
  "Consulting",
  "Medicine",
  "Public Health",
  "Law",
  "Academic Research",
  "Entrepreneurship",
  "Journalism",
  "Education",
  "Other",
  "Not sure yet",
] as const;

export const locationFormatOptions = [
  { value: "remote", label: "Remote" },
  { value: "in_person", label: "In person" },
  { value: "hybrid", label: "Hybrid" },
  { value: "no_preference", label: "No preference" },
] as const;

export const compensationOptions = [
  { value: "paid_only", label: "Paid opportunities only" },
  { value: "prefer_paid", label: "Prefer paid, but show strong unpaid opportunities" },
  { value: "no_preference", label: "No preference" },
] as const;

export const timeCommitmentOptions = [
  { value: "short_term", label: "Short-term" },
  { value: "semester", label: "Semester" },
  { value: "summer", label: "Summer" },
  { value: "year_round", label: "Year-round" },
  { value: "no_preference", label: "No preference" },
] as const;

export type OpportunityTypeInterest = (typeof opportunityTypeOptions)[number];
export type FieldInterest = (typeof fieldInterestOptions)[number] | (string & {});
export type CurrentGoal = (typeof currentGoalOptions)[number];
export type CareerPathInterest = (typeof careerPathOptions)[number] | (string & {});
export type LocationFormatPreference = (typeof locationFormatOptions)[number]["value"];
export type CompensationPreference = (typeof compensationOptions)[number]["value"];
export type TimeCommitmentPreference = (typeof timeCommitmentOptions)[number]["value"];

export const onboardingSelectionLimits = {
  fieldInterests: 5,
  currentGoals: 4,
  specificCareerInterests: 5,
} as const;

const opportunityCategorySignals: Record<OpportunityTypeInterest, readonly string[]> = {
  "Internships": ["Internships"],
  "Jobs and part-time work": ["Campus Jobs", "Career Resources"],
  "Scholarships and grants": ["Scholarship", "Scholarships", "Grants"],
  "Research": ["Research"],
  "Fellowships and academic programs": ["Fellowships", "Research"],
  "Competitions": ["Competitions", "Hackathons"],
  "Career-development programs": ["Career Resources", "Leadership Programs"],
  "Campus and student resources": ["Student Organizations", "Benefit"],
  "Software and student benefits": ["AI", "Benefit"],
  "Still exploring": [],
};

export function categorySignalsForOpportunityTypes(values: readonly string[]) {
  return [...new Set(values.flatMap((value) => opportunityCategorySignals[value as OpportunityTypeInterest] ?? [value]).filter(Boolean))];
}

export function isExplorationChoice(value: string) {
  return value === "Still exploring" || value === "Still figuring it out" || value === "Not sure yet";
}
