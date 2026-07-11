"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { hydrateAccountData } from "@/data/account-sync";
import { createAdvisorProfile } from "@/data/advisor-engine";
import { buildAdvisorBrain, type AdvisorBrainDashboard } from "@/data/advisor-brain";
import { deadlineLabel, opportunities } from "@/data/opportunities";
import type { RecommendationV1 } from "@/data/recommendation-engine";
import { schools } from "@/data/seed";
import { readStudentActivity, type StudentActivity } from "@/data/student-activity";
import { inferApplicationsFromActivity, markMilestoneCompleted, readStudentProgress, updateApplicationStatus, writeStudentProgress, type StudentProgress } from "@/data/student-progress";
import type { StudentProfile } from "@/data/student-profile";
import type { AccountSession } from "@/lib/account-types";
import { getAdvisorAccessState, type AdvisorAccessState } from "@/lib/advisor-access";
import { trackProductEvent } from "@/data/product-analytics";

type AdvisorState = {
  profile: StudentProfile;
  activity: StudentActivity;
  progress: StudentProgress;
  session: AccountSession;
  brain: AdvisorBrainDashboard;
  access: AdvisorAccessState;
};

function buildState(profile: StudentProfile, activity: StudentActivity, progress: StudentProgress, session: AccountSession): AdvisorState | null {
  const school = schools.find((item) => item.slug === profile.schoolSlug);
  if (!school) return null;
  const inferredProgress = inferApplicationsFromActivity(activity, opportunities, progress);
  const advisorProfile = createAdvisorProfile({ profile, school, activity, progress: inferredProgress });
  return {
    profile,
    activity,
    progress: inferredProgress,
    session,
    brain: buildAdvisorBrain({ advisorProfile, opportunities, progress: inferredProgress }),
    access: getAdvisorAccessState({ authenticated: session.authenticated, profileComplete: Boolean(session.data?.onboardingComplete), billing: session.data?.billing }),
  };
}

function opportunityHref(recommendation?: RecommendationV1) {
  if (recommendation?.relatedOpportunityId) return `/opportunities/${recommendation.relatedOpportunityId}`;
  const category = recommendation?.categories[0];
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (recommendation?.kind === "Opportunity") params.set("query", recommendation.title);
  return `/opportunities${params.size ? `?${params.toString()}` : ""}`;
}

