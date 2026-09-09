export const resumeExperienceKinds = [
  "work",
  "internship",
  "research",
  "project",
  "leadership",
  "campus_organization",
  "activity",
  "volunteer",
  "teaching",
  "athletics",
  "competition",
  "award",
  "scholarship",
  "fellowship",
  "program",
  "publication",
  "course_project",
  "independent_project",
  "certification",
  "other",
] as const;
export type ResumeExperienceKind = (typeof resumeExperienceKinds)[number];
export const resumeFactKinds = [
  "action",
  "responsibility",
  "creation",
  "collaboration",
  "audience",
  "tool",
  "method",
  "scope",
  "frequency",
  "decision",
  "challenge",
  "outcome",
  "link",
  "other",
] as const;
export type ResumeFactKind = (typeof resumeFactKinds)[number];
export const resumeSectionKinds = [
  "education",
  "experience",
  "projects",
  "research",
  "leadership",
  "activities",
  "awards",
  "publications",
  "coursework",
  "skills",
  "custom",
] as const;
export type ResumeSectionKind = (typeof resumeSectionKinds)[number];

export type ResumeFactSource =
  "user" | "accomplishment" | "profile" | "journey" | "import";
export type ResumeFact = {
  id: string;
  kind: ResumeFactKind;
  text: string;
  confirmed: boolean;
  source?: ResumeFactSource;
  sourceLabel?: string;
};
export type ResumeBullet = {
  id: string;
  text: string;
  factIds: string[];
  confirmedClaims: string[];
  reviewState?: "draft" | "reviewed";
  createdAt: string;
  updatedAt: string;
  version: number;
};
export type HighSchoolRolePeriod = {
  id: string;
  title: string;
  grades: string[];
  startDate?: string;
  endDate?: string;
  createdAt: string;
};
export type HighSchoolExperienceDetails = {
  category?: string;
  grades: string[];
  participationTiming: string[];
  hoursPerWeek?: number;
  weeksPerYear?: number;
  privateNotes?: string;
  collaborators?: string;
  links: string[];
  roleHistory: HighSchoolRolePeriod[];
};
export type ApplicationActivityRevision = {
  id: string;
  position: string;
  organization: string;
  description: string;
  updatedAt: string;
};
export type ApplicationActivityVersion = {
  experienceId: string;
  activityType: string;
  position: string;
  organization: string;
  description: string;
  grades: string[];
  participationTiming: string[];
  hoursPerWeek?: number;
  weeksPerYear?: number;
  continueInCollege?: boolean;
  revisions: ApplicationActivityRevision[];
  updatedAt: string;
  version: number;
};
export type ApplicationActivitySet = {
  id: string;
  platform: "common_app";
  cycle: string;
  sourceUrl: string;
  verifiedAt: string;
  slotLimit: number;
  limits: { position: number; organization: number; description: number };
  selectedExperienceIds: string[];
  versions: Record<string, ApplicationActivityVersion>;
  status: "draft" | "ready";
  updatedAt: string;
  version: number;
};
export type ResumeExperienceRecord = {
  id: string;
  source: "manual" | "accomplishment";
  accomplishmentId?: string;
  kind: ResumeExperienceKind;
  organization?: string;
  title?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current: boolean;
  skills: string[];
  facts: ResumeFact[];
  bullets: ResumeBullet[];
  highSchool?: HighSchoolExperienceDetails;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ResumeEntry = {
  experienceId: string;
  bulletIds: string[];
  bulletOverrides?: Record<string, string>;
};
export type ResumeSection = {
  id: string;
  kind: ResumeSectionKind;
  title: string;
  visible: boolean;
  entries: ResumeEntry[];
};
export type ResumeTarget = {
  type: "general" | "opportunity" | "path";
  id?: string;
  label?: string;
};
export const resumeTemplates = [
  "classic",
  "modern",
  "technical",
  "academic",
] as const;
export type ResumeTemplate = (typeof resumeTemplates)[number];
export type ResumeRevision = {
  id: string;
  createdAt: string;
  version: number;
  title: string;
  target: ResumeTarget;
  contact: ResumeDocumentRecord["contact"];
  summary?: string;
  sections: ResumeSection[];
  skills: string[];
  template: ResumeTemplate;
};
export type ResumeDocumentRecord = {
  id: string;
  materialId: string;
  title: string;
  kind: "master" | "targeted";
  baseResumeId?: string;
  target: ResumeTarget;
  contact: {
    email?: string;
    phone?: string;
    city?: string;
    linkedIn?: string;
    portfolio?: string;
  };
  summary?: string;
  sections: ResumeSection[];
  skills: string[];
  template: ResumeTemplate;
  revisions?: ResumeRevision[];
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ResumeLabStore = {
  experiences: Record<string, ResumeExperienceRecord>;
  resumes: Record<string, ResumeDocumentRecord>;
  applicationActivitySets?: Record<string, ApplicationActivitySet>;
  version: number;
  updatedAt?: string;
};
export const emptyResumeLabStore = (): ResumeLabStore => ({
  experiences: {},
  resumes: {},
  applicationActivitySets: {},
  version: 0,
});

const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const clean = (value: unknown, max: number) =>
  typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, max)
    : "";
const timestamp = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : undefined;
const date = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}(-\d{2})?$/.test(value)
    ? value
    : undefined;
