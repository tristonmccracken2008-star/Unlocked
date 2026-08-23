import type { Metadata } from "next";
import { Accomplishments, AccomplishmentsUnavailable } from "@/components/accomplishments";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { buildAccomplishmentsModel } from "@/lib/accomplishments";
import { normalizeGuidanceState } from "@/lib/guidance";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Accomplishments",
  description: "Your private record of completed opportunities, awards, programs, and other meaningful college experiences.",
  robots: { index: false, follow: false },
};

export default async function AccomplishmentsPage() {
  const session = await requireCompletedOnboarding();
  const ids = [...new Set([
    ...Object.keys(session.data.tracker ?? {}),
    ...Object.keys(session.data.activity?.tracked ?? {}),
    ...Object.values(session.data.accomplishments ?? {}).flatMap((record) => record.canonicalOpportunityId ? [record.canonicalOpportunityId] : []),
  ])];
  try {
    const opportunities = await listPublishedOpportunitiesByIds(ids, { includeArchived: true });
    const model = buildAccomplishmentsModel({ account: session.data, opportunities });
    return <Accomplishments model={model} guidance={normalizeGuidanceState(session.data.guidance)} />;
  } catch (error) {
    console.error("[UnlockED accomplishments] composition failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return <AccomplishmentsUnavailable />;
  }
}
