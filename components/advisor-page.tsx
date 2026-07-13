"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { deadlineLabel } from "@/data/opportunities";
import type { RecommendationViewModel } from "@/data/recommendation-service";
import type { School } from "@/data/seed";
import type { StudentActivity } from "@/data/student-activity";
import type { StudentProfile } from "@/data/student-profile";
import type { AccountSession } from "@/lib/account-types";
import type { AdvisorAccessState } from "@/lib/advisor-access";
import type { Entitlements } from "@/lib/entitlements";
import type { ForYouServerState } from "@/lib/for-you-snapshot";
import { accountSessionEvent, readAccountSession } from "@/data/account-sync";
import { trackProductEvent } from "@/data/product-analytics";
import { ArrowIcon, BookmarkIcon, CheckCircleIcon, SearchIcon, SendIcon, TargetIcon } from "./icons";
import { OrganizationLogo } from "./organization-logo";
import { AddToJourneyButton } from "./opportunity-activity";
import type { FeedbackType } from "@/lib/advisor/types";

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

function profileInterests(profile: StudentProfile) {
  return [...new Set([...(profile.advisorInterview?.interests ?? []), ...profile.interests.split(",").map((item) => item.trim()).filter(Boolean)])].slice(0, 3);
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

export function AdvisorPage({ initialState = null }: { initialState?: ForYouServerState | null }) {
  const initial = initialState ? normalizeForYouPayload(initialState) : null;
  const [state, setState] = useState<AdvisorState | null>(initial?.state ?? null);
  const [pageState, setPageState] = useState<ForYouPageState>(initial?.pageState ?? "loading");
  const [sessionReadiness, setSessionReadiness] = useState<SessionReadiness>(initialState ? "authenticated" : "checking");
  const [errorMessage, setErrorMessage] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [requestActive, setRequestActive] = useState(false);
  const trackedRecommendation = useRef("");
  const requestId = useRef(0);
  const sessionKey = useRef("");
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
        const response = await fetch("/api/advisor/for-you", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
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
    if (initialState) return;
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
  }, [applySession, initialState, refreshSession]);

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
    trackProductEvent("for_you_error", { reason: errorMessage });
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
    const response = await fetch("/api/advisor/feedback", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) {
      setFeedbackMessage("Could not save that signal.");
      return;
    }
    const event = feedbackType === "helpful" ? "recommendation_saved" : feedbackType === "already-applied" ? "recommendation_applied" : feedbackType === "already-completed" || feedbackType === "completed" ? "recommendation_completed" : feedbackType === "dismissed" ? "recommendation_dismissed" : "recommendation_ignored";
    trackProductEvent(event, { recommendationId: view.recommendation.id, opportunityId: view.recommendation.relatedOpportunityId, section: "for-you-feedback" });
    if (["dismissed", "not-interested", "already-completed", "completed"].includes(feedbackType)) {
      setState((current) => current ? { ...current, recommendations: current.recommendations.filter((item) => item.recommendation.id !== view.recommendation.id) } : current);
    }
    setFeedbackMessage(label);
  }

  if (sessionReadiness === "checking" || pageState === "loading") return <ForYouLoading />;
  if (sessionReadiness === "unauthenticated") return <ForYouSetupState title="Sign in to see For You." text="Your recommendations are tied to your UnlockED account so they can reflect your profile and Journey." actionHref="/api/auth/google" actionLabel="Sign in" />;
  if (sessionReadiness === "error") return <ForYouErrorState message={errorMessage} onRetry={() => void refreshSession()} retrying={requestActive} />;
  if (pageState === "error") return <ForYouErrorState message={errorMessage} onRetry={() => void loadForYou({ allowAutoRetry: false })} retrying={requestActive} />;
  if (pageState === "profile_incomplete" || !state?.profile || !state.school) return <ForYouSetupState title="Complete your profile first." text="UnlockED needs your school, major, year, goals, and activity before it can recommend fitting opportunities." actionHref="/profile" actionLabel="Open profile" />;
  if (pageState === "preparing") return <ForYouPreparingState />;
  if (pageState === "free_preview" && !top) return <ForYouFreePreviewOnly totalMatches={state.totalMatches} shown={state.recommendations.length} />;
  if (pageState === "empty" || !top) return <ForYouEmptyState />;

  return <main className="bg-[radial-gradient(circle_at_top_left,rgba(231,216,189,.45),transparent_34rem),#f6f0e6] px-5 py-10 sm:px-8 sm:py-14">
    <section className="mx-auto max-w-[112rem] space-y-10">
      <Hero state={state} firstName={firstName} />
      <TopRecommendation view={top} onFeedback={sendFeedback} />
      <RecommendedGrid recommendations={recommended.slice(1, 5)} onFeedback={sendFeedback} />
      {feedbackMessage ? <p role="status" className="rounded-full bg-white/70 px-4 py-3 text-sm font-bold text-forest ring-1 ring-ink/8">{feedbackMessage}</p> : null}
      {pageState === "free_preview" ? <ForYouUpgradeGate totalMatches={state.totalMatches} shown={state.recommendations.length} /> : null}
      <WhyRecommendations state={state} />
      <ActivityGlance activity={state.activity} />
      <FooterNote />
    </section>
  </main>;
}

