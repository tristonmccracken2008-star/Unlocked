"use client";

import { useEffect } from "react";
import { accountSessionEvent, readAccountSession } from "@/data/account-sync";
import { isProUser } from "@/lib/billing";
import type { AccountSession } from "@/lib/account-types";

function applyTheme(session: AccountSession | null) {
  const appearance = session?.data?.preferences?.appearance ?? "light";
  const allowed = isProUser(session?.data?.billing) ? appearance : "light";
  document.documentElement.dataset.theme = allowed === "midnight" || allowed === "forest" ? allowed : "light";
}

export function ThemeBootstrapScript() {
  const script = `try{var s=JSON.parse(localStorage.getItem("unlocked-account-session")||"null");var a=s&&s.data&&s.data.preferences&&s.data.preferences.appearance;var b=s&&s.data&&s.data.billing;var referral=b&&b.referralProGrantedUntil&&new Date(b.referralProGrantedUntil)>new Date();var pro=referral||b&&b.tier==="pro"&&["active","trialing","past_due"].indexOf(b.status)>=0;document.documentElement.dataset.theme=pro&&(a==="midnight"||a==="forest")?a:"light"}catch(e){document.documentElement.dataset.theme="light"}`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export function ThemeController() {
  useEffect(() => {
    readAccountSession().then(applyTheme).catch(() => applyTheme(null));
    const update = (event: Event) => applyTheme((event as CustomEvent<AccountSession>).detail);
    window.addEventListener(accountSessionEvent, update);
    return () => window.removeEventListener(accountSessionEvent, update);
  }, []);
  return null;
}
