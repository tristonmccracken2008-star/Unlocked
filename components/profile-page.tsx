"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readStudentProfile, writeStudentProfile, type StudentProfile } from "@/data/student-profile";
import { readAccountSession, hydrateAccountData } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";
import { AccountButton } from "./account-auth";
import { StudentSetup } from "./personalized-home";

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
          <h1 className="mt-2 font-editorial text-3xl font-bold">Profile and sync</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/50">{!session ? "Loading your account and saved profile…" : session.authenticated ? `Signed in as ${session.user?.email}. Your profile, saved opportunities, application progress, and activity sync to your account.` : "Your session has ended. Return to the homepage to sign in again."}</p>
          {accountError && <p className="mt-2 text-xs font-bold text-red-700">{accountError}</p>}
        </div>
        <AccountButton />
      </div>
    </section>
    <StudentSetup initialProfile={profile} onSave={(next)=>{writeStudentProfile(next);setProfile(next);setSaved(true)}} onCancel={profile ? undefined : undefined}/>
    {saved&&<div role="status" className="fixed bottom-5 left-5 right-5 z-40 border-2 border-ink bg-white px-5 py-3 text-sm font-bold shadow-[4px_4px_0_#10243e] sm:left-auto">Profile saved. <Link href="/" className="ml-2 border-b border-forest text-forest">Return to dashboard</Link></div>}
  </div>;
}
