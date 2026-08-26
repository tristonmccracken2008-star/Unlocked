import type { Opportunity } from "@/data/opportunities";
import { applicationMaterialTypeLabels, type ApplicationMaterialType } from "@/data/application-materials";
import type { OpportunityTrackerStatus, TrackedOpportunity } from "@/data/student-activity";
import { getJourneyProfessionalActions, getJourneyProfessionalWorkflow, resolveJourneyProfessionalStage } from "@/data/journey-professional";
import type { AccountData } from "./account-types";
import { applicationWorkspaceEligible, projectApplicationWorkspace, type ApplicationWorkspaceProjection } from "./application-workspace";
import { createApplicationMaterialProjectionContext } from "./application-materials";

export type ApplicationsWorkspaceState = "needs_attention" | "ready" | "waiting" | "submitted" | "requirements_unknown";
export type ApplicationsWorkspaceAttentionKind = "material_missing" | "material_update" | "task" | "task_due" | "deadline" | "provider_change";

export type ApplicationsWorkspaceAttention = {
  id: string;
  applicationId: string;
  kind: ApplicationsWorkspaceAttentionKind;
  label: string;
  detail: string;
  dueDate?: string;
  priority: number;
  href: string;
};

export type ApplicationsWorkspaceNextAction = {
  kind: "select_material" | "review_material" | "complete_task" | "review_change" | "open_provider" | "mark_applied" | "none";
  label: string;
  detail: string;
  href: string;
  taskId?: string;
  materialType?: ApplicationMaterialType;
};

export type ApplicationsWorkspaceApplication = {
  id: string;
  title: string;
  organization: string;
  category: string;
  status: OpportunityTrackerStatus;
  stageLabel: string;
  updatedAt: string;
  state: ApplicationsWorkspaceState;
  stateLabel: string;
  attention: ApplicationsWorkspaceAttention[];
  nextAction: ApplicationsWorkspaceNextAction;
  deadline?: string;
  deadlineDaysRemaining?: number;
  incompleteTaskCount: number;
  verifiedRequirementCount: number;
  coveredRequirementCount: number;
  materialRequirementCount: number;
  recentChange?: ApplicationWorkspaceProjection["recentProviderUpdate"];
  commandCenterHref: string;
  officialSource: string;
  sourceVerified: boolean;
  workspace: ApplicationWorkspaceProjection;
  submission?: {
    professionalStageId: string;
    expectedStatus: OpportunityTrackerStatus;
    expectedVersion: number;
  };
};

export type ApplicationsWorkspaceMaterialDemand = {
  type: ApplicationMaterialType;
  label: string;
  applicationCount: number;
  selectedCount: number;
  availableCount: number;
  needsAttentionCount: number;
  missingCount: number;
  applications: Array<{ id: string; title: string; state: string }>;
};

export type ApplicationsWorkspaceDeadlineCluster = {
  id: string;
  start: string;
  end: string;
  label: string;
  applicationIds: string[];
};

export type ApplicationsWorkspaceModel = {
  applications: ApplicationsWorkspaceApplication[];
  attention: ApplicationsWorkspaceAttention[];
  active: ApplicationsWorkspaceApplication[];
  submitted: ApplicationsWorkspaceApplication[];
  ready: ApplicationsWorkspaceApplication[];
  materials: ApplicationsWorkspaceMaterialDemand[];
  deadlines: Array<{ applicationId: string; title: string; date: string; daysRemaining?: number }>;
  deadlineClusters: ApplicationsWorkspaceDeadlineCluster[];
  counts: { active: number; needsAttention: number; ready: number; submitted: number; unknown: number };
  generatedAt: string;
};

const preparationStatuses = new Set<OpportunityTrackerStatus>(["Interested", "Applying", "Paused"]);
const postSubmissionStatuses = new Set<OpportunityTrackerStatus>(["Submitted", "Interview", "Accepted", "Rejected", "Completed"]);

function commandCenterHref(id: string) {
  return `/applications/${encodeURIComponent(id)}`;
}

