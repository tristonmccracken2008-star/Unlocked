"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { listingDeadlineLabel as deadlineLabel } from "@/data/opportunity-listing";
import type { RecommendationDisplaySignal, RecommendationViewModel } from "@/data/recommendation-service";
import type { School } from "@/data/seed";
import type { StudentActivity } from "@/data/student-activity";
import type { StudentProfile } from "@/data/student-profile";
import type { AccountSession } from "@/lib/account-types";
import type { AdvisorAccessState } from "@/lib/advisor-access";
import type { Entitlements } from "@/lib/entitlements";
import type { ForYouServerState } from "@/lib/for-you-snapshot";
import { accountSessionEvent, readAccountSession } from "@/data/account-sync";
import { authenticatedFetch } from "@/data/authenticated-request";
import { rememberRecommendationAttribution, trackProductError, trackProductEvent } from "@/data/product-analytics";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { ArrowIcon, CheckCircleIcon, SearchIcon } from "./icons";
import { OrganizationLogo } from "./organization-logo";
import { AddToJourneyButton } from "./opportunity-activity";
import type { FeedbackType } from "@/lib/advisor/types";
import styles from "./advisor-page.module.css";

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
    if (!top || trackedRecommendation.current === top.recommendation.id) return;
    trackedRecommendation.current = top.recommendation.id;
    trackProductEvent("recommendation_viewed", { recommendationId: top.recommendation.id, section: "for-you" });
  }, [top]);

  async function sendFeedback(view: RecommendationViewModel, feedbackType: FeedbackType, label: string) {
    setFeedbackMessage("");
    const body = {
      recommendationId: view.recommendation.id,
      actionId: view.recommendation.relatedOpportunityId ? `opportunity:${view.recommendation.relatedOpportunityId}` : view.recommendation.id,
      signal: view.opportunity ? `category:${view.opportunity.category}` : view.recommendation.categories[0],
      feedbackType,
      reason: label,
    };
    try {
      const response = await authenticatedFetch("/api/advisor/feedback", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) {
        setFeedbackMessage("We couldn’t save that preference. Try again.");
        return;
      }
      const event = feedbackType === "helpful" ? "recommendation_saved" : feedbackType === "already-applied" ? "recommendation_applied" : feedbackType === "already-completed" || feedbackType === "completed" ? "recommendation_completed" : feedbackType === "dismissed" ? "recommendation_dismissed" : "recommendation_ignored";
      trackProductEvent(event, { recommendationId: view.recommendation.id, opportunityId: view.recommendation.relatedOpportunityId, section: "for-you-feedback" });
      if (["dismissed", "not-interested"].includes(feedbackType) && view.recommendation.relatedOpportunityId) {
        trackProductEvent(productIntelligenceEvents.recommendationDismissed, {
          recommendationId: view.recommendation.id,
          opportunityId: view.recommendation.relatedOpportunityId,
          category: analyticsCategory(view),
          exposureCount: view.recommendation.portfolio?.exposureCount ?? 0,
        });
      }
      if (["dismissed", "not-interested", "already-completed", "completed"].includes(feedbackType)) {
        setState((current) => current ? { ...current, recommendations: current.recommendations.filter((item) => item.recommendation.id !== view.recommendation.id) } : current);
      }
      setFeedbackMessage(label);
    } catch {
      setFeedbackMessage("We couldn’t save that preference. Try again.");
    }
  }

  if (sessionReadiness === "checking" || pageState === "loading") return <ForYouLoading />;
  if (sessionReadiness === "unauthenticated") return <ForYouSetupState title="Sign in to see For You." text="Your recommendations are tied to your UnlockED account so they can reflect your profile and Journey." actionHref="/api/auth/google" actionLabel="Sign in" />;
  if (sessionReadiness === "error") return <ForYouErrorState message={errorMessage} onRetry={() => void refreshSession()} retrying={requestActive} />;
  if (pageState === "error") return <ForYouErrorState message={errorMessage} onRetry={() => void loadForYou({ allowAutoRetry: false })} retrying={requestActive} />;
  if (pageState === "profile_incomplete" || !state?.profile || !state.school) return <ForYouSetupState title="Complete your profile first." text="UnlockED needs your school, major, year, goals, and activity before it can recommend fitting opportunities." actionHref="/profile" actionLabel="Open profile" />;
  if (pageState === "preparing") return <ForYouPreparingState />;
  if (pageState === "free_preview" && !top) return <ForYouFreePreviewOnly />;
  if (pageState === "empty" || !top) return <ForYouEmptyState />;

  return <main className={styles.page} data-for-you-page="premium-v2">
    <section className={styles.container}>
      <Hero state={state} firstName={firstName} count={recommended.length} />
      <TopRecommendation view={top} onFeedback={sendFeedback} />
      {feedbackMessage ? <p role="status" aria-live="polite" className={styles.feedbackStatus}>{feedbackMessage}</p> : null}
      <RecommendedGrid recommendations={recommended.slice(1)} onFeedback={sendFeedback} />
      {pageState === "free_preview" ? <ForYouUpgradeGate totalMatches={state.totalMatches} shown={state.recommendations.length} /> : null}
      <FooterNote />
    </section>
  </main>;
}

