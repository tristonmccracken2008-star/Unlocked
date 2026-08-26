import "server-only";

import crypto from "node:crypto";
import {
  applicationMaterialContexts,
  applicationMaterialStatuses,
  applicationMaterialTypes,
  materialAssociationId,
  type ApplicationMaterialContext,
  type ApplicationMaterialStatus,
  type ApplicationMaterialType,
} from "@/data/application-materials";
import type { AuthUser } from "./account-types";
import { materialTypeForRequirement, buildApplicationMaterialsModel } from "./application-materials";
import { trustedApplicationRequirements } from "./application-workspace";
import { mutateApplicationMaterials } from "./auth-store";
import { listPublishedOpportunitiesByIds } from "./content-store";

export type ApplicationMaterialMutation =
  | { action: "create"; expectedVersion: number; idempotencyKey: string; type: ApplicationMaterialType; title: string; versionLabel?: string; status: ApplicationMaterialStatus; contexts: ApplicationMaterialContext[]; notes?: string }
  | { action: "update"; expectedVersion: number; materialId: string; expectedMaterialVersion: number; title: string; versionLabel?: string; status: ApplicationMaterialStatus; contexts: ApplicationMaterialContext[]; notes?: string }
  | { action: "set_preferred"; expectedVersion: number; materialId: string; expectedMaterialVersion: number }
  | { action: "archive" | "restore"; expectedVersion: number; materialId: string; expectedMaterialVersion: number }
  | { action: "delete"; expectedVersion: number; materialId: string; expectedMaterialVersion: number; expectedUsageCount: number }
  | { action: "associate"; expectedVersion: number; opportunityId: string; requirementType: ApplicationMaterialType; materialId: string }
  | { action: "dissociate"; expectedVersion: number; opportunityId: string; requirementType: ApplicationMaterialType };

function domainError(message: string, name: string) {
  const error = new Error(message);
  error.name = name;
  return error;
}
function materialId(userId: string, idempotencyKey: string) {
  return `material:${crypto.createHash("sha256").update(`${userId}:${idempotencyKey}`).digest("hex").slice(0, 24)}`;
}

