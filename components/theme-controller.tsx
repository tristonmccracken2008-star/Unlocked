"use client";

import { useEffect } from "react";
import { accountSessionEvent, readAccountSession } from "@/data/account-sync";
import { isProUser } from "@/lib/billing";
import type { AccountSession } from "@/lib/account-types";
import { resolvedAppearance, type AppearancePreference } from "@/lib/journey-theme";

const systemThemeCookie = "unlocked-color-scheme";

function applyTheme(session: AccountSession | null, systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches) {
  const preference = (session?.data?.preferences?.appearance ?? "light") as AppearancePreference;
  const theme = resolvedAppearance(preference, isProUser(session?.data?.billing), systemDark);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.appearance = preference;
  document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
  document.cookie = `${systemThemeCookie}=${systemDark ? "dark" : "light"}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function ThemeBootstrapScript() {
  const script = `try{var s=JSON.parse(localStorage.getItem("unlocked-account-session")||"null");var a=s&&s.data&&s.data.preferences&&s.data.preferences.appearance||"light";var b=s&&s.data&&s.data.billing;var referral=b&&b.referralProGrantedUntil&&new Date(b.referralProGrantedUntil)>new Date();var pro=referral||b&&b.tier==="pro"&&["active","trialing","past_due"].indexOf(b.status)>=0;var dark=window.matchMedia("(prefers-color-scheme: dark)").matches;var t=pro?(a==="system"?(dark?"midnight":"light"):(a==="midnight"||a==="forest"?a:"light")):"light";document.documentElement.dataset.theme=t;document.documentElement.dataset.appearance=a;document.documentElement.style.colorScheme=t==="light"?"light":"dark";document.cookie="unlocked-color-scheme="+(dark?"dark":"light")+"; Path=/; Max-Age=31536000; SameSite=Lax"}catch(e){document.documentElement.dataset.theme="light";document.documentElement.dataset.appearance="light"}`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export function ThemeController() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let session: AccountSession | null = null;
    readAccountSession().then((next) => { session = next; applyTheme(next, media.matches); }).catch(() => applyTheme(null, media.matches));
    const update = (event: Event) => { session = (event as CustomEvent<AccountSession>).detail; applyTheme(session, media.matches); };
    const systemChanged = () => applyTheme(session, media.matches);
    window.addEventListener(accountSessionEvent, update);
    media.addEventListener("change", systemChanged);
    return () => { window.removeEventListener(accountSessionEvent, update); media.removeEventListener("change", systemChanged); };
  }, []);
  return null;
}
