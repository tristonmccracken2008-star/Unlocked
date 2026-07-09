import type { OpportunityPriority } from "./opportunity-intelligence";
import type { Opportunity } from "./opportunities";
import type { RoadmapMilestone } from "./roadmap-engine";
import type { StudentActivity } from "./student-activity";

export const studentProgressStorageKey = "unlocked-student-progress";
export const studentProgressEvent = "unlocked-student-progress-change";

export type MilestoneStatus = "not_started" | "in_progress" | "completed" | "skipped";
export type ProgressSource = "manual" | "inferred" | "system";

export type MilestoneProgressRecord = {
  milestoneId: string;
  status: MilestoneStatus;
  startedDate?: string;
  completedDate?: string;
  notes?: string;
  source: ProgressSource;
  updatedAt: string;
};

export type ApplicationStatus = "saved" | "interested" | "preparing" | "applying" | "submitted" | "interview" | "accepted" | "rejected" | "completed";

export type ApplicationRecord = {
  opportunityId: string;
  status: ApplicationStatus;
  deadline?: string | null;
  priority: OpportunityPriority;
  lastUpdated: string;
  notes?: string;
  nextAction?: string;
  source: ProgressSource;
};

export type StudentProgress = {
  milestones: Record<string, MilestoneProgressRecord>;
  applications: Record<string, ApplicationRecord>;
};

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const emptyProgress = (): StudentProgress => ({ milestones: {}, applications: {} });

function normalizeMilestoneStatus(status: unknown): MilestoneStatus {
  return status === "in_progress" || status === "completed" || status === "skipped" ? status : "not_started";
}

function normalizeApplicationStatus(status: unknown): ApplicationStatus {
  return status === "interested" || status === "preparing" || status === "applying" || status === "submitted" || status === "interview" || status === "accepted" || status === "rejected" || status === "completed" ? status : "saved";
}

function normalizePriority(priority: unknown): OpportunityPriority {
  return priority === "Critical" || priority === "High" || priority === "Optional" ? priority : "Recommended";
}

function normalizeSource(source: unknown): ProgressSource {
  return source === "inferred" || source === "system" ? source : "manual";
}

export function normalizeStudentProgress(value: unknown): StudentProgress {
  if (!value || typeof value !== "object") return emptyProgress();
  const input = value as Partial<StudentProgress>;
  const milestones = Object.fromEntries(Object.entries(input.milestones ?? {}).map(([milestoneId, record]) => {
    const item = record as Partial<MilestoneProgressRecord>;
    return [milestoneId, {
      milestoneId,
      status: normalizeMilestoneStatus(item.status),
      startedDate: item.startedDate,
      completedDate: item.completedDate,
      notes: item.notes,
      source: normalizeSource(item.source),
      updatedAt: item.updatedAt ?? now(),
    } satisfies MilestoneProgressRecord];
  }));
  const applications = Object.fromEntries(Object.entries(input.applications ?? {}).map(([opportunityId, record]) => {
    const item = record as Partial<ApplicationRecord>;
    return [opportunityId, {
      opportunityId,
      status: normalizeApplicationStatus(item.status),
      deadline: item.deadline ?? null,
      priority: normalizePriority(item.priority),
      lastUpdated: item.lastUpdated ?? now(),
      notes: item.notes,
      nextAction: item.nextAction,
      source: normalizeSource(item.source),
    } satisfies ApplicationRecord];
  }));
  return { milestones, applications };
}

export function readStudentProgress() {
  try {
    return normalizeStudentProgress(JSON.parse(localStorage.getItem(studentProgressStorageKey) ?? "null"));
  } catch {
    return emptyProgress();
  }
}

export function writeStudentProgress(progress: StudentProgress) {
  const normalized = normalizeStudentProgress(progress);
  localStorage.setItem(studentProgressStorageKey, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(studentProgressEvent, { detail: normalized }));
  return normalized;
}

export function getMilestoneStatus(progress: StudentProgress, milestoneId: string): MilestoneStatus {
  return progress.milestones[milestoneId]?.status ?? "not_started";
}

function updateMilestone(progress: StudentProgress, milestoneId: string, status: MilestoneStatus, input: Partial<Pick<MilestoneProgressRecord, "notes" | "source">> = {}) {
  const existing = progress.milestones[milestoneId];
  const timestamp = now();
  return normalizeStudentProgress({
    ...progress,
    milestones: {
      ...progress.milestones,
      [milestoneId]: {
        milestoneId,
        status,
        startedDate: existing?.startedDate ?? (status === "in_progress" || status === "completed" ? today() : undefined),
        completedDate: status === "completed" ? today() : existing?.completedDate,
        notes: input.notes ?? existing?.notes,
        source: input.source ?? existing?.source ?? "manual",
        updatedAt: timestamp,
      },
    },
  });
}

