"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { listingDeadlineLabel as deadlineLabel } from "@/data/opportunity-listing";
import type { RecommendationViewModel } from "@/data/recommendation-service";
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

function trackRecommendationOpen(view: RecommendationViewModel) {
  const opportunityId = view.recommendation.relatedOpportunityId;
  if (!opportunityId) return;
  rememberRecommendationAttribution(opportunityId, view.recommendation.id);
  trackProductEvent(productIntelligenceEvents.recommendationOpened, {
    opportunityId,
    recommendationId: view.recommendation.id,
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
  const recommended = state?.recommendations.slice(0, 5) ?? [];
  const firstName = state?.profile ? displayFirstName(state.profile, state.session) : "there";

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
  if (pageState === "free_preview" && !top) return <ForYouFreePreviewOnly totalMatches={state.totalMatches} shown={state.recommendations.length} />;
  if (pageState === "empty" || !top) return <ForYouEmptyState />;

  return <main className={styles.page} data-for-you-page="premium-v1">
    <section className={styles.container}>
      <Hero state={state} firstName={firstName} count={recommended.length} />
      <TopRecommendation view={top} onFeedback={sendFeedback} />
      {feedbackMessage ? <p role="status" aria-live="polite" className={styles.feedbackStatus}>{feedbackMessage}</p> : null}
      <RecommendedGrid recommendations={recommended.slice(1, 5)} onFeedback={sendFeedback} />
      {pageState === "free_preview" ? <ForYouUpgradeGate totalMatches={state.totalMatches} shown={state.recommendations.length} /> : null}
      <FooterNote />
    </section>
  </main>;
}

function Hero({ state, firstName, count }: { state: AdvisorState; firstName: string; count: number }) {
  if (!state.profile || !state.school) return null;
  const context = [state.profile.major, state.profile.year || state.profile.graduationYear, state.profile.careerGoal].filter(Boolean);
  return <header className={styles.hero}>
    <p className={styles.eyebrow}>For {firstName}</p>
    <h1>Your strongest matches, right now.</h1>
    <p className={styles.heroCopy}>{count === 1 ? "One opportunity" : `${count} opportunities`} cleared our eligibility and relevance checks for your profile.</p>
    <div className={styles.profileContext} aria-label="Recommendation profile">
      <span className={styles.contextLead}>Selected for</span>
      <span>{state.school.name}</span>
      {context.map((item) => <span key={item}>{item}</span>)}
      <Link href="/profile">Adjust profile <ArrowIcon /></Link>
    </div>
  </header>;
}

function cleanValueLabel(value: string) {
  return /^unknown/i.test(value) ? "Not listed" : value;
}

function recommendationSignals(view: RecommendationViewModel, limit = 4) {
  const opportunity = view.opportunity;
  const reasons = view.reasons.join(" ");
  const signals = [
    /matches your major:/i.test(reasons) ? "Matches your major" : /open to students in any major/i.test(reasons) ? "Open to your major" : "",
    /career goal/i.test(reasons) ? "Fits your goals" : "",
    /opportunity interests?/i.test(reasons) ? "Matches your interests" : "",
    view.chips.includes("Freshman eligible") ? "Freshman eligible" : "",
    opportunity?.difficulty === "Open" ? "Beginner friendly" : "",
    opportunity?.estimated_value && opportunity.estimated_value >= 5_000 ? "High estimated value" : "",
    view.chips.includes("Paid") ? "Paid" : "",
    view.chips.includes("Remote") ? "Remote" : "",
    opportunity?.verification_status === "verified" ? "Source verified" : "",
  ].filter(Boolean);
  return [...new Set(signals)].slice(0, limit);
}

function strongestReason(view: RecommendationViewModel) {
  return view.reasons.find((reason) => /career goal/i.test(reason))
    ?? view.reasons.find((reason) => /opportunity interests?/i.test(reason))
    ?? view.reasons.find((reason) => /matches your major:/i.test(reason))
    ?? view.reasons.find((reason) => /you are a/i.test(reason))
    ?? view.reasons[0]
    ?? "It passed UnlockED’s eligibility and relevance checks for your profile.";
}

type RecommendationFeedbackHandler = (view: RecommendationViewModel, feedbackType: FeedbackType, label: string) => Promise<void>;

function TopRecommendation({ view, onFeedback }: { view: RecommendationViewModel; onFeedback: RecommendationFeedbackHandler }) {
  const opportunity = view.opportunity;
  const signals = recommendationSignals(view);
  return <article className={styles.featured} aria-labelledby={`recommendation-${view.recommendation.id}`}>
    <div className={styles.featuredMain}>
      <div className={styles.featuredIdentity}>
        <div className={styles.featuredLabel}><span>Best fit right now</span><strong>{view.label}</strong></div>
        <div className={styles.titleLockup}>
          {opportunity ? <OrganizationLogo opportunity={opportunity} size="lg" className={styles.logo} /> : null}
          <div><p>{opportunity?.organization ?? view.recommendation.kind}</p><h2 id={`recommendation-${view.recommendation.id}`}>{opportunity?.title ?? view.recommendation.title}</h2></div>
        </div>
        <p className={styles.featuredDescription}>{opportunity?.description ?? view.recommendation.description}</p>
        <div className={styles.signals} aria-label="Why this matches">{signals.map((signal) => <span key={signal}><CheckCircleIcon />{signal}</span>)}</div>
        <p className={styles.reason}><strong>Why it fits:</strong> {strongestReason(view)}</p>
      </div>
      <aside className={styles.featuredDecision} aria-label="Opportunity details and actions">
        <dl className={styles.featuredMeta}>
          <div><dt>Deadline</dt><dd>{opportunity ? deadlineLabel(opportunity) : "Not announced"}</dd></div>
          <div><dt>Estimated value</dt><dd>{cleanValueLabel(view.recommendation.estimatedValueLabel)}</dd></div>
        </dl>
        <Link href={view.href} onClick={() => trackRecommendationOpen(view)} className={styles.primaryAction}>Review opportunity <ArrowIcon /></Link>
        {view.recommendation.relatedOpportunityId ? <AddToJourneyButton opportunityId={view.recommendation.relatedOpportunityId} recommendationId={view.recommendation.id} className={styles.addAction} /> : null}
      </aside>
    </div>
    <RecommendationFeedback view={view} onFeedback={onFeedback} />
  </article>;
}

function RecommendedGrid({ recommendations, onFeedback }: { recommendations: RecommendationViewModel[]; onFeedback: RecommendationFeedbackHandler }) {
  if (!recommendations.length) return null;
  return <section className={styles.more} aria-labelledby="more-matches-title">
    <div className={styles.sectionHeading}><div><p>Also selected for you</p><h2 id="more-matches-title">More strong matches</h2></div><span>{recommendations.length} to review</span></div>
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

function ForYouFreePreviewOnly({ totalMatches, shown }: { totalMatches: number; shown: number }) {
  return <main className={styles.page}>
    <section className={`${styles.container} ${styles.stateContainer}`}>
      <div className={styles.stateIntro}><p>For You</p><h1>Your personalized shortlist is ready.</h1><span>We found {totalMatches} eligible matches. Your current preview shows {shown}.</span></div>
      <ForYouUpgradeGate totalMatches={totalMatches} shown={shown} />
    </section>
  </main>;
}

function ForYouLoading() {
  return <main className={styles.page}><section className={styles.loading} aria-busy="true" aria-live="polite" aria-label="Loading For You recommendations"><p>For You</p><div className={`${styles.skeleton} ${styles.skeletonTitle}`} /><div className={`${styles.skeleton} ${styles.skeletonCopy}`} /><div className={styles.loadingContext}><span /><span /><span /></div><div className={styles.loadingFeature}><div /><div /><div /></div><span className={styles.srStatus}>Selecting your strongest verified matches.</span></section></main>;
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
  return <article className={styles.recommendation} aria-labelledby={`recommendation-${view.recommendation.id}`}>
    <span className={styles.rank} aria-hidden="true">{String(index).padStart(2, "0")}</span>
    <div className={styles.recommendationBody}>
      <div className={styles.recommendationTitle}>{opportunity ? <OrganizationLogo opportunity={opportunity} size="md" className={styles.logo} /> : null}<div><p>{opportunity?.organization ?? view.recommendation.kind}</p><h3 id={`recommendation-${view.recommendation.id}`}>{opportunity?.title ?? view.recommendation.title}</h3></div></div>
      <p className={styles.recommendationReason}>{strongestReason(view)}</p>
      <div className={styles.signals}>{signals.map((signal) => <span key={signal}><CheckCircleIcon />{signal}</span>)}</div>
      <RecommendationFeedback view={view} onFeedback={onFeedback} compact />
    </div>
    <dl className={styles.rowMeta}><div><dt>Deadline</dt><dd>{opportunity ? deadlineLabel(opportunity) : "Not announced"}</dd></div><div><dt>Match</dt><dd>{view.label}</dd></div></dl>
    <div className={styles.rowActions}><Link href={view.href} onClick={() => trackRecommendationOpen(view)}>Review <ArrowIcon /></Link>{view.recommendation.relatedOpportunityId ? <AddToJourneyButton opportunityId={view.recommendation.relatedOpportunityId} recommendationId={view.recommendation.id} className={styles.rowAddAction} /> : null}</div>
  </article>;
}

function RecommendationFeedback({ view, onFeedback, compact = false }: { view: RecommendationViewModel; onFeedback: RecommendationFeedbackHandler; compact?: boolean }) {
  const actions: Array<{ label: string; type: FeedbackType; eventLabel: string }> = [
    { label: "Interested", type: "helpful", eventLabel: "Saved interest signal." },
    { label: "Not interested", type: "not-interested", eventLabel: "We will show fewer like this." },
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
    <summary>Not quite right?</summary>
    <div>
      {actions.map((action) => <button key={action.type} type="button" disabled={Boolean(pending)} onClick={() => void choose(action.type, action.eventLabel)}>{pending === action.type ? "Saving…" : action.label}</button>)}
    </div>
  </details>;
}

function FooterNote() {
  return <footer className={styles.footerNote}><p>Recommendations change as your profile and Journey evolve.</p><Link href="/help">How matching works <ArrowIcon /></Link></footer>;
}
