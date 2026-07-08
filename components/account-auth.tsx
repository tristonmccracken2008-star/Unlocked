"use client";

import { useEffect, useState } from "react";
import { hydrateAccountData, readAccountSession } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";

export function AccountSync() {
  useEffect(() => { void hydrateAccountData(); }, []);
  return null;
}

export function AccountButton({ compact = false }: { compact?: boolean }) {
  const [session, setSession] = useState<AccountSession | null>(null);
  useEffect(() => { let active = true; readAccountSession().then((next) => { if (active) setSession(next); }); return () => { active = false; }; }, []);
  if (!session) return <span className="min-h-11 w-24" />;
  if (!session.authenticated) return <a href="/api/auth/google" className="inline-flex min-h-10 shrink-0 items-center justify-center border border-ink/20 bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-ink/65 hover:border-forest hover:text-forest">{compact ? "Sign in" : "Sign in with Google"}</a>;
  return <form action="/api/auth/logout" method="post" onSubmit={async (event) => {
    event.preventDefault();
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    window.location.reload();
  }} className="flex items-center gap-2">
    {session.user?.image ? <img src={session.user.image} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer"/> : <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">{session.user?.name?.[0] ?? "U"}</span>}
    {!compact && <span className="hidden max-w-28 truncate text-xs font-bold text-ink/60 lg:block">{session.user?.name}</span>}
    <button type="submit" className="text-[11px] font-bold uppercase tracking-wider text-ink/40 hover:text-forest">Sign out</button>
  </form>;
}