function Hero({ state, firstName, count }: { state: AdvisorState; firstName: string; count: number }) {
  if (!state.profile || !state.school) return null;
  const context = [state.profile.major, state.profile.year || state.profile.graduationYear, state.profile.careerGoal].filter(Boolean);
  const trackedCount = Object.keys(state.activity.tracked ?? {}).length;
  const updateNote = trackedCount
    ? "Updated using your profile and Journey activity."
    : state.activity.viewed.length
      ? "Updated using opportunities you recently explored."
      : "Selected using your profile and verified eligibility.";
  return <header className={styles.hero}>
    <p className={styles.eyebrow}>For {firstName}</p>
    <h1>Opportunities worth your attention.</h1>
    <p className={styles.heroCopy}>{count === 1 ? "One opportunity" : `${count} opportunities`} passed UnlockED’s eligibility, quality, and relevance checks.</p>
    <div className={styles.profileContext} aria-label="Recommendation profile">
      <span className={styles.contextLead}>Selected for</span>
      <span>{state.school.name}</span>
      {context.map((item) => <span key={item}>{item}</span>)}
      <Link href="/profile">Adjust profile <ArrowIcon /></Link>
    </div>
    <p className={styles.updateNote}>{updateNote}{state.isRefreshing ? " A refreshed shortlist is being prepared." : ""}</p>
  </header>;
}

function cleanValueLabel(value: string) {
  return /^unknown/i.test(value) ? "Not listed" : value;
}

function recommendationSignals(view: RecommendationViewModel, limit = 4) {
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
    opportunity?.verification_status === "verified" ? { kind: "trust", label: "Official source verified" } : null,
  ];
  const signals = candidates.filter((signal): signal is RecommendationDisplaySignal => Boolean(signal));
  return [...new Map(signals.map((signal) => [signal.label, signal])).values()].slice(0, limit);
}

function strongestReason(view: RecommendationViewModel) {
  return view.summaryReason
    ?? view.reasons.find((reason) => /career goal/i.test(reason))
    ?? view.reasons.find((reason) => /opportunity interests?/i.test(reason))
    ?? view.reasons.find((reason) => /matches your major:/i.test(reason))
    ?? view.reasons.find((reason) => /you are a/i.test(reason))
    ?? view.reasons[0]
    ?? "It passed UnlockED’s eligibility and relevance checks for your profile.";
}

type RecommendationFeedbackHandler = (view: RecommendationViewModel, feedbackType: FeedbackType, label: string) => Promise<void>;

function scoreFor(view: RecommendationViewModel) {
  return view.opportunityScore ?? {
    value: Math.min(99, Math.max(72, Math.round(view.recommendation.confidence))),
    label: view.label === "Excellent Match" ? "Excellent Fit" : view.label === "Explore" ? "Worth Exploring" : "Strong Match",
  };
}

function timingFor(view: RecommendationViewModel) {
  return view.whyApplyNow ?? {
    label: "No artificial urgency",
    detail: "No near-term verified deadline is listed.",
    urgency: "low" as const,
  };
}