export async function updateApplicationMaterials(user: Pick<AuthUser, "id">, mutation: ApplicationMaterialMutation) {
  const opportunity = "opportunityId" in mutation
    ? (await listPublishedOpportunitiesByIds([mutation.opportunityId], { includeArchived: true }))[0]
    : undefined;
  if ("opportunityId" in mutation && !opportunity) throw domainError("This opportunity is no longer available.", "ApplicationMaterialOpportunityError");

  const result = await mutateApplicationMaterials(user.id, {
    expectedVersion: mutation.expectedVersion,
    mutate(current, lockedAccount) {
      const now = new Date().toISOString();
      const records = { ...current.records };
      const associations = { ...current.associations };
      let duplicate = false;
      if (mutation.action === "create") {
        const id = materialId(user.id, mutation.idempotencyKey);
        if (records[id]) duplicate = true;
        else {
          if (Object.keys(records).length >= 500) throw domainError("You have reached the materials record limit.", "ApplicationMaterialLimitError");
          records[id] = {
            id,
            type: mutation.type,
            title: mutation.title,
            versionLabel: mutation.versionLabel,
            status: mutation.status,
            contexts: mutation.contexts,
            notes: mutation.notes,
            preferred: !Object.values(records).some((record) => record.type === mutation.type && record.preferred && record.status !== "archived"),
            createdAt: now,
            updatedAt: now,
            version: 0,
          };
        }
      } else if (mutation.action === "associate" || mutation.action === "dissociate") {
        const tracked = lockedAccount.tracker?.[mutation.opportunityId] ?? lockedAccount.activity?.tracked?.[mutation.opportunityId];
        if (!tracked) throw domainError("Materials can only be selected for opportunities in your Journey.", "ApplicationMaterialOwnershipError");
        if (["Submitted", "Interview", "Accepted", "Rejected", "Completed"].includes(tracked.status)) throw domainError("Submitted application materials are preserved as history and cannot be replaced.", "ApplicationMaterialHistoricalError");
        const requirement = trustedApplicationRequirements(opportunity!).find((title) => materialTypeForRequirement(title) === mutation.requirementType);
        if (!requirement) throw domainError("This material requirement is not verified for the opportunity.", "ApplicationMaterialRequirementError");
        const id = materialAssociationId(mutation.opportunityId, mutation.requirementType);
        const existing = associations[id];
        if (mutation.action === "dissociate") {
          if (!existing) duplicate = true;
          else delete associations[id];
        } else {
          const material = records[mutation.materialId];
          if (!material || material.type !== mutation.requirementType || material.status === "archived") throw domainError("Choose an available material of the required type.", "ApplicationMaterialSelectionError");
          if (existing?.materialId === material.id && !existing.materialDeletedAt) duplicate = true;
          else associations[id] = {
            id,
            opportunityId: mutation.opportunityId,
            requirementType: mutation.requirementType,
            requirementTitle: requirement,
            materialId: material.id,
            materialSnapshot: { type: material.type, title: material.title, versionLabel: material.versionLabel },
            selectedAt: existing?.selectedAt ?? now,
            updatedAt: now,
            version: (existing?.version ?? 0) + 1,
          };
        }
      } else {
        const material = records[mutation.materialId];
        if (!material) throw domainError("This material no longer exists.", "ApplicationMaterialNotFoundError");
        if (material.version !== mutation.expectedMaterialVersion) throw domainError("This material changed elsewhere. Refresh and try again.", "ApplicationMaterialRecordConflictError");
        if (mutation.action === "update") {
          const status = mutation.status;
          records[material.id] = { ...material, title: mutation.title, versionLabel: mutation.versionLabel, status, contexts: mutation.contexts, notes: mutation.notes, archivedAt: status === "archived" ? material.archivedAt ?? now : undefined, updatedAt: now, version: material.version + 1 };
        } else if (mutation.action === "set_preferred") {
          if (material.preferred) duplicate = true;
          else for (const record of Object.values(records)) if (record.type === material.type) records[record.id] = { ...record, preferred: record.id === material.id, updatedAt: now, version: record.version + 1 };
        } else if (mutation.action === "archive") {
          if (material.status === "archived") duplicate = true;
          else records[material.id] = { ...material, status: "archived", preferred: false, archivedAt: now, updatedAt: now, version: material.version + 1 };
        } else if (mutation.action === "restore") {
          if (material.status !== "archived") duplicate = true;
          else records[material.id] = { ...material, status: "needs_update", archivedAt: undefined, updatedAt: now, version: material.version + 1 };
        } else if (mutation.action === "delete") {
          const usage = Object.values(associations).filter((association) => association.materialId === material.id && !association.materialDeletedAt);
          if (usage.length !== mutation.expectedUsageCount) throw domainError("This material’s application use changed. Review it before deleting.", "ApplicationMaterialUsageConflictError");
          delete records[material.id];
          for (const association of usage) associations[association.id] = { ...association, materialDeletedAt: now, updatedAt: now, version: association.version + 1 };
        }
      }
      if (duplicate) return { store: current, duplicate: true };
      return { store: { records, associations, version: current.version + 1, updatedAt: now }, duplicate: false };
    },
  });

  const trackedIds = [...new Set([...Object.keys(result.account.tracker ?? {}), ...Object.keys(result.account.activity?.tracked ?? {})])];
  const opportunities = await listPublishedOpportunitiesByIds(trackedIds, { includeArchived: true });
  return { ok: true as const, duplicate: result.duplicate, model: buildApplicationMaterialsModel({ account: result.account, opportunities }) };
}

export function validMaterialType(value: unknown): value is ApplicationMaterialType {
  return typeof value === "string" && applicationMaterialTypes.includes(value as ApplicationMaterialType);
}

export function validMaterialStatus(value: unknown): value is ApplicationMaterialStatus {
  return typeof value === "string" && applicationMaterialStatuses.includes(value as ApplicationMaterialStatus);
}

export function validMaterialContexts(value: unknown): ApplicationMaterialContext[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is ApplicationMaterialContext => typeof item === "string" && applicationMaterialContexts.includes(item as ApplicationMaterialContext)))].slice(0, 4) : [];
}
