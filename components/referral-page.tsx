"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { hydrateAccountData } from "@/data/account-sync";
import { trackProductEvent } from "@/data/product-analytics";
import type { AccountSession } from "@/lib/account-types";
import { accountReferralSummary, referralRewards } from "@/lib/referrals";
import { ArrowIcon, CheckIcon, SparkIcon } from "./icons";

export function ReferralPage() {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { hydrateAccountData().then(setSession).catch(() => setSession({ authenticated: false, user: null, data: null })); }, []);
  const referrals = session?.data?.referrals ?? null;
  const summary = useMemo(() => accountReferralSummary(session?.data), [session?.data]);
  const completed = summary.completed;
  const nextReward = summary.nextReward;
  const remaining = Math.max(0, nextReward.threshold - completed);

  async function copy(value: string, eventName: "referral_link_copied" | "referral_code_copied") {
    await navigator.clipboard?.writeText(value);
    trackProductEvent(eventName, { referralCode: summary.code });
    setMessage(eventName === "referral_link_copied" ? "Referral link copied." : "Referral code copied.");
  }

  async function share() {
    trackProductEvent("referral_share_started", { referralCode: summary.code });
    const text = "Join me on UnlockED and find college opportunities you might otherwise miss.";
    if (navigator.share) await navigator.share({ title: "UnlockED", text, url: summary.link }).catch(() => undefined);
    else await copy(summary.link, "referral_link_copied");
  }

  if (!session) return <main className="min-h-[60vh] px-5 py-16 sm:px-8"><div className="mx-auto max-w-5xl"><p className="rule-label text-forest">Referrals</p><div className="mt-5 h-12 max-w-xl rounded-full bg-paper" /></div></main>;
  if (!summary.code) return <main className="min-h-[60vh] px-5 py-16 sm:px-8"><div className="mx-auto max-w-5xl"><p className="rule-label text-forest">Referrals</p><h1 className="mt-3 font-editorial text-5xl font-bold">Preparing your referral link.</h1><p className="mt-4 text-sm text-ink/50">Refresh once your account finishes syncing.</p></div></main>;

  return <main className="bg-[radial-gradient(circle_at_top_left,rgba(231,216,189,.48),transparent_34rem),#f6f0e6] px-5 py-10 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-6xl">
      <section className="grid gap-8 rounded-[2rem] bg-white/70 p-6 shadow-soft ring-1 ring-ink/8 sm:p-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
        <div>
          <p className="rule-label text-forest">Invite students</p>
          <h1 className="mt-3 max-w-3xl font-editorial text-5xl font-bold leading-[.98] tracking-[-.045em] text-forest sm:text-7xl">Share UnlockED with someone who could use it.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-ink/58">When a new student joins from your link and completes onboarding, your referral count updates automatically.</p>
        </div>
        <div className="rounded-[1.5rem] bg-paper/80 p-5 ring-1 ring-ink/8">
          <p className="text-xs font-black uppercase tracking-[.14em] text-ink/40">Your code</p>
          <p className="mt-3 font-editorial text-4xl font-bold text-forest">{summary.code}</p>
          <button type="button" onClick={() => copy(summary.code, "referral_code_copied")} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-forest/30 px-5 text-sm font-bold text-forest hover:bg-white">Copy code</button>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-[2rem] bg-white/82 p-6 shadow-soft ring-1 ring-ink/8 sm:p-7">
          <p className="rule-label text-forest">Referral link</p>
          <div className="mt-4 flex flex-col gap-3 rounded-[1.25rem] bg-paper/75 p-3 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-xl bg-white px-4 py-3 text-sm font-bold text-ink/65 ring-1 ring-ink/7">{summary.link}</code>
            <button type="button" onClick={() => copy(summary.link, "referral_link_copied")} className="inline-flex min-h-11 items-center justify-center rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-ink">Copy link</button>
            <button type="button" onClick={share} className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-bold text-ink/60 hover:border-forest hover:text-forest">Share</button>
          </div>
          <p role="status" className="mt-3 min-h-5 text-sm font-bold text-forest">{message}</p>
        </div>

        <div className="rounded-[2rem] bg-forest p-6 text-white shadow-soft">
          <p className="text-xs font-black uppercase tracking-[.14em] text-white/58">Progress</p>
          <p className="mt-3 font-editorial text-6xl font-bold">{completed}</p>
          <p className="mt-2 text-sm font-bold text-white/78">{completed === 1 ? "successful referral" : "successful referrals"}</p>
          <p className="mt-5 text-sm leading-6 text-white/72">{remaining === 0 ? `${nextReward.label} unlocked.` : `${remaining} more to unlock ${nextReward.label}.`}</p>
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] bg-white/82 p-6 shadow-soft ring-1 ring-ink/8 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="rule-label text-forest">Rewards</p>
            <h2 className="mt-2 font-editorial text-3xl font-bold">Built for early supporters.</h2>
          </div>
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-forest hover:text-ink">View Journey <ArrowIcon /></Link>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-5">
          {referralRewards.map((reward) => {
            const unlocked = completed >= reward.threshold;
            return <article key={reward.key} className={`rounded-[1.25rem] p-4 ring-1 ${unlocked ? "bg-forest text-white ring-forest" : "bg-paper/70 text-ink ring-ink/8"}`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`grid h-9 w-9 place-items-center rounded-full ${unlocked ? "bg-white/14" : "bg-white"}`}>{unlocked ? <CheckIcon className="h-4 w-4"/> : <SparkIcon className="h-4 w-4 text-forest"/>}</span>
                <span className="text-xs font-black uppercase tracking-[.14em] opacity-60">{reward.threshold}</span>
              </div>
              <h3 className="mt-4 font-editorial text-xl font-bold leading-tight">{reward.label}</h3>
              <p className={`mt-2 text-xs leading-5 ${unlocked ? "text-white/70" : "text-ink/50"}`}>{reward.description}</p>
            </article>;
          })}
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <ReferralList title="Pending" empty="No pending referrals yet." count={referrals?.pending.length ?? 0} items={referrals?.pending.map((item) => item.firstName || "Student") ?? []} />
        <ReferralList title="Completed" empty="Completed referrals appear here after onboarding." count={referrals?.completed.length ?? 0} items={referrals?.completed.map((item) => item.firstName || "Student") ?? []} />
      </section>
    </div>
  </main>;
}

function ReferralList({ title, empty, count, items }: { title: string; empty: string; count: number; items: string[] }) {
  return <section className="rounded-[2rem] bg-white/76 p-6 shadow-soft ring-1 ring-ink/8">
    <div className="flex items-center justify-between gap-4">
      <h2 className="font-editorial text-2xl font-bold">{title}</h2>
      <span className="rounded-full bg-paper px-3 py-1 text-xs font-black text-ink/50">{count}</span>
    </div>
    {items.length ? <ul className="mt-4 divide-y divide-ink/8">{items.slice(-8).map((item, index) => <li key={`${item}-${index}`} className="py-3 text-sm font-bold text-ink/62">{item}</li>)}</ul> : <p className="mt-4 text-sm leading-6 text-ink/48">{empty}</p>}
  </section>;
}
