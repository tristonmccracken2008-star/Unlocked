import type { Metadata } from "next";
import { OpportunityInsights, OpportunityInsightsUnavailable } from "@/components/opportunity-insights";
import { insightsPeriods, type InsightsPeriod } from "@/data/opportunity-insights";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { buildOpportunityInsights } from "@/lib/opportunity-insights";
import { normalizeGuidanceState } from "@/lib/guidance";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Opportunity Insights",
  description: "A private, factual view of your recorded opportunity history.",
  robots: { index: false, follow: false },
};

function readPeriod(value: string | string[] | undefined): InsightsPeriod {
  const candidate = Array.isArray(value) ? value[0] : value;
  return insightsPeriods.includes(candidate as InsightsPeriod) ? candidate as InsightsPeriod : "all";
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  const session = await requireCompletedOnboarding();
  const parameters = await searchParams;
  const ids = new Set([
    ...Object.keys(session.data.tracker ?? {}),
    ...Object.keys(session.data.activity?.tracked ?? {}),
    ...(session.data.savedOpportunities ?? []).map((record) => record.opportunityId),
    ...(session.data.watchedOpportunities ?? []).map((record) => record.opportunityId),
    ...Object.values(session.data.accomplishments ?? {}).flatMap((record) => [record.canonicalOpportunityId, record.journeyOpportunityId].filter((id): id is string => Boolean(id))),
  ]);

  try {
    const opportunities = await listPublishedOpportunitiesByIds([...ids], { includeArchived: true });
    return <OpportunityInsights model={buildOpportunityInsights({ account: session.data, opportunities, period: readPeriod(parameters.period) })} guidance={normalizeGuidanceState(session.data.guidance)} />;
  } catch (error) {
    console.error("[UnlockED Insights] composition failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return <OpportunityInsightsUnavailable />;
  }
}