function Hero({ state }: { state: AdvisorState; firstName: string }) {
  if (!state.profile || !state.school) return null;
  return <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start">
    <div>
      <p className="rule-label text-forest">For You</p>
      <h1 className="mt-4 max-w-3xl font-editorial text-5xl font-bold leading-[.98] tracking-[-.055em] text-ink sm:text-7xl">Opportunities selected around you.</h1>
      <p className="mt-6 max-w-2xl text-base leading-8 text-ink/58">Personalized matches from your profile, saved activity, eligibility signals, and the UnlockED opportunity database.</p>
    </div>
    <ProfileSummary state={state} />
  </header>;
}

function ProfileSummary({ state }: { state: AdvisorState }) {
  if (!state.profile || !state.school) return null;
  const rows = [
    ["School", state.school.name],
    ["Major", state.profile.major],
    ["Class year", state.profile.graduationYear || state.profile.year],
    ["Top interests", profileInterests(state.profile).join(", ")],
    ["Career goals", state.profile.careerGoal],
  ].filter(([, value]) => value);
  return <aside className="rounded-[1.5rem] bg-white/86 p-6 shadow-[0_18px_60px_rgba(43,33,26,.055)] ring-1 ring-ink/7">
    <div className="flex items-center justify-between gap-4"><h2 className="font-bold">Your profile at a glance</h2><Link href="/profile" className="text-sm font-black text-forest hover:text-ink">Edit profile <ArrowIcon className="inline h-3.5 w-3.5" /></Link></div>
    <dl className="mt-6 space-y-4">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-4 text-sm"><dt className="font-bold text-ink/50">{label}</dt><dd className="font-semibold text-ink/72">{value}</dd></div>)}</dl>
    {rows.length < 5 && <Link href="/profile" className="mt-5 inline-flex text-sm font-bold text-forest hover:text-ink">Improve recommendations <ArrowIcon className="h-4 w-4" /></Link>}
  </aside>;
}

