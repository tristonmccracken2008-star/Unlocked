"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { readStudentProfile, writeStudentProfile, type StudentProfile } from "@/data/student-profile";
import { hydrateAccountData, pushAccountData } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";
import { AccountButton } from "./account-auth";
import { StudentProfileForm } from "./personalized-home";
import { isProUser, proPricing } from "@/lib/billing";

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
  const [appearanceMessage, setAppearanceMessage] = useState("");
  useEffect(() => {
    setProfile(readStudentProfile());
    hydrateAccountData().then((nextSession) => { setProfile(readStudentProfile()); return nextSession; }).then(setSession).catch(() => { setAccountError("Account status could not be loaded."); setSession({ authenticated: false, user: null, data: null }); });
    fetch("/api/billing/config", { cache: "no-store" }).then((response)=>response.ok?response.json():null).then(setBillingAvailability).catch(()=>setBillingAvailability(null));
  }, []);
  if (profile === undefined) return <div className="min-h-[60vh]" />;
  const billing = session?.data?.billing;
  const pro = isProUser(billing);
  const interval = billing?.billingInterval === "year" ? "Annual" : billing?.billingInterval === "month" ? "Monthly" : "";
  const renewalLabel = billing?.currentPeriodEnd ? new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(billing.currentPeriodEnd)) : "";
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
        <p className="rule-label text-forest">Appearance</p>
        <h2 className="mt-2 font-editorial text-2xl font-bold">Site appearance</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/50">UnlockED Light is available to everyone. Midnight and Forest are Pro appearance options.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {(["light", "midnight", "forest"] as const).map((appearance) => {
            const premium = appearance !== "light";
            const selected = (session?.data?.preferences?.appearance ?? "light") === appearance;
            return <button key={appearance} type="button" onClick={async () => {
              if (premium && !pro) {
                setAppearanceMessage("Premium appearance is included with UnlockED Pro.");
                return;
              }
              const preferences = { ...(session?.data?.preferences ?? { updatedAt: new Date().toISOString() }), appearance, updatedAt: new Date().toISOString() };
              await pushAccountData({ preferences });
              const next = await hydrateAccountData();
              setSession(next);
              setAppearanceMessage(`${appearance === "light" ? "Light" : appearance === "midnight" ? "Midnight" : "Forest"} appearance saved.`);
            }} className={`min-h-11 rounded-full px-5 text-sm font-bold capitalize ${selected ? "bg-forest text-white" : "border border-ink/15 bg-white text-ink/60 hover:border-forest hover:text-forest"}`}>{appearance === "light" ? "UnlockED Light" : appearance}{premium ? " · Pro" : ""}</button>;
          })}
        </div>
        {appearanceMessage && <p role="status" className="mt-3 text-sm font-bold text-forest">{appearanceMessage} {!pro && <Link href="/pricing" className="ml-2 border-b border-current">View Pro</Link>}</p>}
      </div>
    </section>
    <section className="px-5 pt-6 sm:px-8">
      <div className="mx-auto max-w-5xl rounded-[2rem] bg-white p-5 shadow-soft ring-1 ring-ink/8 sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="rule-label text-forest">Billing</p>
            <h2 className="mt-2 font-editorial text-2xl font-bold">{pro ? `UnlockED Pro${interval ? ` — ${interval}` : ""}` : "UnlockED Free"}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/50">{pro ? billing?.cancelAtPeriodEnd && renewalLabel ? `Cancels ${renewalLabel}. You’ll keep Pro access until then.` : renewalLabel ? `Renews ${renewalLabel}.` : "Your Pro subscription is active." : "Free includes Discover, Journey, standard Journey Cards, and a limited For You preview."}</p>
            {billing?.status === "past_due" && <p className="mt-3 max-w-2xl rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-800">Payment needs attention. Update your payment method in Stripe to keep Pro active.</p>}
            {billing?.status && <p className="mt-2 text-xs font-bold uppercase tracking-wider text-ink/35">Subscription status: {billing.status.replaceAll("_"," ")}</p>}
            {billingAvailability?.developmentWarning && <p className="mt-3 max-w-2xl rounded-2xl bg-paper px-4 py-3 text-xs font-bold leading-5 text-ink/55">{billingAvailability.developmentWarning}</p>}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            {!pro && billingAvailability?.checkoutConfigured ? <>
              {(Object.keys(proPricing) as Array<keyof typeof proPricing>).map((planId) => <form key={planId} action="/api/billing/checkout" method="post"><input type="hidden" name="planId" value={planId} /><button className="min-h-11 w-full rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-ink">Upgrade {proPricing[planId].label}</button></form>)}
              <Link href="/pricing" className="text-center text-xs font-bold text-forest hover:text-ink">Compare plans</Link>
            </> : null}
            {billing?.stripeCustomerId && billingAvailability?.portalConfigured ? <form action="/api/billing/portal" method="post"><button className="min-h-11 w-full rounded-full border border-ink/15 px-5 text-sm font-bold text-ink/60 hover:border-forest hover:text-forest">Manage subscription</button></form> : null}
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
