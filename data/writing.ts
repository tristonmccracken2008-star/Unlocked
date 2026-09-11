export const writingStatuses = ["not_started", "ideas", "drafting", "revising", "final"] as const;
export type WritingStatus = (typeof writingStatuses)[number];
export const writingStatusLabels: Record<WritingStatus, string> = {
  not_started: "Not Started",
  ideas: "Ideas",
  drafting: "Drafting",
  revising: "Revising",
  final: "Final",
};

export const writingPromptTypes = ["personal_statement", "why_us", "why_major", "community", "identity", "activity", "intellectual_curiosity", "challenge", "contribution", "short_answer", "creative", "additional_information"] as const;
export type WritingPromptType = (typeof writingPromptTypes)[number];
export type WritingProvider = "common_app" | "coalition_scoir" | "institution" | "other";
export type WritingVerificationStatus = "verified" | "not_yet_verified" | "retired";

export type WritingPrompt = {
  id: string;
  institutionId?: string;
  institutionName?: string;
  cycle: string;
  type: WritingPromptType;
  title: string;
  text: string;
  wordLimit?: number;
  characterLimit?: number;
  required: boolean;
  provider: WritingProvider;
  applicationPlans: string[];
  sourceLabel: string;
  sourceUrl: string;
  lastVerified: string;
  verificationStatus: WritingVerificationStatus;
};

export type WritingVersion = {
  id: string;
  documentVersion: number;
  content: string;
  title: string;
  status: WritingStatus;
  createdAt: string;
};

export type WritingDocument = {
  id: string;
  promptId: string;
  collegeId?: string;
  cycle: string;
  title: string;
  status: WritingStatus;
  content: string;
  privateNotes?: string;
  planningDate?: string;
  ideaIds: string[];
  versions: WritingVersion[];
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type WritingIdea = {
  id: string;
  title: string;
  category: string;
  notes?: string;
  storyNotes: {
    happened?: string;
    remember?: string;
    thinking?: string;
    changed?: string;
    detail?: string;
    whyRemember?: string;
  };
  experienceIds: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type WritingPromptAssignment = {
  id: string;
  promptId: string;
  documentId: string;
  collegeId?: string;
  cycle: string;
  createdAt: string;
};

export type WritingFeedback = {
  id: string;
  documentId: string;
  kind: "clarity" | "specificity" | "structure" | "repetition" | "wordiness" | "grammar" | "prompt_alignment" | "voice";
  excerpt?: string;
  message: string;
  question?: string;
  createdAt: string;
  resolvedAt?: string;
};

export type WritingStore = {
  documents: Record<string, WritingDocument>;
  ideas: Record<string, WritingIdea>;
  assignments: Record<string, WritingPromptAssignment>;
  feedback: Record<string, WritingFeedback>;
  version: number;
  updatedAt?: string;
};

export const emptyWritingStore = (): WritingStore => ({
  documents: {},
  ideas: {},
  assignments: {},
  feedback: {},
  version: 0,
});

const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const text = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\r\n?/g, "\n").slice(0, max) : "";
const clean = (value: unknown, max: number) => text(value, max).replace(/\s+/g, " ").trim();
const timestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
const date = (value: unknown) => typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + "T12:00:00Z")) ? value : undefined;

