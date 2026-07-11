"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readStudentProfile, writeStudentProfile, type StudentProfile } from "@/data/student-profile";
import { readAccountSession, hydrateAccountData } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";
import { AccountButton } from "./account-auth";
import { StudentProfileForm } from "./personalized-home";
import { isProUser } from "@/lib/billing";
import { schools } from "@/data/seed";
import { opportunities } from "@/data/opportunities";
import { createAdvisorProfile } from "@/data/advisor-engine";
import { buildAdvisorBrain, type AdvisorBrainDashboard } from "@/data/advisor-brain";
import { inferApplicationsFromActivity, readStudentProgress } from "@/data/student-progress";
import { readStudentActivity } from "@/data/student-activity";

type BillingAvailability = {
  checkoutConfigured: boolean;
  portalConfigured: boolean;
  webhookConfigured: boolean;
  developmentWarning: string;
};

export function ProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null | undefined>(undefined);
  const [session, setSession] = useState<AccountSession | null>(null);
  const [accountError, setAccountError] = useState("");
  const [billingAvailability, setBillingAvailability] = useState<BillingAvailability | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "advisor">("edit");
  useEffect(() => {
    setProfile(readStudentProfile());
    hydrateAccountData().then(() => { setProfile(readStudentProfile()); return readAccountSession(); }).then(setSession).catch(() => { setAccountError("Account status could not be loaded."); setSession({ authenticated: false, user: null, data: null }); });
    fetch("/api/billing/config", { cache: "no-store" }).then((response)=>response.ok?response.json():null).then(setBillingAvailability).catch(()=>setBillingAvailability(null));
  }, []);
  if (profile === undefined) return <div className="min-h-[60vh]" />;
  const billing = session?.data?.billing;
  const pro = isProUser(billing);
  return <div>
    <section className="px-5 pt-8 sm:px-8 sm:pt-10">
      <div className="mx-auto grid max-w-5xl gap-5 border-b border-ink/15 pb-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <p className="rule-label text-forest">UnlockED account</p>
          <h1 className="mt-2 font-editorial text-3xl font-bold">Edit profile</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/50">{!session ? "Loading your account..." : session.authenticated ? `Signed in as ${session.user?.email}. Changes save to your dashboard.` : "Your session has ended. Return home to sign in again."}</p>
          {accountError && <p className="mt-2 text-xs font-bold text-red-700">{accountError}</p>}
        </div>
        <AccountButton />
      </div>
    </section>
    <section className="px-5 pt-6 sm:px-8">
      <div className="mx-auto max-w-5xl rounded-[2rem] bg-white p-5 shadow-soft ring-1 ring-ink/8 sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="rule-label text-forest">Billing</p>
            <h2 className="mt-2 font-editorial text-2xl font-bold">Current plan: {pro ? "Pro" : "Free"}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/50">Free users keep access to the normal UnlockED product. Pro is a placeholder plan for future paid features.</p>
            {billing?.status && <p className="mt-2 text-xs font-bold uppercase tracking-wider text-ink/35">Subscription status: {billing.status.replaceAll("_"," ")}</p>}
            {billingAvailability?.developmentWarning && <p className="mt-3 max-w-2xl rounded-2xl bg-paper px-4 py-3 text-xs font-bold leading-5 text-ink/55">{billingAvailability.developmentWarning}</p>}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            {!pro && billingAvailability?.checkoutConfigured ? <form action="/api/billing/checkout" method="post"><button className="min-h-11 w-full rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-ink">Upgrade to Pro</button></form> : null}
            {billing?.stripeCustomerId && billingAvailability?.portalConfigured ? <form action="/api/billing/portal" method="post"><button className="min-h-11 w-full rounded-full border border-ink/15 px-5 text-sm font-bold text-ink/60 hover:border-forest hover:text-forest">Manage billing</button></form> : null}
          </div>
        </div>
      </div>
    </section>
    <section className="px-5 pt-6 sm:px-8">
      <div className="mx-auto flex max-w-5xl gap-2 border-b border-ink/10">
        <button type="button" onClick={()=>setActiveTab("edit")} className={`px-4 py-3 text-sm font-bold ${activeTab==="edit"?"border-b-2 border-forest text-forest":"text-ink/45 hover:text-forest"}`}>Edit Profile</button>
        <button type="button" onClick={()=>setActiveTab("advisor")} className={`px-4 py-3 text-sm font-bold ${activeTab==="advisor"?"border-b-2 border-forest text-forest":"text-ink/45 hover:text-forest"}`}>Advisor Brain</button>
      </div>
    </section>
    {activeTab === "edit" ? <StudentProfileForm mode="edit" session={session} initialProfile={profile} onSave={async (next)=>{await writeStudentProfile(next);setProfile(next);setSaved(true)}}/> : <AdvisorBrainProfileTab profile={profile} session={session} />}
    {saved&&<div role="status" className="fixed bottom-5 left-5 right-5 z-40 border-2 border-ink bg-white px-5 py-3 text-sm font-bold shadow-[4px_4px_0_#2b211a] sm:left-auto">Profile saved. <Link href="/" className="ml-2 border-b border-forest text-forest">Return to dashboard</Link></div>}
  </div>;
}

