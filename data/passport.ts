export const passportSectionIds = ["timeline", "experiences", "projects", "accomplishments", "skills", "interests"] as const;
export type PassportSectionId = (typeof passportSectionIds)[number];
export type PassportVisibility = "private" | "passport";

export type PassportManualEvent = {
  id: string;
  title: string;
  organization?: string;
  date: string;
  kind: "experience" | "project" | "publication" | "leadership" | "service" | "milestone";
  description?: string;
  skills: string[];
  visibility: PassportVisibility;
  createdAt: string;
};

export type PassportCollection = {
  id: string;
  title: string;
  description?: string;
  opportunityIds: string[];
  sharingEnabled: boolean;
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
};

export type OpportunityPassport = {
  headline?: string;
  sharingEnabled: boolean;
  shareToken?: string;
  showSchool: boolean;
  showAcademicDetails: boolean;
  showCareerInterests: boolean;
  visibleAccomplishmentIds: string[];
  visibleExperienceIds: string[];
  highlightIds: string[];
  sectionOrder: PassportSectionId[];
  manualEvents: PassportManualEvent[];
  collections: PassportCollection[];
  updatedAt: string;
  version: number;
};

const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const clean = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const ids = (value: unknown, max = 100) => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && safeId.test(item)))].slice(0, max) : [];
const strings = (value: unknown, max = 20) => Array.isArray(value) ? [...new Set(value.map((item) => clean(item, 80)).filter(Boolean))].slice(0, max) : [];
const timestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
const date = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) ? value : undefined;

export function emptyOpportunityPassport(now = new Date().toISOString()): OpportunityPassport {
  return { sharingEnabled: false, showSchool: false, showAcademicDetails: false, showCareerInterests: false, visibleAccomplishmentIds: [], visibleExperienceIds: [], highlightIds: [], sectionOrder: [...passportSectionIds], manualEvents: [], collections: [], updatedAt: now, version: 0 };
}

export function normalizeOpportunityPassport(value: unknown): OpportunityPassport {
  const fallback = emptyOpportunityPassport();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const input = value as Partial<OpportunityPassport>;
  const order = Array.isArray(input.sectionOrder) ? input.sectionOrder.filter((item): item is PassportSectionId => passportSectionIds.includes(item as PassportSectionId)) : [];
  const sectionOrder = [...new Set([...order, ...passportSectionIds])];
  const manualEvents = Array.isArray(input.manualEvents) ? input.manualEvents.flatMap((item) => {
    if (!item || !safeId.test(String(item.id ?? ""))) return [];
    const title = clean(item.title, 180); const eventDate = date(item.date); const createdAt = timestamp(item.createdAt);
    const kind = ["experience", "project", "publication", "leadership", "service", "milestone"].includes(String(item.kind)) ? item.kind : undefined;
    if (!title || !eventDate || !createdAt || !kind) return [];
    return [{ id: item.id, title, organization: clean(item.organization, 180) || undefined, date: eventDate, kind, description: clean(item.description, 600) || undefined, skills: strings(item.skills), visibility: item.visibility === "passport" ? "passport" as const : "private" as const, createdAt }];
  }).slice(0, 100) : [];
  const collections = Array.isArray(input.collections) ? input.collections.flatMap((item) => {
    if (!item || !safeId.test(String(item.id ?? ""))) return [];
    const title = clean(item.title, 120); const createdAt = timestamp(item.createdAt); const updatedAt = timestamp(item.updatedAt);
    if (!title || !createdAt || !updatedAt) return [];
    const shareToken = typeof item.shareToken === "string" && /^[A-Za-z0-9_-]{24,80}$/.test(item.shareToken) ? item.shareToken : undefined;
    return [{ id: item.id, title, description: clean(item.description, 400) || undefined, opportunityIds: ids(item.opportunityIds, 60), sharingEnabled: Boolean(item.sharingEnabled && shareToken), shareToken, createdAt, updatedAt }];
  }).slice(0, 30) : [];
  const shareToken = typeof input.shareToken === "string" && /^[A-Za-z0-9_-]{24,80}$/.test(input.shareToken) ? input.shareToken : undefined;
  return {
    headline: clean(input.headline, 160) || undefined,
    sharingEnabled: Boolean(input.sharingEnabled && shareToken), shareToken,
    showSchool: Boolean(input.showSchool), showAcademicDetails: Boolean(input.showAcademicDetails), showCareerInterests: Boolean(input.showCareerInterests),
    visibleAccomplishmentIds: ids(input.visibleAccomplishmentIds), visibleExperienceIds: ids(input.visibleExperienceIds), highlightIds: ids(input.highlightIds, 6),
    sectionOrder, manualEvents, collections,
    updatedAt: timestamp(input.updatedAt) ?? fallback.updatedAt,
    version: Number.isInteger(input.version) && Number(input.version) >= 0 ? Number(input.version) : 0,
  };
}