function TopRecommendation({ view, onFeedback }: { view: RecommendationViewModel; onFeedback: RecommendationFeedbackHandler }) {
  const opportunity = view.opportunity;
  const signals = recommendationSignals(view);
  const score = scoreFor(view);
  const timing = timingFor(view);
  return <article className={styles.featured} aria-labelledby={`recommendation-${view.recommendation.id}`}>
    <div className={styles.featuredMain}>
      <div className={styles.featuredIdentity}>
        <div className={styles.featuredLabel}>
          <span>Highest-priority match</span>
          {view.freshnessLabel ? <strong>{view.freshnessLabel}</strong> : view.historyLabel ? <strong>{view.historyLabel}</strong> : null}
        </div>
        <div className={styles.titleLockup}>
          {opportunity ? <OrganizationLogo opportunity={opportunity} size="lg" className={styles.logo} /> : null}
          <div><p>{opportunity?.organization ?? view.recommendation.kind}</p><h2 id={`recommendation-${view.recommendation.id}`}>{opportunity?.title ?? view.recommendation.title}</h2></div>
        </div>
        <p className={styles.featuredDescription}>{opportunity?.description ?? view.recommendation.description}</p>
        <div className={styles.signals} aria-label="Why this matches">{signals.map((signal) => <span key={signal.label} data-signal-kind={signal.kind}><CheckCircleIcon />{signal.label}</span>)}</div>
        <p className={styles.reason}><strong>Why it fits:</strong> {strongestReason(view)}</p>
      </div>
      <aside className={styles.featuredDecision} aria-label="Opportunity details and actions">
        <div className={styles.score} aria-label={`UnlockED Opportunity Score: ${score.value}, ${score.label}`}>
          <strong>{score.value}</strong>
          <span>{score.label}</span>
          <small>Opportunity Score</small>
        </div>
        <dl className={styles.featuredMeta}>
          <div><dt>Deadline</dt><dd>{opportunity ? deadlineLabel(opportunity) : "Not announced"}</dd></div>
          <div><dt>Estimated value</dt><dd>{cleanValueLabel(view.recommendation.estimatedValueLabel)}</dd></div>
        </dl>
        <p className={styles.timing} data-urgency={timing.urgency}><strong>{timing.label}</strong><span>{timing.detail}</span></p>
        <Link href={view.href} onClick={() => trackRecommendationOpen(view)} className={styles.primaryAction}>Review opportunity <ArrowIcon /></Link>
        {view.recommendation.relatedOpportunityId ? <AddToJourneyButton opportunityId={view.recommendation.relatedOpportunityId} recommendationId={view.recommendation.id} recommendationCategory={analyticsCategory(view)} recommendationExposureCount={view.recommendation.portfolio?.exposureCount ?? 0} className={styles.addAction} /> : null}
      </aside>
    </div>
    <RecommendationIntelligence view={view} />
    <RecommendationFeedback view={view} onFeedback={onFeedback} />
  </article>;
}

function RecommendedGrid({ recommendations, onFeedback }: { recommendations: RecommendationViewModel[]; onFeedback: RecommendationFeedbackHandler }) {
  if (!recommendations.length) return null;
  return <section className={styles.more} aria-labelledby="more-matches-title">
    <div className={styles.sectionHeading}><div><p>Your shortlist</p><h2 id="more-matches-title">More opportunities selected for you</h2></div><span>{recommendations.length} to review</span></div>
    <ol className={styles.recommendationList}>{recommendations.map((view, index) => <li key={view.recommendation.id}><RecommendationCard view={view} index={index + 2} onFeedback={onFeedback} /></li>)}</ol>
    <Link href="/opportunities" className={styles.discoverLink}>Explore all opportunities in Discover <ArrowIcon /></Link>
  </section>;
}

function ForYouUpgradeGate({ totalMatches, shown }: { totalMatches: number; shown: number }) {
  const lockedCount = Math.max(totalMatches - shown, 0);
  return <section className={styles.upgrade} aria-labelledby="for-you-pro-title">
    <div><p>UnlockED Pro</p><h2 id="for-you-pro-title">Keep the full shortlist working for you.</h2><span>Free shows {shown} of {totalMatches} eligible matches. Pro adds {lockedCount} more, with the same verified eligibility standard.</span></div>
    <Link href="/pricing" onClick={() => trackProductEvent("pro_upgrade_clicked", { section: "for-you" })}>See Pro options <ArrowIcon /></Link>
  </section>;
}

function ForYouFreePreviewOnly() {
  return <main className={styles.page}>
    <section className={`${styles.container} ${styles.stateContainer}`}>
      <div className={styles.stateIntro}><p>For You</p><h1>A shortlist built around you.</h1><span>UnlockED Pro checks eligibility first, then ranks verified opportunities by fit, quality, timing, and value.</span></div>
      <ol className={styles.previewChecks} aria-label="How Pro recommendations are selected">
        <li><span>01</span><div><strong>Eligibility confirmed</strong><p>School, year, major, and other known requirements are checked before ranking.</p></div></li>
        <li><span>02</span><div><strong>Fit and quality ranked</strong><p>Your goals and interests are balanced with source quality and documented value.</p></div></li>
        <li><span>03</span><div><strong>Reasons made visible</strong><p>Every recommendation shows the factual signals that put it on your shortlist.</p></div></li>
      </ol>
      <section className={styles.upgrade} aria-labelledby="for-you-pro-title">
        <div><p>UnlockED Pro</p><h2 id="for-you-pro-title">Find the opportunities you would otherwise miss.</h2><span>See a focused, rotating shortlist with fit, timing, trust, and related alternatives explained.</span></div>
        <Link href="/pricing" onClick={() => trackProductEvent("pro_upgrade_clicked", { section: "for-you" })}>See Pro options <ArrowIcon /></Link>
      </section>
    </section>
  </main>;
}

