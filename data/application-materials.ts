export const applicationMaterialTypes = [
  "resume",
  "transcript",
  "cover_letter",
  "personal_statement",
  "essay",
  "writing_sample",
  "recommendation",
  "portfolio",
  "project_sample",
  "certification",
  "other",
] as const;

export type ApplicationMaterialType = (typeof applicationMaterialTypes)[number];

export const applicationMaterialStatuses = ["draft", "ready", "needs_update", "archived"] as const;
export type ApplicationMaterialStatus = (typeof applicationMaterialStatuses)[number];

export const applicationMaterialContexts = ["general", "finance", "research", "software", "public_service", "health", "humanities"] as const;
export type ApplicationMaterialContext = (typeof applicationMaterialContexts)[number];

export const applicationMaterialTypeLabels: Record<ApplicationMaterialType, string> = {
  resume: "Resume",
  transcript: "Transcript",
  cover_letter: "Cover letter",
  personal_statement: "Personal statement",
  essay: "Essay",
  writing_sample: "Writing sample",
  recommendation: "Recommendation",
  portfolio: "Portfolio",
  project_sample: "Project sample",
  certification: "Certification",
  other: "Other",
};

export const applicationMaterialStatusLabels: Record<ApplicationMaterialStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  needs_update: "Needs update",
  archived: "Archived",
};

export type ApplicationMaterialRecord = {
  id: string;
  type: ApplicationMaterialType;
  title: string;
  versionLabel?: string;
  status: ApplicationMaterialStatus;
  contexts: ApplicationMaterialContext[];
  notes?: string;
  preferred: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  version: number;
};

export type ApplicationMaterialSnapshot = Pick<ApplicationMaterialRecord, "type" | "title" | "versionLabel">;

export type ApplicationMaterialAssociation = {
  id: string;
  opportunityId: string;
  requirementType: ApplicationMaterialType;
  requirementTitle: string;
  materialId: string;
  materialSnapshot: ApplicationMaterialSnapshot;
  selectedAt: string;
  updatedAt: string;
  materialDeletedAt?: string;
  version: number;
};

export type ApplicationMaterialStore = {
  records: Record<string, ApplicationMaterialRecord>;
  associations: Record<string, ApplicationMaterialAssociation>;
  version: number;
  updatedAt?: string;
};

export const emptyApplicationMaterialStore = (): ApplicationMaterialStore => ({ records: {}, associations: {}, version: 0 });

const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const clean = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const timestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;

export function materialAssociationId(opportunityId: string, type: ApplicationMaterialType) {
  const value = `${opportunityId}:${type}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `association:${(hash >>> 0).toString(36)}`;
}

export function normalizeApplicationMaterialStore(value: ApplicationMaterialStore | null | undefined): ApplicationMaterialStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyApplicationMaterialStore();
  const records: Record<string, ApplicationMaterialRecord> = {};
  for (const [id, candidate] of Object.entries(value.records ?? {}).slice(0, 500)) {
    if (!safeId.test(id) || !candidate || candidate.id !== id || !applicationMaterialTypes.includes(candidate.type) || !applicationMaterialStatuses.includes(candidate.status)) continue;
    const title = clean(candidate.title, 120);
    const createdAt = timestamp(candidate.createdAt);
    const updatedAt = timestamp(candidate.updatedAt);
    if (!title || !createdAt || !updatedAt) continue;
    records[id] = {
      id,
      type: candidate.type,
      title,
      versionLabel: clean(candidate.versionLabel, 60) || undefined,
      status: candidate.status,
      contexts: [...new Set((candidate.contexts ?? []).filter((item) => applicationMaterialContexts.includes(item)))].slice(0, 4),
      notes: clean(candidate.notes, 800) || undefined,
      preferred: Boolean(candidate.preferred),
      createdAt,
      updatedAt,
      archivedAt: candidate.status === "archived" ? timestamp(candidate.archivedAt) ?? updatedAt : undefined,
      version: Number.isInteger(candidate.version) && candidate.version >= 0 ? candidate.version : 0,
    };
  }
  const associations: Record<string, ApplicationMaterialAssociation> = {};
  for (const [id, candidate] of Object.entries(value.associations ?? {}).slice(0, 2_000)) {
    if (!safeId.test(id) || !candidate || candidate.id !== id || !safeId.test(candidate.opportunityId) || !safeId.test(candidate.materialId) || !applicationMaterialTypes.includes(candidate.requirementType)) continue;
    const selectedAt = timestamp(candidate.selectedAt);
    const updatedAt = timestamp(candidate.updatedAt);
    const requirementTitle = clean(candidate.requirementTitle, 160);
    const snapshotTitle = clean(candidate.materialSnapshot?.title, 120);
    if (!selectedAt || !updatedAt || !requirementTitle || !snapshotTitle) continue;
    associations[id] = {
      id,
      opportunityId: candidate.opportunityId,
      requirementType: candidate.requirementType,
      requirementTitle,
      materialId: candidate.materialId,
      materialSnapshot: {
        type: applicationMaterialTypes.includes(candidate.materialSnapshot.type) ? candidate.materialSnapshot.type : candidate.requirementType,
        title: snapshotTitle,
        versionLabel: clean(candidate.materialSnapshot.versionLabel, 60) || undefined,
      },
      selectedAt,
      updatedAt,
      materialDeletedAt: timestamp(candidate.materialDeletedAt),
      version: Number.isInteger(candidate.version) && candidate.version >= 0 ? candidate.version : 0,
    };
  }
  return {
    records,
    associations,
    version: Number.isInteger(value.version) && value.version >= 0 ? value.version : 0,
    updatedAt: timestamp(value.updatedAt),
  };
}