export function normalizeWritingStore(value: WritingStore | null | undefined): WritingStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyWritingStore();
  const documents: Record<string, WritingDocument> = {};
  for (const [id, candidate] of Object.entries(value.documents ?? {}).slice(0, 200)) {
    if (!safeId.test(id) || candidate?.id !== id || !safeId.test(candidate.promptId) || !writingStatuses.includes(candidate.status)) continue;
    const createdAt = timestamp(candidate.createdAt);
    const updatedAt = timestamp(candidate.updatedAt);
    const title = clean(candidate.title, 160);
    if (!createdAt || !updatedAt || !title) continue;
    const versions = (candidate.versions ?? []).slice(-100).flatMap((item) => {
      const versionId = clean(item?.id, 160);
      const versionAt = timestamp(item?.createdAt);
      if (!safeId.test(versionId) || !versionAt || !writingStatuses.includes(item.status)) return [];
      return [{ id: versionId, documentVersion: Math.max(0, Math.floor(item.documentVersion || 0)), content: text(item.content, 100_000), title: clean(item.title, 160) || title, status: item.status, createdAt: versionAt }];
    });
    documents[id] = {
      id,
      promptId: candidate.promptId,
      collegeId: candidate.collegeId && safeId.test(candidate.collegeId) ? candidate.collegeId : undefined,
      cycle: clean(candidate.cycle, 30) || "Unknown cycle",
      title,
      status: candidate.status,
      content: text(candidate.content, 100_000),
      privateNotes: text(candidate.privateNotes, 10_000).trim() || undefined,
      planningDate: date(candidate.planningDate),
      ideaIds: [...new Set((candidate.ideaIds ?? []).filter((item) => safeId.test(item)))].slice(0, 50),
      versions,
      createdAt,
      updatedAt,
      version: Math.max(0, Math.floor(candidate.version || 0)),
    };
  }
  const ideas: Record<string, WritingIdea> = {};
  for (const [id, candidate] of Object.entries(value.ideas ?? {}).slice(0, 400)) {
    if (!safeId.test(id) || candidate?.id !== id) continue;
    const title = clean(candidate.title, 160);
    const createdAt = timestamp(candidate.createdAt);
    const updatedAt = timestamp(candidate.updatedAt);
    if (!title || !createdAt || !updatedAt) continue;
    ideas[id] = {
      id,
      title,
      category: clean(candidate.category, 60) || "Something ordinary but meaningful",
      notes: text(candidate.notes, 10_000).trim() || undefined,
      storyNotes: {
        happened: text(candidate.storyNotes?.happened, 4_000).trim() || undefined,
        remember: text(candidate.storyNotes?.remember, 4_000).trim() || undefined,
        thinking: text(candidate.storyNotes?.thinking, 4_000).trim() || undefined,
        changed: text(candidate.storyNotes?.changed, 4_000).trim() || undefined,
        detail: text(candidate.storyNotes?.detail, 4_000).trim() || undefined,
        whyRemember: text(candidate.storyNotes?.whyRemember, 4_000).trim() || undefined,
      },
      experienceIds: [...new Set((candidate.experienceIds ?? []).filter((item) => safeId.test(item)))].slice(0, 20),
      createdAt,
      updatedAt,
      version: Math.max(0, Math.floor(candidate.version || 0)),
    };
  }
  const assignments = Object.fromEntries(Object.entries(value.assignments ?? {}).slice(0, 300).flatMap(([id, item]) => {
    const createdAt = timestamp(item?.createdAt);
    if (!safeId.test(id) || item?.id !== id || !safeId.test(item.promptId) || !safeId.test(item.documentId) || !documents[item.documentId] || !createdAt) return [];
    return [[id, { id, promptId: item.promptId, documentId: item.documentId, collegeId: item.collegeId && safeId.test(item.collegeId) ? item.collegeId : undefined, cycle: clean(item.cycle, 30), createdAt }]];
  }));
  const feedback = Object.fromEntries(Object.entries(value.feedback ?? {}).slice(-800).flatMap(([id, item]) => {
    const createdAt = timestamp(item?.createdAt);
    if (!safeId.test(id) || item?.id !== id || !documents[item.documentId] || !createdAt) return [];
    return [[id, { ...item, id, excerpt: clean(item.excerpt, 500) || undefined, message: clean(item.message, 1_000), question: clean(item.question, 1_000) || undefined, createdAt, resolvedAt: timestamp(item.resolvedAt) }]];
  }));
  return { documents, ideas, assignments, feedback, version: Math.max(0, Math.floor(value.version || 0)), updatedAt: timestamp(value.updatedAt) };
}
