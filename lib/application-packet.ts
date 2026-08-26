import type { Opportunity } from "@/data/opportunities";
import type {
  ApplicationMaterialRecord,
  ApplicationMaterialType,
} from "@/data/application-materials";
import {
  materialAssociationId,
  normalizeApplicationMaterialStore,
} from "@/data/application-materials";
import { materialTypeForRequirement } from "./application-materials";
import type { AccountData } from "./account-types";
import {
  buildApplicationsWorkspace,
  type ApplicationsWorkspaceApplication,
} from "./applications-workspace";
import { projectOpportunityTrust } from "@/data/opportunity-trust";
import {
  opportunityChangeLabel,
  opportunityChangeSummary,
  recentOpportunityChanges,
} from "@/data/opportunity-changelog";
import { normalizeResumeLabStore } from "@/data/resume-lab";

export type ApplicationPacketRequirementState =
  | "assembled"
  | "selected_needs_attention"
  | "available"
  | "available_needs_attention"
  | "missing"
  | "recorded_complete"
  | "incomplete";

export type ApplicationPacketRequirement = {
  id: string;
  title: string;
  materialType?: ApplicationMaterialType;
  materialTypeLabel?: string;
  state: ApplicationPacketRequirementState;
  stateLabel: string;
  completed: boolean;
  recentlyAdded: boolean;
  selected?: ApplicationMaterialRecord;
  selectedSnapshot?: { title: string; versionLabel?: string };
  candidates: ApplicationMaterialRecord[];
  duplicateMaterialType: boolean;
  otherApplicationUseCount: number;
};

export type ApplicationPacketNextAction = {
  kind:
    | "review_change"
    | "select_material"
    | "review_material"
    | "complete_task"
    | "review_requirements"
    | "final_review"
    | "await_outcome";
  label: string;
  reason: string;
  href?: string;
  taskId?: string;
  materialType?: ApplicationMaterialType;
};

export type ApplicationPacketModel = {
  application: ApplicationsWorkspaceApplication;
  packetHref: string;
  status:
    | "needs_attention"
    | "known_materials_assembled"
    | "requirements_unknown"
    | "submitted";
  statusLabel: string;
  statusDetail: string;
  requirements: ApplicationPacketRequirement[];
  verifiedRequirementCount: number;
  assembledRequirementCount: number;
  knownItemsNeedingAttention: number;
  requirementsCheckedAt?: string;
  requirementsSourceUrl?: string;
  nextAction: ApplicationPacketNextAction;
  personalTasks: ApplicationsWorkspaceApplication["workspace"]["tasks"];
  changes: Array<{
    id: string;
    label: string;
    summary: string;
    detectedAt: string;
  }>;
  calendarContext?: {
    label: string;
    applicationCount: number;
    start: string;
    end: string;
  };
  resume?: {
    materialId: string;
    title: string;
    status: string;
    versionLabel?: string;
    targetState:
      | "current_opportunity"
      | "general"
      | "different_target"
      | "not_managed_in_resume_lab";
    targetLabel?: string;
    reviewHref: string;
  };
  timeline: Array<{ id: string; label: string; occurredAt: string }>;
  submitted: boolean;
  historical: boolean;
};

const historicalStatuses = new Set([
  "Submitted",
  "Interview",
  "Accepted",
  "Rejected",
  "Completed",
]);

function stateLabel(state: ApplicationPacketRequirementState) {
  return state === "assembled"
    ? "Selected · Ready"
    : state === "selected_needs_attention"
      ? "Selected · Needs review"
      : state === "available"
        ? "Ready version available"
        : state === "available_needs_attention"
          ? "Available version needs review"
          : state === "missing"
            ? "No material recorded"
            : state === "recorded_complete"
              ? "Recorded complete"
              : "Not recorded complete";
}

