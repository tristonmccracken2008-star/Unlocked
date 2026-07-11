"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { hydrateAccountData } from "@/data/account-sync";
import { deadlineLabel, opportunities } from "@/data/opportunities";
import { buildRecommendationService, type RecommendationServiceResult, type RecommendationViewModel } from "@/data/recommendation-service";
import { schools, type School } from "@/data/seed";
import { readStudentActivity, type StudentActivity } from "@/data/student-activity";
import { inferApplicationsFromActivity, readStudentProgress, updateApplicationStatus, writeStudentProgress, type StudentProgress } from "@/data/student-progress";
import type { StudentProfile } from "@/data/student-profile";
import type { AccountSession } from "@/lib/account-types";
import { getAdvisorAccessState, type AdvisorAccessState } from "@/lib/advisor-access";
import { trackProductEvent } from "@/data/product-analytics";
import { ArrowIcon, BookmarkIcon, CheckCircleIcon, SearchIcon, SendIcon, TargetIcon } from "./icons";
import { OrganizationLogo } from "./organization-logo";

type AdvisorState = {
  profile: StudentProfile;
  school: School;
  activity: StudentActivity;
  progress: StudentProgress;
  session: AccountSession;
  service: RecommendationServiceResult;
  access: AdvisorAccessState;
};

function displayFirstName(profile: StudentProfile, session: AccountSession | null) {
  return profile.firstName?.trim() || session?.user?.name?.split(" ")[0] || "there";
}

function profileInterests(profile: StudentProfile) {
  return [...new Set([...(profile.advisorInterview?.interests ?? []), ...profile.interests.split(",").map((item) => item.trim()).filter(Boolean)])].slice(0, 3);
}

function buildState(profile: StudentProfile, activity: StudentActivity, progress: StudentProgress, session: AccountSession): AdvisorState | null {
  const school = schools.find((item) => item.slug === profile.schoolSlug);
  if (!school) return null;
  const inferredProgress = inferApplicationsFromActivity(activity, opportunities, progress);
  return {
    profile,
    school,
    activity,
    progress: inferredProgress,
    session,
    service: buildRecommendationService({ profile, school, activity, progress: inferredProgress, source: opportunities }),
    access: getAdvisorAccessState({ authenticated: session.authenticated, profileComplete: Boolean(session.data?.onboardingComplete), billing: session.data?.billing }),
  };
}

