import { opportunityCategories, opportunityMajors } from "./opportunity-taxonomy";

export const graduationYears = () => Array.from({ length: 9 }, (_, index) => String(new Date().getFullYear() + index));

export const canonicalMajors = opportunityMajors.filter((item) => item !== "All" && item !== "Any Major");

export const careerGoalOptions = [
  "Software Engineering",
  "Medicine",
  "Law",
  "Research",
  "Graduate School",
  "Investment Banking",
  "Consulting",
  "Entrepreneurship",
  "Undecided",
] as const;

export const opportunityInterestOptions = [
  "Internships",
  "Research",
  "Scholarships",
  "Fellowships",
  "Campus Jobs",
  "Competitions",
  "Student Benefits",
  "AI Tools",
  "Software Benefits",
  "Study Abroad",
] as const;

export const currentPriorityOptions = [
  "Finding an internship",
  "Finding research",
  "Finding scholarships",
  "Discovering student benefits",
  "Exploring opportunities",
  "Preparing for future applications",
] as const;

export function priorityToOpportunityType(priority?: string) {
  if (!priority) return "";
  const value = priority.toLowerCase();
  if (value.includes("internship")) return "Internships";
  if (value.includes("research")) return "Research";
  if (value.includes("scholarship")) return "Scholarships";
  if (value.includes("benefit")) return "Student Benefits";
  if (value.includes("application")) return "Career Resources";
  return "";
}

export function normalizedOpportunityInterests(values: readonly string[]) {
  const supported = new Set<string>([...opportunityInterestOptions, ...opportunityCategories.filter((item) => item !== "All")]);
  return [...new Set(values.map((item) => item.trim()).filter((item) => item && (supported.has(item) || item === "Software Benefits" || item === "Student Benefits" || item === "AI Tools")))];
}

export function academicYearFromGraduationYear(value: string) {
  const gradYear = Number(value);
  if (!Number.isFinite(gradYear)) return "Graduate student";
  const yearsUntilGraduation = gradYear - new Date().getFullYear();
  if (yearsUntilGraduation >= 4) return "First year";
  if (yearsUntilGraduation === 3) return "Second year";
  if (yearsUntilGraduation === 2) return "Third year";
  if (yearsUntilGraduation === 1) return "Fourth year";
  return "Graduate student";
}
