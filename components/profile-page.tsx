"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readStudentProfile, writeStudentProfile, type StudentProfile } from "@/data/student-profile";
import { readAccountSession, hydrateAccountData } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";
import { AccountButton } from "./account-auth";
import { StudentProfileForm } from "./personalized-home";

export function ProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null | undefined>(undefined);
  const [session, setSession] = useState<AccountSession | null>(null);
  const [accountError, setAccountError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setProfile(readStudentProfile());
    hydrateAccountData().then(() => { setProfile(readStudentProfile()); return readAccountSession(); }).then(setSession).catch(() => { setAccountError("Account status could not be loaded."); setSession({ authenticated: false, user: null, data: null }); });
  }, []);
  if (profile === undefined) return <div className="min-h-[60vh]" />;
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
      <div className="mx-auto max-w-5xl border-b border-ink/15 pb-6">
        <p className="rule-label text-forest">Billing</p>
        <div className="mt-3 grid gap-3 bg-white p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div>
            <h2 className="font-editorial text-2xl font-bold">UnlockED Pro coming soon.</h2>
            <p className="mt-2 text-sm text-ink/45">Current plan: {session?.data?.billing?.tier === "pro" ? "Pro" : "Free"}</p>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-ink/35">{session?.data?.billing?.status === "active" ? "Active" : "No paid subscription"}</p>
        </div>
      </div>
    </section>
    <StudentProfileForm mode="edit" session={session} initialProfile={profile} onSave={(next)=>{writeStudentProfile(next);setProfile(next);setSaved(true)}}/>
    {saved&&<div role="status" className="fixed bottom-5 left-5 right-5 z-40 border-2 border-ink bg-white px-5 py-3 text-sm font-bold shadow-[4px_4px_0_#2b211a] sm:left-auto">Profile saved. <Link href="/" className="ml-2 border-b border-forest text-forest">Return to dashboard</Link></div>}
  </div>;
}
