"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { projectOpportunityTrust } from "@/data/opportunity-trust";
import type { RecommendationViewModel } from "@/data/recommendation-service";
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
import { ArrowIcon, BookmarkIcon, CheckIcon, SearchIcon } from "./icons";
import { OrganizationLogo } from "./organization-logo";
import { AddToJourneyButton } from "./opportunity-activity";
import type { FeedbackType } from "@/lib/advisor/types";
import styles from "./advisor-page.module.css";
import { AdvisorRecommendationLoading } from "./loading-system";
import { DelayedPendingLabel } from "./delayed-pending-label";
import { SmartEmptyState } from "./smart-empty-state";
import { useUndoRecovery } from "./undo-recovery";
import { useLayoutContinuity } from "./use-layout-continuity";

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
      briefing: input.briefing?.version === "for-you-briefing-v2" ? input.briefing : null,
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

  return <main className={styles.page} data-for-you-page="opportunity-briefing-v3">
    <section className={styles.container}>
      {pageState === "pro_ready" && state.briefing
        ? <OpportunityBriefingHeader state={state} firstName={firstName} briefing={state.briefing} />
        : <Hero state={state} firstName={firstName} count={recommended.length} />}
      {feedbackMessage ? <div role="status" aria-live="polite" className={styles.feedbackStatus}><span>{feedbackMessage}</span></div> : null}
      {pageState === "pro_ready" && state.briefing
        ? <ProIntelligenceExperience state={state} briefing={state.briefing} onFeedback={sendFeedback} />
        : <><TopRecommendation view={top} onFeedback={sendFeedback} /><ForYouUpgradeGate totalMatches={state.totalMatches} shown={state.recommendations.length} /></>}
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
      {briefing.summary ? <p className={styles.briefingSummary}>{briefing.summary}</p> : null}
    </div>
    <div className={styles.briefingContext}>
      <span>Updated {updated}{state.isRefreshing ? " · Updating" : ""}</span>
      <Link href="/profile#interests">Edit preferences <ArrowIcon /></Link>
    </div>
  </header>;
}

function ProIntelligenceExperience({ state, briefing, onFeedback }: { state: AdvisorState; briefing: ForYouBriefing; onFeedback: RecommendationFeedbackHandler }) {
  const topPicks = viewsForIds(state.recommendations, briefing.topPickIds);
  const exploration = viewsForIds(state.recommendations, briefing.explorationIds);
  const additional = viewsForIds(state.recommendations, briefing.additionalMatchIds);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [watched, setWatched] = useState(() => new Set(briefing.watchingIds ?? []));
  const [watchPending, setWatchPending] = useState("");
  const [watchError, setWatchError] = useState("");
  const topPicksRef = useLayoutContinuity<HTMLOListElement>(topPicks.map((view) => view.recommendation.id).join(":"));
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
      comparisonMode,
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
    {watchError ? <p className={styles.decisionError} role="alert">{watchError}</p> : null}
    <section className={styles.briefingSection} aria-labelledby="top-picks-title">
      <div className={styles.sectionHeading}>
        <div><p>Shortlist</p><h2 id="top-picks-title">Top picks</h2></div>
        {state.recommendations.length >= 2 ? <button type="button" className={styles.compareModeButton} aria-pressed={comparisonMode} onClick={() => { setComparisonMode((current) => !current); setSelected([]); trackProductEvent(productIntelligenceEvents.forYouPriorityViewUsed, { control: "comparison" }); }}>{comparisonMode ? "Done comparing" : "Compare shortlist"}</button> : null}
      </div>
      <ol ref={topPicksRef} className={styles.editorialList}>{topPicks.map((view, index) => <li key={view.recommendation.id} data-motion-key={view.recommendation.id}><RecommendationCard view={view} insight={briefing.insights[opportunityId(view)]} index={index} onFeedback={onFeedback} decisionActions={decisionActions(view)} featured={index === 0} /></li>)}</ol>
    </section>

    {exploration.length ? <BriefingGroup eyebrow="Adjacent match" title="Worth exploring" recommendations={exploration} briefing={briefing} onFeedback={onFeedback} getDecisionActions={decisionActions} /> : null}
    {additional.length ? <BriefingGroup eyebrow="More current matches" title="Also selected" recommendations={additional} briefing={briefing} onFeedback={onFeedback} getDecisionActions={decisionActions} /> : null}
    {selected.length ? <CompareTray count={selected.length} onClear={() => setSelected([])} /> : null}
    {selected.length >= 2 ? <OpportunityComparison recommendations={compared} briefing={briefing} onClear={() => setSelected([])} /> : null}
    <section className={styles.briefingUtilities} aria-label="Briefing updates and saved context">
      <OpportunityRadar briefing={briefing} recommendations={state.recommendations} />
      <WatchingList items={watchingItems} pendingId={watchPending} onToggle={toggleWatch} />
      <HowForYouWorks signals={briefing.profileSignals} />
    </section>
    {state.recommendations.length < 4 ? <LimitedInventoryNote /> : null}
  </>;
}

