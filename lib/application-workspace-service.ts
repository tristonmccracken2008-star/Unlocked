import "server-only";

import type { AnswerBankRecord, ApplicationRecommenderRecord, AuthUser } from "./account-types";
import { applicationWorkspaceEligible, customApplicationTaskId, materializeApplicationWorkspace, normalizeAnswerBank, projectApplicationWorkspace } from "./application-workspace";
import { mutateApplicationWorkspace, readAccountData } from "./auth-store";
import { listPublishedOpportunitiesByIds } from "./content-store";

export type ApplicationWorkspaceMutation =
  | { action: "add_task"; opportunityId: string; expectedVersion: number; idempotencyKey: string; title: string; dueDate?: string }
  | { action: "set_completion"; opportunityId: string; expectedVersion: number; taskId: string; completed: boolean }
  | { action: "delete_task"; opportunityId: string; expectedVersion: number; taskId: string }
  | { action: "restore_task"; opportunityId: string; expectedVersion: number; taskId: string }
  | { action: "add_prompt"; opportunityId: string; expectedVersion: number; idempotencyKey: string; prompt: string; source: "verified" | "student"; sourceUrl?: string; required: boolean; wordLimit?: number; characterLimit?: number }
  | { action: "save_response"; opportunityId: string; expectedVersion: number; responseId: string; expectedResponseVersion: number; draft: string; status: "draft" | "ready" }
  | { action: "add_recommender"; opportunityId: string; expectedVersion: number; idempotencyKey: string; name: string; role?: string; organization?: string; email?: string; relationship?: string; requestedDate?: string; deadline?: string; status: ApplicationRecommenderRecord["status"]; notes?: string }
  | { action: "save_notes"; opportunityId: string; expectedVersion: number; notes: string }
  | { action: "save_answer_story"; opportunityId: string; expectedVersion: number; idempotencyKey: string; title: string; category: string; experienceIds: string[]; situation?: string; actionText?: string; challenge?: string; result?: string; learning?: string; notes?: string }
  | { action: "capture_submission"; opportunityId: string; expectedVersion: number; idempotencyKey: string };

function mutationError(message: string, name: string) {
  const error = new Error(message);
  error.name = name;
  return error;
}

