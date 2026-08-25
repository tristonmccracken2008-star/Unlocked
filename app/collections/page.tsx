import type { Metadata } from "next";
import { OpportunityCollectionsLanding, OpportunityCollectionsUnavailable } from "@/components/opportunity-collections";
import { isProUser } from "@/lib/billing";
import { listPublishedOpportunities } from "@/lib/content-store";
import { buildCollectionsLanding } from "@/lib/opportunity-collections";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { normalizeGuidanceState } from "@/lib/guidance";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Opportunity Collections", description: "Curated starting points for common student situations, fields, and timing.", robots: { index: false, follow: false } };

export default async function CollectionsPage() {
  const session = await requireCompletedOnboarding();
  try {
    const opportunities = await listPublishedOpportunities();
    return <OpportunityCollectionsLanding model={buildCollectionsLanding({ account: session.data, opportunities, pro: isProUser(session.data.billing) })} guidance={normalizeGuidanceState(session.data.guidance)} />;
  } catch (error) {
    console.error("[UnlockED Collections] landing composition failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return <OpportunityCollectionsUnavailable />;
  }
}
