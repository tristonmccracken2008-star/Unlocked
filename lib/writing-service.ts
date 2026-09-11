import crypto from "node:crypto";
import { writingPromptById } from "@/data/writing-prompts";
import {
  normalizeWritingStore,
  type WritingDocument,
  type WritingIdea,
  type WritingStatus,
  type WritingStore,
} from "@/data/writing";
import { mutateWriting } from "./auth-store";

export type WritingMutation =
  | { action: "create_document"; expectedVersion: number; idempotencyKey: string; promptId: string; title?: string; planningDate?: string }
  | { action: "save_document"; expectedVersion: number; documentId: string; expectedDocumentVersion: number; title: string; content: string; status: WritingStatus; privateNotes?: string; planningDate?: string; checkpoint?: boolean }
  | { action: "restore_version"; expectedVersion: number; documentId: string; expectedDocumentVersion: number; versionId: string }
  | { action: "create_idea"; expectedVersion: number; idempotencyKey: string; title: string; category: string; notes?: string; experienceId?: string }
  | { action: "save_idea"; expectedVersion: number; ideaId: string; expectedIdeaVersion: number; title: string; category: string; notes?: string; storyNotes: WritingIdea["storyNotes"] }
  | { action: "attach_idea"; expectedVersion: number; documentId: string; expectedDocumentVersion: number; ideaId: string };

const now = () => new Date().toISOString();
const versionSnapshot = (document: WritingDocument, createdAt: string) => ({
  id: "writing-version:" + crypto.randomUUID(),
  documentVersion: document.version,
  content: document.content,
  title: document.title,
  status: document.status,
  createdAt,
});

export async function updateWriting(userId: string, mutation: WritingMutation) {
  return await mutateWriting(userId, {
    expectedVersion: mutation.expectedVersion,
    mutate(current) {
      const store = normalizeWritingStore(current);
      const changedAt = now();
      if (mutation.action === "create_document") {
        const duplicate = Object.values(store.assignments).find((item) => item.id === "writing-assignment:" + mutation.idempotencyKey);
        if (duplicate) return { store, duplicate: true };
        const prompt = writingPromptById.get(mutation.promptId);
        if (!prompt || prompt.verificationStatus !== "verified") throw new Error("This prompt is not available as a verified writing assignment.");
        const documentId = "writing-document:" + crypto.randomUUID();
        const assignmentId = "writing-assignment:" + mutation.idempotencyKey;
        const document: WritingDocument = {
          id: documentId,
          promptId: prompt.id,
          collegeId: prompt.institutionId,
          cycle: prompt.cycle,
          title: mutation.title || prompt.title,
          status: "not_started",
          content: "",
          planningDate: mutation.planningDate,
          ideaIds: [],
          versions: [],
          createdAt: changedAt,
          updatedAt: changedAt,
          version: 0,
        };
        return {
          duplicate: false,
          store: {
            ...store,
            documents: { ...store.documents, [documentId]: document },
            assignments: {
              ...store.assignments,
              [assignmentId]: { id: assignmentId, promptId: prompt.id, documentId, collegeId: prompt.institutionId, cycle: prompt.cycle, createdAt: changedAt },
            },
            version: store.version + 1,
            updatedAt: changedAt,
          },
        };
      }
      if (mutation.action === "create_idea") {
        const ideaId = "writing-idea:" + mutation.idempotencyKey;
        if (store.ideas[ideaId]) return { store, duplicate: true };
        const idea: WritingIdea = {
          id: ideaId,
          title: mutation.title,
          category: mutation.category,
          notes: mutation.notes,
          storyNotes: {},
          experienceIds: mutation.experienceId ? [mutation.experienceId] : [],
          createdAt: changedAt,
          updatedAt: changedAt,
          version: 0,
        };
        return { duplicate: false, store: { ...store, ideas: { ...store.ideas, [ideaId]: idea }, version: store.version + 1, updatedAt: changedAt } };
      }
      if (mutation.action === "save_idea") {
        const idea = store.ideas[mutation.ideaId];
        if (!idea) throw new Error("Writing idea not found.");
        if (idea.version !== mutation.expectedIdeaVersion) throw Object.assign(new Error("This idea changed elsewhere. Reload before saving."), { name: "WritingConflictError" });
        const next = { ...idea, title: mutation.title, category: mutation.category, notes: mutation.notes, storyNotes: mutation.storyNotes, updatedAt: changedAt, version: idea.version + 1 };
        return { duplicate: false, store: { ...store, ideas: { ...store.ideas, [idea.id]: next }, version: store.version + 1, updatedAt: changedAt } };
      }
      const document = store.documents[mutation.documentId];
      if (!document) throw new Error("Writing document not found.");
      if (document.version !== mutation.expectedDocumentVersion) throw Object.assign(new Error("This draft changed elsewhere. Reload before saving."), { name: "WritingConflictError" });
      if (mutation.action === "attach_idea") {
        if (!store.ideas[mutation.ideaId]) throw new Error("Writing idea not found.");
        const next = { ...document, ideaIds: [...new Set([...document.ideaIds, mutation.ideaId])], updatedAt: changedAt, version: document.version + 1 };
        return { duplicate: false, store: { ...store, documents: { ...store.documents, [document.id]: next }, version: store.version + 1, updatedAt: changedAt } };
      }
      if (mutation.action === "restore_version") {
        const selected = document.versions.find((item) => item.id === mutation.versionId);
        if (!selected) throw new Error("Writing version not found.");
        const next = {
          ...document,
          title: selected.title,
          content: selected.content,
          status: selected.status,
          versions: [...document.versions, versionSnapshot(document, changedAt)].slice(-100),
          updatedAt: changedAt,
          version: document.version + 1,
        };
        return { duplicate: false, store: { ...store, documents: { ...store.documents, [document.id]: next }, version: store.version + 1, updatedAt: changedAt } };
      }
      const contentChanged = mutation.content !== document.content;
      const lastCheckpoint = document.versions.at(-1)?.createdAt;
      const checkpointDue = !lastCheckpoint || Date.parse(changedAt) - Date.parse(lastCheckpoint) >= 5 * 60_000;
      const shouldCheckpoint = Boolean(document.content) && (mutation.checkpoint || mutation.status !== document.status || (contentChanged && checkpointDue));
      const next = {
        ...document,
        title: mutation.title,
        content: mutation.content,
        status: mutation.status,
        privateNotes: mutation.privateNotes,
        planningDate: mutation.planningDate,
        versions: shouldCheckpoint ? [...document.versions, versionSnapshot(document, changedAt)].slice(-100) : document.versions,
        updatedAt: changedAt,
        version: document.version + 1,
      };
      return { duplicate: false, store: { ...store, documents: { ...store.documents, [document.id]: next }, version: store.version + 1, updatedAt: changedAt } };
    },
  });
}
