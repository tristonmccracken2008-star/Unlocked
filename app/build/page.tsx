import type { Metadata } from "next";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { buildBuildWorkspaceModel } from "@/lib/build-workspace";
import { BuildWorkspace } from "@/components/build-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Build",
  description:
    "Turn confirmed experience into reusable resumes and application materials.",
  robots: { index: false, follow: false },
};

export default async function BuildPage() {
  const session = await requireCompletedOnboarding();
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