function TopRecommendation({ view, onFeedback }: { view: RecommendationViewModel; onFeedback: (view: RecommendationViewModel, feedbackType: FeedbackType, label: string) => void }) {
  const opportunity = view.opportunity;
  return <article className="rounded-[2rem] bg-white/48 p-6 shadow-[0_18px_60px_rgba(43,33,26,.045)] ring-1 ring-ink/6 sm:p-8">
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px_250px] lg:items-center">
      <div>{opportunity && <OrganizationLogo opportunity={opportunity} size="lg" className="mb-5 bg-white/70"/>}<p className="rule-label text-forest">Top recommendation · {view.recommendation.priority} priority</p><h2 className="mt-4 font-editorial text-4xl font-bold leading-tight tracking-[-.035em]">{opportunity?.title ?? view.recommendation.title}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-ink/62">{opportunity?.description ?? view.recommendation.description}</p>{view.chips.length ? <div className="mt-5 flex flex-wrap gap-2">{view.chips.map((chip) => <span key={chip} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink/70">{chip}</span>)}</div> : null}</div>
      <dl className="grid gap-5 border-ink/10 text-sm lg:border-l lg:pl-8"><div><dt className="text-ink/40">Deadline</dt><dd className="mt-1 font-black">{opportunity ? deadlineLabel(opportunity) : "Not announced"}</dd></div><div><dt className="text-ink/40">Est. effort</dt><dd className="mt-1 font-black">{view.recommendation.estimatedValueLabel === "Unknown" ? "Medium" : view.recommendation.estimatedValueLabel}</dd></div><div><dt className="text-ink/40">Match</dt><dd className="mt-1 font-black text-forest">{view.label}</dd></div></dl>
      <div className="flex flex-col gap-3"><Link href={view.href} onClick={() => trackProductEvent("recommendation_clicked", { recommendationId: view.recommendation.id, opportunityId: view.recommendation.relatedOpportunityId, section: "for-you" })} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-forest px-6 text-sm font-bold text-white shadow-[0_16px_34px_rgba(31,95,67,.18)] hover:bg-ink">Open Opportunity <ArrowIcon /></Link>{view.recommendation.relatedOpportunityId ? <AddToJourneyButton opportunityId={view.recommendation.relatedOpportunityId} className="rounded-full border border-forest/35 bg-white px-6 text-forest hover:border-forest" /> : null}</div>
    </div>
    <RecommendationFeedback view={view} onFeedback={onFeedback} />
  </article>;
}

function RecommendedGrid({ recommendations, onFeedback }: { recommendations: RecommendationViewModel[]; onFeedback: (view: RecommendationViewModel, feedbackType: FeedbackType, label: string) => void }) {
  return <section>
    <div className="mb-5 flex items-end justify-between gap-4"><h2 className="font-editorial text-3xl font-bold tracking-[-.025em]">Recommended for you</h2><span className="hidden rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-bold text-ink/55 sm:inline-flex">Most relevant</span></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{recommendations.map((view) => <RecommendationCard key={view.recommendation.id} view={view} onFeedback={onFeedback} />)}</div>
    <Link href="/opportunities" className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-full border border-ink/10 bg-white text-sm font-bold text-ink hover:border-forest hover:text-forest">View more opportunities <ArrowIcon /></Link>
  </section>;
}

function ForYouUpgradeGate({ totalMatches, shown }: { totalMatches: number; shown: number }) {
  const lockedCount = Math.max(totalMatches - shown, 0);
  return <section className="overflow-hidden rounded-[1.5rem] bg-forest p-6 text-white shadow-[0_20px_60px_rgba(31,95,67,.18)] sm:p-8">
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
      <div>
        <p className="rule-label text-white/70">UnlockED Pro</p>
        <h2 className="mt-3 font-editorial text-3xl font-bold tracking-[-.03em]">Unlock your full personalized feed</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72">We found {totalMatches} opportunities aligned with your profile. Free shows {shown}; Pro unlocks the remaining {lockedCount} matches, deeper explanations, roadmap guidance, and premium themes.</p>
        <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-2xl bg-white/10 p-4"><p className="font-black">Free</p><p className="mt-2 text-white/68">Discover, Journey, and a focused For You preview.</p></div>
          <div className="rounded-2xl bg-white/14 p-4"><p className="font-black">Pro</p><p className="mt-2 text-white/68">Full feed, detailed match logic, adaptive learning, and career-roadmap guidance.</p></div>
        </div>
      </div>
      <div className="rounded-[1.25rem] bg-white/10 p-4 ring-1 ring-white/15">
        <div className="space-y-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="rounded-2xl bg-white/12 p-4"><div className="h-3 w-24 rounded-full bg-white/30" /><div className="mt-4 h-5 w-3/4 rounded-full bg-white/25" /><div className="mt-3 h-3 w-1/2 rounded-full bg-white/20" /></div>)}</div>
        <Link href="/pricing" onClick={() => trackProductEvent("pro_upgrade_clicked", { section: "for-you" })} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-forest hover:bg-paper">Upgrade to Pro <ArrowIcon /></Link>
        <Link href="/pricing" className="mt-3 inline-flex w-full justify-center text-sm font-bold text-white/76 hover:text-white">View pricing</Link>
      </div>
    </div>
  </section>;
}

