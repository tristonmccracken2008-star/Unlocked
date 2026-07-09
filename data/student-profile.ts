export const studentProfileStorageKey = "unlocked-student-profile";
export const studentProfileCompleteStorageKey = "unlocked-student-profile-complete";

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
  goals?: string[];
  topics?: string[];
  clubs?: string;
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
    if (isStudentProfile(parsed)) return isPlaceholderStudentProfile(parsed) ? null : parsed;
    if (parsed && typeof parsed === "object") {
      const legacy = parsed as Record<string, unknown>;
      if (typeof legacy.schoolSlug === "string" && typeof legacy.major === "string" && typeof legacy.year === "string") {
        const migrated: StudentProfile = {
          schoolSlug: legacy.schoolSlug,
          major: legacy.major,
          year: legacy.year,
          careerGoal: typeof legacy.careerGoals === "string" && legacy.careerGoals ? legacy.careerGoals : "Explore career opportunities",
          interests: typeof legacy.interests === "string" && legacy.interests ? legacy.interests : legacy.major,
        };
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

export async function writeStudentProfile(profile: StudentProfile) {
  localStorage.setItem(studentProfileStorageKey, JSON.stringify(profile));
  localStorage.setItem(studentProfileCompleteStorageKey, "true");
  if (typeof window !== "undefined") {
    const response = await fetch("/api/account/data", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, onboardingComplete: true }) });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error("Profile could not be saved.");
    return await response.json();
  }
  return null;
}

export function profileSummary(profile: StudentProfile) {
  const study = profile.minor ? `${profile.major} + ${profile.minor}` : profile.major;
  const year = profile.graduationYear ? `class of ${profile.graduationYear}` : profile.year === "First year" ? "freshman" : profile.year === "Second year" ? "sophomore" : profile.year === "Third year" ? "junior" : profile.year === "Fourth year" ? "senior" : profile.year.toLowerCase();
  const interest = profile.interests.split(",")[0]?.trim();
  return `${study} ${year}${interest ? ` interested in ${interest}` : ""}`;
}
