import { authenticatedFetch } from "./authenticated-request";

export const studentProfileStorageKey = "unlocked-student-profile";
export const studentProfileCompleteStorageKey = "unlocked-student-profile-complete";
export const advisorProfileUpdatedMessageKey = "unlocked-advisor-profile-updated-message";

export type MinorStatus = "declared" | "none";
export type GpaStatus = "reported" | "none_yet" | "nonstandard";

export type StudentProfile = {
  firstName?: string;
  lastName?: string;
  schoolSlug: string;
  major: string;
  graduationYear?: string;
  year: string;
  careerGoal: string;
  interests: string;
  currentExperience?: string;
  weeklyAvailability?: string;
  preferredOpportunityTypes?: string[];
  advisorInterview?: {
    careerGoal?: string;
    currentExperience?: string;
    interests?: string[];
    primaryGoals?: string[];
    weeklyAvailability?: string;
    preferredOpportunityTypes?: string[];
    completedAt?: string;
  };
  minor?: string;
  minorStatus?: MinorStatus;
  gpaStatus?: GpaStatus;
  gpa?: number;
  gpaScale?: "4.0";
  currentPriority?: string;
  onboardingCompletedAt?: string;
  goals?: string[];
  topics?: string[];
  clubs?: string;
  institutionType?: "college" | "university" | "community_college" | "liberal_arts_college" | "unknown";
  enrollmentStatus?: "enrolled" | "incoming" | "recent_graduate" | "not_enrolled" | "unknown";
  degreeLevel?: "associate" | "undergraduate" | "graduate" | "unknown";
  citizenshipStatus?: "us_citizen" | "permanent_resident" | "international" | "unknown";
  workAuthorization?: "us_authorized" | "not_us_authorized" | "unknown";
  residency?: string;
  age?: number;
  transferStatus?: "community_college_student" | "transfer_applicant" | "not_transfer" | "unknown";
  financialNeedStatus?: "demonstrated" | "not_demonstrated" | "unknown";
  meritStatus?: "demonstrated" | "not_demonstrated" | "unknown";
  eligibilityAttributes?: string[];
};

export function isStudentProfile(value: unknown): value is StudentProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<StudentProfile>;
  return Boolean(profile.schoolSlug && profile.major && profile.year && profile.careerGoal && profile.interests);
}

export function isCompletedStudentProfile(value: unknown): value is StudentProfile {
  if (!isStudentProfile(value)) return false;
  const profile = value as StudentProfile;
  return Boolean(profile.firstName?.trim() && profile.graduationYear?.trim() && !isPlaceholderStudentProfile(profile));
}

export function normalizeStudentProfile(profile: StudentProfile): StudentProfile {
  const topicTokens = profile.topics?.length ? profile.topics : profile.interests.split(",").map((item) => item.trim()).filter(Boolean);
  const goalTokens = profile.goals?.length ? profile.goals : profile.careerGoal.split(",").map((item) => item.trim()).filter(Boolean);
  const minorStatus: MinorStatus = profile.minor?.trim() ? "declared" : profile.minorStatus === "declared" ? "declared" : "none";
  const gpaStatus: GpaStatus = profile.gpaStatus ?? "none_yet";
  const gpa = gpaStatus === "reported" && typeof profile.gpa === "number" && Number.isFinite(profile.gpa) ? Math.min(4, Math.max(0, profile.gpa)) : undefined;
  const currentPriority = profile.currentPriority ?? profile.preferredOpportunityTypes?.[0] ?? profile.goals?.[0] ?? "Exploring opportunities";
  return {
    ...profile,
    minor: minorStatus === "declared" ? profile.minor?.trim() : undefined,
    minorStatus,
    gpaStatus,
    gpa,
    gpaScale: gpaStatus === "reported" ? "4.0" : undefined,
    currentPriority,
    goals: goalTokens,
    topics: topicTokens,
    advisorInterview: profile.advisorInterview ? {
      ...profile.advisorInterview,
      careerGoal: profile.advisorInterview.careerGoal ?? profile.careerGoal,
      interests: profile.advisorInterview.interests?.length ? profile.advisorInterview.interests : topicTokens,
      primaryGoals: profile.advisorInterview.primaryGoals?.length ? profile.advisorInterview.primaryGoals : goalTokens,
      preferredOpportunityTypes: profile.advisorInterview.preferredOpportunityTypes?.length ? profile.advisorInterview.preferredOpportunityTypes : profile.preferredOpportunityTypes,
      completedAt: profile.advisorInterview.completedAt ?? profile.onboardingCompletedAt,
    } : profile.advisorInterview,
  };
}

export function isPlaceholderStudentProfile(profile: StudentProfile) {
  const hasOnboardingSelections = Boolean(profile.goals?.length || profile.topics?.length);
  const genericLegacyCopy = profile.careerGoal === "Explore career opportunities" && profile.interests.trim().toLowerCase() === profile.major.trim().toLowerCase();
  return !hasOnboardingSelections && genericLegacyCopy;
}

