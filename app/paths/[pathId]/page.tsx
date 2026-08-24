import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpportunityPathDetail, OpportunityPathsUnavailable } from "@/components/opportunity-paths";
import { getOpportunityPath } from "@/data/opportunity-paths";
import { isProUser } from "@/lib/billing";
import { listPublishedOpportunities } from "@/lib/content-store";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { buildOpportunityPathModel } from "@/lib/opportunity-paths";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ pathId: string }> }): Promise<Metadata> {
  const path = getOpportunityPath((await params).pathId);
  return path ? { title: path.name, description: path.description, robots: { index: false, follow: false } } : { title: "Path not found", robots: { index: false, follow: false } };
}

export default async function OpportunityPathPage({ params }: { params: Promise<{ pathId: string }> }) {
  const path = getOpportunityPath((await params).pathId);
  if (!path) notFound();
  const session = await requireCompletedOnboarding();
  try {
    const opportunities = await listPublishedOpportunities();
    const pro = isProUser(session.data.billing);
    return <OpportunityPathDetail path={buildOpportunityPathModel({ path, account: session.data, opportunities, pro })} pro={pro} />;
  } catch (error) {
    console.error("[UnlockED Paths] Detail composition failed", { pathId: path.id, errorType: error instanceof Error ? error.name : "UnknownError" });
    return <OpportunityPathsUnavailable />;
  }
}