function datePriority(value: string | undefined) {
  return value ? Date.parse(`${value}T23:59:59.999Z`) : Number.POSITIVE_INFINITY;
}

function attentionFor(application: Omit<ApplicationsWorkspaceApplication, "attention" | "nextAction" | "state" | "stateLabel">, now: Date) {
  const items: ApplicationsWorkspaceAttention[] = [];
  const href = commandCenterHref(application.id);
  for (const requirement of application.workspace.materials.mappedRequirements) {
    if (requirement.state === "missing") items.push({ id: `${application.id}:material:${requirement.type}:missing`, applicationId: application.id, kind: "material_missing", label: `${requirement.typeLabel} missing`, detail: `No ${requirement.typeLabel.toLocaleLowerCase()} is available for this verified requirement.`, priority: 1, href: `/materials?type=${requirement.type}` });
    else if (requirement.state === "needs_attention") items.push({ id: `${application.id}:material:${requirement.type}:update`, applicationId: application.id, kind: "material_update", label: `${requirement.typeLabel} needs review`, detail: `The available ${requirement.typeLabel.toLocaleLowerCase()} is not marked Ready.`, priority: 2, href: "/materials" });
    else if (requirement.state === "available") items.push({ id: `${application.id}:material:${requirement.type}:select`, applicationId: application.id, kind: "material_missing", label: `Select a ${requirement.typeLabel.toLocaleLowerCase()}`, detail: `A Ready version is available but has not been selected for this application.`, priority: 2, href });
  }
  for (const task of application.workspace.tasks.filter((item) => !item.completed)) {
    const due = task.dueDate ? Math.ceil((datePriority(task.dueDate) - now.getTime()) / 86_400_000) : undefined;
    items.push({
      id: `${application.id}:task:${task.id}`,
      applicationId: application.id,
      kind: due !== undefined && due <= 7 ? "task_due" : "task",
      label: task.title,
      detail: task.dueDate ? `Your task is due ${task.dueDate}.` : task.source === "verified_requirement" ? "Verified application requirement not yet recorded as complete." : "Private application task not yet complete.",
      dueDate: task.dueDate,
      priority: due !== undefined && due < 0 ? 0 : due !== undefined && due <= 2 ? 1 : task.source === "verified_requirement" ? 3 : 4,
      href,
    });
  }
  if (application.recentChange) items.push({ id: `${application.id}:change`, applicationId: application.id, kind: "provider_change", label: application.recentChange.label, detail: application.recentChange.summary, priority: 1, href });
  if (application.deadline && application.deadlineDaysRemaining !== undefined && application.deadlineDaysRemaining >= 0 && application.deadlineDaysRemaining <= 14) items.push({
    id: `${application.id}:deadline`, applicationId: application.id, kind: "deadline", label: application.deadlineDaysRemaining === 0 ? "Application due today" : application.deadlineDaysRemaining === 1 ? "Application due tomorrow" : `Application due in ${application.deadlineDaysRemaining} days`, detail: `Verified application deadline: ${application.deadline}.`, dueDate: application.deadline, priority: application.deadlineDaysRemaining <= 2 ? 1 : 5, href,
  });
  return items.sort((left, right) => left.priority - right.priority || datePriority(left.dueDate) - datePriority(right.dueDate) || left.label.localeCompare(right.label));
}

function stateFor(record: TrackedOpportunity, workspace: ApplicationWorkspaceProjection, attention: readonly ApplicationsWorkspaceAttention[]): [ApplicationsWorkspaceState, string] {
  if (postSubmissionStatuses.has(record.status)) {
    const labels: Partial<Record<OpportunityTrackerStatus, string>> = { Submitted: "Submitted", Interview: "Interviewing", Accepted: "Accepted", Rejected: "Not selected", Completed: "Completed" };
    return ["submitted", labels[record.status] ?? record.status];
  }
  if (record.status === "Paused") return ["waiting", "Paused"];
  if (!workspace.requirementsVerified) return ["requirements_unknown", "Requirements not verified"];
  const unresolved = attention.some((item) => item.kind !== "deadline");
  if (unresolved) return ["needs_attention", "Needs attention"];
  return ["ready", "Ready"];
}

