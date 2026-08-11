import "server-only";

import type { AuthUser } from "./account-types";
import { applicationWorkspaceEligible, customApplicationTaskId, materializeApplicationWorkspace, projectApplicationWorkspace } from "./application-workspace";
import { mutateApplicationWorkspace, readAccountData } from "./auth-store";
import { listPublishedOpportunitiesByIds } from "./content-store";

export type ApplicationWorkspaceMutation =
  | { action: "add_task"; opportunityId: string; expectedVersion: number; idempotencyKey: string; title: string; dueDate?: string }
  | { action: "set_completion"; opportunityId: string; expectedVersion: number; taskId: string; completed: boolean }
  | { action: "delete_task"; opportunityId: string; expectedVersion: number; taskId: string }
  | { action: "restore_task"; opportunityId: string; expectedVersion: number; taskId: string };

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
      if (mutation.action === "add_task") {
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
      return { workspace, duplicate: false };
    },
  });
  const persistedRecord = result.account.tracker?.[mutation.opportunityId] ?? result.account.activity?.tracked?.[mutation.opportunityId] ?? record;
  return {
    ok: true as const,
    duplicate: result.duplicate,
    workspace: projectApplicationWorkspace({ opportunity, record: persistedRecord, workspace: result.workspace }),
  };
}