const id = (value: unknown) =>
  typeof value === "string" && safeId.test(value) ? value : undefined;

export function normalizeResumeLabStore(value: unknown): ResumeLabStore {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return emptyResumeLabStore();
  const input = value as Partial<ResumeLabStore>;
  const experiences: Record<string, ResumeExperienceRecord> = {};
  for (const [recordId, candidate] of Object.entries(
    input.experiences ?? {},
  ).slice(0, 500)) {
    if (
      !safeId.test(recordId) ||
      !candidate ||
      candidate.id !== recordId ||
      !resumeExperienceKinds.includes(candidate.kind)
    )
      continue;
    const createdAt = timestamp(candidate.createdAt);
    const updatedAt = timestamp(candidate.updatedAt);
    if (
      !createdAt ||
      !updatedAt ||
      (candidate.source !== "manual" && candidate.source !== "accomplishment")
    )
      continue;
    const facts = (candidate.facts ?? [])
      .flatMap((fact): ResumeFact[] => {
        const factId = id(fact?.id);
        const text = clean(fact?.text, 300);
        const source = [
          "user",
          "accomplishment",
          "profile",
          "journey",
          "import",
        ].includes(String(fact?.source))
          ? (fact.source as ResumeFactSource)
          : undefined;
        return factId && text && resumeFactKinds.includes(fact.kind)
          ? [
              {
                id: factId,
                kind: fact.kind,
                text,
                confirmed: Boolean(fact.confirmed),
                source,
                sourceLabel: clean(fact.sourceLabel, 120) || undefined,
              },
            ]
          : [];
      })
      .slice(0, 80);
    const factIds = new Set(facts.map((fact) => fact.id));
    const bullets = (candidate.bullets ?? [])
      .flatMap((bullet): ResumeBullet[] => {
        const bulletId = id(bullet?.id);
        const text = clean(bullet?.text, 500);
        const created = timestamp(bullet?.createdAt);
        const updated = timestamp(bullet?.updatedAt);
        return bulletId && text && created && updated
          ? [
              {
                id: bulletId,
                text,
                factIds: [
                  ...new Set(
                    (bullet.factIds ?? []).filter((item) => factIds.has(item)),
                  ),
                ].slice(0, 12),
                confirmedClaims: [
                  ...new Set(
                    (bullet.confirmedClaims ?? [])
                      .map((item) => clean(item, 80))
                      .filter(Boolean),
                  ),
                ].slice(0, 20),
                reviewState:
                  bullet.reviewState === "reviewed" ? "reviewed" : "draft",
                createdAt: created,
                updatedAt: updated,
                version:
                  Number.isInteger(bullet.version) && bullet.version >= 0
                    ? bullet.version
                    : 0,
              },
            ]
          : [];
      })
      .slice(0, 100);
    const accomplishmentId = id(candidate.accomplishmentId);
    if (candidate.source === "accomplishment" && !accomplishmentId) continue;
    const highSchoolInput =
      candidate.highSchool && typeof candidate.highSchool === "object"
        ? candidate.highSchool
        : undefined;
    const roleHistory: HighSchoolRolePeriod[] = Array.isArray(
      highSchoolInput?.roleHistory,
    )
      ? highSchoolInput.roleHistory
          .flatMap((role): HighSchoolRolePeriod[] => {
            const roleId = id(role?.id);
            const title = clean(role?.title, 100);
            const createdAt = timestamp(role?.createdAt);
            return roleId && title && createdAt
              ? [
                  {
                    id: roleId,
                    title,
                    grades: [
                      ...new Set(
                        (role.grades ?? [])
                          .map((item) => clean(item, 20))
                          .filter(Boolean),
                      ),
                    ].slice(0, 4),
                    startDate: date(role.startDate),
                    endDate: date(role.endDate),
                    createdAt,
                  },
                ]
              : [];
          })
          .slice(0, 20)
      : [];
    const highSchool: HighSchoolExperienceDetails | undefined = highSchoolInput
      ? {
          category: clean(highSchoolInput.category, 100) || undefined,
          grades: [
            ...new Set(
              (highSchoolInput.grades ?? [])
                .map((item) => clean(item, 20))
                .filter(Boolean),
            ),
          ].slice(0, 4),
          participationTiming: [
            ...new Set(
              (highSchoolInput.participationTiming ?? [])
                .map((item) => clean(item, 40))
                .filter(Boolean),
            ),
          ].slice(0, 8),
          hoursPerWeek:
            typeof highSchoolInput.hoursPerWeek === "number" &&
            highSchoolInput.hoursPerWeek >= 0 &&
            highSchoolInput.hoursPerWeek <= 168
              ? highSchoolInput.hoursPerWeek
              : undefined,
          weeksPerYear:
            typeof highSchoolInput.weeksPerYear === "number" &&
            highSchoolInput.weeksPerYear >= 0 &&
            highSchoolInput.weeksPerYear <= 53
              ? highSchoolInput.weeksPerYear
              : undefined,
          privateNotes: clean(highSchoolInput.privateNotes, 4_000) || undefined,
          collaborators: clean(highSchoolInput.collaborators, 500) || undefined,
          links: [
            ...new Set(
              (highSchoolInput.links ?? [])
                .map((item) => clean(item, 500))
                .filter((item) => /^https:\/\//i.test(item)),
            ),
          ].slice(0, 12),
          roleHistory,
        }
      : undefined;
    experiences[recordId] = {
      id: recordId,
      source: candidate.source,
      accomplishmentId,
      kind: candidate.kind,
      organization: clean(candidate.organization, 180) || undefined,
      title: clean(candidate.title, 180) || undefined,
      location: clean(candidate.location, 160) || undefined,
      startDate: date(candidate.startDate),
      endDate: date(candidate.endDate),
      current: Boolean(candidate.current),
      skills: [
        ...new Set(
          (candidate.skills ?? [])
            .map((item) => clean(item, 80))
            .filter(Boolean),
        ),
      ].slice(0, 40),
      facts,
      bullets,
      highSchool,
      createdAt,
      updatedAt,
      version:
        Number.isInteger(candidate.version) && candidate.version >= 0
          ? candidate.version
          : 0,
    };
  }
  const resumes: Record<string, ResumeDocumentRecord> = {};
  for (const [recordId, candidate] of Object.entries(input.resumes ?? {}).slice(
    0,
    100,
  )) {
    if (
      !safeId.test(recordId) ||
      !candidate ||
      candidate.id !== recordId ||
      !id(candidate.materialId)
    )
      continue;
    const createdAt = timestamp(candidate.createdAt);
    const updatedAt = timestamp(candidate.updatedAt);
    const title = clean(candidate.title, 120);
    if (
      !createdAt ||
      !updatedAt ||
      !title ||
      (candidate.kind !== "master" && candidate.kind !== "targeted")
    )
      continue;
    const sections = (candidate.sections ?? [])
      .flatMap((section): ResumeSection[] => {
        const sectionId = id(section?.id);
        const sectionTitle = clean(section?.title, 80);
        if (
          !sectionId ||
          !sectionTitle ||
          !resumeSectionKinds.includes(section.kind)
        )
          return [];
        const entries = (section.entries ?? [])
          .flatMap((entry): ResumeEntry[] => {
            const experienceId = id(entry?.experienceId);
            if (!experienceId || !experiences[experienceId]) return [];
            const validBullets = new Set(
              experiences[experienceId].bullets.map((bullet) => bullet.id),
            );
            const bulletIds = [
              ...new Set(
                (entry.bulletIds ?? []).filter((item) =>
                  validBullets.has(item),
                ),
              ),
            ].slice(0, 12);
            const overrides = Object.fromEntries(
              Object.entries(entry.bulletOverrides ?? {}).flatMap(
                ([key, textValue]) =>
                  validBullets.has(key) && clean(textValue, 500)
                    ? [[key, clean(textValue, 500)]]
                    : [],
              ),
            );
            return [
              {
                experienceId,
                bulletIds,
                bulletOverrides: Object.keys(overrides).length
                  ? overrides
                  : undefined,
              },
            ];
          })
          .slice(0, 40);
        return [
          {
            id: sectionId,
            kind: section.kind,
            title: sectionTitle,
            visible: section.visible !== false,
            entries,
          },
        ];
      })
      .slice(0, 12);
    const targetType =
      candidate.target?.type === "opportunity" ||
      candidate.target?.type === "path"
        ? candidate.target.type
        : "general";
    const rawTemplate = String(candidate.template ?? "classic");
    const normalizedTemplate: ResumeTemplate =
      rawTemplate === "modern" ||
      rawTemplate === "technical" ||
      rawTemplate === "academic"
        ? rawTemplate
        : rawTemplate === "compact"
          ? "technical"
          : "classic";
    const revisions = (candidate.revisions ?? [])
      .flatMap((revision): ResumeRevision[] => {
        const revisionId = id(revision?.id);
        const revisionCreatedAt = timestamp(revision?.createdAt);
        const revisionTitle = clean(revision?.title, 120);
        if (!revisionId || !revisionCreatedAt || !revisionTitle) return [];
        const revisionTargetType =
          revision.target?.type === "opportunity" ||
          revision.target?.type === "path"
            ? revision.target.type
            : "general";
        const revisionTemplate: ResumeTemplate =
          revision.template === "modern" ||
          revision.template === "technical" ||
          revision.template === "academic"
            ? revision.template
            : "classic";
        return [
          {
            id: revisionId,
            createdAt: revisionCreatedAt,
            version:
              Number.isInteger(revision.version) && revision.version >= 0
                ? revision.version
                : 0,
            title: revisionTitle,
            target: {
              type: revisionTargetType,
              id: id(revision.target?.id),
              label: clean(revision.target?.label, 180) || undefined,
            },
            contact: {
              email: clean(revision.contact?.email, 160) || undefined,
              phone: clean(revision.contact?.phone, 40) || undefined,
              city: clean(revision.contact?.city, 100) || undefined,
              linkedIn: clean(revision.contact?.linkedIn, 240) || undefined,
              portfolio: clean(revision.contact?.portfolio, 240) || undefined,
            },
            summary: clean(revision.summary, 800) || undefined,
            sections: (revision.sections ?? [])
              .slice(0, 12)
              .map((section) => ({
                ...section,
                entries: (section.entries ?? []).slice(0, 40),
              })),
            skills: [
              ...new Set(
                (revision.skills ?? [])
                  .map((item) => clean(item, 80))
                  .filter(Boolean),
              ),
            ].slice(0, 60),
            template: revisionTemplate,
          },
        ];
      })
      .slice(-30);
    resumes[recordId] = {
      id: recordId,
      materialId: candidate.materialId,
      title,
      kind: candidate.kind,
      baseResumeId: id(candidate.baseResumeId),
      target: {
        type: targetType,
        id: id(candidate.target?.id),
        label: clean(candidate.target?.label, 180) || undefined,
      },
      contact: {
        email: clean(candidate.contact?.email, 160) || undefined,
        phone: clean(candidate.contact?.phone, 40) || undefined,
        city: clean(candidate.contact?.city, 100) || undefined,
        linkedIn: clean(candidate.contact?.linkedIn, 240) || undefined,
        portfolio: clean(candidate.contact?.portfolio, 240) || undefined,
      },
      summary: clean(candidate.summary, 800) || undefined,
      sections,
      skills: [
        ...new Set(
          (candidate.skills ?? [])
            .map((item) => clean(item, 80))
            .filter(Boolean),
        ),
      ].slice(0, 60),
      template: normalizedTemplate,
      revisions,
      archivedAt: timestamp(candidate.archivedAt),
      createdAt,
      updatedAt,
      version:
        Number.isInteger(candidate.version) && candidate.version >= 0
          ? candidate.version
          : 0,
    };
  }
  const applicationActivitySets: Record<string, ApplicationActivitySet> = {};
  for (const [setId, candidate] of Object.entries(
    input.applicationActivitySets ?? {},
  ).slice(0, 20)) {
    if (
      !safeId.test(setId) ||
      !candidate ||
      candidate.id !== setId ||
      candidate.platform !== "common_app"
    )
      continue;
    const updatedAt = timestamp(candidate.updatedAt);
    const sourceUrl = clean(candidate.sourceUrl, 500);
    const verifiedAt = date(candidate.verifiedAt);
    const cycle = clean(candidate.cycle, 30);
    if (
      !updatedAt ||
      !sourceUrl.startsWith("https://") ||
      !verifiedAt ||
      !cycle
    )
      continue;
    const selectedExperienceIds = [
      ...new Set(
        (candidate.selectedExperienceIds ?? []).filter((item) =>
          Boolean(experiences[item]),
        ),
      ),
    ].slice(0, 10);
    const versions: Record<string, ApplicationActivityVersion> = {};
    for (const experienceId of selectedExperienceIds) {
      const raw = candidate.versions?.[experienceId];
      if (!raw) continue;
      const revisionUpdated = timestamp(raw.updatedAt);
      if (!revisionUpdated) continue;
      versions[experienceId] = {
        experienceId,
        activityType: clean(raw.activityType, 80),
        position: clean(raw.position, 50),
        organization: clean(raw.organization, 100),
        description: clean(raw.description, 150),
        grades: [
          ...new Set(
            (raw.grades ?? []).map((item) => clean(item, 20)).filter(Boolean),
          ),
        ].slice(0, 4),
        participationTiming: [
          ...new Set(
            (raw.participationTiming ?? [])
              .map((item) => clean(item, 40))
              .filter(Boolean),
          ),
        ].slice(0, 8),
        hoursPerWeek:
          typeof raw.hoursPerWeek === "number" &&
          raw.hoursPerWeek >= 0 &&
          raw.hoursPerWeek <= 168
            ? raw.hoursPerWeek
            : undefined,
        weeksPerYear:
          typeof raw.weeksPerYear === "number" &&
          raw.weeksPerYear >= 0 &&
          raw.weeksPerYear <= 53
            ? raw.weeksPerYear
            : undefined,
        continueInCollege:
          typeof raw.continueInCollege === "boolean"
            ? raw.continueInCollege
            : undefined,
        revisions: (raw.revisions ?? [])
          .flatMap((revision): ApplicationActivityRevision[] => {
            const revisionId = id(revision?.id);
            const revisionAt = timestamp(revision?.updatedAt);
            return revisionId && revisionAt
              ? [
                  {
                    id: revisionId,
                    position: clean(revision.position, 50),
                    organization: clean(revision.organization, 100),
                    description: clean(revision.description, 150),
                    updatedAt: revisionAt,
                  },
                ]
              : [];
          })
          .slice(-20),
        updatedAt: revisionUpdated,
        version:
          Number.isInteger(raw.version) && raw.version >= 0 ? raw.version : 0,
      };
    }
    applicationActivitySets[setId] = {
      id: setId,
      platform: "common_app",
      cycle,
      sourceUrl,
      verifiedAt,
      slotLimit: 10,
      limits: { position: 50, organization: 100, description: 150 },
      selectedExperienceIds,
      versions,
      status: candidate.status === "ready" ? "ready" : "draft",
      updatedAt,
      version:
        Number.isInteger(candidate.version) && candidate.version >= 0
          ? candidate.version
          : 0,
    };
  }
  const version =
    typeof input.version === "number" &&
    Number.isInteger(input.version) &&
    input.version >= 0
      ? input.version
      : 0;
  return {
    experiences,
    resumes,
    applicationActivitySets,
    version,
    updatedAt: timestamp(input.updatedAt),
  };
}