function WatchingList({ items, pendingId, onToggle }: { items: ForYouWatchingItem[]; pendingId: string; onToggle: (id: string) => Promise<void> }) {
  const listRef = useLayoutContinuity<HTMLOListElement>(items.map((item) => item.opportunityId).join(":"));
  if (!items.length) return null;
  return <details className={styles.utilityDisclosure}><summary><span>Watching</span><strong>{items.length}</strong></summary><ol ref={listRef}>{items.slice(0, 4).map((item) => <li key={item.opportunityId} data-motion-key={item.opportunityId}><Link href={item.href}><strong>{item.title}</strong><span>{item.organization}</span></Link><button type="button" onClick={() => void onToggle(item.opportunityId)} disabled={pendingId === item.opportunityId} aria-label={`Stop watching ${item.title}`}>{pendingId === item.opportunityId ? "Updating…" : "Remove"}</button></li>)}</ol></details>;
}

type DecisionActions = { watched: boolean; watchPending: boolean; selected: boolean; comparisonMode: boolean; onWatch: () => void; onCompare: () => void };

function DecisionControls({ actions }: { actions: DecisionActions }) {
  return <div className={styles.decisionControls}>
    {actions.comparisonMode
      ? <button type="button" onClick={actions.onCompare} aria-pressed={actions.selected}>{actions.selected ? "Selected" : "Select"}</button>
      : <button type="button" onClick={actions.onWatch} disabled={actions.watchPending} aria-pressed={actions.watched} data-action-state={actions.watchPending ? "loading" : actions.watched ? "success" : "idle"}><span className={styles.watchStateIcon} aria-hidden="true"><BookmarkIcon /><CheckIcon /></span><span>{actions.watchPending ? "Updating…" : actions.watched ? "Watching" : "Watch"}</span></button>}
  </div>;
}

function CompareTray({ count, onClear }: { count: number; onClear: () => void }) {
  return <aside className={styles.compareTray} data-motion-surface="state" aria-live="polite"><strong>{count < 2 ? "Choose one more to compare" : `Comparing ${count} opportunities`}</strong><button type="button" onClick={onClear}>Clear</button></aside>;
}

function OpportunityComparison({ recommendations, briefing, onClear }: { recommendations: RecommendationViewModel[]; briefing: ForYouBriefing; onClear: () => void }) {
  const projections: ForYouComparisonProjection[] = recommendations.flatMap((view) => briefing.insights[opportunityId(view)]?.comparison ?? []);
  const availableRows: Array<{ label: string; value: (item: ForYouComparisonProjection) => string | undefined }> = [
    { label: "Type", value: (item: ForYouComparisonProjection) => item.type },
    { label: "Deadline", value: (item: ForYouComparisonProjection) => item.deadline }, { label: "Location", value: (item: ForYouComparisonProjection) => item.location },
    { label: "Compensation or value", value: (item: ForYouComparisonProjection) => item.value },
    { label: "Known requirements", value: (item: ForYouComparisonProjection) => item.applicationRequirements },
    { label: "Current pursuits", value: (item: ForYouComparisonProjection) => item.journeyContribution },
  ];
  const rows = availableRows.filter((row) => {
    const values = projections.map((item) => row.value(item) || "Unknown");
    return values.some((value) => value !== "Unknown") && new Set(values).size > 1;
  }).slice(0, 4);
  const comparisonKey = recommendations.map(opportunityId).join(":");
  useEffect(() => {
    trackProductEvent(productIntelligenceEvents.forYouComparisonOpened, { status: "active" });
    recommendations.forEach((view) => trackProductEvent(productIntelligenceEvents.forYouOpportunityCompared, { opportunityId: opportunityId(view) }));
  }, [comparisonKey]);
  return <section className={styles.comparison} data-motion-surface="workflow" aria-labelledby="compare-title">
    <div className={styles.sectionHeading}><div><p>Comparison</p><h2 id="compare-title">Differences</h2></div><button type="button" onClick={onClear}>Close comparison</button></div>
    {!rows.length ? <p className={styles.comparisonNote}>The recorded facts do not show a meaningful difference yet. Open each opportunity for full details.</p> : null}
    <div className={styles.comparisonScroll}><table><thead><tr><th scope="col">Detail</th>{recommendations.map((view) => <th key={opportunityId(view)} scope="col"><Link href={view.href}>{view.opportunity?.title ?? view.recommendation.title}</Link></th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{projections.map((item) => <td key={`${row.label}-${item.opportunityId}`}>{row.value(item) || "—"}</td>)}</tr>)}</tbody></table></div>
  </section>;
}

