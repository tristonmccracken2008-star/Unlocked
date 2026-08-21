"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { projectOpportunityTrust } from "@/data/opportunity-trust";
import type { RecommendationDisplaySignal, RecommendationViewModel } from "@/data/recommendation-service";
import type { School } from "@/data/seed";
import type { StudentActivity } from "@/data/student-activity";
import type { StudentProfile } from "@/data/student-profile";
import type { AccountSession } from "@/lib/account-types";
import type { AdvisorAccessState } from "@/lib/advisor-access";
import type { Entitlements } from "@/lib/entitlements";
import type { ForYouServerState } from "@/lib/for-you-snapshot";
import type { ForYouBriefing, ForYouComparisonProjection, ForYouRecommendationInsight, ForYouWatchingItem } from "@/lib/advisor/types";
import { accountSessionEvent, readAccountSession } from "@/data/account-sync";
import { authenticatedFetch } from "@/data/authenticated-request";
import { rememberRecommendationAttribution, trackProductError, trackProductEvent } from "@/data/product-analytics";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { ArrowIcon, CheckCircleIcon, SearchIcon } from "./icons";
import { OrganizationLogo } from "./organization-logo";
import { AddToJourneyButton } from "./opportunity-activity";
import type { FeedbackType } from "@/lib/advisor/types";
import styles from "./advisor-page.module.css";
import { AdvisorRecommendationLoading } from "./loading-system";
import { DelayedPendingLabel } from "./delayed-pending-label";
import { SmartEmptyState } from "./smart-empty-state";
import { useUndoRecovery } from "./undo-recovery";

type ForYouPageState = "loading" | "pro_ready" | "free_preview" | "profile_incomplete" | "empty" | "preparing" | "error";
type SessionReadiness = "checking" | "authenticated" | "unauthenticated" | "error";

type AdvisorState = {
  pageState: Exclude<ForYouPageState, "loading">;
  profile: StudentProfile | null;
  school: School | null;
  activity: StudentActivity;
  session: AccountSession | null;
  access: AdvisorAccessState;
  entitlements: Entitlements | null;
  recommendations: RecommendationViewModel[];
  briefing: ForYouBriefing | null;
  totalMatches: number;
  snapshotStatus?: string;
  isRefreshing?: boolean;
  errorCode?: string;
};

const validForYouPageStates = ["pro_ready", "free_preview", "profile_incomplete", "empty", "preparing", "error"] as const;
const emptyActivity: StudentActivity = { viewed: [], saved: [], claimed: [], tracked: {} };

function isForYouPageState(value: unknown): value is Exclude<ForYouPageState, "loading"> {
  return validForYouPageStates.includes(value as never);
}

export function normalizeForYouPayload(payload: unknown): { pageState: Exclude<ForYouPageState, "loading">; state: AdvisorState } {
  const input = payload && typeof payload === "object" ? payload as Partial<AdvisorState> : {};
  const recommendations = Array.isArray(input.recommendations) ? input.recommendations.filter((item): item is RecommendationViewModel => Boolean(item && typeof item === "object" && "recommendation" in item)) : [];
  const access: AdvisorAccessState = input.access === "pro" || input.access === "preview" || input.access === "free" || input.access === "unavailable" ? input.access : "unavailable";
  const profile = input.profile ?? null;
  const school = input.school ?? null;
  let pageState: Exclude<ForYouPageState, "loading"> = isForYouPageState(input.pageState) ? input.pageState : access === "unavailable" ? "profile_incomplete" : access === "preview" ? "free_preview" : recommendations.length ? "pro_ready" : "empty";
  if ((pageState === "pro_ready" || pageState === "free_preview" || pageState === "empty") && (!profile || !school)) pageState = "profile_incomplete";
  if (pageState === "pro_ready" && recommendations.length === 0) pageState = "empty";
  return {
    pageState,
    state: {
      pageState,
      profile,
      school,
      activity: input.activity ?? emptyActivity,
      session: input.session ?? null,
      access,
      entitlements: input.entitlements ?? null,
      recommendations,
      briefing: input.briefing?.version === "for-you-briefing-v1" ? input.briefing : null,
      totalMatches: typeof input.totalMatches === "number" ? input.totalMatches : recommendations.length,
      snapshotStatus: typeof input.snapshotStatus === "string" ? input.snapshotStatus : undefined,
      isRefreshing: Boolean(input.isRefreshing),
      errorCode: typeof input.errorCode === "string" ? input.errorCode : undefined,
    },
  };
}

function displayFirstName(profile: StudentProfile, session: AccountSession | null) {
  return profile.firstName?.trim() || session?.user?.name?.split(" ")[0] || "there";
}