function packetNextAction(input: {
  application: ApplicationsWorkspaceApplication;
  requirements: ApplicationPacketRequirement[];
  changes: ApplicationPacketModel["changes"];
  personalTasks: ApplicationPacketModel["personalTasks"];
}): ApplicationPacketNextAction {
  if (input.application.state === "submitted")
    return {
      kind: "await_outcome",
      label: "Awaiting outcome",
      reason:
        "This application is recorded as submitted. Update Journey when the provider responds.",
    };
  if (input.changes.length)
    return {
      kind: "review_change",
      label: "Review provider change",
      reason: input.changes[0]!.summary,
    };
  const missing = input.requirements.find(
    (item) =>
      item.state === "missing" ||
      item.state === "available" ||
      item.state === "available_needs_attention",
  );
  if (missing?.materialType)
    return missing.state === "available_needs_attention"
      ? {
          kind: "review_material",
          label: `Review ${missing.materialTypeLabel?.toLocaleLowerCase()}`,
          reason: `${missing.title} is verified. A version exists, but it needs review before selection.`,
          materialType: missing.materialType,
          href:
            missing.materialType === "resume"
              ? `/resume-lab?view=resumes&target=${encodeURIComponent(input.application.id)}`
              : "/materials",
        }
      : {
          kind: "select_material",
          label:
            missing.state === "available"
              ? `Select ${missing.materialTypeLabel?.toLocaleLowerCase()}`
              : `Prepare ${missing.materialTypeLabel?.toLocaleLowerCase()}`,
          reason: `${missing.title} is verified, but no material is selected for this application.`,
          materialType: missing.materialType,
          href:
            missing.state === "missing"
              ? `/materials?type=${missing.materialType}`
              : undefined,
        };
  const review = input.requirements.find(
    (item) => item.state === "selected_needs_attention",
  );
  if (review?.materialType)
    return {
      kind: "review_material",
      label: `Review ${review.materialTypeLabel?.toLocaleLowerCase()}`,
      reason: "The selected material is not marked Ready.",
      materialType: review.materialType,
      href:
        review.materialType === "resume"
          ? `/resume-lab?view=resumes&target=${encodeURIComponent(input.application.id)}`
          : "/materials",
    };
  const requirementTask = input.requirements.find((item) => !item.completed);
  if (requirementTask)
    return {
      kind: "complete_task",
      label: requirementTask.title,
      reason: "This verified requirement is not recorded complete.",
      taskId: requirementTask.id,
    };
  const privateTask = input.personalTasks.find((item) => !item.completed);
  if (privateTask)
    return {
      kind: "complete_task",
      label: privateTask.title,
      reason: privateTask.dueDate
        ? `Your task is due ${privateTask.dueDate}.`
        : "This private preparation task is not complete.",
      taskId: privateTask.id,
    };
  if (!input.application.workspace.requirementsVerified)
    return {
      kind: "review_requirements",
      label: "Review official requirements",
      reason:
        "UnlockED has not verified a complete requirement set for this opportunity.",
      href: input.application.officialSource,
    };
  return {
    kind: "final_review",
    label: "Review before applying",
    reason:
      "All currently verified requirements are recorded and selected materials are marked Ready.",
  };
}

