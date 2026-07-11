import type { AdvisorProfile } from "./advisor-engine";
import type { RecommendationV1 } from "./recommendation-engine";
import type { ApplicationRecord, MilestoneProgressRecord, StudentProgress } from "./student-progress";

export type EvidenceDimension =
  | "technical-depth"
  | "research-reasoning"
  | "external-validation"
  | "teamwork"
  | "communication"
  | "leadership"
  | "professional-reliability"
  | "user-or-stakeholder-exposure"
  | "career-fit-evidence"
  | "interview-story-quality";

export type EvidenceConfidence = "low" | "medium" | "high";

export type EvidenceItem = {
  id: string;
  title: string;
  source: "profile" | "activity" | "milestone" | "application" | "recommendation";
  dimensions: Partial<Record<EvidenceDimension, number>>;
  confidence: EvidenceConfidence;
  producedBy: string;
  interviewUse: string;
  updatedAt?: string;
};

export type EvidenceInventory = {
  items: EvidenceItem[];
  summary: Record<EvidenceDimension, {
    level: number;
    confidence: EvidenceConfidence;
    sourceItemIds: string[];
    supportCount: number;
  }>;
  gaps: EvidenceDimension[];
};

export const evidenceDimensions: EvidenceDimension[] = [
  "technical-depth",
  "research-reasoning",
  "external-validation",
  "teamwork",
  "communication",
  "leadership",
  "professional-reliability",
  "user-or-stakeholder-exposure",
  "career-fit-evidence",
  "interview-story-quality",
];

const confidenceRank: Record<EvidenceConfidence, number> = { low: 0, medium: 1, high: 2 };

function clampLevel(value: number) {
  return Math.max(0, Math.min(4, Math.round(value * 10) / 10));
}

function confidenceForLevel(level: number, explicit?: EvidenceConfidence): EvidenceConfidence {
  if (explicit) return explicit;
  if (level >= 3) return "high";
  if (level >= 1.5) return "medium";
  return "low";
}

function item(id: string, title: string, source: EvidenceItem["source"], dimensions: EvidenceItem["dimensions"], producedBy: string, interviewUse: string, confidence?: EvidenceConfidence, updatedAt?: string): EvidenceItem {
  const strongest = Math.max(0, ...Object.values(dimensions).map(Number));
  return { id, title, source, dimensions, confidence: confidenceForLevel(strongest, confidence), producedBy, interviewUse, updatedAt };
}

function profileEvidence(profile: AdvisorProfile): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  if (profile.student.completedProfile) {
    items.push(item("profile-complete", "Completed UnlockED profile", "profile", { "career-fit-evidence": 1.5, communication: 1 }, "Saved school, major, year, goals, interests, and availability.", "Use this to explain current direction and constraints.", "medium"));
  }
  if (profile.experience.statedExperience) {
    const text = profile.experience.statedExperience.toLowerCase();
    items.push(item("profile-stated-experience", "Stated current experience", "profile", {
      "technical-depth": /project|coding|engineering|lab|research|analysis/.test(text) ? 1.5 : 0.5,
      "research-reasoning": /research|lab|study|paper/.test(text) ? 2 : 0,
      leadership: /leadership|led|president|captain|mentor/.test(text) ? 2 : 0,
      teamwork: /team|club|organization|internship/.test(text) ? 1.5 : 0,
      "interview-story-quality": 1,
    }, profile.experience.statedExperience, "Convert this into a STAR story only if the student can add actions and outcomes.", "low"));
  }
  return items;
}

function milestoneEvidence(records: MilestoneProgressRecord[]): EvidenceItem[] {
  return records.map((record) => item(`milestone-${record.milestoneId}`, `Completed milestone: ${record.milestoneId}`, "milestone", {
    "professional-reliability": 2.5,
    "career-fit-evidence": 2,
    communication: record.notes ? 2 : 1,
    "interview-story-quality": record.notes ? 2 : 1,
  }, record.notes ?? "Milestone marked complete in UnlockED progress.", "Use as proof of follow-through and planning.", record.source === "manual" ? "medium" : "low", record.completedDate ?? record.updatedAt));
}

