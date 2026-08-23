import type { Metadata } from "next";
import { OpportunityPlanner, OpportunityPlannerUnavailable } from "@/components/opportunity-planner";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { isProUser } from "@/lib/billing";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { buildJourneyCommandCenterModel } from "@/lib/journey-command-center";
import { buildOpportunityPlanner } from "@/lib/opportunity-planner";
import { resolveForYouState } from "@/lib/for-you-snapshot";
import { normalizeGuidanceState } from "@/lib/guidance";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Opportunity Planner",
  description: "See verified opportunity dates, active priorities, watched cycles, and your opportunity mix across the months ahead.",
  robots: { index: false, follow: false },
};

export default async function PlannerPage() {
  const session = await requireCompletedOnboarding();
  const pro = isProUser(session.data.billing);
  const trackedIds = [...new Set([
    ...Object.keys(session.data.tracker ?? {}),
    ...Object.keys(session.data.activity?.tracked ?? {}),
    ...session.data.savedOpportunities.map((record) => record.opportunityId),
  ])];
  const watchedIds = pro ? (session.data.watchedOpportunities ?? []).map((record) => record.opportunityId) : [];
  try {
    const [trackedOpportunities, watchedOpportunities, forYou] = await Promise.all([
      listPublishedOpportunitiesByIds(trackedIds, { includeArchived: true }).catch(() => []),
      pro ? listPublishedOpportunitiesByIds(watchedIds, { includeArchived: true }).catch(() => []) : Promise.resolve([]),
      pro ? resolveForYouState(session.user, session.data, { allowGeneration: false }).catch(() => null) : Promise.resolve(null),
    ]);
    const recommendations = forYou?.pageState === "pro_ready" ? forYou.recommendations : [];
    const opportunities = [...new Map([
      ...trackedOpportunities,
      ...watchedOpportunities,
      ...recommendations.flatMap((recommendation) => recommendation.opportunity ? [recommendation.opportunity] : []),
    ].map((opportunity) => [opportunity.id, opportunity])).values()];
    const journey = buildJourneyCommandCenterModel({
      user: session.user,
      account: session.data,
      opportunities,
      activeLimit: 100,
      historyLimit: 1,
    });
    const model = buildOpportunityPlanner({ account: session.data, journey, opportunities, recommendations, pro });
    return <OpportunityPlanner model={model} guidance={normalizeGuidanceState(session.data.guidance)} />;
  } catch (error) {
    console.error("[UnlockED Planner] composition failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return <OpportunityPlannerUnavailable />;
  }
}
