import type { Metadata } from "next";
import { OpportunityPathsLanding, OpportunityPathsUnavailable } from "@/components/opportunity-paths";
import { isProUser } from "@/lib/billing";
import { listPublishedOpportunities } from "@/lib/content-store";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { buildOpportunityPathsLandingModel } from "@/lib/opportunity-paths";
import { normalizeGuidanceState } from "@/lib/guidance";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Opportunity Paths", description: "Explore how real student opportunities connect to a goal or direction.", robots: { index: false, follow: false } };

export default async function OpportunityPathsPage() {
  const session = await requireCompletedOnboarding();
  try {
    const opportunities = await listPublishedOpportunities();
    return <OpportunityPathsLanding model={buildOpportunityPathsLandingModel({ account: session.data, opportunities, pro: isProUser(session.data.billing) })} guidance={normalizeGuidanceState(session.data.guidance)} />;
  } catch (error) {
    console.error("[UnlockED Paths] Landing composition failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return <OpportunityPathsUnavailable />;
  }
}
