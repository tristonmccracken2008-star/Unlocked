import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildRecommendationService } from "@/data/recommendation-service";
import { opportunities } from "@/data/opportunities";
import { schools } from "@/data/seed";
import { inferApplicationsFromActivity } from "@/data/student-progress";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { getEntitlementsForBilling } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const startedAt = Date.now();
  console.info("[UnlockED For You] request started");
  try {
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) {
      console.info("[UnlockED For You] unauthenticated request", { durationMs: Date.now() - startedAt });
      return NextResponse.json({ pageState: "error", error: "not_authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const profile = session.data.profile;
    const school = schools.find((item) => item.slug === profile?.schoolSlug);
    const entitlements = getEntitlementsForBilling(session.data.billing);
    if (!profile || !school) {
      console.info("[UnlockED For You] profile incomplete", { plan: entitlements.plan, billingStatus: session.data.billing.status, durationMs: Date.now() - startedAt });
      return NextResponse.json({ pageState: "profile_incomplete", access: "unavailable", entitlements, recommendations: [], totalMatches: 0 }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const activity = session.data.activity ?? { viewed: [], saved: [], claimed: [], tracked: {} };
    const progress = inferApplicationsFromActivity(activity, opportunities, { milestones: {}, applications: {} });
    const service = buildRecommendationService({
      profile,
      school,
      activity,
      progress,
      source: opportunities,
      feedbackRecords: session.data.advisor?.feedbackRecords ?? [],
      hiddenOpportunityIds: session.data.preferences?.hiddenDismissedIds ?? [],
      dismissedOpportunityIds: session.data.advisor?.feedbackRecords?.filter((record) => ["dismissed", "not-interested", "already-completed", "completed"].includes(record.feedbackType)).map((record) => record.recommendationId.replace("recommendation-opportunity-", "")) ?? [],
      referralActivity: session.data.referrals,
    });
    const pro = entitlements.canUseFullForYou;
    const allowed = pro ? service.recommendations.slice(0, 24) : service.recommendations.slice(0, 2);
    const recommendations = allowed.map((view) => ({
      ...view,
      reasons: entitlements.canViewRecommendationExplanations ? view.reasons : view.reasons.slice(0, 1),
    }));
    const pageState = pro ? service.recommendations.length ? "pro_ready" : "empty" : "free_preview";
    console.info("[UnlockED For You] request completed", {
      pageState,
      access: pro ? "pro" : "preview",
      plan: entitlements.plan,
      billingStatus: session.data.billing.status,
      recommendationsReturned: recommendations.length,
      totalMatches: service.recommendations.length,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({
      pageState,
      access: pro ? "pro" : "preview",
      entitlements,
      profile,
      school,
      activity,
      recommendations,
      totalMatches: service.recommendations.length,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[UnlockED For You] request failed", {
      errorCategory: error instanceof Error ? error.name : "unknown",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ pageState: "error", error: "recommendations_unavailable", recommendations: [], totalMatches: 0 }, { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