function nextActionFor(application: Omit<ApplicationsWorkspaceApplication, "nextAction">): ApplicationsWorkspaceNextAction {
  const first = application.attention.find((item) => item.kind !== "deadline");
  if (first?.kind === "material_missing") return { kind: "select_material", label: first.label.startsWith("Select") ? first.label : "Add material", detail: first.detail, href: first.href, materialType: application.workspace.materials.mappedRequirements.find((item) => first.id.includes(`:${item.type}:`))?.type };
  if (first?.kind === "material_update") return { kind: "review_material", label: "Review material", detail: first.detail, href: first.href };
  if (first?.kind === "provider_change") return { kind: "review_change", label: "Review change", detail: first.detail, href: first.href };
  if (first?.kind === "task" || first?.kind === "task_due") return { kind: "complete_task", label: first.label, detail: first.detail, href: first.href, taskId: first.id.split(":task:")[1] };
  if (application.state === "ready" && application.submission) return { kind: "mark_applied", label: "Mark as applied", detail: "Use this only after you submit through the provider.", href: application.commandCenterHref };
  if (application.state === "requirements_unknown") return { kind: "open_provider", label: "Review provider requirements", detail: "UnlockED does not have verified requirements for this application.", href: application.officialSource };
  if (application.state === "submitted") return { kind: "none", label: "Awaiting outcome", detail: "Keep Journey updated when the provider responds.", href: application.commandCenterHref };
  return { kind: "open_provider", label: "Open application", detail: "Continue on the provider’s official site.", href: application.officialSource };
}

function deadlineClusters(applications: readonly ApplicationsWorkspaceApplication[]) {
  const dated = applications.filter((item) => item.deadline).sort((a, b) => datePriority(a.deadline) - datePriority(b.deadline));
  const clusters: ApplicationsWorkspaceDeadlineCluster[] = [];
  for (let start = 0; start < dated.length; start += 1) {
    let end = start;
    while (end + 1 < dated.length && datePriority(dated[end + 1]!.deadline) - datePriority(dated[start]!.deadline) <= 7 * 86_400_000) end += 1;
    if (end - start + 1 >= 2) {
      const group = dated.slice(start, end + 1);
      clusters.push({ id: `deadlines:${group[0]!.deadline}:${group.at(-1)!.deadline}`, start: group[0]!.deadline!, end: group.at(-1)!.deadline!, label: `${group.length} application deadlines in ${Math.round((datePriority(group.at(-1)!.deadline) - datePriority(group[0]!.deadline)) / 86_400_000) + 1} days`, applicationIds: group.map((item) => item.id) });
      start = end;
    }
  }
  return clusters;
}