export async function updateApplicationWorkspace(user: Pick<AuthUser, "id">, mutation: ApplicationWorkspaceMutation) {
  const [account, catalog] = await Promise.all([
    readAccountData(user.id),
    listPublishedOpportunitiesByIds([mutation.opportunityId], { includeArchived: true }),
  ]);
  const record = account.tracker?.[mutation.opportunityId] ?? account.activity?.tracked?.[mutation.opportunityId];
  const opportunity = catalog.find((item) => item.id === mutation.opportunityId);
  if (!record) throw mutationError("Only opportunities in your Journey can have application tasks.", "ApplicationWorkspaceOwnershipError");
  if (!opportunity) throw mutationError("This opportunity is no longer available.", "ApplicationWorkspaceUnavailableError");
  if (!applicationWorkspaceEligible(opportunity)) throw mutationError("This opportunity does not use an application workspace.", "ApplicationWorkspaceIneligibleError");

  const result = await mutateApplicationWorkspace(user.id, {
    opportunityId: mutation.opportunityId,
    expectedVersion: mutation.expectedVersion,
    mutate(existing, lockedAccount) {
      const currentRecord = lockedAccount.tracker?.[mutation.opportunityId] ?? lockedAccount.activity?.tracked?.[mutation.opportunityId];
      if (!currentRecord) throw mutationError("Only opportunities in your Journey can have application tasks.", "ApplicationWorkspaceOwnershipError");
      const now = new Date().toISOString();
      const workspace = materializeApplicationWorkspace(existing, opportunity, now);
      workspace.deletedTasks = { ...(workspace.deletedTasks ?? {}) };
      workspace.writtenResponses = { ...(workspace.writtenResponses ?? {}) };
      workspace.recommenders = { ...(workspace.recommenders ?? {}) };
      workspace.submissionSnapshots = [...(workspace.submissionSnapshots ?? [])];
      let answerBank = normalizeAnswerBank(lockedAccount.answerBank);
      if (mutation.action === "add_prompt") {
        const id = customApplicationTaskId(mutation.opportunityId, `prompt:${mutation.idempotencyKey}`).replace("task:", "prompt:");
        if (workspace.writtenResponses[id]) return { workspace, duplicate: true };
        if (Object.keys(workspace.writtenResponses).length >= 40) throw mutationError("This application already has the maximum number of written prompts.", "ApplicationWorkspaceLimitError");
        workspace.writtenResponses[id] = { id, prompt: mutation.prompt, source: mutation.source, sourceUrl: mutation.sourceUrl, required: mutation.required, wordLimit: mutation.wordLimit, characterLimit: mutation.characterLimit, draft: "", status: "not_started", revisions: [], createdAt: now, updatedAt: now, version: 0 };
      } else if (mutation.action === "save_response") {
        const response = workspace.writtenResponses[mutation.responseId];
        if (!response) throw mutationError("This written response no longer exists.", "ApplicationTaskNotFoundError");
        if (response.version !== mutation.expectedResponseVersion) throw mutationError("This response changed elsewhere. Refresh and try again.", "ApplicationWorkspaceConflictError");
        const revisions = response.draft && response.draft !== mutation.draft ? [...response.revisions, { id: `revision:${response.id}:${response.version}`, draft: response.draft, createdAt: now }].slice(-20) : response.revisions;
        workspace.writtenResponses[response.id] = { ...response, draft: mutation.draft, status: mutation.draft.trim() ? mutation.status : "not_started", revisions, updatedAt: now, version: response.version + 1 };
      } else if (mutation.action === "add_recommender") {
        const id = customApplicationTaskId(mutation.opportunityId, `recommender:${mutation.idempotencyKey}`).replace("task:", "recommender:");
        if (workspace.recommenders[id]) return { workspace, duplicate: true };
        if (Object.keys(workspace.recommenders).length >= 20) throw mutationError("This application already has the maximum number of recommenders.", "ApplicationWorkspaceLimitError");
        workspace.recommenders[id] = { id, name: mutation.name, role: mutation.role, organization: mutation.organization, email: mutation.email, relationship: mutation.relationship, requestedDate: mutation.requestedDate, deadline: mutation.deadline, status: mutation.status, notes: mutation.notes, createdAt: now, updatedAt: now, version: 0 };
      } else if (mutation.action === "save_notes") {
        workspace.privateNotes = mutation.notes || undefined;
      } else if (mutation.action === "save_answer_story") {
        const id = customApplicationTaskId(mutation.opportunityId, `story:${mutation.idempotencyKey}`).replace("task:", "story:");
        if (answerBank.records[id]) return { workspace, duplicate: true };
        if (Object.keys(answerBank.records).length >= 500) throw mutationError("Your Answer Bank has reached its current limit.", "ApplicationWorkspaceLimitError");
        const story: AnswerBankRecord = { id, title: mutation.title, category: mutation.category, experienceIds: mutation.experienceIds, situation: mutation.situation, action: mutation.actionText, challenge: mutation.challenge, result: mutation.result, learning: mutation.learning, notes: mutation.notes, createdAt: now, updatedAt: now, version: 0 };
        answerBank = { records: { ...answerBank.records, [id]: story }, version: answerBank.version + 1, updatedAt: now };
      } else if (mutation.action === "capture_submission") {
        const id = `submission:${mutation.idempotencyKey}`;
        if (workspace.submissionSnapshots.some((snapshot) => snapshot.id === id)) return { workspace, duplicate: true };
        const materials = Object.values(lockedAccount.applicationMaterials?.associations ?? {}).filter((association) => association.opportunityId === mutation.opportunityId && !association.materialDeletedAt).map((association) => ({ materialId: association.materialId, requirementType: association.requirementType, title: association.materialSnapshot.title, versionLabel: association.materialSnapshot.versionLabel }));
        workspace.submissionSnapshots = [...workspace.submissionSnapshots, { id, createdAt: now, opportunity: { title: opportunity.title, organization: opportunity.organization, officialSource: opportunity.official_source_url || opportunity.official_source, deadline: opportunity.application_deadline || undefined }, materials, writtenResponses: Object.values(workspace.writtenResponses).map((response) => ({ id: response.id, prompt: response.prompt, draft: response.draft, version: response.version })), recommenders: Object.values(workspace.recommenders).map((person) => ({ id: person.id, name: person.name, status: person.status })), notes: workspace.privateNotes }].slice(-10);
      } else if (mutation.action === "add_task") {
        const id = customApplicationTaskId(mutation.opportunityId, mutation.idempotencyKey);
        if (workspace.tasks[id]) return { workspace, duplicate: true };
        if (Object.keys(workspace.tasks).length >= 40) throw mutationError("This application already has the maximum number of tasks.", "ApplicationWorkspaceLimitError");
        workspace.tasks[id] = {
          id,
          title: mutation.title,
          dueDate: mutation.dueDate,
          source: "user",
          completed: false,
          createdAt: now,
          updatedAt: now,
          version: 0,
        };
      } else if (mutation.action === "restore_task") {
        const existingTask = workspace.tasks[mutation.taskId];
        if (existingTask) return { workspace, duplicate: true };
        const deleted = workspace.deletedTasks[mutation.taskId];
        if (!deleted) throw mutationError("This task is no longer available to restore.", "ApplicationTaskNotFoundError");
        workspace.tasks[deleted.id] = { ...deleted, updatedAt: now, version: deleted.version + 1 };
        delete workspace.deletedTasks[deleted.id];
      } else {
        const task = workspace.tasks[mutation.taskId];
        if (mutation.action === "delete_task" && !task && workspace.deletedTasks[mutation.taskId]) return { workspace, duplicate: true };
        if (!task) throw mutationError("This application task no longer exists.", "ApplicationTaskNotFoundError");
        if (mutation.action === "set_completion") {
          if (task.completed === mutation.completed) return { workspace, duplicate: true };
          workspace.tasks[task.id] = {
            ...task,
            completed: mutation.completed,
            completedAt: mutation.completed ? now : undefined,
            updatedAt: now,
            version: task.version + 1,
          };
        } else if (mutation.action === "delete_task") {
          if (task.source !== "user") throw mutationError("Verified requirements can be completed, but not removed.", "ApplicationTaskProtectedError");
          workspace.deletedTasks[task.id] = { ...task, updatedAt: now };
          const retained = Object.values(workspace.deletedTasks).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 10);
          workspace.deletedTasks = Object.fromEntries(retained.map((item) => [item.id, item]));
          delete workspace.tasks[task.id];
        }
      }
      workspace.updatedAt = now;
      workspace.version += 1;
      return { workspace, answerBank, duplicate: false };
    },
  });
  const persistedRecord = result.account.tracker?.[mutation.opportunityId] ?? result.account.activity?.tracked?.[mutation.opportunityId] ?? record;
  return {
    ok: true as const,
    duplicate: result.duplicate,
    workspace: projectApplicationWorkspace({ opportunity, record: persistedRecord, workspace: result.workspace, materials: result.account.applicationMaterials }),
  };
}
