import "server-only";

import crypto from "node:crypto";
import type { AuthUser } from "./account-types";
import { mutateResumeLab } from "./auth-store";
import { buildResumeLabModel } from "./resume-lab";
import { listPublishedOpportunitiesByIds } from "./content-store";
import { normalizeResumeLabStore, resumeExperienceKinds, type ResumeDocumentRecord, type ResumeExperienceRecord, type ResumeFactKind, type ResumeSection } from "@/data/resume-lab";
import { applicationMaterialContexts, type ApplicationMaterialContext, type ApplicationMaterialStore } from "@/data/application-materials";
import { draftBulletFromFacts } from "./resume-intelligence";

export type ResumeLabMutation =
  | { action: "create_resume"; expectedVersion: number; idempotencyKey: string; title: string; kind: "master" | "targeted"; target?: { type: "general" | "opportunity" | "path"; id?: string; label?: string }; baseResumeId?: string }
  | { action: "duplicate_resume"; expectedVersion: number; idempotencyKey: string; resumeId: string; title: string; target?: { type: "general" | "opportunity" | "path"; id?: string; label?: string } }
  | { action: "save_resume"; expectedVersion: number; resumeId: string; expectedRecordVersion: number; title: string; contact: ResumeDocumentRecord["contact"]; summary?: string; skills: string[]; sections: ResumeSection[]; template: "classic" | "compact"; materialStatus: "draft" | "ready" | "needs_update" }
  | { action: "archive_resume"; expectedVersion: number; resumeId: string; expectedRecordVersion: number }
  | { action: "save_experience"; expectedVersion: number; idempotencyKey?: string; experienceId?: string; expectedRecordVersion?: number; kind: ResumeExperienceRecord["kind"]; organization: string; title: string; location?: string; startDate?: string; endDate?: string; current: boolean; skills: string[]; facts: Array<{ id?: string; kind: ResumeFactKind; text: string; confirmed: boolean }>; bullets: Array<{ id?: string; text?: string; factIds: string[]; confirmedClaims?: string[] }> }
  | { action: "import_accomplishment"; expectedVersion: number; idempotencyKey: string; accomplishmentId: string }
  | { action: "delete_experience"; expectedVersion: number; experienceId: string; expectedRecordVersion: number };

function domainError(message: string, name: string) { const error = new Error(message); error.name = name; return error; }
function stableId(prefix: string, userId: string, key: string) { return `${prefix}:${crypto.createHash("sha256").update(`${userId}:${key}`).digest("hex").slice(0, 24)}`; }
function contextsFor(title: string): ApplicationMaterialContext[] { const lower = title.toLowerCase(); const result = applicationMaterialContexts.filter((item) => item !== "general" && lower.includes(item.replace("_", " "))); return ["general", ...result].slice(0, 4) as ApplicationMaterialContext[]; }
function defaultSections(): ResumeSection[] { return [{ id: "section:education", kind: "education", title: "Education", visible: true, entries: [] }, { id: "section:experience", kind: "experience", title: "Experience", visible: true, entries: [] }, { id: "section:projects", kind: "projects", title: "Projects", visible: true, entries: [] }, { id: "section:skills", kind: "skills", title: "Skills", visible: true, entries: [] }]; }
function nextMaterials(materials: ApplicationMaterialStore, record: ResumeDocumentRecord, now: string, status: "draft" | "ready" | "needs_update" = "draft") {
  const current = materials.records[record.materialId];
  return { ...materials, records: { ...materials.records, [record.materialId]: current ? { ...current, title: record.title, status, contexts: contextsFor(record.title), updatedAt: now, version: current.version + 1 } : { id: record.materialId, type: "resume" as const, title: record.title, status, contexts: contextsFor(record.title), preferred: !Object.values(materials.records).some((item) => item.type === "resume" && item.preferred && item.status !== "archived"), createdAt: now, updatedAt: now, version: 0 } }, version: materials.version + 1, updatedAt: now };
}