export function buildApplicationsWorkspace(input: { account: AccountData; opportunities: readonly Opportunity[]; now?: Date }): ApplicationsWorkspaceModel {
  const now = input.now ?? new Date();
  const records = { ...(input.account.activity?.tracked ?? {}), ...(input.account.tracker ?? {}) };
  const opportunityById = new Map(input.opportunities.map((item) => [item.id, item]));
  const materialContext = createApplicationMaterialProjectionContext(input.account.applicationMaterials);
  const applications: ApplicationsWorkspaceApplication[] = [];
  for (const record of Object.values(records)) {
    if (!preparationStatuses.has(record.status) && !postSubmissionStatuses.has(record.status)) continue;
    const opportunity = opportunityById.get(record.id);
    if (!opportunity || !applicationWorkspaceEligible(opportunity)) continue;
    const workspace = projectApplicationWorkspace({ opportunity, record, workspace: input.account.applicationWorkspaces?.[record.id], materialContext, now });
    const workflow = getJourneyProfessionalWorkflow(opportunity);
    const submit = getJourneyProfessionalActions(record, workflow).find((action) => action.resultingStatus === "Submitted" && action.stage);
    const base = {
      id: record.id,
      title: opportunity.title,
      organization: opportunity.organization,
      category: opportunity.category,
      status: record.status,
      stageLabel: resolveJourneyProfessionalStage(record, workflow).label,
      updatedAt: record.updatedAt,
      deadline: workspace.deadline,
      deadlineDaysRemaining: workspace.deadlineDaysRemaining,
      incompleteTaskCount: workspace.unfinishedCount,
      verifiedRequirementCount: workspace.tasks.filter((task) => task.source === "verified_requirement").length,
      coveredRequirementCount: workspace.tasks.filter((task) => task.source === "verified_requirement" && task.completed).length,
      materialRequirementCount: workspace.materials.mappedRequirements.length,
      recentChange: workspace.recentProviderUpdate,
      commandCenterHref: commandCenterHref(record.id),
      officialSource: workspace.officialSource,
      sourceVerified: workspace.sourceVerified,
      workspace,
      submission: submit?.stage ? { professionalStageId: submit.stage.id, expectedStatus: record.status, expectedVersion: record.version ?? 0 } : undefined,
    };
    const attention = postSubmissionStatuses.has(record.status) ? [] : attentionFor(base, now);
    const [state, stateLabel] = stateFor(record, workspace, attention);
    const withState = { ...base, state, stateLabel, attention };
    applications.push({ ...withState, nextAction: nextActionFor(withState) });
  }
  applications.sort((left, right) => {
    const group = (item: ApplicationsWorkspaceApplication) => item.state === "needs_attention" ? 0 : item.attention.length ? 1 : item.state === "ready" ? 2 : item.state === "requirements_unknown" ? 3 : item.state === "waiting" ? 4 : 5;
    return group(left) - group(right) || (left.attention[0]?.priority ?? 99) - (right.attention[0]?.priority ?? 99) || datePriority(left.deadline) - datePriority(right.deadline) || right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title);
  });
  const active = applications.filter((item) => item.state !== "submitted");
  const submitted = applications.filter((item) => item.state === "submitted");
  const attention = active.flatMap((item) => item.attention).sort((left, right) => left.priority - right.priority || datePriority(left.dueDate) - datePriority(right.dueDate) || left.label.localeCompare(right.label));
  const materialMap = new Map<ApplicationMaterialType, ApplicationsWorkspaceMaterialDemand>();
  for (const application of active) for (const requirement of application.workspace.materials.mappedRequirements) {
    const current = materialMap.get(requirement.type) ?? { type: requirement.type, label: applicationMaterialTypeLabels[requirement.type], applicationCount: 0, selectedCount: 0, availableCount: 0, needsAttentionCount: 0, missingCount: 0, applications: [] };
    current.applicationCount += 1;
    if (requirement.state === "selected") current.selectedCount += 1;
    if (requirement.state === "available") current.availableCount += 1;
    if (requirement.state === "needs_attention") current.needsAttentionCount += 1;
    if (requirement.state === "missing") current.missingCount += 1;
    current.applications.push({ id: application.id, title: application.title, state: requirement.state });
    materialMap.set(requirement.type, current);
  }
  const deadlines = active.filter((item) => item.deadline).map((item) => ({ applicationId: item.id, title: item.title, date: item.deadline!, daysRemaining: item.deadlineDaysRemaining })).sort((a, b) => datePriority(a.date) - datePriority(b.date));
  return {
    applications,
    attention,
    active,
    submitted,
    ready: active.filter((item) => item.state === "ready"),
    materials: [...materialMap.values()].sort((a, b) => b.applicationCount - a.applicationCount || a.label.localeCompare(b.label)),
    deadlines,
    deadlineClusters: deadlineClusters(active),
    counts: { active: active.length, needsAttention: active.filter((item) => item.state === "needs_attention").length, ready: active.filter((item) => item.state === "ready").length, submitted: submitted.length, unknown: active.filter((item) => item.state === "requirements_unknown").length },
    generatedAt: now.toISOString(),
  };
}