export function AdvisorPage() {
  const [state, setState] = useState<AdvisorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<RecommendationV1 | null>(null);
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

  const recommendation = state?.brain.recommendations[0] ?? null;
  const nextRecommendation = state?.brain.recommendations.find((item) => item.id !== completed?.id) ?? null;
  const relatedOpportunity = recommendation?.relatedOpportunityId ? opportunities.find((item) => item.id === recommendation.relatedOpportunityId) : null;
  const evidenceCount = state?.brain.evidenceInventory.items.length ?? 0;

  useEffect(() => {
    if (!recommendation || trackedRecommendation.current === recommendation.id) return;
    trackedRecommendation.current = recommendation.id;
    trackProductEvent("for_you_opened");
    trackProductEvent("recommendation_viewed", { recommendationId: recommendation.id, section: "for-you" });
  }, [recommendation]);

  const completeRecommendation = () => {
    if (!state || !recommendation) return;
    let nextProgress = state.progress;
    if (recommendation.relatedMilestoneId) {
      nextProgress = markMilestoneCompleted(nextProgress, recommendation.relatedMilestoneId, `Completed from Advisor: ${recommendation.title}`, "manual");
    } else if (recommendation.relatedOpportunityId) {
      nextProgress = updateApplicationStatus(nextProgress, recommendation.relatedOpportunityId, "interested", {
        nextAction: "Review the official source and decide whether to apply.",
        source: "manual",
      });
    }
    const stored = writeStudentProgress(nextProgress);
    const rebuilt = buildState(state.profile, state.activity, stored, state.session);
    if (rebuilt) setState(rebuilt);
    setCompleted(recommendation);
    trackProductEvent(recommendation.relatedMilestoneId ? "milestone_completed" : "status_changed", { recommendationId: recommendation.id, milestoneId: recommendation.relatedMilestoneId, opportunityId: recommendation.relatedOpportunityId, status: recommendation.relatedMilestoneId ? "completed" : "interested" });
    setCompletionMessage(recommendation.relatedMilestoneId ? "Marked complete. UnlockED added milestone evidence to your progress." : "Saved as active interest. UnlockED will treat this as an opportunity you are considering.");
  };

  if (loading) return <main className="min-h-[70vh] bg-white px-5 py-16 sm:px-8"><section className="mx-auto max-w-4xl"><p className="rule-label text-forest">For You</p><div className="mt-6 h-12 max-w-2xl rounded-2xl bg-paper" /><div className="mt-4 h-4 max-w-xl rounded-full bg-paper" /><div className="mt-10 h-44 rounded-[2rem] bg-paper" /></section></main>;
  if (!state || !recommendation) return <main className="min-h-[70vh] bg-white px-5 py-16 sm:px-8"><section className="mx-auto max-w-4xl"><p className="rule-label text-forest">For You</p><h1 className="mt-4 font-editorial text-5xl font-bold tracking-[-.045em]">Complete your profile first.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-ink/55">UnlockED needs your school, major, year, goals, and activity before it can recommend fitting opportunities.</p><Link href="/profile" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-ink">Open profile</Link></section></main>;

  return <main className="bg-white px-5 py-12 sm:px-8 sm:py-16">
    <section className="mx-auto max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="rule-label text-forest">For You</p>
          <h1 className="mt-4 font-editorial text-5xl font-bold leading-[1] tracking-[-.05em] sm:text-7xl">Opportunities selected around you.</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-ink/55">Personalized matches from your profile, saved activity, eligibility signals, and the UnlockED opportunity database.</p>
        </div>
        <AdvisorAccessBadge access={state.access} />
      </div>

      <article className="mt-12 rounded-[2rem] bg-paper px-5 py-8 sm:px-8 sm:py-10">
        <p className="rule-label text-forest">{recommendation.priority} priority</p>
        <h2 className="mt-3 font-editorial text-4xl font-bold leading-tight tracking-[-.035em] sm:text-5xl">{recommendation.title}</h2>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-ink/60">{recommendation.nextAction}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href={opportunityHref(recommendation)} onClick={() => trackProductEvent("recommendation_clicked", { recommendationId: recommendation.id, opportunityId: recommendation.relatedOpportunityId, section: "for-you" })} className="inline-flex min-h-12 items-center justify-center rounded-full bg-forest px-6 text-sm font-bold text-white transition hover:bg-ink">{relatedOpportunity ? "Open opportunity" : "Find matching opportunities"}</Link>
          <button type="button" onClick={completeRecommendation} className="inline-flex min-h-12 items-center justify-center rounded-full border border-forest/25 px-6 text-sm font-bold text-forest transition hover:border-forest hover:bg-white">Track this</button>
        </div>
        {completionMessage && <div role="status" className="mt-6 rounded-[1.5rem] bg-white px-5 py-4 text-sm leading-6 text-ink/60"><p className="font-bold text-forest">Completed.</p><p className="mt-1">{completionMessage}</p>{nextRecommendation && <p className="mt-3"><span className="font-bold text-ink/75">Next recommendation after this:</span> {nextRecommendation.title}</p>}</div>}
      </article>

      <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          <InfoBlock title="Why it fits" values={recommendation.reasons.slice(0, 4)} />
          <details className="rounded-[1.5rem] bg-paper px-5 py-5">
            <summary className="cursor-pointer text-sm font-bold text-forest">Evidence and confidence</summary>
            <div className="mt-4 space-y-4 text-sm leading-6 text-ink/55">
              <p>{recommendation.confidence}% confidence from structured matching. This is not a prediction of selection.</p>
              <InfoBlock title="Evidence used" values={state.brain.highestImpactAction?.evidenceUsed.slice(0, 4) ?? ["Saved profile and opportunity matching."]} compact />
              <InfoBlock title="Tradeoffs" values={state.brain.highestImpactAction?.tradeoffs ?? ["Confirm eligibility and deadline on the official source."]} compact />
            </div>
          </details>
          <details className="rounded-[1.5rem] bg-paper px-5 py-5">
            <summary className="cursor-pointer text-sm font-bold text-forest">Alternatives</summary>
            <div className="mt-4 divide-y divide-ink/10">{state.brain.recommendations.slice(1, 4).map((item) => <Link key={item.id} href={opportunityHref(item)} className="block py-4 hover:text-forest"><span className="block font-editorial text-xl font-bold">{item.title}</span><span className="mt-1 block text-xs font-bold uppercase tracking-wider text-ink/35">{item.priority} · {item.confidence}% confidence</span></Link>)}</div>
          </details>
        </div>
        <aside className="h-fit rounded-[2rem] bg-white p-5 shadow-soft ring-1 ring-ink/8">
          <p className="rule-label text-forest">Match context</p>
          <dl className="mt-4 space-y-4 text-sm">
            <div><dt className="text-ink/40">Evidence items</dt><dd className="mt-1 font-bold">{evidenceCount}</dd></div>
            <div><dt className="text-ink/40">Main gap</dt><dd className="mt-1 font-bold">{state.brain.biggestCareerGap.title}</dd></div>
            <div><dt className="text-ink/40">Estimated value</dt><dd className="mt-1 font-bold">{recommendation.estimatedValueLabel}</dd></div>
            {relatedOpportunity && <div><dt className="text-ink/40">Deadline</dt><dd className="mt-1 font-bold">{deadlineLabel(relatedOpportunity)}</dd></div>}
          </dl>
        </aside>
      </section>
    </section>
  </main>;
}

function AdvisorAccessBadge({ access }: { access: AdvisorAccessState }) {
  const copy = access === "pro" ? "Pro For You" : access === "preview" ? "Preview" : access === "free" ? "Free" : "Needs profile";
  return <span className="inline-flex w-fit rounded-full bg-paper px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink/45">{copy}</span>;
}

function InfoBlock({ title, values, compact = false }: { title: string; values: string[]; compact?: boolean }) {
  return <section className={compact ? "" : "rounded-[1.5rem] bg-paper px-5 py-5"}><p className="rule-label text-forest">{title}</p><ul className="mt-3 space-y-2 text-sm leading-6 text-ink/60">{values.map((value) => <li key={value}>{value}</li>)}</ul></section>;
}