function OpportunityRadar({ briefing, recommendations }: { briefing: ForYouBriefing; recommendations: RecommendationViewModel[] }) {
  if (!briefing.radar.length) return null;
  return <details className={styles.utilityDisclosure}><summary><span>What changed</span><strong>{briefing.radar.length}</strong></summary><ol>{briefing.radar.map((event) => <li key={event.id}><Link href={event.href} onClick={() => trackProductEvent(productIntelligenceEvents.forYouRadarOpened, { opportunityId: event.opportunityId, category: event.type, source: event.source ?? "for_you" })}><span>{event.source === "watched" ? `Watching · ${event.label}` : event.label}</span><strong>{event.detail}</strong><ArrowIcon /></Link></li>)}</ol></details>;
}

function HowForYouWorks({ signals }: { signals: string[] }) {
  return <details className={`${styles.method} ${styles.utilityDisclosure}`}>
    <summary>How matches are chosen</summary>
    <div><p>Known eligibility is checked first. Fit, source quality, timing, and your Journey determine the order.</p>{signals.length ? <p><strong>Using:</strong> {signals.join(" · ")}</p> : null}<p>A match is not a guarantee of eligibility. Check the official source before applying.</p></div>
  </details>;
}

function BriefingGroup({ eyebrow, title, recommendations, briefing, onFeedback, getDecisionActions }: { eyebrow: string; title: string; recommendations: RecommendationViewModel[]; briefing: ForYouBriefing; onFeedback: RecommendationFeedbackHandler; getDecisionActions?: (view: RecommendationViewModel) => DecisionActions }) {
  const listRef = useLayoutContinuity<HTMLOListElement>(recommendations.map((view) => view.recommendation.id).join(":"));
  if (!recommendations.length) return null;
  const id = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-title`;
  return <section className={styles.briefingSection} aria-labelledby={id}>
    <div className={styles.sectionHeading}><div><p>{eyebrow}</p><h2 id={id}>{title}</h2></div><span>{recommendations.length}</span></div>
    <ol ref={listRef} className={styles.editorialList}>{recommendations.map((view, index) => <li key={view.recommendation.id} data-motion-key={view.recommendation.id}><RecommendationCard view={view} insight={briefing.insights[opportunityId(view)]} index={index} onFeedback={onFeedback} decisionActions={getDecisionActions?.(view)} /></li>)}</ol>
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

function portfolioRole(view: RecommendationViewModel) {
  if (view.recommendation.portfolio?.role === "exploration") return "Worth exploring";
  if (view.recommendation.portfolio?.selectionRole === "Deadline Approaching") return "Deadline soon";
  if (view.recommendation.portfolio?.selectionRole === "Newly Available") return "New for you";
  return "Top pick";
}

function portfolioRoleSlug(view: RecommendationViewModel) {
  return portfolioRole(view).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function TopRecommendation({ view, insight, onFeedback, decisionActions }: { view: RecommendationViewModel; insight?: ForYouRecommendationInsight; onFeedback: RecommendationFeedbackHandler; decisionActions?: DecisionActions }) {
  const opportunity = view.opportunity;
  const reason = insight?.explanations[0]?.text ?? strongestReason(view);
  return <article className={`${styles.recommendation} ${styles.recommendationFeatured}`} data-for-you-card="featured" aria-labelledby={`recommendation-${view.recommendation.id}`}>
    <div className={styles.recommendationBody}>
      <div className={styles.recommendationTitle}>{opportunity ? <OrganizationLogo opportunity={opportunity} size="lg" className={styles.logo} /> : null}<div><p>{opportunity?.organization ?? view.recommendation.kind}</p><h2 id={`recommendation-${view.recommendation.id}`}>{opportunity?.title ?? view.recommendation.title}</h2><span className={styles.trace}>{opportunity?.type ?? view.recommendation.kind}</span></div></div>
      <p className={styles.featuredDescription}>{opportunity?.description ?? view.recommendation.description}</p>
      <p className={styles.explanationLine}><strong>Why it appeared</strong><span>{reason}</span></p>
      <RecommendationFeedback view={view} onFeedback={onFeedback} compact />
    </div>
    <div className={styles.recommendationDecision}>
      <p className={styles.meaningfulDate}>{insight?.meaningfulDate?.label ?? trustedDeadlineLabel(view)}</p>
      <Link href={view.href} onClick={() => trackRecommendationOpen(view)} className={styles.primaryAction}>Open Opportunity <ArrowIcon /></Link>
      {view.recommendation.relatedOpportunityId ? <AddToJourneyButton opportunityId={view.recommendation.relatedOpportunityId} recommendationId={view.recommendation.id} recommendationCategory={analyticsCategory(view)} recommendationExposureCount={view.recommendation.portfolio?.exposureCount ?? 0} className={styles.addAction} /> : null}
      {decisionActions ? <DecisionControls actions={decisionActions} /> : null}
    </div>
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

function freshnessLabel(insight?: ForYouRecommendationInsight) {
  switch (insight?.freshness) {
    case "new_for_you": return "New for you";
    case "new_to_unlocked": return "New to UnlockED";
    case "previously_seen": return "Previously seen";
    case "watching": return "Watching";
    case "in_journey": return "In Journey";
    default: return "";
  }
}

function RecommendationCard({ view, insight, onFeedback, decisionActions, featured = false }: { view: RecommendationViewModel; insight?: ForYouRecommendationInsight; index: number; onFeedback: RecommendationFeedbackHandler; decisionActions?: DecisionActions; featured?: boolean }) {
  const opportunity = view.opportunity;
  const status = freshnessLabel(insight);
  const explanations = insight?.explanations?.slice(0, 2) ?? [{ kind: "goal" as const, label: "Why it appeared", text: strongestReason(view) }];
  return <article className={`${styles.recommendation} ${featured ? styles.recommendationFeatured : ""}`} data-for-you-card="recommendation" aria-labelledby={`recommendation-${view.recommendation.id}`}>
    <div className={styles.recommendationBody}>
      <div className={styles.recommendationTitle}>{opportunity ? <OrganizationLogo opportunity={opportunity} size={featured ? "lg" : "md"} className={styles.logo} /> : null}<div><p>{opportunity?.organization ?? view.recommendation.kind}</p><h3 id={`recommendation-${view.recommendation.id}`}>{opportunity?.title ?? view.recommendation.title}</h3><span className={styles.trace}>{opportunity?.type ?? view.recommendation.kind}{status ? ` · ${status}` : ""}</span></div></div>
      {featured ? <p className={styles.featuredDescription}>{opportunity?.description ?? view.recommendation.description}</p> : null}
      <div className={styles.explanations} aria-label="Why this opportunity was selected">{explanations.map((line) => <p key={`${line.kind}-${line.text}`} className={styles.explanationLine} data-explanation-kind={line.kind}><strong>{line.label}</strong><span>{line.text}</span></p>)}</div>
      <RecommendationFeedback view={view} onFeedback={onFeedback} compact />
    </div>
    <div className={styles.recommendationDecision}>
      {insight?.meaningfulDate ? <p className={styles.meaningfulDate}>{insight.meaningfulDate.label}</p> : null}
      <Link href={view.href} onClick={() => trackRecommendationOpen(view)} className={styles.primaryAction}>Open Opportunity <ArrowIcon /></Link>
      {!decisionActions?.comparisonMode && !insight?.state.inJourney && view.recommendation.relatedOpportunityId ? <AddToJourneyButton opportunityId={view.recommendation.relatedOpportunityId} recommendationId={view.recommendation.id} recommendationCategory={analyticsCategory(view)} recommendationExposureCount={view.recommendation.portfolio?.exposureCount ?? 0} className={styles.rowAddAction} /> : null}
      {decisionActions ? <DecisionControls actions={decisionActions} /> : null}
    </div>
  </article>;
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
