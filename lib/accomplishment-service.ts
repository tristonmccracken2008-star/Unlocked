import "server-only";

import crypto from "node:crypto";
import {
  accomplishmentKinds,
  accomplishmentOutcomes,
  normalizeAccomplishmentStore,
  type AccomplishmentKind,
  type AccomplishmentOutcome,
  type AccomplishmentRecord,
} from "@/data/accomplishments";
import { mergeAccountData, readAccountData, withSecurityLock } from "./auth-store";
import { buildAccomplishmentsModel } from "./accomplishments";
import { listPublishedOpportunitiesByIds } from "./content-store";

export class AccomplishmentMutationError extends Error {
  constructor(message: string, readonly code: "invalid" | "not_found" | "conflict" | "duplicate") {
    super(message);
    this.name = "AccomplishmentMutationError";
  }
}

export type AccomplishmentFields = {
  title: string;
  organization: string;
  kind: AccomplishmentKind;
  outcome: AccomplishmentOutcome;
  outcomeDate: string;
  startDate?: string;
  endDate?: string;
  roleTitle?: string;
  team?: string;
  location?: string;
  projectTitle?: string;
  mentor?: string;
  labOrGroup?: string;
  researchArea?: string;
  placement?: string;
  awardAmount?: string;
  description?: string;
  notes?: string;
  skills?: string[];
};

export type AccomplishmentMutation =
  | { action: "create"; idempotencyKey: string; fields: AccomplishmentFields }
  | { action: "update"; id: string; expectedVersion: number; idempotencyKey: string; fields: Partial<AccomplishmentFields> }
  | { action: "remove"; id: string; expectedVersion: number; idempotencyKey: string };

function normalizedText(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim().toLocaleLowerCase() ?? "";
}

function duplicateRecord(records: readonly AccomplishmentRecord[], fields: Pick<AccomplishmentFields, "title" | "organization">, ignoreId?: string) {
  const title = normalizedText(fields.title);
  const organization = normalizedText(fields.organization);
  return records.find((record) => record.id !== ignoreId && !record.inactiveAt && normalizedText(record.snapshot.title) === title && normalizedText(record.snapshot.organization) === organization);
}

function applyFields(record: AccomplishmentRecord, fields: Partial<AccomplishmentFields>, now: string): AccomplishmentRecord {
  return normalizeAccomplishmentStore({
    [record.id]: {
      ...record,
      snapshot: {
        ...record.snapshot,
        title: fields.title ?? record.snapshot.title,
        organization: fields.organization ?? record.snapshot.organization,
      },
      kind: fields.kind ?? record.kind,
      outcome: fields.outcome ?? record.outcome,
      outcomeDate: fields.outcomeDate ?? record.outcomeDate,
      startDate: fields.startDate ?? record.startDate,
      endDate: fields.endDate ?? record.endDate,
      roleTitle: fields.roleTitle ?? record.roleTitle,
      team: fields.team ?? record.team,
      location: fields.location ?? record.location,
      projectTitle: fields.projectTitle ?? record.projectTitle,
      mentor: fields.mentor ?? record.mentor,
      labOrGroup: fields.labOrGroup ?? record.labOrGroup,
      researchArea: fields.researchArea ?? record.researchArea,
      placement: fields.placement ?? record.placement,
      awardAmount: fields.awardAmount ?? record.awardAmount,
      description: fields.description ?? record.description,
      notes: fields.notes ?? record.notes,
      skills: fields.skills ?? record.skills,
      updatedAt: now,
      version: record.version + 1,
    },
  })[record.id];
}

