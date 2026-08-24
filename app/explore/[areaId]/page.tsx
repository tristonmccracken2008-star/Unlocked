import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpportunityExplorerArea, OpportunityExplorerUnavailable } from "@/components/opportunity-explorer";
import { explorerAreaById } from "@/data/opportunity-explorer";
import { isProUser } from "@/lib/billing";
import { listPublishedOpportunities } from "@/lib/content-store";
import { buildOpportunityExplorerArea } from "@/lib/opportunity-explorer";
import { requireCompletedOnboarding } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ areaId: string }> }): Promise<Metadata> {
  const area = explorerAreaById((await params).areaId);
  return area ? { title: `Explore ${area.name}`, description: area.description, robots: { index: false, follow: false } } : {};
}

export default async function ExplorerAreaPage({ params }: { params: Promise<{ areaId: string }> }) {
  const area = explorerAreaById((await params).areaId);
  if (!area) notFound();
  const session = await requireCompletedOnboarding();
  try {
    const opportunities = await listPublishedOpportunities();
    return <OpportunityExplorerArea model={buildOpportunityExplorerArea({ area, account: session.data, opportunities, pro: isProUser(session.data.billing) })} />;
  } catch (error) {
    console.error("[UnlockED Explorer] area composition failed", { areaId: area.id, errorType: error instanceof Error ? error.name : "UnknownError" });
    return <OpportunityExplorerUnavailable />;
  }
}
