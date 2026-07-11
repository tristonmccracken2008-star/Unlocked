import type { AdvisorProfile } from "./advisor-engine";
import { buildEvidenceInventory, type EvidenceInventory } from "./evidence-inventory";
import type { RecommendationV1 } from "./recommendation-engine";
import type { StudentProgress } from "./student-progress";

export type TwinDimension = "academics" | "technical" | "evidence" | "network" | "communication" | "execution" | "wellbeing" | "interview";

export type StudentDigitalTwin = {
  version: "student-digital-twin-v1";
  studentId: string;
  generatedAt: string;
  profile: {
    school: string;
    major: string;
    academicYear: string;
    careerGoal: string;
    completedProfile: boolean;
  };
  goals: string[];
  constraints: {
    weeklyAvailability?: string;
    activeApplicationCount: number;
    upcomingDeadlineCount: number;
  };
  dimensions: Record<TwinDimension, number>;
  evidenceInventory: EvidenceInventory;
  stateFlags: string[];
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function weeklyHours(value?: string) {
  if (!value) return 5;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 5;
}

function dimensionFromEvidence(inventory: EvidenceInventory, keys: (keyof EvidenceInventory["summary"])[]) {
  const levels = keys.map((key) => inventory.summary[key].level);
  return clamp((levels.reduce((sum, level) => sum + level, 0) / Math.max(1, levels.length)) * 25);
}

export function buildStudentDigitalTwin(input: { advisorProfile: AdvisorProfile; progress?: StudentProgress; recommendations?: readonly RecommendationV1[] }): StudentDigitalTwin {
  const { advisorProfile } = input;
  const evidenceInventory = buildEvidenceInventory(input);
  const hours = weeklyHours(advisorProfile.goals.weeklyAvailability);
  const activeApplications = advisorProfile.progress.activeApplications.length;
  const upcomingDeadlines = advisorProfile.progress.upcomingDeadlines.length;
  const completedMilestones = advisorProfile.progress.completedMilestones.length;
  const dimensions: StudentDigitalTwin["dimensions"] = {
    academics: clamp(advisorProfile.student.completedProfile ? 72 : 45),
    technical: dimensionFromEvidence(evidenceInventory, ["technical-depth", "research-reasoning"]),
    evidence: dimensionFromEvidence(evidenceInventory, ["external-validation", "professional-reliability", "career-fit-evidence"]),
    network: clamp((advisorProfile.experience.savedCount > 0 ? 45 : 25) + Math.min(25, activeApplications * 8)),
    communication: dimensionFromEvidence(evidenceInventory, ["communication", "interview-story-quality"]),
    execution: clamp(35 + completedMilestones * 12 + activeApplications * 8 + advisorProfile.experience.completedCount * 10),
    wellbeing: clamp(hours <= 2 ? 48 : hours <= 5 ? 68 : 78),
    interview: dimensionFromEvidence(evidenceInventory, ["interview-story-quality", "communication", "external-validation"]),
  };
  const stateFlags = [
    hours <= 2 ? "time-constrained" : "",
    activeApplications > 0 ? "active-applications" : "",
    upcomingDeadlines > 0 ? "upcoming-deadlines" : "",
    evidenceInventory.gaps.includes("interview-story-quality") ? "interview-story-gap" : "",
    evidenceInventory.gaps.includes("external-validation") ? "external-validation-gap" : "",
  ].filter(Boolean);
  return {
    version: "student-digital-twin-v1",
    studentId: `${advisorProfile.school.slug}:${advisorProfile.student.firstName ?? "student"}`,
    generatedAt: new Date().toISOString(),
    profile: {
      school: advisorProfile.school.name,
      major: advisorProfile.academics.major,
      academicYear: advisorProfile.academics.academicYear,
      careerGoal: advisorProfile.goals.careerGoal,
      completedProfile: advisorProfile.student.completedProfile,
    },
    goals: [advisorProfile.goals.careerGoal, ...advisorProfile.goals.primaryGoals].filter(Boolean),
    constraints: {
      weeklyAvailability: advisorProfile.goals.weeklyAvailability,
      activeApplicationCount: activeApplications,
      upcomingDeadlineCount: upcomingDeadlines,
    },
    dimensions,
    evidenceInventory,
    stateFlags,
  };
}