function ForYouFreePreviewOnly({ totalMatches, shown }: { totalMatches: number; shown: number }) {
  return <main className="min-h-[70vh] bg-[radial-gradient(circle_at_top_left,rgba(231,216,189,.45),transparent_34rem),#f6f0e6] px-5 py-16 sm:px-8">
    <section className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="rule-label text-forest">For You</p>
        <h1 className="mt-4 max-w-3xl font-editorial text-5xl font-bold leading-[.98] tracking-[-.055em] text-ink sm:text-7xl">Opportunities selected around you.</h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-ink/58">UnlockED uses your school, major, graduation year, goals, interests, GPA status, and activity to find opportunities that fit you.</p>
      </div>
      <ForYouUpgradeGate totalMatches={totalMatches} shown={shown} />
    </section>
  </main>;
}

function ForYouLoading() {
  return <main className="min-h-[70vh] bg-paper px-5 py-16 sm:px-8"><section className="mx-auto max-w-6xl" aria-busy="true" aria-label="Loading For You recommendations"><p className="rule-label text-forest">For You</p><div className="mt-6 h-16 max-w-2xl animate-pulse rounded-2xl bg-white/70" /><div className="mt-10 h-52 animate-pulse rounded-[2rem] bg-white/70" /></section></main>;
}

function ForYouEmptyState() {
  return <main className="min-h-[70vh] bg-paper px-5 py-16 sm:px-8">
    <section className="mx-auto max-w-4xl rounded-[2rem] bg-white/62 p-8 shadow-[0_18px_60px_rgba(43,33,26,.045)] ring-1 ring-ink/6 sm:p-10">
      <p className="rule-label text-forest">For You</p>
      <h1 className="mt-4 font-editorial text-5xl font-bold tracking-[-.045em]">We could not find strong matches yet.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/55">Your profile is ready, but no recommendations cleared the quality bar. Update your priority or browse Discover while new matches are verified.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/profile" className="inline-flex min-h-12 items-center justify-center rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-ink">Edit profile</Link>
        <Link href="/opportunities" className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink/15 bg-white px-6 text-sm font-bold text-ink hover:border-forest hover:text-forest">Browse Discover</Link>
      </div>
    </section>
  </main>;
}

function ForYouPreparingState() {
  return <main className="min-h-[70vh] bg-paper px-5 py-16 sm:px-8">
    <section className="mx-auto max-w-4xl rounded-[2rem] bg-white/62 p-8 shadow-[0_18px_60px_rgba(43,33,26,.045)] ring-1 ring-ink/6 sm:p-10" aria-busy="true">
      <p className="rule-label text-forest">For You</p>
      <h1 className="mt-4 font-editorial text-5xl font-bold tracking-[-.045em]">Preparing your personalized recommendations.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/55">UnlockED is building your first snapshot. This should finish on its own in a moment.</p>
      <div className="mt-8 h-2 overflow-hidden rounded-full bg-ink/8"><div className="h-full w-1/3 animate-pulse rounded-full bg-forest" /></div>
    </section>
  </main>;
}

function ForYouErrorState({ message, onRetry, retrying = false }: { message: string; onRetry: () => void; retrying?: boolean }) {
  return <main className="min-h-[70vh] bg-paper px-5 py-16 sm:px-8">
    <section className="mx-auto max-w-4xl rounded-[2rem] bg-white/62 p-8 shadow-[0_18px_60px_rgba(43,33,26,.045)] ring-1 ring-ink/6 sm:p-10">
      <p className="rule-label text-forest">For You</p>
      <h1 className="mt-4 font-editorial text-5xl font-bold tracking-[-.045em]">We couldn’t load your recommendations.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/55">{message || "Something interrupted the request. Try again, or browse Discover while we sort it out."}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={onRetry} disabled={retrying} className="inline-flex min-h-12 items-center justify-center rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-ink disabled:cursor-not-allowed disabled:bg-ink/35">{retrying ? "Retrying..." : "Retry"}</button>
        <Link href="/opportunities" className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink/15 bg-white px-6 text-sm font-bold text-ink hover:border-forest hover:text-forest">Browse Discover</Link>
        <Link href="/contact" className="inline-flex min-h-12 items-center justify-center rounded-full px-4 text-sm font-bold text-forest hover:text-ink">Contact support</Link>
      </div>
    </section>
  </main>;
}

