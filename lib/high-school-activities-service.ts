import "server-only";
import crypto from "node:crypto";
import {
  commonAppActivitySetId,
  emptyCommonAppActivitySet,
  kindForHighSchoolCategory,
} from "@/data/high-school-activities";
import type {
  ApplicationActivityVersion,
  HighSchoolExperienceDetails,
  ResumeExperienceRecord,
  ResumeFactKind,
  ResumeFactSource,
} from "@/data/resume-lab";
import { mutateResumeLab } from "./auth-store";
import { unsupportedActivityClaims } from "./high-school-activities";

type FactInput = {
  id?: string;
  kind: ResumeFactKind;
  text: string;
  confirmed: boolean;
  source?: ResumeFactSource;
};
export type HighSchoolActivitiesMutation =
  | {
      action: "save_experience";
      expectedVersion: number;
      idempotencyKey: string;
      experienceId?: string;
      expectedRecordVersion?: number;
      title: string;
      organization?: string;
      role?: string;
      category: string;
      location?: string;
      startDate?: string;
      endDate?: string;
      current: boolean;
      skills: string[];
      facts: FactInput[];
      highSchool: Omit<HighSchoolExperienceDetails, "roleHistory"> & {
        roleHistory: HighSchoolExperienceDetails["roleHistory"];
      };
    }
  | {
      action: "set_fact_confirmation";
      expectedVersion: number;
      experienceId: string;
      factId: string;
      confirmed: boolean;
    }
  | {
      action: "toggle_application_activity";
      expectedVersion: number;
      experienceId: string;
      selected: boolean;
    }
  | {
      action: "reorder_application_activities";
      expectedVersion: number;
      experienceIds: string[];
    }
  | {
      action: "save_application_activity";
      expectedVersion: number;
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
    }
  | {
      action: "set_application_activities_status";
      expectedVersion: number;
      status: "draft" | "ready";
    };

function stableId(prefix: string, userId: string, key: string) {
  return `${prefix}:${crypto.createHash("sha256").update(`${userId}:${key}`).digest("hex").slice(0, 24)}`;
}
function domainError(message: string, name = "HighSchoolActivitiesError") {
  const error = new Error(message);
  error.name = name;
  return error;
}

