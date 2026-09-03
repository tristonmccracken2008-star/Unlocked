import type { Opportunity } from "@/data/opportunities";
import type { OpportunityTrackerStatus, TrackedOpportunity } from "@/data/student-activity";
import { journeyWorkflowKind } from "@/data/journey-professional";
import { recentOpportunityChanges, requirementAddedByRecentChange, opportunityChangeLabel, opportunityChangeSummary } from "@/data/opportunity-changelog";
import { projectOpportunityTrust, verifiedApplicationRequirements } from "@/data/opportunity-trust";
import type { AccountData, AnswerBankStore, ApplicationRecommenderRecord, ApplicationTaskRecord, ApplicationWorkspaceRecord, JourneyCalendarEventRecord, WrittenResponseRecord } from "./account-types";
import { projectApplicationMaterialReadiness, type ApplicationMaterialProjectionContext, type ApplicationMaterialReadiness } from "./application-materials";

export type ApplicationWorkspaceTask = ApplicationTaskRecord & { recentlyUpdated?: boolean };

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
  sourceVerified: boolean;
  deadline?: string;
  deadlineDaysRemaining?: number;
  unfinishedCount: number;
  recentProviderUpdate?: { label: string; summary: string; detectedAt: string };
  materials: ApplicationMaterialReadiness;
};

const terminalPreparationStatuses = new Set<OpportunityTrackerStatus>(["Submitted", "Interview", "Accepted", "Completed"]);

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
  return applicationWorkspaceEligible(opportunity) ? verifiedApplicationRequirements(opportunity) : [];
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
    deletedTasks: existing?.deletedTasks ?? {},
    writtenResponses: existing?.writtenResponses ?? {},
    recommenders: existing?.recommenders ?? {},
    privateNotes: existing?.privateNotes,
    submissionSnapshots: existing?.submissionSnapshots ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: existing?.updatedAt ?? now,
    version: existing?.version ?? 0,
  } satisfies ApplicationWorkspaceRecord;
}