export function AdvisorPage() {
  const [state, setState] = useState<AdvisorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [completionMessage, setCompletionMessage] = useState("");
  const trackedRecommendation = useRef("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const session = await hydrateAccountData();
      if (!active) return;
      const profile = session.data?.profile;
      if (!session.authenticated || !profile) {
        setState(null);
        setLoading(false);
        return;
      }
      setState(buildState(profile, session.data?.activity ?? readStudentActivity(), readStudentProgress(), session));
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  const top = state?.service.topRecommendation ?? null;
  const recommended = state?.service.recommendations.slice(0, 5) ?? [];
  const firstName = state ? displayFirstName(state.profile, state.session) : "there";

  useEffect(() => {
    if (!top || trackedRecommendation.current === top.recommendation.id) return;
    trackedRecommendation.current = top.recommendation.id;
    trackProductEvent("for_you_opened");
    trackProductEvent("recommendation_viewed", { recommendationId: top.recommendation.id, section: "for-you" });
  }, [top]);

  function trackRecommendation(view: RecommendationViewModel) {
    if (!state || !view.recommendation.relatedOpportunityId) return;
    const stored = writeStudentProgress(updateApplicationStatus(state.progress, view.recommendation.relatedOpportunityId, "interested", {
      nextAction: "Review the official source and decide whether to apply.",
      source: "manual",
    }));
    const rebuilt = buildState(state.profile, state.activity, stored, state.session);
    if (rebuilt) setState(rebuilt);
    trackProductEvent("status_changed", { recommendationId: view.recommendation.id, opportunityId: view.recommendation.relatedOpportunityId, status: "interested" });
    setCompletionMessage("Tracked as active interest. UnlockED will use this when prioritizing future recommendations.");
  }

  if (loading) return <main className="min-h-[70vh] bg-paper px-5 py-16 sm:px-8"><section className="mx-auto max-w-6xl"><p className="rule-label text-forest">For You</p><div className="mt-6 h-16 max-w-2xl rounded-2xl bg-white/70" /><div className="mt-10 h-52 rounded-[2rem] bg-white/70" /></section></main>;
  if (!state || !top) return <main className="min-h-[70vh] bg-paper px-5 py-16 sm:px-8"><section className="mx-auto max-w-4xl"><p className="rule-label text-forest">For You</p><h1 className="mt-4 font-editorial text-5xl font-bold tracking-[-.045em]">Complete your profile first.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-ink/55">UnlockED needs your school, major, year, goals, and activity before it can recommend fitting opportunities.</p><Link href="/profile" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-ink">Open profile</Link></section></main>;

  return <main className="bg-[radial-gradient(circle_at_top_left,rgba(231,216,189,.45),transparent_34rem),#f6f0e6] px-5 py-10 sm:px-8 sm:py-14">
    <section className="mx-auto max-w-[112rem] space-y-10">
      <Hero state={state} firstName={firstName} />
      <TopRecommendation view={top} onTrack={() => trackRecommendation(top)} completionMessage={completionMessage} />
      <RecommendedGrid recommendations={recommended.slice(1, 5)} />
      <WhyRecommendations state={state} />
      <ActivityGlance activity={state.activity} />
      <FooterNote />
    </section>
  </main>;
}

function Hero({ state }: { state: AdvisorState; firstName: string }) {
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

function TopRecommendation({ view, onTrack, completionMessage }: { view: RecommendationViewModel; onTrack: () => void; completionMessage: string }) {
  const opportunity = view.opportunity;
  return <article className="rounded-[2rem] bg-white/48 p-6 shadow-[0_18px_60px_rgba(43,33,26,.045)] ring-1 ring-ink/6 sm:p-8">
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px_250px] lg:items-center">
      <div>{opportunity && <OrganizationLogo opportunity={opportunity} size="lg" className="mb-5 bg-white/70"/>}<p className="rule-label text-forest">Top recommendation · {view.recommendation.priority} priority</p><h2 className="mt-4 font-editorial text-4xl font-bold leading-tight tracking-[-.035em]">{opportunity?.title ?? view.recommendation.title}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-ink/62">{opportunity?.description ?? view.recommendation.description}</p>{view.chips.length ? <div className="mt-5 flex flex-wrap gap-2">{view.chips.map((chip) => <span key={chip} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink/70">{chip}</span>)}</div> : null}</div>
      <dl className="grid gap-5 border-ink/10 text-sm lg:border-l lg:pl-8"><div><dt className="text-ink/40">Deadline</dt><dd className="mt-1 font-black">{opportunity ? deadlineLabel(opportunity) : "Not announced"}</dd></div><div><dt className="text-ink/40">Est. effort</dt><dd className="mt-1 font-black">{view.recommendation.estimatedValueLabel === "Unknown" ? "Medium" : view.recommendation.estimatedValueLabel}</dd></div><div><dt className="text-ink/40">Match</dt><dd className="mt-1 font-black text-forest">{view.label}</dd></div></dl>
      <div className="flex flex-col gap-3"><Link href={view.href} onClick={() => trackProductEvent("recommendation_clicked", { recommendationId: view.recommendation.id, opportunityId: view.recommendation.relatedOpportunityId, section: "for-you" })} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-forest px-6 text-sm font-bold text-white shadow-[0_16px_34px_rgba(31,95,67,.18)] hover:bg-ink">Open opportunity <ArrowIcon /></Link><button type="button" onClick={onTrack} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-forest/35 bg-white px-6 text-sm font-bold text-forest hover:border-forest"><BookmarkIcon className="h-4 w-4" /> Track this</button></div>
    </div>
    {completionMessage && <p role="status" className="mt-5 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-forest">{completionMessage}</p>}
  </article>;
}

function RecommendedGrid({ recommendations }: { recommendations: RecommendationViewModel[] }) {
  return <section>
    <div className="mb-5 flex items-end justify-between gap-4"><h2 className="font-editorial text-3xl font-bold tracking-[-.025em]">Recommended for you</h2><span className="hidden rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-bold text-ink/55 sm:inline-flex">Most relevant</span></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{recommendations.map((view) => <RecommendationCard key={view.recommendation.id} view={view} />)}</div>
    <Link href="/opportunities" className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-full border border-ink/10 bg-white text-sm font-bold text-ink hover:border-forest hover:text-forest">View more opportunities <ArrowIcon /></Link>
  </section>;
}