export async function mutateAccomplishment(userId: string, mutation: AccomplishmentMutation) {
  return await withSecurityLock("accomplishment", userId, async () => {
    const account = await readAccountData(userId);
    const records = { ...(account.accomplishments ?? {}) };
    const duplicateMutation = Object.values(records).find((record) => record.lastMutationKey === mutation.idempotencyKey);
    if (duplicateMutation) return { record: duplicateMutation, duplicate: true, removed: Boolean(duplicateMutation.inactiveAt || duplicateMutation.hidden) };
    const now = new Date().toISOString();
    if (mutation.action === "create") {
      const trackedIds = [...new Set([
        ...Object.keys(account.activity?.tracked ?? {}),
        ...Object.keys(account.tracker ?? {}),
      ])];
      const opportunities = trackedIds.length
        ? await listPublishedOpportunitiesByIds(trackedIds, { includeArchived: true })
        : [];
      const visibleRecords = buildAccomplishmentsModel({ account, opportunities }).records;
      const duplicate = duplicateRecord(visibleRecords, mutation.fields);
      if (duplicate) throw new AccomplishmentMutationError("This accomplishment already exists in your record.", "duplicate");
      const id = `manual:${crypto.randomUUID()}`;
      const candidate: AccomplishmentRecord = {
        id,
        source: "manual",
        snapshot: { title: mutation.fields.title, organization: mutation.fields.organization, capturedAt: now },
        kind: mutation.fields.kind,
        outcome: mutation.fields.outcome,
        outcomeDate: mutation.fields.outcomeDate,
        startDate: mutation.fields.startDate,
        endDate: mutation.fields.endDate,
        roleTitle: mutation.fields.roleTitle,
        team: mutation.fields.team,
        location: mutation.fields.location,
        projectTitle: mutation.fields.projectTitle,
        mentor: mutation.fields.mentor,
        labOrGroup: mutation.fields.labOrGroup,
        researchArea: mutation.fields.researchArea,
        placement: mutation.fields.placement,
        awardAmount: mutation.fields.awardAmount,
        description: mutation.fields.description,
        notes: mutation.fields.notes,
        skills: mutation.fields.skills,
        hidden: false,
        createdAt: now,
        updatedAt: now,
        version: 0,
        lastMutationKey: mutation.idempotencyKey,
      };
      const record = normalizeAccomplishmentStore({ [id]: candidate })[id];
      if (!record) throw new AccomplishmentMutationError("Check the required fields and dates.", "invalid");
      records[id] = record;
      await mergeAccountData(userId, { accomplishments: records });
      return { record, duplicate: false, removed: false };
    }
    const current = records[mutation.id];
    if (!current) throw new AccomplishmentMutationError("This accomplishment no longer exists.", "not_found");
    if (current.version !== mutation.expectedVersion) throw new AccomplishmentMutationError("This accomplishment changed elsewhere. Refresh and try again.", "conflict");
    if (mutation.action === "remove") {
      records[current.id] = { ...current, hidden: true, inactiveAt: current.source === "manual" ? now : current.inactiveAt, updatedAt: now, version: current.version + 1, lastMutationKey: mutation.idempotencyKey };
      await mergeAccountData(userId, { accomplishments: records });
      return { record: records[current.id], duplicate: false, removed: true };
    }
    if (current.source === "journey" && (mutation.fields.title || mutation.fields.organization || mutation.fields.kind || mutation.fields.outcome || mutation.fields.outcomeDate)) {
      throw new AccomplishmentMutationError("Journey facts must be corrected from Journey.", "invalid");
    }
    const title = mutation.fields.title ?? current.snapshot.title;
    const organization = mutation.fields.organization ?? current.snapshot.organization;
    const duplicate = duplicateRecord(Object.values(records), { title, organization }, current.id);
    if (duplicate) throw new AccomplishmentMutationError("This accomplishment already exists in your record.", "duplicate");
    const updated = applyFields(current, mutation.fields, now);
    if (!updated || !accomplishmentKinds.includes(updated.kind) || !accomplishmentOutcomes.includes(updated.outcome)) throw new AccomplishmentMutationError("Check the fields and dates.", "invalid");
    records[current.id] = { ...updated, lastMutationKey: mutation.idempotencyKey };
    await mergeAccountData(userId, { accomplishments: records });
    return { record: records[current.id], duplicate: false, removed: false };
  });
}