function ForYouLoading() {
  return <main className={styles.page}><section className={styles.loading} aria-busy="true" aria-live="polite" aria-label="Loading For You recommendations"><p>For You</p><div className={`${styles.skeleton} ${styles.skeletonTitle}`} /><div className={`${styles.skeleton} ${styles.skeletonCopy}`} /><div className={styles.loadingSteps} aria-hidden="true"><span>Checking eligibility</span><span>Ranking fit and quality</span><span>Confirming sources</span></div><div className={styles.loadingFeature}><div /><div /><div /></div><span className={styles.srStatus}>Checking eligibility, quality, and verified sources.</span></section></main>;
}

function ForYouEmptyState() {
  return <StateShell eyebrow="For You" title="No strong matches yet." text="Nothing cleared our eligibility and relevance checks today. Adjust your profile to sharpen the next selection." actionHref="/profile" actionLabel="Review your profile" secondaryHref="/opportunities" secondaryLabel="Browse Discover" Icon={SearchIcon} />;
}

function ForYouPreparingState() {
  return <main className={styles.page}><section className={`${styles.state} ${styles.preparing}`} aria-busy="true" aria-live="polite"><span className={styles.preparingMark} aria-hidden="true"><i /><i /><i /></span><p>For You</p><h1>Building your first shortlist.</h1><span>Checking verified opportunities against your profile. This page will update on its own.</span></section></main>;
}

function ForYouErrorState({ message, onRetry, retrying = false }: { message: string; onRetry: () => void; retrying?: boolean }) {
  return <main className={styles.page}><section className={styles.state}><p>For You</p><h1>We couldn’t load your shortlist.</h1><span>{message || "The request was interrupted. Your profile and Journey are unchanged."}</span><div className={styles.stateActions}><button type="button" onClick={onRetry} disabled={retrying}>{retrying ? "Trying again…" : "Try again"}</button><Link href="/opportunities">Browse Discover</Link></div></section></main>;
}

function ForYouSetupState({ title, text, actionHref, actionLabel }: { title: string; text: string; actionHref: string; actionLabel: string }) {
  return <StateShell eyebrow="For You" title={title} text={text} actionHref={actionHref} actionLabel={actionLabel} />;
}

function StateShell({ eyebrow, title, text, actionHref, actionLabel, secondaryHref, secondaryLabel, Icon }: { eyebrow: string; title: string; text: string; actionHref: string; actionLabel: string; secondaryHref?: string; secondaryLabel?: string; Icon?: typeof SearchIcon }) {
  return <main className={styles.page}><section className={styles.state}>{Icon ? <span className={styles.stateIcon}><Icon /></span> : null}<p>{eyebrow}</p><h1>{title}</h1><span>{text}</span><div className={styles.stateActions}><Link href={actionHref}>{actionLabel}</Link>{secondaryHref && secondaryLabel ? <Link href={secondaryHref}>{secondaryLabel}</Link> : null}</div></section></main>;
}

function RecommendationCard({ view, index, onFeedback }: { view: RecommendationViewModel; index: number; onFeedback: RecommendationFeedbackHandler }) {
  const opportunity = view.opportunity;
  const signals = recommendationSignals(view, 4);
  const score = scoreFor(view);
  const timing = timingFor(view);
  return <article className={styles.recommendation} aria-labelledby={`recommendation-${view.recommendation.id}`}>
    <span className={styles.rank} aria-hidden="true">{String(index).padStart(2, "0")}</span>
    <div className={styles.recommendationBody}>
      <div className={styles.recommendationTitle}>{opportunity ? <OrganizationLogo opportunity={opportunity} size="md" className={styles.logo} /> : null}<div><p>{opportunity?.organization ?? view.recommendation.kind}</p><h3 id={`recommendation-${view.recommendation.id}`}>{opportunity?.title ?? view.recommendation.title}</h3>{view.freshnessLabel || view.historyLabel ? <span className={styles.trace}>{view.freshnessLabel ?? view.historyLabel}</span> : null}</div></div>
      <p className={styles.recommendationReason}>{strongestReason(view)}</p>
      <div className={styles.signals} aria-label="Why this matches">{signals.map((signal) => <span key={signal.label} data-signal-kind={signal.kind}><CheckCircleIcon />{signal.label}</span>)}</div>
      <RecommendationIntelligence view={view} compact />
      <RecommendationFeedback view={view} onFeedback={onFeedback} compact />
    </div>
    <dl className={styles.rowMeta}><div className={styles.rowScore}><dt>Opportunity Score</dt><dd><strong>{score.value}</strong> {score.label}</dd></div><div><dt>Why now</dt><dd>{timing.label}</dd></div><div><dt>Deadline</dt><dd>{opportunity ? deadlineLabel(opportunity) : "Not announced"}</dd></div></dl>
    <div className={styles.rowActions}><Link href={view.href} onClick={() => trackRecommendationOpen(view)}>Review <ArrowIcon /></Link>{view.recommendation.relatedOpportunityId ? <AddToJourneyButton opportunityId={view.recommendation.relatedOpportunityId} recommendationId={view.recommendation.id} recommendationCategory={analyticsCategory(view)} recommendationExposureCount={view.recommendation.portfolio?.exposureCount ?? 0} className={styles.rowAddAction} /> : null}</div>
  </article>;
}