function applicationEvidence(records: ApplicationRecord[]): EvidenceItem[] {
  return records.map((record) => {
    const submitted = ["submitted", "interview", "accepted", "completed"].includes(record.status);
    return item(`application-${record.opportunityId}`, `Application ${record.status}: ${record.opportunityId}`, "application", {
      "professional-reliability": submitted ? 3 : 2,
      execution: 0,
      communication: record.notes ? 2 : 1,
      "interview-story-quality": record.status === "interview" ? 2.5 : 1,
      "external-validation": record.status === "accepted" || record.status === "completed" ? 3 : submitted ? 1.5 : 0.5,
    } as Partial<Record<EvidenceDimension, number>>, record.nextAction ?? `Application is currently ${record.status}.`, "Use to discuss application judgment, preparation, and follow-through.", submitted ? "medium" : "low", record.lastUpdated);
  });
}

function activityEvidence(profile: AdvisorProfile): EvidenceItem[] {
  return Object.values(profile.experience.tracked).map((record) => {
    const completed = record.status === "Completed" || record.status === "Accepted";
    return item(`activity-${record.id}`, `Tracked opportunity: ${record.id}`, "activity", {
      "professional-reliability": completed ? 3 : 1.5,
      "external-validation": completed ? 2.5 : 0.5,
      "career-fit-evidence": 1.5,
      "interview-story-quality": completed ? 2 : 1,
    }, `Opportunity tracker status: ${record.status}.`, "Use only with the official opportunity context and the student's actual contribution.", completed ? "medium" : "low", record.updatedAt);
  });
}

function recommendationEvidence(recommendations: readonly RecommendationV1[]): EvidenceItem[] {
  return recommendations.slice(0, 5).map((recommendation) => item(`recommendation-${recommendation.id}`, recommendation.title, "recommendation", {
    "career-fit-evidence": Math.min(3, recommendation.confidence / 35),
    "interview-story-quality": recommendation.kind === "Milestone" ? 1.5 : 1,
  }, recommendation.reason, `If completed, this can support: ${recommendation.nextAction}`, recommendation.confidence >= 75 ? "medium" : "low"));
}

export function buildEvidenceInventory(input: { advisorProfile: AdvisorProfile; progress?: StudentProgress; recommendations?: readonly RecommendationV1[] }): EvidenceInventory {
  const completedMilestones = Object.values(input.progress?.milestones ?? input.advisorProfile.progress.milestoneProgress).filter((record) => record.status === "completed");
  const activeApplications = Object.values(input.progress?.applications ?? {}).length ? Object.values(input.progress?.applications ?? {}) : [
    ...input.advisorProfile.progress.activeApplications,
    ...input.advisorProfile.progress.upcomingDeadlines,
  ];
  const items = [
    ...profileEvidence(input.advisorProfile),
    ...activityEvidence(input.advisorProfile),
    ...milestoneEvidence(completedMilestones),
    ...applicationEvidence(activeApplications),
    ...recommendationEvidence(input.recommendations ?? []),
  ];
  const summary = Object.fromEntries(evidenceDimensions.map((dimension) => {
    const support = items
      .map((evidence) => ({ evidence, level: clampLevel(Number(evidence.dimensions[dimension] ?? 0)) }))
      .filter(({ level }) => level > 0)
      .sort((a, b) => b.level - a.level);
    if (!support.length) return [dimension, { level: 0, confidence: "low", sourceItemIds: [], supportCount: 0 }];
    const top = support[0].level;
    const repetition = Math.min(0.5, Math.max(0, support.length - 1) * 0.15);
    const confidence = support.map(({ evidence }) => evidence.confidence).sort((a, b) => confidenceRank[b] - confidenceRank[a])[0];
    return [dimension, { level: clampLevel(top + repetition), confidence, sourceItemIds: support.map(({ evidence }) => evidence.id), supportCount: support.length }];
  })) as EvidenceInventory["summary"];
  return {
    items,
    summary,
    gaps: evidenceDimensions.filter((dimension) => summary[dimension].level < 2),
  };
}