export async function updateHighSchoolActivities(
  userId: string,
  mutation: HighSchoolActivitiesMutation,
) {
  return await mutateResumeLab(userId, {
    expectedVersion: mutation.expectedVersion,
    mutate(store, materials) {
      const now = new Date().toISOString();
      const experiences = { ...store.experiences };
      const sets = { ...(store.applicationActivitySets ?? {}) };
      const set =
        sets[commonAppActivitySetId] ?? emptyCommonAppActivitySet(now);
      if (mutation.action === "save_experience") {
        const existing = mutation.experienceId
          ? experiences[mutation.experienceId]
          : undefined;
        const experienceId =
          existing?.id ??
          stableId("experience", userId, mutation.idempotencyKey);
        if (existing && existing.version !== mutation.expectedRecordVersion)
          throw domainError(
            "This experience changed elsewhere. Refresh and try again.",
            "ResumeLabRecordConflictError",
          );
        const facts = mutation.facts.map((fact, index) => ({
          id:
            fact.id ??
            stableId("fact", userId, `${experienceId}:${index}:${fact.text}`),
          kind: fact.kind,
          text: fact.text,
          confirmed: fact.confirmed,
          source: fact.source ?? ("user" as const),
        }));
        const roleHistory = mutation.highSchool.roleHistory.map(
          (role, index) => ({
            ...role,
            id:
              role.id ||
              stableId(
                "role",
                userId,
                `${experienceId}:${index}:${role.title}:${role.grades.join("-")}`,
              ),
            createdAt: role.createdAt || now,
          }),
        );
        experiences[experienceId] = {
          id: experienceId,
          source: existing?.source ?? "manual",
          accomplishmentId: existing?.accomplishmentId,
          kind: kindForHighSchoolCategory(mutation.category),
          organization: mutation.organization,
          title: mutation.title,
          location: mutation.location,
          startDate: mutation.startDate,
          endDate: mutation.endDate,
          current: mutation.current,
          skills: mutation.skills,
          facts,
          bullets: existing?.bullets ?? [],
          highSchool: {
            ...mutation.highSchool,
            category: mutation.category,
            roleHistory,
          },
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          version: existing ? existing.version + 1 : 0,
        };
      } else if (mutation.action === "set_fact_confirmation") {
        const experience = experiences[mutation.experienceId];
        if (!experience)
          throw domainError("This experience is no longer available.");
        experiences[experience.id] = {
          ...experience,
          facts: experience.facts.map((fact) =>
            fact.id === mutation.factId
              ? { ...fact, confirmed: mutation.confirmed }
              : fact,
          ),
          updatedAt: now,
          version: experience.version + 1,
        };
      } else {
        const experienceId =
          "experienceId" in mutation ? mutation.experienceId : "";
        const experience = experiences[experienceId];
        if (experienceId && !experience)
          throw domainError("This experience is no longer available.");
        if (mutation.action === "toggle_application_activity") {
          const selected = set.selectedExperienceIds.includes(
            mutation.experienceId,
          );
          let ids = set.selectedExperienceIds.filter(
            (id) => id !== mutation.experienceId,
          );
          if (mutation.selected && !selected) {
            if (ids.length >= set.slotLimit)
              throw domainError(
                `Common App currently supports up to ${set.slotLimit} activities.`,
              );
            ids.push(mutation.experienceId);
          }
          sets[set.id] = {
            ...set,
            selectedExperienceIds: ids,
            status: "draft",
            updatedAt: now,
            version: set.version + 1,
          };
        } else if (mutation.action === "reorder_application_activities") {
          if (
            mutation.experienceIds.length !==
              set.selectedExperienceIds.length ||
            new Set(mutation.experienceIds).size !==
              mutation.experienceIds.length ||
            mutation.experienceIds.some(
              (id) => !set.selectedExperienceIds.includes(id),
            )
          )
            throw domainError(
              "Activity order is out of date. Refresh and try again.",
            );
          sets[set.id] = {
            ...set,
            selectedExperienceIds: mutation.experienceIds,
            status: "draft",
            updatedAt: now,
            version: set.version + 1,
          };
        } else if (mutation.action === "save_application_activity") {
          if (!set.selectedExperienceIds.includes(mutation.experienceId))
            throw domainError(
              "Select this experience before creating its application version.",
            );
          const unsupported = unsupportedActivityClaims(
            mutation.description,
            experience!,
          );
          const current = set.versions[mutation.experienceId];
          if (unsupported.length)
            throw domainError(
              `Review unsupported claim${unsupported.length === 1 ? "" : "s"}: ${unsupported.join(", ")}. Add the fact to the experience first or remove it.`,
            );
          const revision = current
            ? {
                id: stableId(
                  "activity-revision",
                  userId,
                  `${current.experienceId}:${current.version}:${current.updatedAt}`,
                ),
                position: current.position,
                organization: current.organization,
                description: current.description,
                updatedAt: current.updatedAt,
              }
            : undefined;
          const version: ApplicationActivityVersion = {
            experienceId: mutation.experienceId,
            activityType: mutation.activityType,
            position: mutation.position,
            organization: mutation.organization,
            description: mutation.description,
            grades: mutation.grades,
            participationTiming: mutation.participationTiming,
            hoursPerWeek: mutation.hoursPerWeek,
            weeksPerYear: mutation.weeksPerYear,
            continueInCollege: mutation.continueInCollege,
            revisions: [
              ...(current?.revisions ?? []),
              ...(revision ? [revision] : []),
            ].slice(-20),
            updatedAt: now,
            version: current ? current.version + 1 : 0,
          };
          sets[set.id] = {
            ...set,
            versions: { ...set.versions, [mutation.experienceId]: version },
            status: "draft",
            updatedAt: now,
            version: set.version + 1,
          };
        } else {
          if (mutation.status === "ready") {
            if (!set.selectedExperienceIds.length)
              throw domainError(
                "Select at least one activity before marking this section ready.",
              );
            const incomplete = set.selectedExperienceIds.some(
              (id) => !set.versions[id]?.description.trim(),
            );
            if (incomplete)
              throw domainError(
                "Finish each selected activity before marking this section ready.",
              );
          }
          sets[set.id] = {
            ...set,
            status: mutation.status,
            updatedAt: now,
            version: set.version + 1,
          };
        }
      }
      return {
        store: {
          ...store,
          experiences,
          applicationActivitySets: sets,
          version: store.version + 1,
          updatedAt: now,
        },
        materials,
        duplicate: false,
      };
    },
  });
}