export function projectApplicationPacket(input: {
  account: AccountData;
  opportunities: readonly Opportunity[];
  opportunityId: string;
  now?: Date;
}): ApplicationPacketModel | null {
  const now = input.now ?? new Date();
  const workspaceModel = buildApplicationsWorkspace({
    account: input.account,
    opportunities: input.opportunities,
    now,
  });
  const application = workspaceModel.applications.find(
    (item) => item.id === input.opportunityId,
  );
  const opportunity = input.opportunities.find(
    (item) => item.id === input.opportunityId,
  );
  if (!application || !opportunity) return null;
  const trust = projectOpportunityTrust(opportunity, now);
  const materials = normalizeApplicationMaterialStore(
    input.account.applicationMaterials,
  );
  const resumes = normalizeResumeLabStore(input.account.resumeLab);
  const historical = historicalStatuses.has(application.status);
  const typeCounts = new Map<ApplicationMaterialType, number>();
  for (const task of application.workspace.tasks.filter(
    (item) => item.source === "verified_requirement",
  )) {
    const type = materialTypeForRequirement(task.title);
    if (type) typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }
  const mappedByType = new Map(
    application.workspace.materials.mappedRequirements.map((item) => [
      item.type,
      item,
    ]),
  );
  const activeTracker = {
    ...(input.account.activity?.tracked ?? {}),
    ...(input.account.tracker ?? {}),
  };
  const requirements = application.workspace.tasks
    .filter((item) => item.source === "verified_requirement")
    .map((task): ApplicationPacketRequirement => {
      const materialType = materialTypeForRequirement(task.title) ?? undefined;
      const mapped = materialType ? mappedByType.get(materialType) : undefined;
      const association = materialType
        ? materials.associations[
            materialAssociationId(application.id, materialType)
          ]
        : undefined;
      const historicalSnapshot =
        historical && association ? association.materialSnapshot : undefined;
      const selected = mapped?.selected;
      const state: ApplicationPacketRequirementState = !materialType
        ? task.completed
          ? "recorded_complete"
          : "incomplete"
        : historicalSnapshot
          ? "assembled"
          : selected?.status === "ready"
            ? "assembled"
            : selected
              ? "selected_needs_attention"
              : mapped?.state === "available"
                ? "available"
                : mapped?.state === "needs_attention"
                  ? "available_needs_attention"
                  : "missing";
      const selectedMaterialId = selected?.id ?? association?.materialId;
      const otherApplicationUseCount = selectedMaterialId
        ? Object.values(materials.associations).filter(
            (item) =>
              item.opportunityId !== application.id &&
              item.materialId === selectedMaterialId &&
              !item.materialDeletedAt &&
              activeTracker[item.opportunityId],
          ).length
        : 0;
      return {
        id: task.id,
        title: task.title,
        materialType,
        materialTypeLabel: mapped?.typeLabel,
        state,
        stateLabel: stateLabel(state),
        completed: task.completed,
        recentlyAdded: Boolean(task.recentlyUpdated),
        selected,
        selectedSnapshot: historicalSnapshot,
        candidates: mapped?.candidates ?? [],
        duplicateMaterialType: materialType
          ? (typeCounts.get(materialType) ?? 0) > 1
          : false,
        otherApplicationUseCount,
      };
    });
  const personalTasks = application.workspace.tasks.filter(
    (item) => item.source === "user",
  );
  const changes = recentOpportunityChanges(opportunity, 4)
    .filter((item) => item.workspaceImpact)
    .map((item) => ({
      id: item.id,
      label: opportunityChangeLabel(item),
      summary: opportunityChangeSummary(item),
      detectedAt: item.detectedAt,
    }));
  const assembledRequirementCount = requirements.filter(
    (item) =>
      item.completed && ["assembled", "recorded_complete"].includes(item.state),
  ).length;
  const knownItemsNeedingAttention =
    requirements.filter(
      (item) =>
        !item.completed ||
        !["assembled", "recorded_complete"].includes(item.state),
    ).length + personalTasks.filter((item) => !item.completed).length;
  const knownAssembled =
    Boolean(requirements.length) && knownItemsNeedingAttention === 0;
  const status = historical
    ? "submitted"
    : !application.workspace.requirementsVerified
      ? "requirements_unknown"
      : knownAssembled
        ? "known_materials_assembled"
        : "needs_attention";
  const statusLabel = historical
    ? application.stateLabel
    : status === "requirements_unknown"
      ? "Requirements not verified"
      : status === "known_materials_assembled"
        ? "Known materials assembled"
        : `${knownItemsNeedingAttention} known ${knownItemsNeedingAttention === 1 ? "item needs" : "items need"} attention`;
  const statusDetail = historical
    ? "This packet preserves the materials recorded for the submitted application."
    : status === "requirements_unknown"
      ? "Review the official provider page before relying on this packet."
      : status === "known_materials_assembled"
        ? "This covers the requirements UnlockED has verified. It does not confirm provider submission or competitiveness."
        : "Complete or select the known items below before your final review.";
  const selectedResumeRequirement = requirements.find(
    (item) =>
      item.materialType === "resume" &&
      (item.selected || item.selectedSnapshot),
  );
  const selectedResume = selectedResumeRequirement?.selected;
  const resumeDocument = selectedResume
    ? Object.values(resumes.resumes).find(
        (item) => item.materialId === selectedResume.id,
      )
    : undefined;
  const resume = selectedResumeRequirement
    ? {
        materialId:
          selectedResume?.id ??
          materials.associations[
            materialAssociationId(application.id, "resume")
          ]?.materialId ??
          "",
        title:
          selectedResume?.title ??
          selectedResumeRequirement.selectedSnapshot?.title ??
          "Selected resume",
        status: selectedResume?.status ?? "historical",
        versionLabel:
          selectedResume?.versionLabel ??
          selectedResumeRequirement.selectedSnapshot?.versionLabel,
        targetState: !resumeDocument
          ? ("not_managed_in_resume_lab" as const)
          : resumeDocument.target.type === "general"
            ? ("general" as const)
            : resumeDocument.target.type === "opportunity" &&
                resumeDocument.target.id === application.id
              ? ("current_opportunity" as const)
              : ("different_target" as const),
        targetLabel: resumeDocument?.target.label,
        reviewHref: `/resume-lab?view=resumes&target=${encodeURIComponent(application.id)}`,
      }
    : undefined;
  const cluster = workspaceModel.deadlineClusters.find((item) =>
    item.applicationIds.includes(application.id),
  );
  const calendarContext = cluster
    ? {
        label: cluster.label,
        applicationCount: cluster.applicationIds.length,
        start: cluster.start,
        end: cluster.end,
      }
    : undefined;
  const timelineLabels: Record<string, string> = {
    choose: "Chose this opportunity",
    start: "Started preparing",
    submit: "Marked submitted",
    interview: "Recorded an interview",
    accept: "Recorded acceptance",
    complete: "Completed the experience",
    pause: "Paused preparation",
    resume: "Resumed preparation",
    close: "Closed this path",
  };
  const record =
    input.account.tracker?.[application.id] ??
    input.account.activity?.tracked?.[application.id];
  const timeline = (record?.history ?? [])
    .map((event) => ({
      id: event.id,
      label: timelineLabels[event.transition] ?? event.transition,
      occurredAt: event.occurredAt,
    }))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return {
    application,
    packetHref: `/applications/${encodeURIComponent(application.id)}`,
    status,
    statusLabel,
    statusDetail,
    requirements,
    verifiedRequirementCount: requirements.length,
    assembledRequirementCount,
    knownItemsNeedingAttention,
    requirementsCheckedAt: trust.requirements.checkedAt,
    requirementsSourceUrl: trust.requirements.sourceUrl,
    nextAction: packetNextAction({
      application,
      requirements,
      changes,
      personalTasks,
    }),
    personalTasks,
    changes,
    calendarContext,
    resume,
    timeline,
    submitted: historical,
    historical,
  };
}