function profileBrain(profile: StudentProfile | null, session: AccountSession | null): AdvisorBrainDashboard | null {
  if (!profile) return null;
  const school = schools.find((item) => item.slug === profile.schoolSlug);
  if (!school) return null;
  const accountActivity = session?.data?.activity;
  const activity = accountActivity ?? readStudentActivity();
  const progress = inferApplicationsFromActivity(activity, opportunities, readStudentProgress());
  const advisorProfile = createAdvisorProfile({ profile, school, activity, progress });
  return buildAdvisorBrain({ advisorProfile, opportunities, progress });
}

function AdvisorBrainProfileTab({ profile, session }: { profile: StudentProfile | null; session: AccountSession | null }) {
  const brain = profileBrain(profile, session);
  if (!brain) return <main className="px-5 py-10 sm:px-8 sm:py-14"><section className="mx-auto max-w-5xl"><p className="rule-label text-forest">Advisor Brain</p><h1 className="mt-3 font-editorial text-4xl font-bold tracking-[-.03em]">Complete your profile first.</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-ink/50">UnlockED needs your school, major, graduation year, goals, and interests before it can build a Student Digital Twin.</p></section></main>;
  const twin = brain.twin;
  const evidence = brain.evidenceInventory;
  const coverage = brain.interview.competencyCoverage;
  const bottlenecks = evidence.gaps.slice(0, 5);
  return <main className="px-5 py-10 sm:px-8 sm:py-14">
    <section className="mx-auto max-w-5xl">
      <p className="rule-label text-forest">Advisor Brain</p>
      <h1 className="mt-3 font-editorial text-4xl font-bold tracking-[-.03em] sm:text-5xl">Your Student Digital Twin.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/55">{twin.profile.academicYear} {twin.profile.major} student at {twin.profile.school}. Current direction: {twin.profile.careerGoal || "still exploring"}.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[2rem] bg-white p-6 shadow-soft ring-1 ring-ink/8">
          <p className="rule-label text-forest">Evidence inventory</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {Object.entries(evidence.summary).map(([dimension, summary]) => <div key={dimension} className="rounded-2xl bg-paper p-4">
              <p className="text-sm font-bold capitalize">{dimension.replaceAll("-", " ")}</p>
              <p className="mt-2 text-xs leading-5 text-ink/50">Level {summary.level}/4 · {summary.supportCount} source(s) · {summary.confidence} confidence</p>
            </div>)}
          </div>
        </section>
        <aside className="space-y-6">
          <section className="rounded-[2rem] bg-paper p-6">
            <p className="rule-label text-forest">Current bottlenecks</p>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-ink/60">{bottlenecks.map((item)=><li key={item}>{item.replaceAll("-", " ")}</li>)}</ul>
          </section>
          <section className="rounded-[2rem] bg-paper p-6">
            <p className="rule-label text-forest">Confidence levels</p>
            <p className="mt-3 text-sm leading-6 text-ink/55">Interview readiness: {brain.interview.readinessScore}/100 · {brain.interview.readinessStage}</p>
            <p className="mt-2 text-sm leading-6 text-ink/55">Generated from {evidence.items.length} evidence item(s), saved activity, roadmap progress, and structured recommendations.</p>
          </section>
        </aside>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ProfileBrainPanel title="Competency coverage" values={Object.entries(coverage).map(([name, item])=>`${name.replaceAll("-", " ")}: ${item.covered ? "covered" : "missing"} (${item.confidence})`)} />
        <ProfileBrainPanel title="Skill graph" values={brain.readinessScores.map((score)=>`${score.category}: ${score.score}/100`)} />
        <ProfileBrainPanel title="Career trajectory" values={[brain.highestImpactAction?.nextAction ?? "Keep building evidence before applying widely.", brain.biggestCareerGap.howToClose, brain.interview.nextAction]} />
      </div>
      <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-soft ring-1 ring-ink/8">
        <p className="rule-label text-forest">Interview Intelligence</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ProfileBrainPanel title="Competencies covered" values={Object.entries(coverage).filter(([, item])=>item.covered).map(([name, item])=>`${name.replaceAll("-", " ")} · ${item.confidence}`).concat(Object.values(coverage).some((item)=>item.covered) ? [] : ["No interview competency has enough evidence yet."])} />
          <ProfileBrainPanel title="Missing stories" values={brain.interview.risks.length ? brain.interview.risks : ["No major missing story risk detected from current evidence."]} />
          <ProfileBrainPanel title="Practice priority" values={[brain.interview.primaryRecommendation, brain.interview.nextAction]} />
          <ProfileBrainPanel title="STAR quality" values={brain.interview.storyEvaluations.length ? brain.interview.storyEvaluations.map((story)=>`${story.title}: ${story.starCompleteness}/100`) : [`Current inferred interview readiness: ${brain.interview.readinessScore}/100`]} />
          <ProfileBrainPanel title="Suggested improvements" values={brain.interview.practicePlan.length ? brain.interview.practicePlan.map((item)=>item.title) : [brain.interview.nextAction]} />
        </div>
      </section>
    </section>
  </main>;
}

function ProfileBrainPanel({ title, values }: { title: string; values: string[] }) {
  return <section className="rounded-[2rem] bg-paper p-6"><p className="rule-label text-forest">{title}</p><ul className="mt-4 space-y-2 text-sm leading-6 text-ink/60">{values.map((value)=><li key={value}>{value}</li>)}</ul></section>;
}