function transientForYouStatus(status: number) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function retryDelay(attempt: number) {
  return 280 + attempt * 140;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function analyticsCategory(view: RecommendationViewModel) {
  return (view.recommendation.portfolio?.canonicalCategory ?? view.opportunity?.category ?? "program")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
}

function recommendationDiversityScore(views: readonly RecommendationViewModel[]) {
  if (!views.length) return 0;
  const ratio = (values: string[]) => new Set(values).size / views.length;
  const categoryRatio = ratio(views.map(analyticsCategory));
  const organizationRatio = ratio(views.map((view) => view.opportunity?.organization ?? view.recommendation.id));
  const semanticRatio = ratio(views.map((view) => view.recommendation.portfolio?.semanticCluster ?? view.recommendation.id));
  return Math.round((categoryRatio * 0.4 + organizationRatio * 0.3 + semanticRatio * 0.3) * 100);
}

function trackRecommendationOpen(view: RecommendationViewModel) {
  const opportunityId = view.recommendation.relatedOpportunityId;
  if (!opportunityId) return;
  const category = analyticsCategory(view);
  const exposureCount = view.recommendation.portfolio?.exposureCount ?? 0;
  rememberRecommendationAttribution(opportunityId, view.recommendation.id, category, exposureCount);
  trackProductEvent(productIntelligenceEvents.recommendationOpened, {
    opportunityId,
    recommendationId: view.recommendation.id,
    category,
    exposureCount,
  });
}

export function AdvisorPage({ initialState = null, serverAuthenticated = false }: { initialState?: ForYouServerState | null; serverAuthenticated?: boolean }) {
  const { offerUndo } = useUndoRecovery();
  const initial = initialState ? normalizeForYouPayload(initialState) : null;
  const [state, setState] = useState<AdvisorState | null>(initial?.state ?? null);
  const [pageState, setPageState] = useState<ForYouPageState>(initial?.pageState ?? "loading");
  const [sessionReadiness, setSessionReadiness] = useState<SessionReadiness>(initialState || serverAuthenticated ? "authenticated" : "checking");
  const [errorMessage, setErrorMessage] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [requestActive, setRequestActive] = useState(false);
  const trackedRecommendation = useRef("");
  const trackedImpressions = useRef(new Set<string>());
  const trackedFeedSignature = useRef("");
  const trackedBriefingSignature = useRef("");
  const requestId = useRef(0);
  const sessionKey = useRef(serverAuthenticated ? "server-authenticated" : "");
  const activeRequestKey = useRef("");
  const lastValidResponse = useRef<{ pageState: Exclude<ForYouPageState, "loading">; state: AdvisorState } | null>(initial ?? null);

  const applySession = useCallback((session: AccountSession) => {
    if (session.authenticated && session.user) {
      const nextSessionKey = session.user.id;
      if (sessionKey.current !== nextSessionKey) {
        requestId.current += 1;
        trackedRecommendation.current = "";
        trackedImpressions.current.clear();
        trackedFeedSignature.current = "";
        trackedBriefingSignature.current = "";
        setState(null);
        setPageState("loading");
      }
      sessionKey.current = nextSessionKey;
      setSessionReadiness("authenticated");
      return;
    }
    requestId.current += 1;
    sessionKey.current = "";
    activeRequestKey.current = "";
    setRequestActive(false);
    setState(null);
    lastValidResponse.current = null;
    setSessionReadiness("unauthenticated");
    setPageState("error");
    setErrorMessage("Please sign in to load your recommendations.");
  }, []);

  const refreshSession = useCallback(async () => {
    setSessionReadiness("checking");
    setErrorMessage("");
    try {
      const session = await readAccountSession(true);
      applySession(session);
    } catch {
      setSessionReadiness("error");
      setPageState("error");
      setErrorMessage("We couldn’t confirm your session.");
    }
  }, [applySession]);

  const loadForYou = useCallback(async (options: { allowAutoRetry?: boolean } = {}) => {
    const targetSessionKey = sessionKey.current || (state ? "server-initial-session" : "");
    if (!targetSessionKey && !state) return;
    if (activeRequestKey.current === targetSessionKey) return;
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    activeRequestKey.current = targetSessionKey;
    setRequestActive(true);
    if (!lastValidResponse.current) setPageState("loading");
    setErrorMessage("");
    const runAttempt = async (attempt: number): Promise<void> => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      try {
        const response = await authenticatedFetch("/api/advisor/for-you", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (requestId.current !== currentRequest || (sessionKey.current && sessionKey.current !== targetSessionKey)) return;
        const payload = await response.json().catch(() => null) as unknown;
        if (!response.ok || !payload) {
          if (options.allowAutoRetry !== false && attempt === 0 && transientForYouStatus(response.status)) {
            trackProductEvent("for_you_auto_retry", { reason: `status_${response.status}` });
            await wait(retryDelay(attempt));
            return runAttempt(1);
          }
          if (lastValidResponse.current) {
            setState(lastValidResponse.current.state);
            setPageState(lastValidResponse.current.pageState);
          } else {
            setState(null);
            setPageState("error");
          }
          setErrorMessage(response.status === 401 ? "Please sign in again to load your recommendations." : "We couldn’t load your recommendations.");
          return;
        }
        const normalized = normalizeForYouPayload(payload);
        lastValidResponse.current = normalized;
        setState(normalized.state);
        setPageState(normalized.pageState);
      } catch (error) {
        if (requestId.current !== currentRequest || (sessionKey.current && sessionKey.current !== targetSessionKey)) return;
        const timedOut = error instanceof DOMException && error.name === "AbortError";
        if (options.allowAutoRetry !== false && attempt === 0) {
          trackProductEvent("for_you_auto_retry", { reason: timedOut ? "timeout" : "network" });
          await wait(retryDelay(attempt));
          return runAttempt(1);
        }
        if (lastValidResponse.current) {
          setState(lastValidResponse.current.state);
          setPageState(lastValidResponse.current.pageState);
        } else {
          setState(null);
          setPageState("error");
        }
        setErrorMessage(timedOut ? "Recommendations took too long to load." : "We couldn’t load your recommendations.");
      } finally {
        window.clearTimeout(timeout);
      }
    };
    try {
      await runAttempt(0);
    } finally {
      if (requestId.current === currentRequest && activeRequestKey.current === targetSessionKey) {
        activeRequestKey.current = "";
        setRequestActive(false);
      }
    }
  }, []);

  useEffect(() => {
    if (initialState || serverAuthenticated) return;
    void refreshSession();
    const onSessionChange = (event: Event) => {
      const session = (event as CustomEvent<AccountSession>).detail;
      if (session) applySession(session);
    };
    window.addEventListener(accountSessionEvent, onSessionChange);
    return () => {
      requestId.current += 1;
      window.removeEventListener(accountSessionEvent, onSessionChange);
    };
  }, [applySession, initialState, refreshSession, serverAuthenticated]);

  useEffect(() => {
    if (initialState) return;
    if (sessionReadiness !== "authenticated") return;
    void loadForYou({ allowAutoRetry: true });
  }, [initialState, loadForYou, sessionReadiness]);

  useEffect(() => {
    if (pageState !== "preparing" && !state?.isRefreshing) return;
    const timeout = window.setTimeout(() => void loadForYou({ allowAutoRetry: false }), pageState === "preparing" ? 900 : 1800);
    return () => window.clearTimeout(timeout);
  }, [loadForYou, pageState, state?.isRefreshing]);

  useEffect(() => {
    if (pageState === "loading") return;
    trackProductEvent("for_you_opened");
  }, [pageState]);

  useEffect(() => {
    if (pageState !== "error" || !errorMessage) return;
    trackProductError("recommendations", "unavailable", "load");
  }, [errorMessage, pageState]);

  useEffect(() => {
    if (pageState !== "free_preview") return;
    trackProductEvent("pro_gate_viewed", { section: "for-you" });
  }, [pageState]);

  const top = state?.recommendations[0] ?? null;
  const recommended = state?.recommendations.slice(0, 8) ?? [];
  const firstName = state?.profile ? displayFirstName(state.profile, state.session) : "there";

  useEffect(() => {
    if (!recommended.length) return;
    const signature = recommended.map((view) => view.recommendation.id).join("|");
    if (trackedFeedSignature.current !== signature) {
      trackedFeedSignature.current = signature;
      trackProductEvent(productIntelligenceEvents.recommendationFeedViewed, { diversityScore: recommendationDiversityScore(recommended) }, { dedupeKey: `recommendation-feed:${signature}`, dedupeWindowMs: 30_000 });
    }
    recommended.forEach((view) => {
      if (trackedImpressions.current.has(view.recommendation.id) || !view.recommendation.relatedOpportunityId) return;
      trackedImpressions.current.add(view.recommendation.id);
      trackProductEvent(productIntelligenceEvents.recommendationImpression, {
        opportunityId: view.recommendation.relatedOpportunityId,
        recommendationId: view.recommendation.id,
        category: analyticsCategory(view),
        feedRole: view.recommendation.portfolio?.role ?? "core",
        exposureCount: view.recommendation.portfolio?.exposureCount ?? 0,
      });
    });
  }, [recommended]);

  useEffect(() => {
    const briefing = state?.briefing;
    if (pageState !== "pro_ready" || !briefing || trackedBriefingSignature.current === briefing.generatedAt) return;
    trackedBriefingSignature.current = briefing.generatedAt;
    trackProductEvent(productIntelligenceEvents.forYouBriefingViewed, {
      source: "for_you",
      category: briefing.radar.length ? "radar_updates" : "caught_up",
    });
  }, [pageState, state?.briefing]);

  useEffect(() => {
    if (!top || trackedRecommendation.current === top.recommendation.id) return;
    trackedRecommendation.current = top.recommendation.id;
    trackProductEvent("recommendation_viewed", { recommendationId: top.recommendation.id, section: "for-you" });
  }, [top]);

  async function sendFeedback(view: RecommendationViewModel, feedbackType: FeedbackType, label: string) {
    setFeedbackMessage("");
    const currentIndex = state?.recommendations.findIndex((item) => item.recommendation.id === view.recommendation.id) ?? -1;
    const body = {
      recommendationId: view.recommendation.id,
      actionId: view.recommendation.relatedOpportunityId ? `opportunity:${view.recommendation.relatedOpportunityId}` : view.recommendation.id,
      signal: view.opportunity ? `category:${view.opportunity.category}` : view.recommendation.categories[0],
      feedbackType,
      requestId: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${view.recommendation.id}`,
    };
    try {
      const response = await authenticatedFetch("/api/advisor/feedback", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) {
        setFeedbackMessage("We couldn’t save that preference. Try again.");
        return false;
      }
      const event = feedbackType === "helpful" ? "recommendation_saved" : feedbackType === "already-applied" ? "recommendation_applied" : feedbackType === "already-completed" || feedbackType === "completed" ? "recommendation_completed" : feedbackType === "dismissed" ? "recommendation_dismissed" : "recommendation_ignored";
      trackProductEvent(event, { recommendationId: view.recommendation.id, opportunityId: view.recommendation.relatedOpportunityId, section: "for-you-feedback" });
      trackProductEvent(productIntelligenceEvents.recommendationFeedback, {
        recommendationId: view.recommendation.id,
        opportunityId: view.recommendation.relatedOpportunityId,
        category: analyticsCategory(view),
        feedRole: portfolioRoleSlug(view),
        exposureCount: view.recommendation.portfolio?.exposureCount ?? 0,
        action: feedbackType,
      });
      if (["dismissed", "not-interested", "show-fewer", "not-eligible"].includes(feedbackType) && view.recommendation.relatedOpportunityId) {
        trackProductEvent(productIntelligenceEvents.recommendationDismissed, {
          recommendationId: view.recommendation.id,
          opportunityId: view.recommendation.relatedOpportunityId,
          category: analyticsCategory(view),
          exposureCount: view.recommendation.portfolio?.exposureCount ?? 0,
        });
      }
      const removesFromFeed = ["dismissed", "not-interested", "show-fewer", "not-eligible", "already-applied", "already-completed", "completed"].includes(feedbackType);
      if (removesFromFeed) {
        setState((current) => current ? { ...current, recommendations: current.recommendations.filter((item) => item.recommendation.id !== view.recommendation.id) } : current);
        offerUndo({
          message: "Recommendation hidden.",
          restoredMessage: "Recommendation restored.",
          undo: async () => {
            const restored = await sendFeedback(view, "undo", "Recommendation restored.");
            if (!restored) throw new Error("Recommendation recovery failed");
            setState((current) => {
              if (!current || current.recommendations.some((item) => item.recommendation.id === view.recommendation.id)) return current;
              const recommendations = [...current.recommendations];
              recommendations.splice(Math.min(Math.max(0, currentIndex), recommendations.length), 0, view);
              return { ...current, recommendations };
            });
          },
        });
      }
      setFeedbackMessage(label);
      return true;
    } catch {
      setFeedbackMessage("We couldn’t save that preference. Try again.");
      return false;
    }
  }

  if (sessionReadiness === "checking" || pageState === "loading") return <ForYouLoading />;
  if (sessionReadiness === "unauthenticated") return <ForYouSetupState title="Sign in to open For You." text="Your matches stay with your UnlockED account." actionHref="/api/auth/google" actionLabel="Sign in" />;
  if (sessionReadiness === "error") return <ForYouErrorState message={errorMessage} onRetry={() => void refreshSession()} retrying={requestActive} />;
  if (pageState === "error") return <ForYouErrorState message={errorMessage} onRetry={() => void loadForYou({ allowAutoRetry: false })} retrying={requestActive} />;
  if (pageState === "profile_incomplete" || !state?.profile || !state.school) return <ForYouSetupState title="Finish your profile." text="Add your school, major, year, and interests to see matches." actionHref="/profile" actionLabel="Open profile" />;
  if (pageState === "preparing") return <ForYouPreparingState />;
  if (pageState === "free_preview" && !top) return <ForYouFreePreviewOnly />;
  if (pageState === "empty" || !top) return <ForYouEmptyState />;

  return <main className={styles.page} data-for-you-page="opportunity-intelligence-v2">
    <section className={styles.container}>
      {pageState === "pro_ready" && state.briefing
        ? <OpportunityBriefingHeader state={state} firstName={firstName} briefing={state.briefing} />
        : <Hero state={state} firstName={firstName} count={recommended.length} />}
      {feedbackMessage ? <div role="status" aria-live="polite" className={styles.feedbackStatus}><span>{feedbackMessage}</span></div> : null}
      {pageState === "pro_ready" && state.briefing
        ? <ProIntelligenceExperience state={state} briefing={state.briefing} onFeedback={sendFeedback} />
        : <><TopRecommendation view={top} onFeedback={sendFeedback} premium={false} /><ForYouUpgradeGate totalMatches={state.totalMatches} shown={state.recommendations.length} /></>}
      <FooterNote />
    </section>
  </main>;
}

function opportunityId(view: RecommendationViewModel) {
  return view.recommendation.relatedOpportunityId ?? view.opportunity?.id ?? "";
}

function viewsForIds(recommendations: RecommendationViewModel[], ids: string[]) {
  const byId = new Map(recommendations.map((view) => [opportunityId(view), view]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

function OpportunityBriefingHeader({ state, firstName, briefing }: { state: AdvisorState; firstName: string; briefing: ForYouBriefing }) {
  const updated = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(briefing.generatedAt));
  return <header className={styles.briefingHeader}>
    <div>
      <p className={styles.eyebrow}>For {firstName}</p>
      <h1>{briefing.title}</h1>
      {briefing.summary ? <p className={styles.heroCopy}>{briefing.summary}</p> : null}
    </div>
    <div className={styles.briefingContext}>
      <span>Updated {updated}{state.isRefreshing ? " · Updating" : ""}</span>
      <Link href="/profile#interests">Edit preferences <ArrowIcon /></Link>
    </div>
  </header>;
}

function ProIntelligenceExperience({ state, briefing, onFeedback }: { state: AdvisorState; briefing: ForYouBriefing; onFeedback: RecommendationFeedbackHandler }) {
  const topPicks = viewsForIds(state.recommendations, briefing.topPickIds);
  const dontMiss = viewsForIds(state.recommendations, briefing.dontMissIds);
  const exploration = viewsForIds(state.recommendations, briefing.explorationIds);
  const more = viewsForIds(state.recommendations, briefing.moreMatchIds);
  const lead = topPicks[0];
  const [priorityView, setPriorityView] = useState<"curated" | "deadline" | "effort">("curated");
  const [selected, setSelected] = useState<string[]>([]);
  const [watched, setWatched] = useState(() => new Set(briefing.watchingIds ?? []));
  const [watchPending, setWatchPending] = useState("");
  const [watchError, setWatchError] = useState("");
  const priorityIds = briefing.priorityViews?.[priorityView] ?? [];
  const priorityRecommendations = viewsForIds(state.recommendations, priorityIds);
  const toggleWatch = async (id: string) => {
    if (!id || watchPending) return;
    setWatchError("");
    setWatchPending(id);
    const next = !watched.has(id);
    try {
      const response = await authenticatedFetch("/api/advisor/watch", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId: id, watching: next }) });
      if (!response.ok) throw new Error(response.status === 403 ? "Watch is available with Pro." : "We couldn’t update Watch. Try again.");
      setWatched((current) => {
        const updated = new Set(current);
        if (next) updated.add(id); else updated.delete(id);
        return updated;
      });
      trackProductEvent(productIntelligenceEvents.forYouWatchChanged, { opportunityId: id, action: next ? "added" : "removed", source: "for_you" });
    } catch (error) {
      setWatchError(error instanceof Error ? error.message : "We couldn’t update Watch. Try again.");
    } finally {
      setWatchPending("");
    }
  };
  const decisionActions = (view: RecommendationViewModel): DecisionActions => {
    const id = opportunityId(view);
    return {
      watched: watched.has(id),
      watchPending: watchPending === id,
      selected: selected.includes(id),
      onWatch: () => void toggleWatch(id),
      onCompare: () => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current),
    };
  };
  const watchingItems = [...new Map([
    ...(briefing.watchingItems ?? []),
    ...state.recommendations.filter((view) => watched.has(opportunityId(view))).flatMap((view) => view.opportunity ? [{ opportunityId: view.opportunity.id, title: view.opportunity.title, organization: view.opportunity.organization, href: view.href }] : []),
  ].map((item) => [item.opportunityId, item])).values()].filter((item) => watched.has(item.opportunityId));
  const compared = viewsForIds(state.recommendations, selected);
  return <>
    <PriorityView value={priorityView} briefing={briefing} onChange={(value) => { setPriorityView(value); trackProductEvent(productIntelligenceEvents.forYouPriorityViewUsed, { control: value }); }} />
    {watchError ? <p className={styles.decisionError} role="alert">{watchError}</p> : null}
    {priorityView !== "curated" ? <IntelligenceGroup title={priorityView === "deadline" ? "By verified deadline" : "By application workload"} recommendations={priorityRecommendations} briefing={briefing} onFeedback={onFeedback} getDecisionActions={decisionActions} /> : <>
    <section className={styles.intelligenceLayout} aria-label="Top picks for you">
      <div className={styles.primaryBriefing}>
        {lead ? <TopRecommendation view={lead} insight={briefing.insights[opportunityId(lead)]} onFeedback={onFeedback} premium decisionActions={decisionActions(lead)} /> : null}
        {topPicks.length > 1 ? <ol className={styles.topPickList}>{topPicks.slice(1).map((view, index) => <li key={view.recommendation.id}><RecommendationCard view={view} insight={briefing.insights[opportunityId(view)]} index={index + 2} onFeedback={onFeedback} decisionActions={decisionActions(view)} /></li>)}</ol> : null}
      </div>
      <aside className={styles.intelligenceRail} aria-label="For You details">
        <OpportunityRadar briefing={briefing} recommendations={state.recommendations} />
        <WatchingList items={watchingItems} pendingId={watchPending} onToggle={toggleWatch} />
        <OpportunityPortfolio briefing={briefing} />
        <HowForYouWorks signals={briefing.profileSignals} />
      </aside>
    </section>
    <IntelligenceGroup title="Deadlines coming up" recommendations={dontMiss} briefing={briefing} onFeedback={onFeedback} getDecisionActions={decisionActions} />
    <IntelligenceGroup title="Try something different" recommendations={exploration} briefing={briefing} onFeedback={onFeedback} getDecisionActions={decisionActions} />
    <IntelligenceGroup title="More for you" recommendations={more} briefing={briefing} onFeedback={onFeedback} getDecisionActions={decisionActions} />
    </>}
    {selected.length ? <CompareTray count={selected.length} onClear={() => setSelected([])} /> : null}
    {selected.length >= 2 ? <OpportunityComparison recommendations={compared} briefing={briefing} onClear={() => setSelected([])} /> : null}
    {state.recommendations.length < 4 ? <LimitedInventoryNote /> : null}
  </>;
}

function WatchingList({ items, pendingId, onToggle }: { items: ForYouWatchingItem[]; pendingId: string; onToggle: (id: string) => Promise<void> }) {
  if (!items.length) return null;
  return <section className={styles.watching} aria-labelledby="watching-title"><div className={styles.railHeading}><p>Watching</p><h2 id="watching-title">{items.length} program{items.length === 1 ? "" : "s"}</h2></div><ol>{items.slice(0, 4).map((item) => <li key={item.opportunityId}><Link href={item.href}><strong>{item.title}</strong><span>{item.organization}</span></Link><button type="button" onClick={() => void onToggle(item.opportunityId)} disabled={pendingId === item.opportunityId} aria-label={`Stop watching ${item.title}`}>{pendingId === item.opportunityId ? "Updating…" : "Remove"}</button></li>)}</ol></section>;
}

type DecisionActions = { watched: boolean; watchPending: boolean; selected: boolean; onWatch: () => void; onCompare: () => void };

function PriorityView({ value, briefing, onChange }: { value: "curated" | "deadline" | "effort"; briefing: ForYouBriefing; onChange: (value: "curated" | "deadline" | "effort") => void }) {
  const options: Array<{ id: "curated" | "deadline" | "effort"; label: string }> = [{ id: "curated", label: "Curated" }];
  if ((briefing.priorityViews?.deadline.length ?? 0) >= 2) options.push({ id: "deadline", label: "Deadline" });
  if ((briefing.priorityViews?.effort.length ?? 0) >= 2) options.push({ id: "effort", label: "Application effort" });
  if (options.length === 1) return null;
  return <div className={styles.priorityView} aria-label="Order recommendations">{options.map((option) => <button key={option.id} type="button" aria-pressed={value === option.id} onClick={() => onChange(option.id)}>{option.label}</button>)}</div>;
}

function DecisionControls({ actions }: { actions: DecisionActions }) {
  return <div className={styles.decisionControls}>
    <button type="button" onClick={actions.onWatch} disabled={actions.watchPending} aria-pressed={actions.watched}>{actions.watchPending ? "Updating…" : actions.watched ? "Watching" : "Watch"}</button>
    <button type="button" onClick={actions.onCompare} aria-pressed={actions.selected}>{actions.selected ? "Selected" : "Compare"}</button>
  </div>;
}

function CompareTray({ count, onClear }: { count: number; onClear: () => void }) {
  return <aside className={styles.compareTray} aria-live="polite"><strong>{count < 2 ? "Choose one more to compare" : `Comparing ${count} opportunities`}</strong><button type="button" onClick={onClear}>Clear</button></aside>;
}

function OpportunityComparison({ recommendations, briefing, onClear }: { recommendations: RecommendationViewModel[]; briefing: ForYouBriefing; onClear: () => void }) {
  const projections: ForYouComparisonProjection[] = recommendations.flatMap((view) => briefing.insights[opportunityId(view)]?.comparison ?? []);
  const availableRows: Array<{ label: string; value: (item: ForYouComparisonProjection) => string | undefined }> = [
    { label: "Type", value: (item: ForYouComparisonProjection) => item.type }, { label: "Organization", value: (item: ForYouComparisonProjection) => item.organization },
    { label: "Deadline", value: (item: ForYouComparisonProjection) => item.deadline }, { label: "Location", value: (item: ForYouComparisonProjection) => item.location },
    { label: "Value", value: (item: ForYouComparisonProjection) => item.value }, { label: "Application workload", value: (item: ForYouComparisonProjection) => item.effort },
    { label: "Requirements", value: (item: ForYouComparisonProjection) => item.applicationRequirements }, { label: "Why it fits", value: (item: ForYouComparisonProjection) => item.matchReason },
    { label: "Journey", value: (item: ForYouComparisonProjection) => item.journeyContribution },
  ];
  const rows = availableRows.filter((row) => projections.some((item) => Boolean(row.value(item))));
  const comparisonKey = recommendations.map(opportunityId).join(":");
  useEffect(() => {
    trackProductEvent(productIntelligenceEvents.forYouComparisonOpened, { status: "active" });
    recommendations.forEach((view) => trackProductEvent(productIntelligenceEvents.forYouOpportunityCompared, { opportunityId: opportunityId(view) }));
  }, [comparisonKey]);
  return <section className={styles.comparison} aria-labelledby="compare-title">
    <div className={styles.sectionHeading}><div><p>Decision view</p><h2 id="compare-title">Compare the facts</h2></div><button type="button" onClick={onClear}>Close comparison</button></div>
    <div className={styles.comparisonScroll}><table><thead><tr><th scope="col">Detail</th>{recommendations.map((view) => <th key={opportunityId(view)} scope="col"><Link href={view.href}>{view.opportunity?.title ?? view.recommendation.title}</Link></th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{projections.map((item) => <td key={`${row.label}-${item.opportunityId}`}>{row.value(item) || "—"}</td>)}</tr>)}</tbody></table></div>
  </section>;
}

function OpportunityRadar({ briefing, recommendations }: { briefing: ForYouBriefing; recommendations: RecommendationViewModel[] }) {
  const comingUp = viewsForIds(recommendations, briefing.comingUpIds ?? []).slice(0, 3);
  return <section className={styles.radar} aria-labelledby="opportunity-radar-title">
    <div className={styles.railHeading}><p>Opportunity Radar</p><h2 id="opportunity-radar-title">{briefing.radar.length ? `${briefing.radar.length} update${briefing.radar.length === 1 ? "" : "s"}` : "You’re caught up"}</h2></div>
    {briefing.radar.length ? <ol>{briefing.radar.map((event) => <li key={event.id}><Link href={event.href} onClick={() => trackProductEvent(productIntelligenceEvents.forYouRadarOpened, { opportunityId: event.opportunityId, category: event.type, source: event.source ?? "for_you" })}><span>{event.source === "watched" ? `Watching · ${event.label}` : event.label}</span><strong>{event.detail}</strong><ArrowIcon /></Link></li>)}</ol> : <p className={styles.radarEmpty}>Nothing new right now. New matches and meaningful changes will appear here.</p>}
    {comingUp.length ? <div className={styles.comingUp}><p>Coming up</p><ol>{comingUp.map((view) => <li key={opportunityId(view)}><Link href={view.href}><span>{briefing.insights[opportunityId(view)]?.whyNow}</span><strong>{view.opportunity?.title}</strong></Link></li>)}</ol></div> : null}
  </section>;
}

function OpportunityPortfolio({ briefing }: { briefing: ForYouBriefing }) {
  const portfolio = briefing.portfolio;
  return <section className={styles.portfolio} aria-labelledby="opportunity-mix-title">
    <div className={styles.railHeading}><p>Your Journey</p><h2 id="opportunity-mix-title">{portfolio.active ? `${portfolio.active} active` : "Nothing added yet"}</h2></div>
    {portfolio.categories.length ? <dl>{portfolio.categories.slice(0, 4).map((item) => <div key={item.id}><dt>{item.label}</dt><dd>{item.count}</dd></div>)}</dl> : null}
    {portfolio.observation ? <p>{portfolio.observation}</p> : null}
    <Link href="/">View Journey <ArrowIcon /></Link>
  </section>;
}

function HowForYouWorks({ signals }: { signals: string[] }) {
  return <details className={styles.method}>
    <summary>How matches are chosen</summary>
    <div><p>Known eligibility is checked first. Fit, source quality, timing, and your Journey determine the order.</p>{signals.length ? <p><strong>Using:</strong> {signals.join(" · ")}</p> : null}<p>A match is not a guarantee of eligibility. Check the official source before applying.</p></div>
  </details>;
}

function IntelligenceGroup({ title, recommendations, briefing, onFeedback, getDecisionActions }: { title: string; recommendations: RecommendationViewModel[]; briefing: ForYouBriefing; onFeedback: RecommendationFeedbackHandler; getDecisionActions?: (view: RecommendationViewModel) => DecisionActions }) {
  if (!recommendations.length) return null;
  const id = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-title`;
  return <section className={styles.intelligenceGroup} aria-labelledby={id}>
    <div className={styles.sectionHeading}><h2 id={id}>{title}</h2><span>{recommendations.length}</span></div>
    <ol className={styles.recommendationList}>{recommendations.map((view, index) => <li key={view.recommendation.id}><RecommendationCard view={view} insight={briefing.insights[opportunityId(view)]} index={index + 1} onFeedback={onFeedback} decisionActions={getDecisionActions?.(view)} /></li>)}</ol>
  </section>;
}

function Hero({ state, firstName, count }: { state: AdvisorState; firstName: string; count: number }) {
  if (!state.profile || !state.school) return null;
  const context = [state.profile.major, state.profile.year || state.profile.graduationYear, state.profile.careerGoal].filter(Boolean);
  const trackedCount = Object.keys(state.activity.tracked ?? {}).length;
  const firstSession = trackedCount === 0 && state.activity.saved.length === 0 && Boolean(state.profile.onboardingCompletedAt);
  return <header className={styles.hero}>
    <p className={styles.eyebrow}>For {firstName}</p>
    <h1>{firstSession ? "Your first match." : count === 1 ? "A match for you." : "Matches for you."}</h1>
    <div className={styles.profileContext} aria-label="Recommendation profile">
      <span className={styles.contextLead}>Using</span>
      <span>{state.school.name}</span>
      {context.map((item) => <span key={item}>{item}</span>)}
      <Link href="/profile">Edit preferences <ArrowIcon /></Link>
    </div>
    {state.isRefreshing ? <p className={styles.updateNote}>Updating matches…</p> : null}
  </header>;
}

function cleanValueLabel(value: string) {
  return /^unknown/i.test(value) ? "Not listed" : value;
}

function recommendationSignals(view: RecommendationViewModel, limit = 3) {
  if (view.signals?.length) return view.signals.slice(0, limit);
  const opportunity = view.opportunity;
  const reasons = view.reasons.join(" ");
  const candidates: Array<RecommendationDisplaySignal | null> = [
    /matches your major:/i.test(reasons) ? { kind: "major", label: "Matches your major" } : /open to students in any major/i.test(reasons) ? { kind: "eligibility", label: "Open to your major" } : null,
    /career goal/i.test(reasons) ? { kind: "career", label: "Fits your goals" } : null,
    /opportunity interests?/i.test(reasons) ? { kind: "interest", label: "Matches your interests" } : null,
    view.chips.includes("Freshman eligible") ? { kind: "eligibility", label: "Freshman eligible" } : null,
    opportunity?.difficulty === "Open" ? { kind: "eligibility", label: "Beginner friendly" } : null,
    (opportunity?.estimated_value ?? 0) >= 5_000 ? { kind: "value", label: "High documented value" } : null,
    view.chips.includes("Paid") ? { kind: "format", label: "Paid" } : null,
    view.chips.includes("Remote") ? { kind: "format", label: "Remote" } : null,
    opportunity && projectOpportunityTrust(opportunity).source.state === "official_source" ? { kind: "trust", label: "Official source" } : null,
  ];
  const signals = candidates.filter((signal): signal is RecommendationDisplaySignal => Boolean(signal));
  return [...new Map(signals.map((signal) => [signal.label, signal])).values()].slice(0, limit);
}

function trustedDeadlineLabel(view: RecommendationViewModel) {
  return view.opportunity ? projectOpportunityTrust(view.opportunity).deadline.displayValue : "Deadline not announced";
}

function strongestReason(view: RecommendationViewModel) {
  return view.summaryReason
    ?? view.reasons.find((reason) => /career goal/i.test(reason))
    ?? view.reasons.find((reason) => /opportunity interests?/i.test(reason))
    ?? view.reasons.find((reason) => /matches your major:/i.test(reason))
    ?? view.reasons.find((reason) => /you are a/i.test(reason))
    ?? view.reasons[0]
    ?? "It matches the details in your profile.";
}

type RecommendationFeedbackHandler = (view: RecommendationViewModel, feedbackType: FeedbackType, label: string) => Promise<boolean>;

function timingFor(view: RecommendationViewModel) {
  return view.whyApplyNow;
}

function portfolioRole(view: RecommendationViewModel) {
  if (view.recommendation.portfolio?.role === "exploration") return "Try something different";
  if (view.recommendation.portfolio?.selectionRole === "Deadline Approaching") return "Deadline soon";
  if (view.recommendation.portfolio?.selectionRole === "Newly Available") return "New for you";
  return "Top pick";
}

function portfolioRoleSlug(view: RecommendationViewModel) {
  return portfolioRole(view).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function TopRecommendation({ view, insight, onFeedback, premium = true, decisionActions }: { view: RecommendationViewModel; insight?: ForYouRecommendationInsight; onFeedback: RecommendationFeedbackHandler; premium?: boolean; decisionActions?: DecisionActions }) {
  const opportunity = view.opportunity;
  const signals = recommendationSignals(view);
  const timing = timingFor(view);
  return <article className={styles.featured} data-for-you-card="featured" aria-labelledby={`recommendation-${view.recommendation.id}`}>
    <div className={styles.featuredMain}>
      <div className={styles.featuredIdentity}>
        <div className={styles.featuredLabel}>
          <span>{insight?.priorityLabel ?? portfolioRole(view)}</span>
          {view.freshnessLabel ? <strong>{view.freshnessLabel}</strong> : view.historyLabel ? <strong>{view.historyLabel}</strong> : null}
        </div>
        <div className={styles.titleLockup}>
          {opportunity ? <OrganizationLogo opportunity={opportunity} size="lg" className={styles.logo} /> : null}
          <div><p>{opportunity?.organization ?? view.recommendation.kind}</p><h2 id={`recommendation-${view.recommendation.id}`}>{opportunity?.title ?? view.recommendation.title}</h2></div>
        </div>
        <p className={styles.featuredDescription}>{opportunity?.description ?? view.recommendation.description}</p>
        <div className={styles.signals} aria-label="Why this matches">{signals.map((signal) => <span key={signal.label} data-signal-kind={signal.kind}><CheckCircleIcon />{signal.label}</span>)}</div>
        {premium && insight?.whyThisOne ? <p className={styles.adds}><strong>Why this one:</strong> {insight.whyThisOne}</p> : null}
      </div>
      <aside className={styles.featuredDecision} aria-label="Opportunity details and actions">
        <dl className={styles.featuredMeta}>
          <div><dt>Deadline</dt><dd>{trustedDeadlineLabel(view)}</dd></div>
          <div><dt>Estimated value</dt><dd>{cleanValueLabel(view.recommendation.estimatedValueLabel)}</dd></div>
          {premium && insight?.estimatedApplicationTime !== "Unknown" ? <div><dt>Estimated effort</dt><dd>{insight?.estimatedApplicationTime}</dd></div> : null}
        </dl>
        {timing && !trustedDeadlineLabel(view).toLowerCase().includes(timing.label.toLowerCase()) ? <p className={styles.timing} data-urgency={timing.urgency}><strong>{timing.label}</strong></p> : null}
        <Link href={view.href} onClick={() => trackRecommendationOpen(view)} className={styles.primaryAction}>Open Opportunity <ArrowIcon /></Link>
        {view.recommendation.relatedOpportunityId ? <AddToJourneyButton opportunityId={view.recommendation.relatedOpportunityId} recommendationId={view.recommendation.id} recommendationCategory={analyticsCategory(view)} recommendationExposureCount={view.recommendation.portfolio?.exposureCount ?? 0} className={styles.addAction} /> : null}
        {decisionActions ? <DecisionControls actions={decisionActions} /> : null}
      </aside>
    </div>
    <RecommendationIntelligence view={view} />
    <RecommendationFeedback view={view} onFeedback={onFeedback} />
  </article>;
}

function ForYouUpgradeGate({ totalMatches, shown }: { totalMatches: number; shown: number }) {
  const lockedCount = Math.max(totalMatches - shown, 0);
  return <section className={styles.upgrade} aria-labelledby="for-you-pro-title">
    <div><p>UnlockED Pro</p><h2 id="for-you-pro-title">See all your matches.</h2><span>{lockedCount ? `${lockedCount} more verified match${lockedCount === 1 ? "" : "es"}, plus new matches, deadline updates, and recommendations shaped by your Journey.` : "Get new matches, deadline updates, and recommendations shaped by your Journey."}</span></div>
    <Link href="/pricing" onClick={() => trackProductEvent("pro_upgrade_clicked", { section: "for-you" })}>View Pro <ArrowIcon /></Link>
  </section>;
}

function ForYouFreePreviewOnly() {
  return <main className={styles.page}>
    <section className={`${styles.container} ${styles.stateContainer}`}>
      <div className={styles.stateIntro}><p>For You</p><h1>Top picks for you</h1><span>Pro finds more verified matches and keeps them up to date.</span></div>
      <ol className={styles.previewChecks} aria-label="How Pro recommendations are selected">
        <li><span>01</span><div><strong>Known eligibility first</strong><p>School, year, major, and other documented requirements are checked before ranking.</p></div></li>
        <li><span>02</span><div><strong>Matches that fit</strong><p>Your interests, goals, and Journey shape the order.</p></div></li>
        <li><span>03</span><div><strong>Changes that matter</strong><p>See new matches, reopened applications, and upcoming deadlines.</p></div></li>
      </ol>
      <section className={styles.upgrade} aria-labelledby="for-you-pro-title">
        <div><p>UnlockED Pro</p><h2 id="for-you-pro-title">See the full shortlist.</h2><span>Full matches, new additions, deadline updates, and Journey-based recommendations.</span></div>
        <Link href="/pricing" onClick={() => trackProductEvent("pro_upgrade_clicked", { section: "for-you" })}>View Pro <ArrowIcon /></Link>
      </section>
    </section>
  </main>;
}

function ForYouLoading() {
  return <AdvisorRecommendationLoading />;
}

function ForYouEmptyState() {
  return <main className={styles.page}><div className={`${styles.container} ${styles.stateContainer}`}><SmartEmptyState eyebrow="For You" title="No matches yet." description="Nothing has cleared the eligibility and source checks for your profile yet." primaryAction={{ label: "Browse Discover", href: "/opportunities" }} secondaryAction={{ label: "Review interests", href: "/profile#interests" }} icon={SearchIcon} /></div></main>;
}

function LimitedInventoryNote() {
  return <aside className={styles.limitedInventory} aria-label="More opportunities"><strong>Want to browse more?</strong><span>For You only shows matches with enough eligibility and source information.</span><Link href="/opportunities">Open Discover <ArrowIcon /></Link></aside>;
}

function ForYouPreparingState() {
  return <main className={styles.page}><section className={`${styles.state} ${styles.preparing}`} aria-busy="true" aria-live="polite"><span className={styles.preparingMark} aria-hidden="true"><i /><i /><i /></span><p>For You</p><h1>Finding your first matches.</h1><span>This page will update when they’re ready.</span></section></main>;
}

function ForYouErrorState({ message, onRetry, retrying = false }: { message: string; onRetry: () => void; retrying?: boolean }) {
  return <main className={styles.page}><section className={styles.state}><p>For You</p><h1>We couldn’t load your matches.</h1><span>{message || "Your profile and Journey are unchanged."}</span><div className={styles.stateActions}><button type="button" onClick={onRetry} disabled={retrying}>{retrying ? "Trying again…" : "Try again"}</button><Link href="/opportunities">Browse Discover</Link></div></section></main>;
}

function ForYouSetupState({ title, text, actionHref, actionLabel }: { title: string; text: string; actionHref: string; actionLabel: string }) {
  return <StateShell eyebrow="For You" title={title} text={text} actionHref={actionHref} actionLabel={actionLabel} />;
}

function StateShell({ eyebrow, title, text, actionHref, actionLabel, secondaryHref, secondaryLabel, Icon }: { eyebrow: string; title: string; text: string; actionHref: string; actionLabel: string; secondaryHref?: string; secondaryLabel?: string; Icon?: typeof SearchIcon }) {
  return <main className={styles.page}><section className={styles.state}>{Icon ? <span className={styles.stateIcon}><Icon /></span> : null}<p>{eyebrow}</p><h1>{title}</h1><span>{text}</span><div className={styles.stateActions}><Link href={actionHref}>{actionLabel}</Link>{secondaryHref && secondaryLabel ? <Link href={secondaryHref}>{secondaryLabel}</Link> : null}</div></section></main>;
}

function RecommendationCard({ view, insight, index, onFeedback, decisionActions }: { view: RecommendationViewModel; insight?: ForYouRecommendationInsight; index: number; onFeedback: RecommendationFeedbackHandler; decisionActions?: DecisionActions }) {
  const opportunity = view.opportunity;
  const signals = recommendationSignals(view, 3);
  const timing = timingFor(view);
  return <article className={styles.recommendation} data-for-you-card="recommendation" aria-labelledby={`recommendation-${view.recommendation.id}`}>
    <span className={styles.rank} aria-hidden="true">{String(index).padStart(2, "0")}</span>
    <div className={styles.recommendationBody}>
      <div className={styles.recommendationTitle}>{opportunity ? <OrganizationLogo opportunity={opportunity} size="md" className={styles.logo} /> : null}<div><p>{opportunity?.organization ?? view.recommendation.kind}</p><h3 id={`recommendation-${view.recommendation.id}`}>{opportunity?.title ?? view.recommendation.title}</h3><span className={styles.trace}>{insight?.priorityLabel ?? portfolioRole(view)}{insight?.state.watched ? " · Watching" : insight?.state.inJourney ? " · In Journey" : view.freshnessLabel ? ` · ${view.freshnessLabel}` : ""}</span></div></div>
      {insight?.whyThisOne ? <p className={styles.recommendationAdds}>{insight.whyThisOne}</p> : null}
      {insight?.factLine ? <p className={styles.factLine}>{insight.factLine}</p> : null}
      <div className={styles.signals} aria-label="Why this matches">{signals.map((signal) => <span key={signal.label} data-signal-kind={signal.kind}><CheckCircleIcon />{signal.label}</span>)}</div>
      <RecommendationIntelligence view={view} compact />
      <RecommendationFeedback view={view} onFeedback={onFeedback} compact />
    </div>
    <dl className={styles.rowMeta}>{timing ? <div><dt>Timing</dt><dd>{timing.label}</dd></div> : null}<div><dt>Deadline</dt><dd>{trustedDeadlineLabel(view)}</dd></div></dl>
    <div className={styles.rowActions}><Link href={view.href} onClick={() => trackRecommendationOpen(view)}>Open Opportunity <ArrowIcon /></Link>{view.recommendation.relatedOpportunityId ? <AddToJourneyButton opportunityId={view.recommendation.relatedOpportunityId} recommendationId={view.recommendation.id} recommendationCategory={analyticsCategory(view)} recommendationExposureCount={view.recommendation.portfolio?.exposureCount ?? 0} className={styles.rowAddAction} /> : null}{decisionActions ? <DecisionControls actions={decisionActions} /> : null}</div>
  </article>;
}

function RecommendationIntelligence({ view, compact = false }: { view: RecommendationViewModel; compact?: boolean }) {
  const reasons = view.whyThisOpportunity?.length
    ? view.whyThisOpportunity
    : [{ kind: "impact" as const, label: "Verified fit", detail: strongestReason(view) }];
  const timing = timingFor(view);
  const trustSignals = view.trustSignals ?? [];
  const similar = view.similarOpportunities ?? [];
  return <details className={`${styles.intelligence} ${compact ? styles.intelligenceCompact : ""}`}>
    <summary>Why this match</summary>
    <div className={styles.intelligencePanel}>
      <section aria-labelledby={`why-fit-${view.recommendation.id}`}>
        <h4 id={`why-fit-${view.recommendation.id}`}>Match details</h4>
        <p className={styles.scoreMethod}>These signals explain the match. Check the official source before applying.</p>
        <ul>{reasons.map((reason) => <li key={`${reason.label}-${reason.detail}`}><span data-signal-kind={reason.kind}>{reason.label}</span><p>{reason.detail}</p></li>)}</ul>
      </section>
      {timing ? <section aria-labelledby={`why-now-${view.recommendation.id}`}>
        <h4 id={`why-now-${view.recommendation.id}`}>Timing</h4>
        <p className={styles.intelligenceCopy}><strong>{timing.label}.</strong> {timing.detail}</p>
        {trustSignals.length ? <div className={styles.trustSignals} aria-label="Verification signals">{trustSignals.map((signal) => <span key={signal.label} title={signal.detail}><CheckCircleIcon />{signal.label}</span>)}</div> : null}
      </section> : trustSignals.length ? <section aria-labelledby={`trust-${view.recommendation.id}`}><h4 id={`trust-${view.recommendation.id}`}>Source checks</h4><div className={styles.trustSignals} aria-label="Verification signals">{trustSignals.map((signal) => <span key={signal.label} title={signal.detail}><CheckCircleIcon />{signal.label}</span>)}</div></section> : null}
      {similar.length ? <section className={styles.similar} aria-labelledby={`similar-${view.recommendation.id}`}>
        <h4 id={`similar-${view.recommendation.id}`}>Similar opportunities</h4>
        <ul>{similar.map((item) => <li key={item.opportunityId}><Link href={item.href}><span>{item.relationship}</span><strong>{item.title}</strong><small>{item.organization}</small></Link></li>)}</ul>
      </section> : null}
    </div>
  </details>;
}

function RecommendationFeedback({ view, onFeedback, compact = false }: { view: RecommendationViewModel; onFeedback: RecommendationFeedbackHandler; compact?: boolean }) {
  const actions: Array<{ label: string; type: FeedbackType; eventLabel: string }> = [
    { label: "More like this", type: "helpful", eventLabel: "Preference saved." },
    { label: "Not for me", type: "not-interested", eventLabel: "Removed from this shortlist." },
    { label: "Fewer like this", type: "show-fewer", eventLabel: "Removed from this shortlist." },
    { label: "Not eligible", type: "not-eligible", eventLabel: "Removed and marked as ineligible for you." },
    { label: "Already applied", type: "already-applied", eventLabel: "Marked as already applied." },
  ];
  const [pending, setPending] = useState<FeedbackType | null>(null);
  async function choose(feedbackType: FeedbackType, label: string) {
    if (pending) return;
    setPending(feedbackType);
    try {
      await onFeedback(view, feedbackType, label);
    } finally {
      setPending(null);
    }
  }
  return <details className={`${styles.feedback} ${compact ? styles.feedbackCompact : ""}`}>
    <summary>{compact ? "Change this match" : "Not for you?"}</summary>
    <div>
      {actions.map((action) => <button key={action.type} type="button" disabled={Boolean(pending)} aria-busy={pending === action.type ? "true" : undefined} data-action-state={pending === action.type ? "loading" : "idle"} onClick={() => void choose(action.type, action.eventLabel)}><DelayedPendingLabel pending={pending === action.type} idle={action.label} pendingLabel="Saving preference…" /></button>)}
    </div>
  </details>;
}

function FooterNote() {
  return <footer className={styles.footerNote}><p>Matches update when your profile or Journey changes.</p><Link href="/help">How matching works <ArrowIcon /></Link></footer>;
}
