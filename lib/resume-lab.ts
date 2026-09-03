import "server-only";

import type { AccountData, AuthUser } from "./account-types";
import type { Opportunity } from "@/data/opportunities";
import {
  normalizeResumeLabStore,
  type ResumeDocumentRecord,
  type ResumeExperienceRecord,
} from "@/data/resume-lab";
import {
  normalizeApplicationMaterialStore,
  applicationMaterialStatusLabels,
} from "@/data/application-materials";
import {
  buildAccomplishmentsModel,
  type AccomplishmentView,
} from "./accomplishments";
import { analyzeResumeAlignment, auditResume, resumeStudioState } from "./resume-intelligence";

export type ResumeExperienceView = ResumeExperienceRecord & {
  resolved: {
    title: string;
    organization: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    skills: string[];
  };
  sourceLabel: string;
  resumeUsageCount: number;
};
export type ResumeDocumentView = ResumeDocumentRecord & {
  status: string;
  statusLabel: string;
  usageCount: number;
  usage: Array<{ opportunityId: string; title: string; organization: string; selectedAt: string }>;
  audit: ReturnType<typeof auditResume>;
  alignment: ReturnType<typeof analyzeResumeAlignment>;
  studio: ReturnType<typeof resumeStudioState>;
};
export type ResumeLabModel = {
  storeVersion: number;
  materialStoreVersion: number;
  profile: {
    name: string;
    school: string;
    major: string;
    graduationYear?: string;
    email: string;
  };
  experiences: ResumeExperienceView[];
  sourceAccomplishments: Array<{
    id: string;
    title: string;
    organization: string;
    outcome: string;
    year: string;
  }>;
  resumes: ResumeDocumentView[];
  opportunities: Array<{ id: string; title: string; organization: string }>;
};

function resolveExperience(
  record: ResumeExperienceRecord,
  accomplishment?: AccomplishmentView,
  resumeUsageCount = 0,
): ResumeExperienceView {
  return {
    ...record,
    resolved: {
      title:
        record.title ??
        accomplishment?.roleTitle ??
        accomplishment?.projectTitle ??
        accomplishment?.snapshot.title ??
        "Untitled experience",
      organization:
        record.organization ?? accomplishment?.snapshot.organization ?? "",
      location: record.location ?? accomplishment?.location,
      startDate: record.startDate ?? accomplishment?.startDate,
      endDate:
        record.endDate ??
        accomplishment?.endDate ??
        accomplishment?.outcomeDate,
      skills: [
        ...new Set([...record.skills, ...(accomplishment?.skills ?? [])]),
      ],
    },
    sourceLabel:
      record.source === "accomplishment"
        ? "From Accomplishments"
        : "Added in Resume Lab",
    resumeUsageCount,
  };
}

export function buildResumeLabModel(input: {
  user: Pick<AuthUser, "email" | "name">;
  account: AccountData;
  opportunities: readonly Opportunity[];
}): ResumeLabModel {
  const store = normalizeResumeLabStore(input.account.resumeLab);
  const materials = normalizeApplicationMaterialStore(
    input.account.applicationMaterials,
  );
  const accomplishments = buildAccomplishmentsModel({
    account: input.account,
    opportunities: input.opportunities,
  });
  const accomplishmentById = new Map(
    accomplishments.records.map((item) => [item.id, item]),
  );
  const experiences = Object.values(store.experiences)
    .map((item) =>
      resolveExperience(
        item,
        item.accomplishmentId
          ? accomplishmentById.get(item.accomplishmentId)
          : undefined,
        Object.values(store.resumes).filter(
          (resume) =>
            !resume.archivedAt &&
            resume.sections.some((section) =>
              section.entries.some((entry) => entry.experienceId === item.id),
            ),
        ).length,
      ),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const experienceById = Object.fromEntries(
    experiences.map((item) => [item.id, item]),
  );
  const opportunityById = new Map(
    input.opportunities.map((item) => [item.id, item]),
  );
  const resumes = Object.values(store.resumes)
    .filter((item) => !item.archivedAt)
    .map((item): ResumeDocumentView => {
      const material = materials.records[item.materialId];
      const target =
        item.target.type === "opportunity" && item.target.id
          ? opportunityById.get(item.target.id)
          : undefined;
      const usage = Object.values(materials.associations)
        .filter((association) => association.materialId === item.materialId && !association.materialDeletedAt)
        .map((association) => {
          const opportunity = opportunityById.get(association.opportunityId);
          return { opportunityId: association.opportunityId, title: opportunity?.title ?? association.requirementTitle, organization: opportunity?.organization ?? "Application", selectedAt: association.selectedAt };
        })
        .sort((a, b) => b.selectedAt.localeCompare(a.selectedAt));
      const audit = auditResume(item, experienceById);
      return {
        ...item,
        status: material?.status ?? "draft",
        statusLabel:
          applicationMaterialStatusLabels[material?.status ?? "draft"],
        usageCount: usage.length,
        usage,
        audit,
        alignment: analyzeResumeAlignment(item, experienceById, target),
        studio: resumeStudioState(item, experienceById, audit),
      };
    })
    .sort(
      (a, b) =>
        (a.kind === "master" ? -1 : 1) - (b.kind === "master" ? -1 : 1) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  const imported = new Set(
    experiences.flatMap((item) =>
      item.accomplishmentId ? [item.accomplishmentId] : [],
    ),
  );
  const profile = input.account.profile;
  return {
    storeVersion: store.version,
    materialStoreVersion: materials.version,
    profile: {
      name:
        [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
        input.user.name,
      school: profile?.schoolName ?? profile?.schoolSlug ?? "",
      major: profile?.major ?? "",
      graduationYear: profile?.graduationYear,
      email: input.user.email,
    },
    experiences,
    sourceAccomplishments: accomplishments.records
      .filter((item) => !imported.has(item.id))
      .map((item) => ({
        id: item.id,
        title: item.snapshot.title,
        organization: item.snapshot.organization,
        outcome: item.outcomeLabel,
        year: item.year,
      })),
    resumes,
    opportunities: input.opportunities
      .filter(
        (item) =>
          input.account.tracker?.[item.id] ||
          input.account.activity?.tracked?.[item.id],
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        organization: item.organization,
      }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  };
}
