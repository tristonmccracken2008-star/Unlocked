"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { schools, type School } from "@/data/seed";
import { advisorProfileUpdatedMessageKey, type StudentProfile } from "@/data/student-profile";
import type { AccountSession } from "@/lib/account-types";
import { expiringSoonOpportunities, type RecommendationProfile } from "@/data/recommendations";
import { deadlineLabel, opportunities, type Opportunity } from "@/data/opportunities";
import { readStudentActivity, studentActivityEvent, type StudentActivity } from "@/data/student-activity";
import { trackProductEvent } from "@/data/product-analytics";
import { createAdvisorProfile } from "@/data/advisor-engine";
import { inferApplicationsFromActivity, readStudentProgress, studentProgressEvent, type StudentProgress } from "@/data/student-progress";
import { buildAdvisorBrain } from "@/data/advisor-brain";
import type { RecommendationV1 } from "@/data/recommendation-engine";
import { buildJourneyMilestones, buildJourneyRecap, type JourneyMilestone, type JourneyRecap } from "@/data/journey";
import { ArrowIcon } from "./icons";

function displayName(profile: StudentProfile, session: AccountSession | null) {
  return profile.firstName?.trim() || session?.user?.name?.split(" ")[0] || "there";
}

function recommendationProfile(profile: StudentProfile, school: School, activity?: StudentActivity): RecommendationProfile {
  return { schoolSlug: school.slug, schoolName: school.name, schoolLocation: school.location, major: profile.major, minor: profile.minor, academicYear: profile.year, interests: profile.interests, careerGoals: profile.careerGoal, clubs: profile.clubs, savedOpportunityIds: activity?.saved, viewedOpportunityIds: activity?.viewed };
}

export function StudentDashboard({ profile, session, syncError }: { profile: StudentProfile; session: AccountSession | null; syncError: string }) {
  const [activity, setActivity] = useState<StudentActivity>({ viewed: [], saved: [], claimed: [], tracked: {} });
  const [progress, setProgress] = useState<StudentProgress>({ milestones: {}, applications: {} });
  const [profileUpdateMessage, setProfileUpdateMessage] = useState("");
  useEffect(() => {
    const message = localStorage.getItem(advisorProfileUpdatedMessageKey);
    if (!message) return;
    setProfileUpdateMessage(message);
    localStorage.removeItem(advisorProfileUpdatedMessageKey);
  }, []);
  useEffect(() => {
    const update = () => setActivity(readStudentActivity());
    update();
    window.addEventListener(studentActivityEvent, update);
    return () => window.removeEventListener(studentActivityEvent, update);
  }, []);
  useEffect(() => {
    const update = () => setProgress(readStudentProgress());
    update();
    window.addEventListener(studentProgressEvent, update);
    return () => window.removeEventListener(studentProgressEvent, update);
  }, []);
  const school = schools.find((item) => item.slug === profile.schoolSlug);
  if (!school) return null;
  const input = recommendationProfile(profile, school, activity);
  const deadlines = expiringSoonOpportunities(input, 4, 90).map(({ opportunity }) => opportunity);
  const trackedRecords = Object.values(activity.tracked ?? {});
  const saved = trackedRecords.map((record) => opportunities.find((item) => item.id === record.id)).filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 3);
  const firstName = displayName(profile, session);
  const inferredProgress = inferApplicationsFromActivity(activity, opportunities, progress);
  const advisorProfile = createAdvisorProfile({ profile, school, activity, progress: inferredProgress });
  const advisorUx = buildAdvisorBrain({ advisorProfile, opportunities, progress: inferredProgress });
  const nextRecommended = advisorUx.recommendations.slice(1, 3);
  const milestones = buildJourneyMilestones({ profile, activity, progress: inferredProgress, opportunities });
  const recap = buildJourneyRecap({ activity, milestones, opportunities });

  return <main className="bg-white px-5 py-12 sm:px-8 sm:py-16">
    <div className="mx-auto max-w-6xl">
      <JourneyHeader firstName={firstName} profile={profile} school={school} syncError={syncError} profileUpdateMessage={profileUpdateMessage} />
      <JourneyProgress recap={recap} milestones={milestones} />
      <JourneyTracker saved={saved} deadlines={deadlines} recommendations={nextRecommended} />
      <JourneyRecapCard firstName={firstName} schoolName={school.name} recap={recap} />
    </div>
  </main>;
}