function ForYouSetupState({ title, text, actionHref, actionLabel }: { title: string; text: string; actionHref: string; actionLabel: string }) {
  return <main className="min-h-[70vh] bg-paper px-5 py-16 sm:px-8">
    <section className="mx-auto max-w-4xl rounded-[2rem] bg-white/62 p-8 shadow-[0_18px_60px_rgba(43,33,26,.045)] ring-1 ring-ink/6 sm:p-10">
      <p className="rule-label text-forest">For You</p>
      <h1 className="mt-4 font-editorial text-5xl font-bold tracking-[-.045em]">{title}</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/55">{text}</p>
      <Link href={actionHref} className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-ink">{actionLabel}</Link>
    </section>
  </main>;
}

function RecommendationCard({ view, onFeedback }: { view: RecommendationViewModel; onFeedback: (view: RecommendationViewModel, feedbackType: FeedbackType, label: string) => void }) {
  const opportunity = view.opportunity;
  return <article className="flex min-h-96 flex-col rounded-[1.35rem] bg-white/92 p-5 shadow-[0_14px_42px_rgba(43,33,26,.055)] ring-1 ring-ink/7">
    <div className="flex items-start justify-between gap-3"><p className="rule-label text-forest">{opportunity?.type ?? view.recommendation.kind}</p><BookmarkIcon className="h-5 w-5 text-ink/45" /></div>
    <div className="mt-7 flex items-start gap-4">{opportunity && <OrganizationLogo opportunity={opportunity} size="md"/>}<div className="min-w-0"><h3 className="font-editorial text-2xl font-bold leading-tight">{opportunity?.title ?? view.recommendation.title}</h3><p className="mt-2 text-xs font-bold text-ink/40">{opportunity?.organization ?? view.recommendation.kind}</p></div></div>
    <div className="mt-4 flex-1"><p className="line-clamp-4 text-sm leading-6 text-ink/60">{opportunity?.description ?? view.recommendation.description}</p></div>
    <div className="mt-5 flex flex-wrap gap-2">{view.chips.slice(0, 2).map((chip) => <span key={chip} className="rounded-full bg-paper px-3 py-1 text-xs font-bold text-ink/65">{chip}</span>)}</div>
    <div className="mt-5 grid grid-cols-2 gap-3 border-t border-ink/8 pt-4 text-xs"><div><p className="text-ink/40">Deadline</p><p className="mt-1 font-black">{opportunity ? deadlineLabel(opportunity) : "Not announced"}</p></div><div className="text-right"><p className="text-ink/40">{view.label}</p><span className="mt-2 inline-block h-2 w-2 rounded-full bg-forest" /></div></div>
    <div className="mt-5 grid gap-3"><Link href={view.href} onClick={() => trackProductEvent("recommendation_clicked", { recommendationId: view.recommendation.id, opportunityId: view.recommendation.relatedOpportunityId, section: "for-you-card" })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-forest text-sm font-bold text-white hover:bg-ink">Open Opportunity <ArrowIcon /></Link>{view.recommendation.relatedOpportunityId ? <AddToJourneyButton opportunityId={view.recommendation.relatedOpportunityId} className="rounded-full border border-ink/15 text-ink hover:border-forest hover:text-forest" /> : null}</div>
    <RecommendationFeedback view={view} onFeedback={onFeedback} compact />
  </article>;
}

function RecommendationFeedback({ view, onFeedback, compact = false }: { view: RecommendationViewModel; onFeedback: (view: RecommendationViewModel, feedbackType: FeedbackType, label: string) => void; compact?: boolean }) {
  const actions: Array<{ label: string; type: FeedbackType; eventLabel: string }> = [
    { label: "Interested", type: "helpful", eventLabel: "Saved interest signal." },
    { label: "Not interested", type: "not-interested", eventLabel: "We will show fewer like this." },
    { label: "Hide", type: "dismissed", eventLabel: "Hidden from your recommendations." },
    { label: "Already applied", type: "already-applied", eventLabel: "Marked as already applied." },
    { label: "Already completed", type: "already-completed", eventLabel: "Marked as already completed." },
  ];
  return <details className={`${compact ? "mt-4" : "mt-6"} group`}>
    <summary className="cursor-pointer text-xs font-black uppercase tracking-[.14em] text-ink/38 hover:text-forest">Improve recommendations</summary>
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action) => <button key={action.type} type="button" onClick={() => onFeedback(view, action.type, action.eventLabel)} className="min-h-9 rounded-full border border-ink/10 bg-white px-3 text-xs font-bold text-ink/55 hover:border-forest hover:text-forest">{action.label}</button>)}
      <button type="button" onClick={() => onFeedback(view, "dismissed", "We will not show this again.")} className="min-h-9 rounded-full border border-ink/10 bg-paper px-3 text-xs font-bold text-ink/45 hover:border-forest hover:text-forest">Never show again</button>
    </div>
  </details>;
}