function RecommendationCard({ view }: { view: RecommendationViewModel }) {
  const opportunity = view.opportunity;
  return <article className="flex min-h-96 flex-col rounded-[1.35rem] bg-white/92 p-5 shadow-[0_14px_42px_rgba(43,33,26,.055)] ring-1 ring-ink/7">
    <div className="flex items-start justify-between gap-3"><p className="rule-label text-forest">{opportunity?.type ?? view.recommendation.kind}</p><BookmarkIcon className="h-5 w-5 text-ink/45" /></div>
    <div className="mt-7 flex items-start gap-4">{opportunity && <OrganizationLogo opportunity={opportunity} size="md"/>}<div className="min-w-0"><h3 className="font-editorial text-2xl font-bold leading-tight">{opportunity?.title ?? view.recommendation.title}</h3><p className="mt-2 text-xs font-bold text-ink/40">{opportunity?.organization ?? view.recommendation.kind}</p></div></div>
    <div className="mt-4 flex-1"><p className="line-clamp-4 text-sm leading-6 text-ink/60">{opportunity?.description ?? view.recommendation.description}</p></div>
    <div className="mt-5 flex flex-wrap gap-2">{view.chips.slice(0, 2).map((chip) => <span key={chip} className="rounded-full bg-paper px-3 py-1 text-xs font-bold text-ink/65">{chip}</span>)}</div>
    <div className="mt-5 grid grid-cols-2 gap-3 border-t border-ink/8 pt-4 text-xs"><div><p className="text-ink/40">Deadline</p><p className="mt-1 font-black">{opportunity ? deadlineLabel(opportunity) : "Not announced"}</p></div><div className="text-right"><p className="text-ink/40">{view.label}</p><span className="mt-2 inline-block h-2 w-2 rounded-full bg-forest" /></div></div>
    <Link href={view.href} onClick={() => trackProductEvent("recommendation_clicked", { recommendationId: view.recommendation.id, opportunityId: view.recommendation.relatedOpportunityId, section: "for-you-card" })} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ink/15 text-sm font-bold text-ink hover:border-forest hover:text-forest">View details <ArrowIcon /></Link>
  </article>;
}

function WhyRecommendations({ state }: { state: AdvisorState }) {
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
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><ActivityCard label="Saved" value={saved} Icon={BookmarkIcon} text="Keep exploring" /><ActivityCard label="Applied" value={applied} Icon={SendIcon} text="Take the next step" /><ActivityCard label="Interviews" value={interviews} Icon={TargetIcon} text="You’ve got this" /><div className="rounded-[1.35rem] bg-forest/8 p-6 ring-1 ring-forest/10"><h3 className="font-editorial text-2xl font-bold text-forest">Stay consistent</h3><p className="mt-3 text-sm leading-6 text-ink/60">Your recommendations improve as you save, review, and track opportunities that fit.</p><Link href="/opportunities" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-forest px-5 text-sm font-bold text-white">Explore more</Link></div></div>
  </section>;
}

function ActivityCard({ label, value, Icon, text }: { label: string; value: number; Icon: typeof BookmarkIcon; text: string }) {
  return <div className="rounded-[1.35rem] bg-white/88 p-6 shadow-[0_14px_42px_rgba(43,33,26,.045)] ring-1 ring-ink/7"><span className="grid h-14 w-14 place-items-center rounded-full bg-forest/10 text-forest"><Icon className="h-6 w-6" /></span><p className="mt-4 font-editorial text-4xl font-bold text-ink">{value}</p><p className="font-bold text-ink/70">{label}</p><p className="mt-1 text-sm text-forest">{text}</p></div>;
}

function FooterNote() {
  return <div className="flex flex-col gap-3 border-t border-ink/10 pt-6 text-sm text-ink/50 sm:flex-row sm:items-center sm:justify-between"><p>Recommendations update as your profile and activity grow.</p><Link href="/help" className="font-bold text-forest hover:text-ink">Learn how we match opportunities <ArrowIcon className="inline h-3.5 w-3.5" /></Link></div>;
}
