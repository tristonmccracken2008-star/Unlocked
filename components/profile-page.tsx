"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { readStudentProfile, writeStudentProfile, type StudentProfile } from "@/data/student-profile";
import { hydrateAccountData } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";
import { AccountButton } from "./account-auth";
import { StudentProfileForm } from "./personalized-home";
import { isProUser } from "@/lib/billing";

const AdvisorBrainProfileTab = dynamic(() => import("./profile-career-tab").then((module) => module.AdvisorBrainProfileTab), {
  ssr: false,
  loading: () => <main className="px-5 py-10 sm:px-8 sm:py-14"><section className="mx-auto max-w-5xl"><p className="rule-label text-forest">Career Profile</p><div className="mt-4 h-10 max-w-xl rounded-full bg-paper"/><div className="mt-4 h-4 max-w-2xl rounded-full bg-paper"/></section></main>,
});

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
    hydrateAccountData().then((nextSession) => { setProfile(readStudentProfile()); return nextSession; }).then(setSession).catch(() => { setAccountError("Account status could not be loaded."); setSession({ authenticated: false, user: null, data: null }); });
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
        <button type="button" onClick={()=>setActiveTab("advisor")} className={`px-4 py-3 text-sm font-bold ${activeTab==="advisor"?"border-b-2 border-forest text-forest":"text-ink/45 hover:text-forest"}`}>Career Profile</button>
      </div>
    </section>
    {activeTab === "edit" ? <StudentProfileForm mode="edit" session={session} initialProfile={profile} onSave={async (next)=>{await writeStudentProfile(next);setProfile(next);setSaved(true)}}/> : <AdvisorBrainProfileTab profile={profile} session={session} />}
    {saved&&<div role="status" className="fixed bottom-5 left-5 right-5 z-40 border-2 border-ink bg-white px-5 py-3 text-sm font-bold shadow-[4px_4px_0_#2b211a] sm:left-auto">Profile saved. <Link href="/" className="ml-2 border-b border-forest text-forest">Return to dashboard</Link></div>}
  </div>;
}
