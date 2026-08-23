export const accomplishmentKinds = [
  "internship",
  "research",
  "scholarship",
  "fellowship",
  "competition",
  "program",
  "leadership",
  "project",
  "other",
] as const;

export type AccomplishmentKind = (typeof accomplishmentKinds)[number];

export const accomplishmentOutcomes = [
  "accepted",
  "awarded",
  "participated",
  "finalist",
  "placed",
  "won",
  "completed",
] as const;

export type AccomplishmentOutcome = (typeof accomplishmentOutcomes)[number];

export type AccomplishmentSnapshot = {
  title: string;
  organization: string;
  opportunityType?: string;
  category?: string;
  capturedAt: string;
};

export type AccomplishmentRecord = {
  id: string;
  source: "journey" | "manual";
  canonicalOpportunityId?: string;
  journeyOpportunityId?: string;
  snapshot: AccomplishmentSnapshot;
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
  hidden: boolean;
  inactiveAt?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  lastMutationKey?: string;
};

export type AccomplishmentStore = Record<string, AccomplishmentRecord>;

export const accomplishmentOutcomeLabels: Record<AccomplishmentOutcome, string> = {
  accepted: "Accepted",
  awarded: "Awarded",
  participated: "Participated",
  finalist: "Finalist",
  placed: "Placed",
  won: "Won",
  completed: "Completed",
};

export const accomplishmentKindLabels: Record<AccomplishmentKind, string> = {
  internship: "Internship",
  research: "Research",
  scholarship: "Scholarship",
  fellowship: "Fellowship",
  competition: "Competition",
  program: "Program",
  leadership: "Leadership",
  project: "Project",
  other: "Other",
};

const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maximum) : "";
}

function date(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const time = Date.parse(`${value}T12:00:00.000Z`);
  return Number.isFinite(time) && time >= Date.UTC(1950, 0, 1) && time <= Date.now() + 10 * 365 * 86_400_000 ? value : undefined;
}

function timestamp(value: unknown) {
  if (typeof value !== "string") return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) && time >= Date.UTC(2000, 0, 1) && time <= Date.now() + 5 * 60_000 ? new Date(time).toISOString() : undefined;
}

export function normalizeAccomplishmentStore(value: unknown): AccomplishmentStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const records: AccomplishmentStore = {};
  for (const [rawId, raw] of Object.entries(value).slice(0, 1_000)) {
    if (!safeId.test(rawId) || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const input = raw as Partial<AccomplishmentRecord>;
    const snapshotInput = input.snapshot && typeof input.snapshot === "object" ? input.snapshot : undefined;
    const source = input.source === "journey" || input.source === "manual" ? input.source : undefined;
    const kind = accomplishmentKinds.includes(input.kind as AccomplishmentKind) ? input.kind as AccomplishmentKind : undefined;
    const outcome = accomplishmentOutcomes.includes(input.outcome as AccomplishmentOutcome) ? input.outcome as AccomplishmentOutcome : undefined;
    const title = text(snapshotInput?.title, 180);
    const organization = text(snapshotInput?.organization, 180);
    const outcomeDate = date(input.outcomeDate);
    const createdAt = timestamp(input.createdAt);
    const updatedAt = timestamp(input.updatedAt);
    const capturedAt = timestamp(snapshotInput?.capturedAt);
    if (!source || !kind || !outcome || !title || !organization || !outcomeDate || !createdAt || !updatedAt || !capturedAt) continue;
    const canonicalOpportunityId = typeof input.canonicalOpportunityId === "string" && safeId.test(input.canonicalOpportunityId) ? input.canonicalOpportunityId : undefined;
    const journeyOpportunityId = typeof input.journeyOpportunityId === "string" && safeId.test(input.journeyOpportunityId) ? input.journeyOpportunityId : undefined;
    if (source === "journey" && !journeyOpportunityId) continue;
    const skills = Array.isArray(input.skills) ? [...new Set(input.skills.map((item) => text(item, 80)).filter(Boolean))].slice(0, 20) : undefined;
    records[rawId] = {
      id: rawId,
      source,
      canonicalOpportunityId,
      journeyOpportunityId,
      snapshot: {
        title,
        organization,
        opportunityType: text(snapshotInput?.opportunityType, 80) || undefined,
        category: text(snapshotInput?.category, 100) || undefined,
        capturedAt,
      },
      kind,
      outcome,
      outcomeDate,
      startDate: date(input.startDate),
      endDate: date(input.endDate),
      roleTitle: text(input.roleTitle, 160) || undefined,
      team: text(input.team, 160) || undefined,
      location: text(input.location, 160) || undefined,
      projectTitle: text(input.projectTitle, 180) || undefined,
      mentor: text(input.mentor, 160) || undefined,
      labOrGroup: text(input.labOrGroup, 180) || undefined,
      researchArea: text(input.researchArea, 180) || undefined,
      placement: text(input.placement, 100) || undefined,
      awardAmount: text(input.awardAmount, 100) || undefined,
      description: text(input.description, 1_500) || undefined,
      notes: text(input.notes, 2_000) || undefined,
      skills,
      hidden: Boolean(input.hidden),
      inactiveAt: timestamp(input.inactiveAt),
      createdAt,
      updatedAt,
      version: Number.isInteger(input.version) && Number(input.version) >= 0 ? Math.min(Number(input.version), Number.MAX_SAFE_INTEGER) : 0,
      lastMutationKey: typeof input.lastMutationKey === "string" && safeId.test(input.lastMutationKey) ? input.lastMutationKey : undefined,
    };
  }
  return records;
}