function RecommendationIntelligence({ view, compact = false }: { view: RecommendationViewModel; compact?: boolean }) {
  const reasons = view.whyThisOpportunity?.length
    ? view.whyThisOpportunity
    : [{ kind: "impact" as const, label: "Verified fit", detail: strongestReason(view) }];
  const timing = timingFor(view);
  const score = scoreFor(view);
  const trustSignals = view.trustSignals ?? [];
  const similar = view.similarOpportunities ?? [];
  return <details className={`${styles.intelligence} ${compact ? styles.intelligenceCompact : ""}`}>
    <summary>Why this opportunity?</summary>
    <div className={styles.intelligencePanel}>
      <section aria-labelledby={`why-fit-${view.recommendation.id}`}>
        <h4 id={`why-fit-${view.recommendation.id}`}>Why it fits</h4>
        <p className={styles.scoreMethod}><strong>{score.value} {score.label}.</strong> Fit, verified eligibility, source quality, and documented impact shape this score.</p>
        <ul>{reasons.map((reason) => <li key={`${reason.label}-${reason.detail}`}><span data-signal-kind={reason.kind}>{reason.label}</span><p>{reason.detail}</p></li>)}</ul>
      </section>
      <section aria-labelledby={`why-now-${view.recommendation.id}`}>
        <h4 id={`why-now-${view.recommendation.id}`}>Why now</h4>
        <p className={styles.intelligenceCopy}><strong>{timing.label}.</strong> {timing.detail}</p>
        {trustSignals.length ? <div className={styles.trustSignals} aria-label="Verification signals">{trustSignals.map((signal) => <span key={signal.label} title={signal.detail}><CheckCircleIcon />{signal.label}</span>)}</div> : null}
      </section>
      {similar.length ? <section className={styles.similar} aria-labelledby={`similar-${view.recommendation.id}`}>
        <h4 id={`similar-${view.recommendation.id}`}>Related paths</h4>
        <ul>{similar.map((item) => <li key={item.opportunityId}><Link href={item.href}><span>{item.relationship}</span><strong>{item.title}</strong><small>{item.organization}</small></Link></li>)}</ul>
      </section> : null}
    </div>
  </details>;
}

function RecommendationFeedback({ view, onFeedback, compact = false }: { view: RecommendationViewModel; onFeedback: RecommendationFeedbackHandler; compact?: boolean }) {
  const actions: Array<{ label: string; type: FeedbackType; eventLabel: string }> = [
    { label: "Show me more like this", type: "helpful", eventLabel: "Preference saved. We’ll use it to improve future matches." },
    { label: "Not interested", type: "not-interested", eventLabel: "Got it. We’ll show fewer opportunities like this." },
    { label: "Hide", type: "dismissed", eventLabel: "Hidden from your recommendations." },
    { label: "Already applied", type: "already-applied", eventLabel: "Marked as already applied." },
    { label: "Already completed", type: "already-completed", eventLabel: "Marked as already completed." },
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
    <summary>{compact ? "Refine this match" : "Not quite right?"}</summary>
    <div>
      {actions.map((action) => <button key={action.type} type="button" disabled={Boolean(pending)} onClick={() => void choose(action.type, action.eventLabel)}>{pending === action.type ? "Saving…" : action.label}</button>)}
    </div>
  </details>;
}

function FooterNote() {
  return <footer className={styles.footerNote}><p>Recommendations change as your profile and Journey evolve.</p><Link href="/help">How matching works <ArrowIcon /></Link></footer>;
}