function WhyRecommendations({ state }: { state: AdvisorState }) {
  if (!state.profile) return null;
  const reasons = [`${state.profile.major} major`, `${state.profile.year} eligibility`, ...profileInterests(state.profile).slice(0, 2), state.profile.careerGoal].filter(Boolean).slice(0, 4);
  return <section className="rounded-[1.5rem] bg-white/48 p-6 ring-1 ring-ink/6">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-editorial text-2xl font-bold">Why these recommendations?</h2><div className="mt-4 flex flex-wrap gap-5 text-sm text-ink/62">{reasons.map((reason) => <span key={reason} className="inline-flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-forest" />{reason}</span>)}</div></div><Link href="/profile" className="text-sm font-black text-forest hover:text-ink">Edit profile <ArrowIcon className="inline h-3.5 w-3.5" /></Link></div>
  </section>;
}

function ActivityGlance({ activity }: { activity: StudentActivity }) {
  const records = Object.values(activity.tracked ?? {});
  const saved = records.length;
  const applied = records.filter((item) => ["Applying", "Submitted", "Interview", "Accepted", "Rejected", "Completed"].includes(item.status)).length;
  const interviews = records.filter((item) => item.status === "Interview").length;
  return <section>
    <h2 className="font-editorial text-3xl font-bold tracking-[-.025em]">Your activity at a glance</h2>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><ActivityCard label="Saved" value={saved} Icon={BookmarkIcon} text="Keep exploring" /><ActivityCard label="Applied" value={applied} Icon={SendIcon} text="Take the next step" /><ActivityCard label="Interviews" value={interviews} Icon={TargetIcon} text="You’ve got this" /><div className="rounded-[1.35rem] bg-forest/8 p-6 ring-1 ring-forest/10"><h3 className="font-editorial text-2xl font-bold text-forest">Stay consistent</h3><p className="mt-3 text-sm leading-6 text-ink/60">Your recommendations improve as you add fitting opportunities to your Journey.</p><Link href="/opportunities" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-forest px-5 text-sm font-bold text-white">Explore more</Link></div></div>
  </section>;
}

function ActivityCard({ label, value, Icon, text }: { label: string; value: number; Icon: typeof BookmarkIcon; text: string }) {
  return <div className="rounded-[1.35rem] bg-white/88 p-6 shadow-[0_14px_42px_rgba(43,33,26,.045)] ring-1 ring-ink/7"><span className="grid h-14 w-14 place-items-center rounded-full bg-forest/10 text-forest"><Icon className="h-6 w-6" /></span><p className="mt-4 font-editorial text-4xl font-bold text-ink">{value}</p><p className="font-bold text-ink/70">{label}</p><p className="mt-1 text-sm text-forest">{text}</p></div>;
}

function FooterNote() {
  return <div className="flex flex-col gap-3 border-t border-ink/10 pt-6 text-sm text-ink/50 sm:flex-row sm:items-center sm:justify-between"><p>Recommendations update as your profile and activity grow.</p><Link href="/help" className="font-bold text-forest hover:text-ink">Learn how we match opportunities <ArrowIcon className="inline h-3.5 w-3.5" /></Link></div>;
}