export function projectApplicationWorkspace(input: {
  opportunity: Opportunity;
  record: TrackedOpportunity;
  workspace?: ApplicationWorkspaceRecord;
  materials?: AccountData["applicationMaterials"];
  materialContext?: ApplicationMaterialProjectionContext;
  now?: Date;
}) {
  const eligible = applicationWorkspaceEligible(input.opportunity);
  const workspace = materializeApplicationWorkspace(input.workspace, input.opportunity, input.record.savedAt);
  const tasks = Object.values(workspace.tasks).map((task): ApplicationWorkspaceTask => ({
    ...task,
    recentlyUpdated: task.source === "verified_requirement" && requirementAddedByRecentChange(input.opportunity, task.title, input.now),
  })).sort((left, right) => {
    if (left.completed !== right.completed) return Number(left.completed) - Number(right.completed);
    if (left.dueDate !== right.dueDate) return (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31");
    if (left.source !== right.source) return left.source === "verified_requirement" ? -1 : 1;
    return left.createdAt.localeCompare(right.createdAt) || left.title.localeCompare(right.title);
  });
  const completedCount = tasks.filter((task) => task.completed).length;
  const trust = projectOpportunityTrust(input.opportunity, input.now);
  const deadline = trust.deadline.state === "verified" ? input.opportunity.application_deadline ?? undefined : undefined;
  const deadlineDaysRemaining = deadline
    ? Math.ceil((Date.parse(`${deadline}T23:59:59.999Z`) - (input.now ?? new Date()).getTime()) / 86_400_000)
    : undefined;
  const submittedEvent = [...(input.record.history ?? [])].reverse().find((event) => event.transition === "submit");
  const submitted = terminalPreparationStatuses.has(input.record.status);
  const providerUpdate = recentOpportunityChanges(input.opportunity, 8).find((event) => event.workspaceImpact
    && (input.now ?? new Date()).getTime() - Date.parse(event.detectedAt) <= 30 * 86_400_000);
  return {
    opportunityId: input.opportunity.id,
    eligible,
    requirementsVerified: trustedApplicationRequirements(input.opportunity).length > 0,
    tasks,
    completedCount,
    totalCount: tasks.length,
    progressPercent: tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0,
    readyForSubmission: !submitted && trust.verifiedRequirements.length > 0 && tasks.length > 0 && completedCount === tasks.length,
    submitted,
    submittedAt: submittedEvent?.occurredAt,
    workspaceVersion: workspace.version,
    officialSource: input.opportunity.official_source_url || input.opportunity.official_source,
    sourceVerified: trust.source.state === "official_source",
    deadline,
    deadlineDaysRemaining,
    unfinishedCount: tasks.length - completedCount,
    recentProviderUpdate: providerUpdate ? {
      label: opportunityChangeLabel(providerUpdate),
      summary: opportunityChangeSummary(providerUpdate),
      detectedAt: providerUpdate.detectedAt,
    } : undefined,
    materials: projectApplicationMaterialReadiness({
      opportunity: input.opportunity,
      store: input.materials,
      context: input.materialContext,
      recentlyAddedRequirements: new Set(tasks.filter((task) => task.recentlyUpdated).map((task) => task.title)),
    }),
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
    const deletedTasks: Record<string, ApplicationTaskRecord> = {};
    for (const [id, task] of Object.entries(candidate.deletedTasks ?? {}).slice(-10)) {
      if (!task || task.id !== id || task.source !== "user" || typeof task.title !== "string" || !task.title.trim()) continue;
      deletedTasks[id] = {
        ...task,
        title: task.title.replace(/\s+/g, " ").trim().slice(0, 120),
        dueDate: typeof task.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) ? task.dueDate : undefined,
        source: "user",
        completed: Boolean(task.completed),
        version: Number.isInteger(task.version) && task.version >= 0 ? task.version : 0,
      };
    }
    const writtenResponses: Record<string, WrittenResponseRecord> = {};
    for (const [id, response] of Object.entries(candidate.writtenResponses ?? {}).slice(0, 40)) {
      if (!response || response.id !== id || typeof response.prompt !== "string" || !response.prompt.trim()) continue;
      writtenResponses[id] = { id, prompt: response.prompt.replace(/\s+/g, " ").trim().slice(0, 2_000), source: response.source === "verified" ? "verified" : "student", sourceUrl: typeof response.sourceUrl === "string" ? response.sourceUrl.slice(0, 500) : undefined, required: Boolean(response.required), wordLimit: Number.isInteger(response.wordLimit) && response.wordLimit! > 0 && response.wordLimit! <= 10_000 ? response.wordLimit : undefined, characterLimit: Number.isInteger(response.characterLimit) && response.characterLimit! > 0 && response.characterLimit! <= 100_000 ? response.characterLimit : undefined, draft: typeof response.draft === "string" ? response.draft.slice(0, 100_000) : "", status: response.status === "ready" ? "ready" : response.draft?.trim() ? "draft" : "not_started", revisions: (response.revisions ?? []).filter((item) => item?.id && typeof item.draft === "string" && item.createdAt).slice(-20).map((item) => ({ id: item.id, draft: item.draft.slice(0, 100_000), createdAt: item.createdAt })), createdAt: response.createdAt, updatedAt: response.updatedAt, version: Number.isInteger(response.version) && response.version >= 0 ? response.version : 0 };
    }
    const recommenderStatuses = new Set<ApplicationRecommenderRecord["status"]>(["not_requested", "planning", "requested", "confirmed", "submitted", "unknown", "declined"]);
    const recommenders: Record<string, ApplicationRecommenderRecord> = {};
    for (const [id, person] of Object.entries(candidate.recommenders ?? {}).slice(0, 20)) {
      if (!person || person.id !== id || typeof person.name !== "string" || !person.name.trim()) continue;
      recommenders[id] = { ...person, id, name: person.name.replace(/\s+/g, " ").trim().slice(0, 120), role: person.role?.replace(/\s+/g, " ").trim().slice(0, 120), organization: person.organization?.replace(/\s+/g, " ").trim().slice(0, 160), email: person.email?.trim().slice(0, 160), relationship: person.relationship?.replace(/\s+/g, " ").trim().slice(0, 300), notes: person.notes?.slice(0, 2_000), status: recommenderStatuses.has(person.status) ? person.status : "unknown", version: Number.isInteger(person.version) && person.version >= 0 ? person.version : 0 };
    }
    const submissionSnapshots = (candidate.submissionSnapshots ?? []).filter((item) => item?.id && item.createdAt && item.opportunity?.title && item.opportunity?.officialSource).slice(-10).map((item) => ({ id: item.id, createdAt: item.createdAt, opportunity: { title: item.opportunity.title.slice(0, 300), organization: item.opportunity.organization.slice(0, 200), officialSource: item.opportunity.officialSource.slice(0, 2_000), deadline: item.opportunity.deadline?.slice(0, 10) }, materials: (item.materials ?? []).slice(0, 40).map((material) => ({ materialId: material.materialId.slice(0, 160), requirementType: material.requirementType.slice(0, 80), title: material.title.slice(0, 200), versionLabel: material.versionLabel?.slice(0, 120) })), writtenResponses: (item.writtenResponses ?? []).slice(0, 40).map((response) => ({ id: response.id, prompt: response.prompt.slice(0, 2_000), draft: response.draft.slice(0, 100_000), version: response.version })), recommenders: (item.recommenders ?? []).slice(0, 20), notes: item.notes?.slice(0, 4_000) }));
    workspaces[opportunityId] = { ...candidate, opportunityId, tasks, deletedTasks, writtenResponses, recommenders, privateNotes: typeof candidate.privateNotes === "string" ? candidate.privateNotes.slice(0, 4_000) : undefined, submissionSnapshots, version: Number.isInteger(candidate.version) && candidate.version >= 0 ? candidate.version : 0 };
  }
  return workspaces;
}

export function normalizeAnswerBank(value: AnswerBankStore | undefined): AnswerBankStore {
  const records: AnswerBankStore["records"] = {};
  for (const [id, story] of Object.entries(value?.records ?? {}).slice(0, 500)) {
    if (!story || story.id !== id || typeof story.title !== "string" || !story.title.trim()) continue;
    const clean = (text: string | undefined, max = 4_000) => text?.trim().slice(0, max) || undefined;
    records[id] = { id, title: story.title.replace(/\s+/g, " ").trim().slice(0, 120), category: clean(story.category, 80) ?? "custom", experienceIds: [...new Set(story.experienceIds ?? [])].slice(0, 20), situation: clean(story.situation), action: clean(story.action), challenge: clean(story.challenge), result: clean(story.result), learning: clean(story.learning), notes: clean(story.notes), createdAt: story.createdAt, updatedAt: story.updatedAt, version: Number.isInteger(story.version) && story.version >= 0 ? story.version : 0 };
  }
  return { records, version: Number.isInteger(value?.version) && value!.version >= 0 ? value!.version : 0, updatedAt: value?.updatedAt };
}
