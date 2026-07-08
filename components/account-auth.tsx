"use client";

import { useEffect, useState } from "react";
import { accountSessionEvent, hydrateAccountData, readAccountSession } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";

export function AccountSync() {
  useEffect(() => {
    void hydrateAccountData();
    if (window.location.search.includes("auth=signed-in")) void hydrateAccountData();
  }, []);
  return null;
}

export function AccountButton({ compact = false }: { compact?: boolean }) {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () => {
      setError("");
      readAccountSession().then((next) => { if (active) setSession(next); }).catch(() => { if (active) { setError("Could not load account"); setSession({ authenticated: false, user: null, data: null }); } });
    };
    refresh();
    const onSession = (event: Event) => setSession((event as CustomEvent<AccountSession>).detail);
    window.addEventListener(accountSessionEvent, onSession);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener(accountSessionEvent, onSession); window.removeEventListener("focus", refresh); };
  }, []);
  if (!session) return <span className="inline-flex min-h-10 items-center px-3 text-[11px] font-bold uppercase tracking-wider text-ink/35">Loading account</span>;
  if (!session.authenticated) return <span className="inline-flex flex-col items-start gap-1"><a href="/api/auth/google" className="inline-flex min-h-10 shrink-0 items-center justify-center border border-ink/20 bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-ink/65 hover:border-forest hover:text-forest">{compact ? "Sign in" : "Sign in with Google"}</a>{!compact && <span className="text-[11px] font-bold text-ink/35">Sign in to save your dashboard across devices.</span>}{error && <span className="text-[10px] font-bold text-red-700">{error}</span>}</span>;
  const label = session.user?.name || session.user?.email || "Signed in";
  return <form action="/api/auth/logout" method="post" onSubmit={async (event) => {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" });
    if (!response.ok) { setError("Sign out failed"); return; }
    const signedOut = { authenticated: false, user: null, data: null } satisfies AccountSession;
    setSession(signedOut);
    window.dispatchEvent(new CustomEvent(accountSessionEvent, { detail: signedOut }));
  }} className="flex items-center gap-2">
    {session.user?.image ? <img src={session.user.image} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer"/> : <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">{session.user?.name?.[0] ?? "U"}</span>}
    <span className="flex min-w-0 flex-col"><span className={`${compact ? "max-w-24" : "max-w-44"} truncate text-xs font-bold text-ink/65`}>{label}</span>{!compact&&<span className="text-[11px] font-bold text-trust">Your dashboard is synced.</span>}</span>
    <button type="submit" className="text-[11px] font-bold uppercase tracking-wider text-ink/40 hover:text-forest">Sign out</button>
    {error && <span className="sr-only">{error}</span>}
  </form>;
}