export async function updateResumeLab(user: Pick<AuthUser, "id" | "email" | "name">, mutation: ResumeLabMutation) {
  const result = await mutateResumeLab(user.id, { expectedVersion: mutation.expectedVersion, mutate(current, materials, account) {
    const now = new Date().toISOString(); const store = normalizeResumeLabStore(current); const experiences = { ...store.experiences }; const resumes = { ...store.resumes }; let nextMaterialStore = materials;
    if (mutation.action === "create_resume" || mutation.action === "duplicate_resume") {
      const id = stableId("resume", user.id, mutation.idempotencyKey); if (resumes[id]) return { store, materials, duplicate: true };
      const source = mutation.action === "duplicate_resume" ? resumes[mutation.resumeId] : undefined;
      if (mutation.action === "duplicate_resume" && !source) throw domainError("This resume no longer exists.", "ResumeLabNotFoundError");
      if (Object.keys(resumes).length >= 100) throw domainError("You have reached the resume version limit.", "ResumeLabLimitError");
      const materialId = stableId("material", user.id, `resume:${id}`); const target = mutation.target ?? (mutation.action === "create_resume" ? mutation.target : source?.target) ?? { type: "general" as const };
      if (target.type === "opportunity" && (!target.id || (!account.tracker?.[target.id] && !account.activity?.tracked?.[target.id]))) throw domainError("Targeted resumes can only use opportunities in your Journey.", "ResumeLabEvidenceError");
      const record: ResumeDocumentRecord = { id, materialId, title: mutation.title, kind: mutation.action === "create_resume" ? mutation.kind : "targeted", baseResumeId: mutation.action === "duplicate_resume" ? source!.id : mutation.baseResumeId, target, contact: source?.contact ?? { email: user.email }, summary: source?.summary, sections: source?.sections ?? defaultSections(), skills: source?.skills ?? [], template: source?.template ?? "classic", createdAt: now, updatedAt: now, version: 0 };
      resumes[id] = record; nextMaterialStore = nextMaterials(materials, record, now);
    } else if (mutation.action === "save_resume" || mutation.action === "archive_resume") {
      const currentResume = resumes[mutation.resumeId]; if (!currentResume) throw domainError("This resume no longer exists.", "ResumeLabNotFoundError");
      if (currentResume.version !== mutation.expectedRecordVersion) throw domainError("This resume changed elsewhere. Refresh and try again.", "ResumeLabRecordConflictError");
      if (mutation.action === "archive_resume") { const record = { ...currentResume, archivedAt: now, updatedAt: now, version: currentResume.version + 1 }; resumes[record.id] = record; const material = materials.records[record.materialId]; nextMaterialStore = material ? { ...materials, records: { ...materials.records, [material.id]: { ...material, status: "archived", preferred: false, archivedAt: now, updatedAt: now, version: material.version + 1 } }, version: materials.version + 1, updatedAt: now } : materials; }
      else { const record = { ...currentResume, title: mutation.title, contact: mutation.contact, summary: mutation.summary, skills: mutation.skills, sections: mutation.sections, template: mutation.template, updatedAt: now, version: currentResume.version + 1 }; resumes[record.id] = record; nextMaterialStore = nextMaterials(materials, record, now, mutation.materialStatus); }
    } else if (mutation.action === "import_accomplishment") {
      const id = stableId("experience", user.id, mutation.idempotencyKey); if (experiences[id] || Object.values(experiences).some((item) => item.accomplishmentId === mutation.accomplishmentId)) return { store, materials, duplicate: true };
      const accomplishment = account.accomplishments?.[mutation.accomplishmentId]; if (!accomplishment || accomplishment.hidden || accomplishment.inactiveAt) throw domainError("This accomplishment is not available.", "ResumeLabEvidenceError");
      experiences[id] = { id, source: "accomplishment", accomplishmentId: accomplishment.id, kind: resumeExperienceKinds.includes(accomplishment.kind as ResumeExperienceRecord["kind"]) ? accomplishment.kind as ResumeExperienceRecord["kind"] : "other", current: false, skills: [], facts: [], bullets: [], createdAt: now, updatedAt: now, version: 0 };
    } else if (mutation.action === "delete_experience") {
      const record = experiences[mutation.experienceId]; if (!record) return { store, materials, duplicate: true }; if (record.version !== mutation.expectedRecordVersion) throw domainError("This experience changed elsewhere. Refresh and try again.", "ResumeLabRecordConflictError");
      if (Object.values(resumes).some((resume) => resume.sections.some((section) => section.entries.some((entry) => entry.experienceId === record.id)))) throw domainError("Remove this experience from resume versions before deleting it.", "ResumeLabInUseError");
      delete experiences[record.id];
    } else {
      const existing = mutation.experienceId ? experiences[mutation.experienceId] : undefined; const id = existing?.id ?? stableId("experience", user.id, mutation.idempotencyKey!);
      if (existing && existing.version !== mutation.expectedRecordVersion) throw domainError("This experience changed elsewhere. Refresh and try again.", "ResumeLabRecordConflictError");
      const facts = mutation.facts.map((fact, index) => ({ id: fact.id ?? stableId("fact", user.id, `${id}:${index}:${fact.text}`), kind: fact.kind, text: fact.text, confirmed: fact.confirmed }));
      const bullets = mutation.bullets.map((bullet, index) => { const generated = bullet.text ? { text: bullet.text, factIds: bullet.factIds } : draftBulletFromFacts(facts.filter((fact) => bullet.factIds.includes(fact.id)), index); if (!generated) throw domainError("Confirm at least one fact before drafting a bullet.", "ResumeLabEvidenceError"); return { id: bullet.id ?? stableId("bullet", user.id, `${id}:${index}:${generated.text}`), text: generated.text, factIds: generated.factIds, confirmedClaims: bullet.confirmedClaims ?? [], createdAt: existing?.bullets.find((item) => item.id === bullet.id)?.createdAt ?? now, updatedAt: now, version: (existing?.bullets.find((item) => item.id === bullet.id)?.version ?? -1) + 1 }; });
      experiences[id] = { id, source: existing?.source ?? "manual", accomplishmentId: existing?.accomplishmentId, kind: mutation.kind, organization: mutation.organization || existing?.organization, title: mutation.title || existing?.title, location: mutation.location, startDate: mutation.startDate, endDate: mutation.endDate, current: mutation.current, skills: mutation.skills, facts, bullets, createdAt: existing?.createdAt ?? now, updatedAt: now, version: existing ? existing.version + 1 : 0 };
    }
    return { store: { experiences, resumes, version: store.version + 1, updatedAt: now }, materials: nextMaterialStore, duplicate: false };
  }});
  const ids = [...new Set([...Object.keys(result.account.tracker ?? {}), ...Object.keys(result.account.activity?.tracked ?? {}), ...Object.values(result.account.accomplishments ?? {}).flatMap((item) => item.canonicalOpportunityId ? [item.canonicalOpportunityId] : []), ...Object.values(result.store.resumes).flatMap((item) => item.target.type === "opportunity" && item.target.id ? [item.target.id] : [])])];
  const opportunities = await listPublishedOpportunitiesByIds(ids, { includeArchived: true });
  return { ok: true as const, duplicate: result.duplicate, model: buildResumeLabModel({ user, account: result.account, opportunities }) };
}