export function readStudentProfile() {
  try {
    const saved = localStorage.getItem(studentProfileStorageKey);
    if (!saved) return null;
    const parsed: unknown = JSON.parse(saved);
    if (isStudentProfile(parsed)) return isPlaceholderStudentProfile(parsed) ? null : normalizeStudentProfile(parsed);
    if (parsed && typeof parsed === "object") {
      const legacy = parsed as Record<string, unknown>;
      if (typeof legacy.schoolSlug === "string" && typeof legacy.major === "string" && typeof legacy.year === "string") {
        const migrated: StudentProfile = normalizeStudentProfile({
          schoolSlug: legacy.schoolSlug,
          major: legacy.major,
          year: legacy.year,
          careerGoal: typeof legacy.careerGoals === "string" && legacy.careerGoals ? legacy.careerGoals : "Explore career opportunities",
          interests: typeof legacy.interests === "string" && legacy.interests ? legacy.interests : legacy.major,
        });
        if (isPlaceholderStudentProfile(migrated)) return null;
        writeStudentProfile(migrated);
        return migrated;
      }
    }
    return null;
  } catch { return null; }
}

export function readCompletedStudentProfile() {
  const profile = readStudentProfile();
  if (!profile) return null;
  if (isPlaceholderStudentProfile(profile)) {
    localStorage.removeItem(studentProfileStorageKey);
    localStorage.removeItem(studentProfileCompleteStorageKey);
    return null;
  }
  const markedComplete = localStorage.getItem(studentProfileCompleteStorageKey) === "true";
  if (markedComplete && isCompletedStudentProfile(profile)) return profile;
  return isCompletedStudentProfile(profile) ? profile : null;
}

function advisorFingerprint(profile: StudentProfile | null | undefined) {
  if (!profile) return "";
  return JSON.stringify({
    major: profile.major?.trim().toLowerCase() ?? "",
    minor: profile.minor?.trim().toLowerCase() ?? "",
    minorStatus: profile.minorStatus ?? "",
    gpaStatus: profile.gpaStatus ?? "",
    gpa: profile.gpa ?? "",
    gpaScale: profile.gpaScale ?? "",
    careerGoal: profile.careerGoal?.trim().toLowerCase() ?? "",
    currentPriority: profile.currentPriority?.trim().toLowerCase() ?? "",
    year: profile.year?.trim().toLowerCase() ?? "",
    graduationYear: profile.graduationYear ?? "",
    interests: profile.interests?.trim().toLowerCase() ?? "",
    currentExperience: profile.currentExperience?.trim().toLowerCase() ?? "",
    weeklyAvailability: profile.weeklyAvailability ?? "",
    preferredOpportunityTypes: [...(profile.preferredOpportunityTypes ?? [])].sort(),
    goals: [...(profile.goals ?? [])].sort(),
    topics: [...(profile.topics ?? [])].sort(),
    advisorInterview: profile.advisorInterview ? {
      careerGoal: profile.advisorInterview.careerGoal ?? "",
      currentExperience: profile.advisorInterview.currentExperience ?? "",
      interests: [...(profile.advisorInterview.interests ?? [])].sort(),
      primaryGoals: [...(profile.advisorInterview.primaryGoals ?? [])].sort(),
      weeklyAvailability: profile.advisorInterview.weeklyAvailability ?? "",
      preferredOpportunityTypes: [...(profile.advisorInterview.preferredOpportunityTypes ?? [])].sort(),
    } : null,
  });
}

export async function writeStudentProfile(profile: StudentProfile) {
  const normalized = normalizeStudentProfile(profile);
  const previous = readCompletedStudentProfile();
  const changedForAdvisor = Boolean(previous && advisorFingerprint(previous) !== advisorFingerprint(normalized));
  localStorage.setItem(studentProfileStorageKey, JSON.stringify(normalized));
  localStorage.setItem(studentProfileCompleteStorageKey, "true");
  if (changedForAdvisor) localStorage.setItem(advisorProfileUpdatedMessageKey, normalized.careerGoal ? `Your plan was updated for your interest in ${normalized.careerGoal}.` : "Your plan was updated based on your new profile.");
  if (typeof window !== "undefined") {
    const response = await authenticatedFetch("/api/account/data", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: normalized, onboardingComplete: true }) });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error("Profile could not be saved.");
    return await response.json();
  }
  return null;
}

export function profileSummary(profile: StudentProfile) {
  const normalized = normalizeStudentProfile(profile);
  const study = normalized.minor ? `${normalized.major} + ${normalized.minor}` : normalized.major;
  const year = normalized.graduationYear ? `class of ${normalized.graduationYear}` : normalized.year === "First year" ? "freshman" : normalized.year === "Second year" ? "sophomore" : normalized.year === "Third year" ? "junior" : normalized.year === "Fourth year" ? "senior" : normalized.year.toLowerCase();
  const interest = normalized.interests.split(",")[0]?.trim();
  return `${study} ${year}${interest ? ` interested in ${interest}` : ""}`;
}
