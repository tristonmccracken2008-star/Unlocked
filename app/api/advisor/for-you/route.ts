import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildRecommendationService } from "@/data/recommendation-service";
import { opportunities, type Opportunity } from "@/data/opportunities";
import { schools } from "@/data/seed";
import { inferApplicationsFromActivity } from "@/data/student-progress";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { getEntitlementsForBilling } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const serverTimeoutMs = 8000;
const sessionTimeoutMs = 6500;
const validPageStates = new Set(["pro_ready", "free_preview", "profile_incomplete", "empty", "error"]);
const moduleStartedAt = Date.now();
let requestSequence = 0;
let globalIndex: { opportunityCount: number; opportunityById: Map<string, Opportunity> } | null = null;
let globalIndexPromise: Promise<{ opportunityCount: number; opportunityById: Map<string, Opportunity> }> | null = null;

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

function logResponseShape(body: Record<string, unknown>) {
  const recommendations = Array.isArray(body.recommendations) ? body.recommendations : [];
  const first = recommendations[0] && typeof recommendations[0] === "object" ? recommendations[0] as Record<string, unknown> : null;
  const opportunity = first?.opportunity && typeof first.opportunity === "object" ? first.opportunity as Record<string, unknown> : null;
  const recommendation = first?.recommendation && typeof first.recommendation === "object" ? first.recommendation as Record<string, unknown> : null;
  console.info("[UnlockED For You] response fields", {
    topLevel: Object.keys(body).sort(),
    firstRecommendation: first ? Object.keys(first).sort() : [],
    firstOpportunity: opportunity ? Object.keys(opportunity).sort() : [],
    firstRecommendationModel: recommendation ? Object.keys(recommendation).sort() : [],
  });
}

function nextRequestId() {
  requestSequence += 1;
  return `for-you-${Date.now().toString(36)}-${requestSequence.toString(36)}`;
}

async function getForYouGlobalIndex() {
  if (globalIndex) return globalIndex;
  if (!globalIndexPromise) {
    globalIndexPromise = Promise.resolve().then(() => {
      const built = {
        opportunityCount: opportunities.length,
        opportunityById: new Map(opportunities.map((opportunity) => [opportunity.id, opportunity])),
      };
      globalIndex = built;
      return built;
    }).catch((error) => {
      globalIndexPromise = null;
      throw error;
    });
  }
  const built = await globalIndexPromise;
  if (globalIndex) globalIndexPromise = null;
  return built;
}

export async function GET() {
  const startedAt = Date.now();
  const requestId = nextRequestId();
  const coldStart = requestSequence === 1 || Date.now() - moduleStartedAt < 1000;
  let lastCheckpoint = "request started";
  const checkpoint = (label: string, extra: Record<string, unknown> = {}) => {
    lastCheckpoint = label;
    console.info(`[UnlockED For You] ${label}: ${Date.now() - startedAt}ms`, { requestId, ...extra });
  };
  console.info("[UnlockED For You] request started", { requestId, coldStart });
  try {
    const cookieStore = await cookies();
    checkpoint("cookies complete");
    const session = await withTimeout(getSession(cookieStore.get(sessionCookieName)?.value), "session lookup", sessionTimeoutMs);
    checkpoint("auth complete", { authenticated: Boolean(session) });
    if (!session) {
      console.info("[UnlockED For You] unauthenticated request", { durationMs: Date.now() - startedAt });
      const body = { pageState: "error", error: "not_authenticated", access: "unavailable", entitlements: null, profile: null, school: null, activity: { viewed: [], saved: [], claimed: [], tracked: {} }, session: null, recommendations: [], totalMatches: 0 };
      logResponseShape(body);
      return NextResponse.json(body, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const profile = session.data.profile;
    checkpoint("user/profile lookup complete", { profileComplete: Boolean(profile) });
    const school = schools.find((item) => item.slug === profile?.schoolSlug);
    checkpoint("billing record lookup complete", { billingStatus: session.data.billing.status });
    const entitlements = getEntitlementsForBilling(session.data.billing);
    checkpoint("entitlements complete", { plan: entitlements.plan, canUseFullForYou: entitlements.canUseFullForYou });
    if (!profile || !school) {
      console.info("[UnlockED For You] profile incomplete", { plan: entitlements.plan, billingStatus: session.data.billing.status, durationMs: Date.now() - startedAt });
      const body = { pageState: "profile_incomplete", access: "unavailable", entitlements, profile: profile ?? null, school: school ?? null, activity: { viewed: [], saved: [], claimed: [], tracked: {} }, session: null, recommendations: [], totalMatches: 0 };
      logResponseShape(body);
      return NextResponse.json(body, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const activity = session.data.activity ?? { viewed: [], saved: [], claimed: [], tracked: {} };
    checkpoint("saved/journey/feedback data complete", {
      trackedCount: Object.keys(activity.tracked ?? {}).length,
      feedbackCount: session.data.advisor?.feedbackRecords?.length ?? 0,
    });
    const indexWasWarm = Boolean(globalIndex);
    const index = await withTimeout(getForYouGlobalIndex(), "global recommendation index", 1000);
    checkpoint("global indexes complete", { cache: indexWasWarm ? "hit" : "miss", opportunityCount: index.opportunityCount });
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
    if (!validPageStates.has(pageState)) throw new Error(`Invalid For You page state: ${pageState}`);
    checkpoint("response serialization complete", { pageState, recommendationsReturned: recommendations.length });
    const body = {
      pageState,
      access: pro ? "pro" : "preview",
      entitlements,
      profile,
      school,
      activity,
      session: null,
      recommendations,
      totalMatches: service.recommendations.length,
    };
    logResponseShape(body);
    console.info("[UnlockED For You] request completed", {
      requestId,
      pageState,
      access: pro ? "pro" : "preview",
      plan: entitlements.plan,
      billingStatus: session.data.billing.status,
      recommendationsReturned: recommendations.length,
      totalMatches: service.recommendations.length,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[UnlockED For You] request failed", {
      requestId,
      errorCategory: error instanceof Error ? error.name : "unknown",
      lastCheckpoint,
      durationMs: Date.now() - startedAt,
    });
    const body = { pageState: "error", error: "recommendations_unavailable", access: "unavailable", entitlements: null, profile: null, school: null, activity: { viewed: [], saved: [], claimed: [], tracked: {} }, session: null, recommendations: [], totalMatches: 0 };
    logResponseShape(body);
    return NextResponse.json(body, { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } });
  } finally {
    console.info("[UnlockED For You] response complete", { requestId, lastCheckpoint, durationMs: Date.now() - startedAt });
  }
}
