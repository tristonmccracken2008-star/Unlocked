import crypto from "node:crypto";
import type { StudentProfile } from "@/data/student-profile";
import type { NormalizedAdvisorProfile } from "./types";

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function hash(value: unknown) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function advisorProfileFingerprint(profile: StudentProfile | null | undefined) {
  if (!profile) return null;
  return {
    major: profile.major?.trim().toLowerCase() ?? "",
    careerGoal: profile.careerGoal?.trim().toLowerCase() ?? "",
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
  };
}

export function studentAdvisorProfileHash(profile: StudentProfile | null | undefined) {
  const fingerprint = advisorProfileFingerprint(profile);
  return fingerprint ? hash(fingerprint) : null;
}

export function normalizedAdvisorProfileHash(profile: NormalizedAdvisorProfile) {
  return hash({
    studentId: profile.studentId,
    academicStage: profile.academicStage,
    majorIds: profile.majorIds,
    careerGoals: profile.careerGoals,
    weeklyAvailableHours: profile.weeklyAvailableHours,
    signals: profile.signals,
    constraints: profile.constraints,
    preferences: profile.preferences,
    completedDependencyNodes: profile.completedDependencyNodes ?? [],
    normalization: profile.normalization,
  });
}

export function meaningfulAdvisorProfileChanged(previous: StudentProfile | null | undefined, next: StudentProfile | null | undefined) {
  if (!previous || !next) return false;
  return studentAdvisorProfileHash(previous) !== studentAdvisorProfileHash(next);
}
