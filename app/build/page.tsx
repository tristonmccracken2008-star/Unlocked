import type { Metadata } from "next";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { buildBuildWorkspaceModel } from "@/lib/build-workspace";
import { BuildWorkspace } from "@/components/build-workspace";
import { HighSchoolBuild } from "@/components/high-school-build";
import { normalizeResumeLabStore } from "@/data/resume-lab";
import { getManagedOpportunity } from "@/lib/content-store";
import { isHighSchoolOpportunity } from "@/lib/high-school-opportunities";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Build",
  description:
    "Turn confirmed experience into reusable resumes and application materials.",
  robots: { index: false, follow: false },
};

export default async function BuildPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCompletedOnboarding();
  if (session.data.educationalStage === "high_school") {
    const sourceIdValue = (await searchParams)?.sourceOpportunity;
    const sourceId = Array.isArray(sourceIdValue) ? sourceIdValue[0] : sourceIdValue;
    const tracked = sourceId ? session.data.tracker?.[sourceId] : undefined;
    const source = sourceId && ["Accepted", "Completed"].includes(tracked?.status ?? "")
      ? await getManagedOpportunity(sourceId)
      : undefined;
    const sourceOpportunity = source && isHighSchoolOpportunity(source) ? source : undefined;
    return (
      <HighSchoolBuild
        initialStore={normalizeResumeLabStore(session.data.resumeLab)}
        accomplishmentCount={
          Object.values(session.data.accomplishments ?? {}).filter(
            (item) => !item.inactiveAt,
          ).length
        }
        opportunityPrefill={sourceOpportunity ? {
          title: sourceOpportunity.title,
          organization: sourceOpportunity.organization,
          category: sourceOpportunity.metadata.highSchool.opportunityType === "competition" ? "Competition" : sourceOpportunity.metadata.highSchool.opportunityType === "research" ? "Research" : sourceOpportunity.metadata.highSchool.opportunityType === "arts" ? "Creative work" : "Summer program",
        } : undefined}
      />
    );
  }
  const ids = [
    ...new Set([
      ...Object.keys(session.data.tracker ?? {}),
      ...Object.keys(session.data.activity?.tracked ?? {}),
      ...Object.values(session.data.accomplishments ?? {}).flatMap((item) =>
        item.canonicalOpportunityId ? [item.canonicalOpportunityId] : [],
      ),
      ...Object.values(session.data.resumeLab?.resumes ?? {}).flatMap((item) =>
        item.target.type === "opportunity" && item.target.id
          ? [item.target.id]
          : [],
      ),
    ]),
  ];
  const opportunities = await listPublishedOpportunitiesByIds(ids);
  const model = buildBuildWorkspaceModel({
    user: session.user,
    account: session.data,
    opportunities,
  });
  return <BuildWorkspace model={model} />;
}
