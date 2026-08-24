import type { Metadata } from "next";
import { OpportunityExplorerLanding, OpportunityExplorerUnavailable } from "@/components/opportunity-explorer";
import { isProUser } from "@/lib/billing";
import { listPublishedOpportunities } from "@/lib/content-store";
import { buildOpportunityExplorerLanding } from "@/lib/opportunity-explorer";
import { normalizeGuidanceState } from "@/lib/guidance";
import { requireCompletedOnboarding } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Explore Opportunities", description: "Discover fields and experience types you may not know to search for.", robots: { index: false, follow: false } };

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const session = await requireCompletedOnboarding();
  try {
    const { type } = await searchParams;
    const opportunities = await listPublishedOpportunities();
    return <OpportunityExplorerLanding model={buildOpportunityExplorerLanding({ account: session.data, opportunities, pro: isProUser(session.data.billing), experienceId: type })} guidance={normalizeGuidanceState(session.data.guidance)} />;
  } catch (error) {
    console.error("[UnlockED Explorer] landing composition failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return <OpportunityExplorerUnavailable />;
  }
}