export function markMilestoneInProgress(progress: StudentProgress, milestoneId: string, notes?: string, source: ProgressSource = "manual") {
  return updateMilestone(progress, milestoneId, "in_progress", { notes, source });
}

export function markMilestoneCompleted(progress: StudentProgress, milestoneId: string, notes?: string, source: ProgressSource = "manual") {
  return updateMilestone(progress, milestoneId, "completed", { notes, source });
}

export function markMilestoneSkipped(progress: StudentProgress, milestoneId: string, notes?: string, source: ProgressSource = "manual") {
  return updateMilestone(progress, milestoneId, "skipped", { notes, source });
}

export function getActiveMilestones(progress: StudentProgress) {
  return Object.values(progress.milestones).filter((record) => record.status === "in_progress");
}

export function getCompletedMilestones(progress: StudentProgress) {
  return Object.values(progress.milestones).filter((record) => record.status === "completed");
}

export function getNextIncompleteMilestone(milestones: readonly RoadmapMilestone[], progress: StudentProgress) {
  return milestones.find((milestone) => !["completed", "skipped"].includes(getMilestoneStatus(progress, milestone.id))) ?? null;
}

function deadlineDays(deadline?: string | null) {
  if (!deadline) return null;
  const date = new Date(`${deadline}T23:59:59Z`);
  return Math.ceil((date.getTime() - new Date().getTime()) / 86400000);
}

export function inferApplicationsFromActivity(activity: StudentActivity | undefined, opportunities: readonly Opportunity[] = [], existing: StudentProgress = emptyProgress()): StudentProgress {
  const applications = { ...existing.applications };
  for (const id of activity?.saved ?? []) {
    const opportunity = opportunities.find((item) => item.id === id);
    if (!applications[id]) applications[id] = { opportunityId: id, status: "saved", deadline: opportunity?.application_deadline ?? null, priority: "Recommended", lastUpdated: now(), nextAction: opportunity?.application_deadline ? "Review requirements before the deadline." : "Review requirements and decide whether to apply.", source: "inferred" };
  }
  for (const [id, tracked] of Object.entries(activity?.tracked ?? {})) {
    const opportunity = opportunities.find((item) => item.id === id);
    const mapped = normalizeApplicationStatus(tracked.status.toLowerCase());
    applications[id] = { ...applications[id], opportunityId: id, status: mapped, deadline: opportunity?.application_deadline ?? applications[id]?.deadline ?? null, priority: applications[id]?.priority ?? "Recommended", lastUpdated: tracked.updatedAt, nextAction: applications[id]?.nextAction ?? "Keep this application moving.", source: applications[id]?.source ?? "inferred" };
  }
  return normalizeStudentProgress({ ...existing, applications });
}

export function getApplicationStatus(progress: StudentProgress, opportunityId: string): ApplicationStatus {
  return progress.applications[opportunityId]?.status ?? "saved";
}

export function updateApplicationStatus(progress: StudentProgress, opportunityId: string, status: ApplicationStatus, updates: Partial<Omit<ApplicationRecord, "opportunityId" | "status" | "lastUpdated">> = {}) {
  const existing = progress.applications[opportunityId];
  return normalizeStudentProgress({
    ...progress,
    applications: {
      ...progress.applications,
      [opportunityId]: {
        opportunityId,
        status,
        deadline: updates.deadline ?? existing?.deadline ?? null,
        priority: updates.priority ?? existing?.priority ?? "Recommended",
        lastUpdated: now(),
        notes: updates.notes ?? existing?.notes,
        nextAction: updates.nextAction ?? existing?.nextAction,
        source: updates.source ?? existing?.source ?? "manual",
      },
    },
  });
}

export function getActiveApplications(progress: StudentProgress) {
  return Object.values(progress.applications).filter((record) => ["interested", "preparing", "applying", "interview"].includes(record.status));
}

export function getSubmittedApplications(progress: StudentProgress) {
  return Object.values(progress.applications).filter((record) => ["submitted", "interview", "accepted", "completed"].includes(record.status));
}

export function getUpcomingApplicationDeadlines(progress: StudentProgress, days = 30) {
  return Object.values(progress.applications).filter((record) => {
    const remaining = deadlineDays(record.deadline);
    return remaining !== null && remaining >= 0 && remaining <= days && !["submitted", "accepted", "rejected", "completed"].includes(record.status);
  }).sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
}

export function getApplicationsNeedingAttention(progress: StudentProgress) {
  const staleCutoff = Date.now() - 1000 * 60 * 60 * 24 * 14;
  return Object.values(progress.applications).filter((record) => {
    const remaining = deadlineDays(record.deadline);
    const stale = new Date(record.lastUpdated).getTime() < staleCutoff && ["preparing", "applying", "interested"].includes(record.status);
    return stale || (remaining !== null && remaining >= 0 && remaining <= 10 && !["submitted", "accepted", "rejected", "completed"].includes(record.status));
  });
}
