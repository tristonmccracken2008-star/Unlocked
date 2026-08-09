import type { Opportunity } from "@/data/opportunities";
import type { OpportunityTrackerStatus, TrackedOpportunity } from "@/data/student-activity";
import { journeyWorkflowKind } from "@/data/journey-professional";
import type { AccountData, ApplicationTaskRecord, ApplicationWorkspaceRecord, JourneyCalendarEventRecord } from "./account-types";

export type ApplicationWorkspaceTask = ApplicationTaskRecord;

export type ApplicationWorkspaceProjection = {
  opportunityId: string;
  eligible: boolean;
  requirementsVerified: boolean;
  tasks: ApplicationWorkspaceTask[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  readyForSubmission: boolean;
  submitted: boolean;
  submittedAt?: string;
  workspaceVersion: number;
  officialSource: string;
  deadline?: string;
  deadlineDaysRemaining?: number;
  unfinishedCount: number;
};

const terminalPreparationStatuses = new Set<OpportunityTrackerStatus>(["Submitted", "Interview", "Accepted", "Completed"]);
const genericRequirementPatterns = [
  /^start at .+ official website/i,
  /^search for the current office/i,
  /^confirm eligibility, deadlines, and application/i,
];

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function verifiedTaskId(opportunityId: string, title: string) {
  return `requirement:${hashText(`${opportunityId}:${title.toLocaleLowerCase()}`)}`;
}

export function customApplicationTaskId(opportunityId: string, idempotencyKey: string) {
  return `task:${hashText(`${opportunityId}:${idempotencyKey}`)}`;
}

export function applicationWorkspaceEligible(opportunity: Pick<Opportunity, "type" | "category" | "metadata">) {
  if (opportunity.metadata.eligibilityRules?.availability === "no_application") return false;
  if (/career resources|student organizations|certifications/i.test(opportunity.category)) return false;
  return journeyWorkflowKind(opportunity) !== "resource";
}

export function trustedApplicationRequirements(opportunity: Opportunity) {
  if (!applicationWorkspaceEligible(opportunity) || opportunity.verification_status !== "verified") return [];
  return [...new Set(opportunity.metadata.applicationRequirements ?? [])]
    .filter((requirement) => !genericRequirementPatterns.some((pattern) => pattern.test(requirement)))
    .slice(0, 20);
}

export function materializeApplicationWorkspace(existing: ApplicationWorkspaceRecord | undefined, opportunity: Opportunity, now = new Date().toISOString()) {
  const requirements = trustedApplicationRequirements(opportunity);
  const current = existing?.tasks ?? {};
  const tasks: Record<string, ApplicationTaskRecord> = {};
  for (const title of requirements) {
    const id = verifiedTaskId(opportunity.id, title);
    const saved = current[id];
    tasks[id] = saved ? { ...saved, title, source: "verified_requirement" } : {
      id,
      title,
      source: "verified_requirement",
      completed: false,
      createdAt: now,
      updatedAt: now,
      version: 0,
    };
  }
  for (const task of Object.values(current)) {
    if (task.source === "user") tasks[task.id] = task;
  }
  return {
    opportunityId: opportunity.id,
    tasks,
    createdAt: existing?.createdAt ?? now,
    updatedAt: existing?.updatedAt ?? now,
    version: existing?.version ?? 0,
  } satisfies ApplicationWorkspaceRecord;
}

export function projectApplicationWorkspace(input: {
  opportunity: Opportunity;
  record: TrackedOpportunity;
  workspace?: ApplicationWorkspaceRecord;
  now?: Date;
}) {
  const eligible = applicationWorkspaceEligible(input.opportunity);
  const workspace = materializeApplicationWorkspace(input.workspace, input.opportunity, input.record.savedAt);
  const tasks = Object.values(workspace.tasks).sort((left, right) => {
    if (left.completed !== right.completed) return Number(left.completed) - Number(right.completed);
    if (left.dueDate !== right.dueDate) return (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31");
    if (left.source !== right.source) return left.source === "verified_requirement" ? -1 : 1;
    return left.createdAt.localeCompare(right.createdAt) || left.title.localeCompare(right.title);
  });
  const completedCount = tasks.filter((task) => task.completed).length;
  const deadline = input.opportunity.application_deadline ?? undefined;
  const deadlineDaysRemaining = deadline
    ? Math.ceil((Date.parse(`${deadline}T23:59:59.999Z`) - (input.now ?? new Date()).getTime()) / 86_400_000)
    : undefined;
  const submittedEvent = [...(input.record.history ?? [])].reverse().find((event) => event.transition === "submit");
  const submitted = terminalPreparationStatuses.has(input.record.status);
  return {
    opportunityId: input.opportunity.id,
    eligible,
    requirementsVerified: trustedApplicationRequirements(input.opportunity).length > 0,
    tasks,
    completedCount,
    totalCount: tasks.length,
    progressPercent: tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0,
    readyForSubmission: !submitted && tasks.length > 0 && completedCount === tasks.length,
    submitted,
    submittedAt: submittedEvent?.occurredAt,
    workspaceVersion: workspace.version,
    officialSource: input.opportunity.official_source_url || input.opportunity.official_source,
    deadline,
    deadlineDaysRemaining,
    unfinishedCount: tasks.length - completedCount,
  } satisfies ApplicationWorkspaceProjection;
}

export function applicationTaskCalendarEvents(account: Pick<AccountData, "applicationWorkspaces">) {
  return Object.values(account.applicationWorkspaces ?? {}).flatMap((workspace) => Object.values(workspace.tasks).flatMap((task): JourneyCalendarEventRecord[] => {
    if (!task.dueDate) return [];
    return [{
      id: `application-task:${hashText(`${workspace.opportunityId}:${task.id}`)}`,
      type: "personal_target",
      title: task.title,
      date: task.dueDate,
      opportunityId: workspace.opportunityId,
      source: "application_task",
      reminderMinutesBefore: 1_440,
      completed: task.completed,
      dismissed: false,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      version: task.version,
    }];
  }));
}

export function normalizeApplicationWorkspaces(value: AccountData["applicationWorkspaces"]) {
  if (!value || typeof value !== "object") return {};
  const workspaces: NonNullable<AccountData["applicationWorkspaces"]> = {};
  for (const [opportunityId, candidate] of Object.entries(value).slice(0, 250)) {
    if (!candidate || candidate.opportunityId !== opportunityId || !candidate.tasks || typeof candidate.tasks !== "object") continue;
    const tasks: Record<string, ApplicationTaskRecord> = {};
    for (const [id, task] of Object.entries(candidate.tasks).slice(0, 40)) {
      if (!task || task.id !== id || typeof task.title !== "string" || !task.title.trim()) continue;
      tasks[id] = {
        id,
        title: task.title.replace(/\s+/g, " ").trim().slice(0, 120),
        dueDate: typeof task.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) ? task.dueDate : undefined,
        source: task.source === "verified_requirement" ? "verified_requirement" : "user",
        completed: Boolean(task.completed),
        completedAt: task.completed && typeof task.completedAt === "string" ? task.completedAt : undefined,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        version: Number.isInteger(task.version) && task.version >= 0 ? task.version : 0,
      };
    }
    workspaces[opportunityId] = { ...candidate, opportunityId, tasks, version: Number.isInteger(candidate.version) && candidate.version >= 0 ? candidate.version : 0 };
  }
  return workspaces;
}