function JourneyHeader({ firstName, profile, school, syncError, profileUpdateMessage }: { firstName: string; profile: StudentProfile; school: School; syncError: string; profileUpdateMessage: string }) {
  const initials = `${profile.firstName?.[0] ?? firstName[0] ?? "U"}${profile.lastName?.[0] ?? ""}`.toUpperCase();
  return <section className="pb-10">
    <div className="rounded-[2rem] bg-paper px-5 py-7 sm:px-8 sm:py-9">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-forest font-editorial text-3xl font-bold text-white">{initials}</div>
          <div>
            <p className="rule-label text-forest">Journey</p>
            <h1 className="mt-2 font-editorial text-4xl font-bold tracking-[-.04em] sm:text-6xl">{firstName}&apos;s college journey</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/55">{school.name} · {profile.major}{profile.graduationYear ? ` · Class of ${profile.graduationYear}` : ""}</p>
          </div>
        </div>
        <Link href="/profile" className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/10 px-5 text-sm font-bold text-ink/55 hover:border-forest hover:text-forest">Edit profile</Link>
      </div>
      {profile.interests && <p className="mt-6 max-w-3xl text-sm leading-7 text-ink/55">{profile.interests}</p>}
      {syncError && <p className="mt-3 text-sm font-bold text-red-700">{syncError}</p>}
      {profileUpdateMessage && <p role="status" className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold text-forest">{profileUpdateMessage}</p>}
    </div>
  </section>;
}

function JourneyProgress({ recap, milestones }: { recap: JourneyRecap; milestones: JourneyMilestone[] }) {
  return <section className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
    <div className="rounded-[2rem] bg-white p-6 shadow-soft ring-1 ring-ink/8">
      <p className="rule-label text-forest">Progress so far</p>
      <dl className="mt-5 grid grid-cols-2 gap-4">
        <JourneyStat label="Saved" value={recap.opportunitiesSaved} />
        <JourneyStat label="Applied" value={recap.applicationsSubmitted} />
        <JourneyStat label="Interviews" value={recap.interviewsReached} />
        <JourneyStat label="Completed" value={recap.completedOpportunities} />
      </dl>
    </div>
    <div className="rounded-[2rem] bg-paper p-6">
      <p className="rule-label text-forest">Timeline</p>
      {milestones.length ? <ol className="mt-5 space-y-4">{milestones.slice(0, 5).map((item) => <li key={item.id} className="border-l-2 border-forest/25 pl-4"><p className="font-editorial text-xl font-bold">{item.title}</p><p className="mt-1 text-sm leading-6 text-ink/55">{item.description}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-ink/35">{new Date(item.date).toLocaleDateString()}</p></li>)}</ol> : <EmptyState title="Your timeline starts here" text="Save or track an opportunity and your real progress will appear here." actionHref="/opportunities" actionLabel="Open Discover" />}
    </div>
  </section>;
}

function JourneyStat({ label, value }: { label: string; value: number }) {
  return <div><dt className="rule-label text-ink/35">{label}</dt><dd className="mt-1 font-editorial text-4xl font-bold text-forest">{value}</dd></div>;
}

function JourneyTracker({ saved, deadlines, recommendations }: { saved: Opportunity[]; deadlines: Opportunity[]; recommendations: RecommendationV1[] }) {
  return <section className="mt-10 grid gap-8 lg:grid-cols-2">
    <div>
      <div className="mb-3 flex items-center justify-between"><h2 className="font-editorial text-3xl font-bold tracking-[-.025em]">Active opportunities</h2><Link href="/my-opportunities" className="text-sm font-bold text-forest">Open tracker</Link></div>
      {saved.length ? <div className="divide-y divide-ink/10">{saved.map((item) => <OpportunityRow key={item.id} opportunity={item} detail={deadlineLabel(item)} />)}</div> : <EmptyState title="Nothing tracked yet" text="Save an opportunity from Discover to begin your Journey." actionHref="/opportunities" actionLabel="Open Discover" />}
    </div>
    <div>
      <h2 className="mb-3 font-editorial text-3xl font-bold tracking-[-.025em]">Next to review</h2>
      {recommendations.length ? <div className="divide-y divide-ink/10">{recommendations.map((recommendation) => <AdvisorRecommendationRow key={recommendation.id} recommendation={recommendation} />)}</div> : deadlines.length ? <div className="divide-y divide-ink/10">{deadlines.slice(0,2).map((item) => <OpportunityRow key={item.id} opportunity={item} detail={deadlineLabel(item)} />)}</div> : <EmptyState title="No urgent next step" text="Your saved opportunities and deadlines will guide this section." />}
    </div>
  </section>;
}

function JourneyRecapCard({ firstName, schoolName, recap }: { firstName: string; schoolName: string; recap: JourneyRecap }) {
  const [copied, setCopied] = useState(false);
  const shareText = `${firstName}'s UnlockED Journey: ${recap.opportunitiesSaved} saved, ${recap.applicationsSubmitted} applications tracked${recap.biggestMilestone ? `, latest milestone: ${recap.biggestMilestone.title}` : ""}.`;
  useEffect(() => { trackProductEvent("recap_viewed"); }, []);
  async function share() {
    trackProductEvent("share_card_generated");
    if (navigator.share) {
      await navigator.share({ title: "UnlockED Journey", text: shareText }).then(()=>{ trackProductEvent("share_initiated"); trackProductEvent("share_completed"); }).catch(()=>undefined);
      return;
    }
    await navigator.clipboard?.writeText(shareText).catch(()=>undefined);
    setCopied(true);
    trackProductEvent("share_initiated");
    trackProductEvent("share_completed");
  }
  return <section className="mt-10 rounded-[2rem] bg-ink p-5 text-white sm:p-7">
    <div className="mx-auto max-w-sm rounded-[2rem] bg-paper p-6 text-ink">
      <p className="rule-label text-forest">UnlockED Journey Recap</p>
      <h2 className="mt-4 font-editorial text-4xl font-bold tracking-[-.04em]">{firstName} is building momentum.</h2>
      <p className="mt-3 text-sm leading-6 text-ink/55">{schoolName}</p>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <JourneyStat label="Saved" value={recap.opportunitiesSaved} />
        <JourneyStat label="Applied" value={recap.applicationsSubmitted} />
      </div>
      <p className="mt-6 text-sm leading-6 text-ink/60">{recap.biggestMilestone ? recap.biggestMilestone.title : "Start tracking opportunities to unlock your first recap milestone."}</p>
    </div>
    <div className="mt-5 flex justify-center"><button type="button" onClick={()=>void share()} className="min-h-11 rounded-full bg-white px-5 text-sm font-bold text-ink hover:bg-paper">{copied ? "Copied recap" : "Share recap"}</button></div>
  </section>;
}

function OpportunityRow({ opportunity, detail }: { opportunity: Opportunity; detail: string }) {
  return <Link href={`/opportunities/${opportunity.id}`} className="group grid gap-2 rounded-2xl px-1 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
    <div className="min-w-0">
      <p className="rule-label text-forest">{opportunity.type}</p>
      <h3 className="mt-1 font-editorial text-xl font-bold group-hover:text-forest">{opportunity.title}</h3>
      <p className="mt-1 text-xs text-ink/45">{detail}</p>
    </div>
    <ArrowIcon className="h-4 w-4 text-ink/30 group-hover:text-forest"/>
  </Link>;
}

function AdvisorRecommendationRow({ recommendation }: { recommendation: RecommendationV1 }) {
  const href = recommendation.relatedOpportunityId ? `/opportunities/${recommendation.relatedOpportunityId}` : "/opportunities";
  return <article className="group rounded-2xl px-1 py-4">
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="min-w-0">
        <p className="rule-label text-forest">{recommendation.priority} · {recommendation.kind}</p>
        <h3 className="mt-1 font-editorial text-xl font-bold group-hover:text-forest">{recommendation.title}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/55">{recommendation.reason}</p>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-forest">Why this?</summary>
          <div className="mt-3 grid gap-3 text-xs leading-5 text-ink/50 md:grid-cols-3">
            <div><p className="font-bold uppercase tracking-wider text-ink/35">Evidence used</p><ul className="mt-2 space-y-1">{recommendation.reasons.slice(0, 3).map((item)=><li key={item}>{item}</li>)}</ul></div>
            <div><p className="font-bold uppercase tracking-wider text-ink/35">Expected impact</p><p className="mt-2">{recommendation.nextAction}</p></div>
            <div><p className="font-bold uppercase tracking-wider text-ink/35">Tradeoffs</p><p className="mt-2">{recommendation.estimatedValueLabel === "Unknown" ? "Value is unknown; confirm details on the official source." : `Estimated value: ${recommendation.estimatedValueLabel}.`} Selection and deadlines are controlled by the provider.</p></div>
          </div>
        </details>
      </div>
      <div className="flex items-center gap-4 sm:flex-col sm:items-end">
        <p className="text-xs font-bold uppercase tracking-wider text-ink/35">{recommendation.confidence}% confidence</p>
        <Link href={href} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-forest hover:text-ink">Open <ArrowIcon/></Link>
      </div>
    </div>
  </article>;
}

function EmptyState({ title, text, actionHref, actionLabel }: { title: string; text: string; actionHref?: string; actionLabel?: string }) {
  return <div className="py-6"><p className="font-editorial text-2xl font-bold">{title}</p><p className="mt-2 max-w-md text-sm leading-6 text-ink/45">{text}</p>{actionHref && actionLabel && <Link href={actionHref} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-bold text-white hover:bg-forest">{actionLabel}</Link>}</div>;
}
