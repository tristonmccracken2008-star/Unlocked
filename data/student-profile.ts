export const studentProfileStorageKey = "unlocked-student-profile";

export type StudentProfile = {
  schoolSlug: string;
  major: string;
  minor?: string;
  year: string;
  careerGoal: string;
  interests: string;
  goals?: string[];
  topics?: string[];
  clubs?: string;
};

export function isStudentProfile(value: unknown): value is StudentProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<StudentProfile>;
  return Boolean(profile.schoolSlug && profile.major && profile.year && profile.careerGoal && profile.interests);
}

export function readStudentProfile() {
  try {
    const saved = localStorage.getItem(studentProfileStorageKey);
    if (!saved) return null;
    const parsed: unknown = JSON.parse(saved);
    if (isStudentProfile(parsed)) return parsed;
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
        writeStudentProfile(migrated);
        return migrated;
      }
    }
    return null;
  } catch { return null; }
}

export function writeStudentProfile(profile: StudentProfile) {
  localStorage.setItem(studentProfileStorageKey, JSON.stringify(profile));
  if (typeof window !== "undefined") {
    void fetch("/api/account/data", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile }) }).catch(() => undefined);
  }
}

export function profileSummary(profile: StudentProfile) {
  const study = profile.minor ? `${profile.major} + ${profile.minor}` : profile.major;
  const year = profile.year === "First year" ? "freshman" : profile.year === "Second year" ? "sophomore" : profile.year === "Third year" ? "junior" : profile.year === "Fourth year" ? "senior" : profile.year.toLowerCase();
  const interest = profile.interests.split(",")[0]?.trim();
  return `${study} ${year}${interest ? ` interested in ${interest}` : ""}`;
}
