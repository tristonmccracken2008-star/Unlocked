"use client";

import { useEffect, useState } from "react";
import { accountSessionEvent, clearLocalDashboardState, hydrateAccountData, readAccountSession, resetAccountSessionCache } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";
import { trackProductEvent } from "@/data/product-analytics";
import { abortAuthenticatedRequests } from "@/data/authenticated-request";

export function AccountSync() {
  useEffect(() => {
    const signedIn = window.location.search.includes("auth=signed-in");
    if (signedIn) { trackProductEvent("sign_in"); const url = new URL(window.location.href); url.searchParams.delete("auth"); window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`); }
    void hydrateAccountData().catch(() => undefined);
  }, []);
  return null;
}

export function AccountButton({ compact = false }: { compact?: boolean }) {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
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
  if (!session) return <span className="inline-flex min-h-10 items-center px-3 text-[11px] font-bold uppercase tracking-wider text-ink/35">Checking account</span>;
  if (!session.authenticated) return <span className="inline-flex flex-col items-start gap-1"><a href="/api/auth/google" onClick={() => resetAccountSessionCache()} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-ink">Sign in</a>{!compact && <span className="text-[11px] font-bold text-ink/35">Save your dashboard across devices.</span>}{error && <span className="text-[10px] font-bold text-red-700">{error}</span>}</span>;
  const label = session.user?.name || session.user?.email || "Signed in";
  return <form action="/api/auth/logout" method="post" aria-busy={signingOut || undefined} onSubmit={async (event) => {
    event.preventDefault();
    if (signingOut) return;
    setSigningOut(true);
    setError("");
    const controller = new AbortController();
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { code?: string } | null;
        const requestId = response.headers.get("x-request-id") ?? "unavailable";
        const category = body?.code ?? `http_${response.status}`;
        console.warn("[UnlockED auth] Client logout rejected", { requestId, status: response.status, category });
        setError(`Sign out was blocked (${category}). Try again.`);
        return;
      }
      abortAuthenticatedRequests();
      const signedOut = { authenticated: false, user: null, data: null } satisfies AccountSession;
      resetAccountSessionCache();
      clearLocalDashboardState();
      setSession(signedOut);
      window.dispatchEvent(new CustomEvent(accountSessionEvent, { detail: signedOut }));
      trackProductEvent("sign_out");
      window.location.replace("/");
    } catch (reason) {
      const category = reason instanceof DOMException && reason.name === "AbortError" ? "request_aborted" : "network_error";
      console.warn("[UnlockED auth] Client logout failed", { category });
      setError(`Sign out didn’t finish (${category}). Try again.`);
    } finally {
      setSigningOut(false);
    }
  }} className="flex flex-wrap items-center justify-end gap-2">
    {session.user?.image ? <img src={session.user.image} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer"/> : <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">{session.user?.name?.[0] ?? "U"}</span>}
    <span className="flex min-w-0 flex-col"><span className={`${compact ? "max-w-24" : "max-w-44"} truncate text-xs font-bold text-ink/65`}>{label}</span>{!compact&&<span className="text-[11px] font-bold text-trust">Your dashboard is synced.</span>}</span>
    <button type="submit" disabled={signingOut} className="min-w-[4.5rem] rounded-full px-2 py-1 text-xs font-bold text-ink/40 hover:bg-white hover:text-forest disabled:cursor-wait disabled:opacity-60">{signingOut ? "Signing out…" : "Sign out"}</button>
    {error && <span role="alert" className="w-full text-right text-[10px] font-bold text-red-700">{error}</span>}
  </form>;
}
