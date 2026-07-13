import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { forYouDiagnostics, resolveForYouState } from "@/lib/for-you-snapshot";
import { enforceRateLimit, SecurityError } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const serverTimeoutMs = 8000;
const sessionTimeoutMs = 6500;
const validPageStates = new Set(["pro_ready", "free_preview", "profile_incomplete", "empty", "preparing", "error"]);
const moduleStartedAt = Date.now();
let requestSequence = 0;

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

export async function GET(request: Request) {
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
      const body = { pageState: "error", errorCode: "not_authenticated", error: "not_authenticated", access: "unavailable", entitlements: null, profile: null, school: null, activity: { viewed: [], saved: [], claimed: [], tracked: {} }, session: null, recommendations: [], totalMatches: 0, snapshotStatus: "failed", isRefreshing: false };
      logResponseShape(body);
      return NextResponse.json(body, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    await enforceRateLimit(request, "advisor-for-you", 30, 60, session.user.id);
    const profile = session.data.profile;
    checkpoint("user/profile lookup complete", { profileComplete: Boolean(profile) });
    checkpoint("billing record lookup complete", { billingStatus: session.data.billing.status });
    const body = await withTimeout(resolveForYouState(session.user, session.data), "For You snapshot resolution", serverTimeoutMs - 500);
    checkpoint("entitlements complete", { plan: body.entitlements?.plan, canUseFullForYou: Boolean(body.entitlements?.canUseFullForYou) });
    checkpoint("saved/journey/feedback data complete", {
      trackedCount: Object.keys(body.activity.tracked ?? {}).length,
      feedbackCount: session.data.advisor?.feedbackRecords?.length ?? 0,
    });
    checkpoint("global indexes complete", forYouDiagnostics(body.snapshotStatus));
    checkpoint("opportunity index complete", { snapshotStatus: body.snapshotStatus });
    checkpoint("recommendation context complete", { snapshotStatus: body.snapshotStatus, isRefreshing: body.isRefreshing });
    checkpoint("ranking complete", { totalMatches: body.totalMatches, snapshotStatus: body.snapshotStatus });
    checkpoint("diversity processing complete", { selectedCount: body.recommendations.length });
    checkpoint("explanation generation complete", { recommendationCount: body.recommendations.length });
    if (!validPageStates.has(body.pageState)) throw new Error(`Invalid For You page state: ${body.pageState}`);
    checkpoint("response serialization complete", { pageState: body.pageState, recommendationsReturned: body.recommendations.length });
    logResponseShape(body);
    console.info("[UnlockED For You] request completed", {
      requestId,
      pageState: body.pageState,
      access: body.access,
      plan: body.entitlements?.plan,
      billingStatus: session.data.billing.status,
      snapshotStatus: body.snapshotStatus,
      isRefreshing: body.isRefreshing,
      recommendationsReturned: body.recommendations.length,
      totalMatches: body.totalMatches,
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
    const body = { pageState: "error", errorCode: "unexpected", error: "recommendations_unavailable", access: "unavailable", entitlements: null, profile: null, school: null, activity: { viewed: [], saved: [], claimed: [], tracked: {} }, session: null, recommendations: [], totalMatches: 0, snapshotStatus: "failed", isRefreshing: false };
    logResponseShape(body);
    const status = error instanceof SecurityError ? error.status : 500;
    const headers: Record<string, string> = { "Cache-Control": "no-store, max-age=0" };
    if (error instanceof SecurityError && error.retryAfter) headers["Retry-After"] = String(error.retryAfter);
    return NextResponse.json(body, { status, headers });
  } finally {
    console.info("[UnlockED For You] response complete", { requestId, lastCheckpoint, durationMs: Date.now() - startedAt });
  }
}
