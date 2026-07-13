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

const serverTimeoutMs = 8000;
const sessionTimeoutMs = 6500;

function timeoutError(label: string, ms: number) {
  const error = new Error(`${label} timed out after ${ms}ms`);
  error.name = "TimeoutError";
  return error;
}

function withTimeout<T>(promise: Promise<T>, label: string, ms: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timer = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(timeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
}

export async function GET() {
  const startedAt = Date.now();
  let lastCheckpoint = "request started";
  const checkpoint = (label: string, extra: Record<string, unknown> = {}) => {
    lastCheckpoint = label;
    console.info(`[UnlockED For You] ${label}: ${Date.now() - startedAt}ms`, extra);
  };
  console.info("[UnlockED For You] request started");
  try {
    const cookieStore = await cookies();
    checkpoint("cookies complete");
    const session = await withTimeout(getSession(cookieStore.get(sessionCookieName)?.value), "session lookup", sessionTimeoutMs);
    checkpoint("auth complete", { authenticated: Boolean(session) });
    if (!session) {
      console.info("[UnlockED For You] unauthenticated request", { durationMs: Date.now() - startedAt });
      return NextResponse.json({ pageState: "error", error: "not_authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const profile = session.data.profile;
    checkpoint("user/profile lookup complete", { profileComplete: Boolean(profile) });
    const school = schools.find((item) => item.slug === profile?.schoolSlug);
    checkpoint("billing record lookup complete", { billingStatus: session.data.billing.status });
    const entitlements = getEntitlementsForBilling(session.data.billing);
    checkpoint("entitlements complete", { plan: entitlements.plan, canUseFullForYou: entitlements.canUseFullForYou });
    if (!profile || !school) {
      console.info("[UnlockED For You] profile incomplete", { plan: entitlements.plan, billingStatus: session.data.billing.status, durationMs: Date.now() - startedAt });
      return NextResponse.json({ pageState: "profile_incomplete", access: "unavailable", entitlements, recommendations: [], totalMatches: 0 }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const activity = session.data.activity ?? { viewed: [], saved: [], claimed: [], tracked: {} };
    checkpoint("saved/journey/feedback data complete", {
      trackedCount: Object.keys(activity.tracked ?? {}).length,
      feedbackCount: session.data.advisor?.feedbackRecords?.length ?? 0,
    });
    const source = opportunities;
    checkpoint("opportunity index complete", { opportunityCount: source.length });
    const progress = inferApplicationsFromActivity(activity, opportunities, { milestones: {}, applications: {} });
    checkpoint("recommendation context complete");
    const service = buildRecommendationService({
      profile,
      school,
      activity,
      progress,
      source,
      feedbackRecords: session.data.advisor?.feedbackRecords ?? [],
      hiddenOpportunityIds: session.data.preferences?.hiddenDismissedIds ?? [],
      dismissedOpportunityIds: session.data.advisor?.feedbackRecords?.filter((record) => ["dismissed", "not-interested", "already-completed", "completed"].includes(record.feedbackType)).map((record) => record.recommendationId.replace("recommendation-opportunity-", "")) ?? [],
      referralActivity: session.data.referrals,
    });
    checkpoint("ranking complete", { totalMatches: service.recommendations.length });
    if (Date.now() - startedAt > serverTimeoutMs) throw timeoutError("For You recommendation generation", serverTimeoutMs);
    const pro = entitlements.canUseFullForYou;
    const allowed = pro ? service.recommendations.slice(0, 24) : service.recommendations.slice(0, 2);
    checkpoint("diversity processing complete", { selectedCount: allowed.length });
    const recommendations = allowed.map((view) => ({
      ...view,
      reasons: entitlements.canViewRecommendationExplanations ? view.reasons : view.reasons.slice(0, 1),
    }));
    checkpoint("explanation generation complete", { recommendationCount: recommendations.length });
    const pageState = pro ? service.recommendations.length ? "pro_ready" : "empty" : "free_preview";
    checkpoint("response serialization complete", { pageState, recommendationsReturned: recommendations.length });
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
      lastCheckpoint,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ pageState: "error", error: "recommendations_unavailable", recommendations: [], totalMatches: 0 }, { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } });
  } finally {
    console.info("[UnlockED For You] response complete", { lastCheckpoint, durationMs: Date.now() - startedAt });
  }
}
