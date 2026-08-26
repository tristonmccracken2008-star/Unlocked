import "server-only";

import type { AccountData, AuthUser } from "./account-types";
import type { Opportunity } from "@/data/opportunities";
import { buildResumeLabModel, type ResumeLabModel } from "./resume-lab";
import {
  buildApplicationMaterialsModel,
  type ApplicationMaterialsModel,
} from "./application-materials";

export type BuildWorkspaceNextAction = {
  label: string;
  detail: string;
  href: string;
  kind: "experience" | "resume" | "application" | "review";
};

export type BuildWorkspaceModel = {
  resumeLab: ResumeLabModel;
  materials: ApplicationMaterialsModel;
  mainResume?: ResumeLabModel["resumes"][number];
  recentResumes: ResumeLabModel["resumes"];
  nextAction: BuildWorkspaceNextAction;
  experienceUsage: Record<string, number>;
  applicationNeedCount: number;
  readyMaterialCount: number;
};

export function buildBuildWorkspaceModel(input: {
  user: Pick<AuthUser, "email" | "name">;
  account: AccountData;
  opportunities: readonly Opportunity[];
}): BuildWorkspaceModel {
  const resumeLab = buildResumeLabModel(input);
  const materials = buildApplicationMaterialsModel({
    account: input.account,
    opportunities: input.opportunities,
  });
  const mainResume =
    resumeLab.resumes.find((resume) => resume.kind === "master") ??
    resumeLab.resumes[0];
  const experienceUsage = Object.fromEntries(
    resumeLab.experiences.map((experience) => [
      experience.id,
      resumeLab.resumes.filter((resume) =>
        resume.sections.some((section) =>
          section.entries.some((entry) => entry.experienceId === experience.id),
        ),
      ).length,
    ]),
  );
  const applicationNeedCount = materials.applications.filter(
    (application) => application.readiness.missingCount > 0,
  ).length;
  const unconfirmedResume = resumeLab.resumes.find((resume) =>
    resume.audit.issues.some((issue) => issue.id.startsWith("claim:")),
  );
  const nextAction: BuildWorkspaceNextAction = !resumeLab.experiences.length
    ? {
        kind: "experience",
        label: "Add your first experience",
        detail:
          "Start with a job, project, activity, or accomplishment you can describe factually.",
        href: "/resume-lab?view=experience",
      }
    : resumeLab.sourceAccomplishments.length
      ? {
          kind: "review",
          label: `Review ${resumeLab.sourceAccomplishments.length} new ${resumeLab.sourceAccomplishments.length === 1 ? "accomplishment" : "accomplishments"}`,
          detail:
            "Decide which confirmed outcomes belong in your reusable Experience Bank.",
          href: "/resume-lab?view=experience#experience-inbox",
        }
      : !mainResume
        ? {
            kind: "resume",
            label: "Create your master resume",
            detail:
              "Use your confirmed experience as the source for future targeted versions.",
            href: "/resume-lab?view=resumes",
          }
        : unconfirmedResume
          ? {
              kind: "review",
              label: `Review ${unconfirmedResume.title}`,
              detail:
                "One or more numeric claims still need a source confirmation.",
              href: `/resume-lab?view=resumes&resume=${encodeURIComponent(unconfirmedResume.id)}`,
            }
          : applicationNeedCount
            ? {
                kind: "application",
                label: `${applicationNeedCount} active ${applicationNeedCount === 1 ? "application needs" : "applications need"} materials`,
                detail:
                  "Open the application workspace to select or prepare the missing assets.",
                href: "/applications",
              }
            : {
                kind: "resume",
                label: `Open ${mainResume.title}`,
                detail:
                  mainResume.status === "ready"
                    ? "Your main resume is ready and available for application use."
                    : "Continue refining the resume you will use as your source.",
                href: `/resume-lab?view=resumes&resume=${encodeURIComponent(mainResume.id)}`,
              };

  return {
    resumeLab,
    materials,
    mainResume,
    recentResumes: resumeLab.resumes
      .filter((resume) => resume.id !== mainResume?.id)
      .slice(0, 4),
    nextAction,
    experienceUsage,
    applicationNeedCount,
    readyMaterialCount: materials.ready.length,
  };
}
