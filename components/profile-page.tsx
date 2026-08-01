"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { readStudentProfile, writeStudentProfile, type StudentProfile } from "@/data/student-profile";
import { accountSessionEvent, clearLocalDashboardState, hydrateAccountData, pushAccountData, resetAccountSessionCache } from "@/data/account-sync";
import { opportunityInterestOptions } from "@/data/profile-options";
import type { AccountPrivacyPreferences, AccountSession, UserPreferencesRecord } from "@/lib/account-types";
import { isProUser, proPricing } from "@/lib/billing";
import { authenticatedFetch } from "@/data/authenticated-request";
import { trackProductEvent } from "@/data/product-analytics";
import { AccountButton } from "./account-auth";
import { BillingCheckoutButton } from "./billing-checkout-button";
import { NotificationSettings } from "./notification-settings";
import { ProfileIdentityCard } from "./profile-identity-card";
import { StudentProfileForm } from "./personalized-home";
import { AccountPageLoading, SectionLoading, SkeletonBlock } from "./loading-system";
import { DelayedPendingLabel } from "./delayed-pending-label";

const AdvisorBrainProfileTab = dynamic(() => import("./profile-career-tab").then((module) => module.AdvisorBrainProfileTab), {
  ssr: false,
  loading: () => <SectionLoading label="Loading career profile" rows={2} className="rounded-lg border border-ink/8 bg-[var(--unlocked-surface-muted)] p-5" />,
});

const sections = [
  ["profile", "Profile"],
  ["interests", "Interests"],
  ["notifications", "Notifications"],
  ["privacy", "Privacy"],
  ["appearance", "Appearance"],
  ["billing", "Plan and billing"],
  ["data", "Data and account"],
] as const;
type SectionId = (typeof sections)[number][0];
type SavePreferences = (patch: Partial<UserPreferencesRecord>, successMessage?: string) => Promise<boolean>;

type BillingAvailability = {
  checkoutConfigured: boolean;
  checkoutPlans?: { pro_monthly: boolean; pro_annual: boolean };
  portalConfigured: boolean;
  developmentWarning: string;
};

const defaultPrivacy = (): AccountPrivacyPreferences => ({
  journeyVisibility: "private",
  analyticsPersonalization: false,
  journeyCard: {
    format: "story",
    theme: "light",
    nameMode: "first_name",
    includeSchool: false,
    includeOrganization: false,
    includeDate: true,
    includeAward: false,
    includeBranding: true,
    visibility: "private",
  },
});

function readableError(status: number, fallback: string) {
  if (status === 401) return "Your session expired. Sign in again before saving.";
  if (status === 403) return "This change was blocked for your protection. Refresh and try again.";
  if (status === 409 || status === 423) return "Your account changed elsewhere. Refresh before trying again.";
  return fallback;
}

function sectionFromHash(hash: string): SectionId {
  const candidate = hash.replace(/^#/, "");
  return sections.some(([id]) => id === candidate) ? candidate as SectionId : "profile";
}

function billingReturnMessage(code: string | null) {
  if (code === "returned") return { message: "You returned from Stripe. Your confirmed billing status is shown below.", error: "" };
  if (code === "already-pro") return { message: "UnlockED Pro is already active on this account.", error: "" };
  if (code === "portal-unavailable") return { message: "", error: "Stripe billing is temporarily unavailable. Your current plan is unchanged." };
  if (code === "portal-failed") return { message: "", error: "We couldn’t open Stripe billing. Your current plan is unchanged." };
  if (code === "not-configured") return { message: "", error: "Checkout is temporarily unavailable. Your current plan is unchanged." };
  if (code === "checkout-failed") return { message: "", error: "We couldn’t start checkout. Your current plan is unchanged." };
  return null;
}

export function ProfilePage({ initialSession }: { initialSession: AccountSession }) {
  const [profile, setProfile] = useState<StudentProfile | null | undefined>(initialSession.data?.profile);
  const [session, setSession] = useState<AccountSession | null>(initialSession);
  const [active, setActive] = useState<SectionId>("profile");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const accountId = useRef<string | null>(null);

  useEffect(() => {
    let current = true;
    accountId.current = initialSession.user?.id ?? null;
    hydrateAccountData()
      .then((next) => {
        if (!current) return;
        setProfile(next.data?.profile ?? readStudentProfile());
        setSession(next);
        accountId.current = next.user?.id ?? null;
      })
      .catch(() => {
        if (!current) return;
        setError("Your account details could not be refreshed. Your session is still active; retry or refresh the page.");
      });
    return () => { current = false; };
  }, [initialSession.user?.id]);

  useEffect(() => {
    const accountChanged = (event: Event) => {
      const next = (event as CustomEvent<AccountSession>).detail;
      const priorAccountId = accountId.current;
      const changedIdentity = priorAccountId !== (next.user?.id ?? null);
      accountId.current = next.user?.id ?? null;
      setSession(next);
      setProfile(next.data?.profile ?? null);
      if (changedIdentity) {
        setMessage("");
        setError("");
        setActive(priorAccountId ? "profile" : sectionFromHash(window.location.hash));
      }
    };
    window.addEventListener(accountSessionEvent, accountChanged);
    return () => window.removeEventListener(accountSessionEvent, accountChanged);
  }, []);

  useEffect(() => {
    if (session?.authenticated) trackProductEvent("account_center_viewed");
  }, [session?.authenticated]);

  useEffect(() => {
    const syncFromUrl = () => {
      const url = new URL(window.location.href);
      const billingReturn = billingReturnMessage(url.searchParams.get("billing"));
      const section = billingReturn ? "billing" : sectionFromHash(url.hash);
      setActive(section);
      if (!billingReturn) return;
      setMessage(billingReturn.message);
      setError(billingReturn.error);
      url.searchParams.delete("billing");
      url.hash = "billing";
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    };
    syncFromUrl();
    window.addEventListener("hashchange", syncFromUrl);
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.removeEventListener("hashchange", syncFromUrl);
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, []);

  async function refresh() {
    const next = await hydrateAccountData();
    setSession(next);
    setProfile(next.data?.profile ?? readStudentProfile());
    return next;
  }

  async function savePreferences(patch: Partial<UserPreferencesRecord>, successMessage = "Account preferences saved.") {
    setError("");
    setMessage("");
    const updatedAt = new Date().toISOString();
    const preferences = { ...(session?.data?.preferences ?? { updatedAt }), ...patch, updatedAt };
    try {
      const data = await pushAccountData({ preferences });
      if (!data) throw new Error("session");
      const next = { ...session!, data } satisfies AccountSession;
      setSession(next);
      await refresh();
      if (patch.preferredTypes) trackProductEvent("interests_updated");
      else if (typeof patch.useActivityForRecommendations === "boolean") trackProductEvent("recommendation_learning_changed");
      else if (patch.privacy) trackProductEvent("privacy_settings_updated");
      else if (patch.appearance || patch.reducedMotion) trackProductEvent("appearance_changed");
      setMessage(successMessage);
      return true;
    } catch {
      setError("We couldn’t save this change. Your previous setting is unchanged.");
      return false;
    }
  }

  if (profile === undefined || !session) return <AccountLoading />;
  if (!session.authenticated || !session.user || !session.data) {
    return <main className="px-5 py-20 sm:px-8"><div className="mx-auto max-w-4xl"><p className="rule-label text-forest">Account</p><h1 className="mt-3 font-editorial text-4xl font-bold">Your session has ended.</h1><p className="mt-4 text-sm text-ink/50">Sign in again to manage your account.</p><div className="mt-6"><AccountButton /></div></div></main>;
  }

  return <main className="px-5 py-8 sm:px-8 sm:py-12">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-5 border-b border-ink/12 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="rule-label text-forest">Profile</p>
          <h1 className="mt-2 font-editorial text-4xl font-bold tracking-[-.03em] text-[var(--unlocked-text)] sm:text-5xl">Your account.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/50">Manage your private profile, preferences, and account.</p>
        </div>
        <Link href="/referral" className="inline-flex min-h-11 items-center self-start text-sm font-bold text-forest hover:text-ink sm:self-auto">Referrals</Link>
      </header>

      <div className="mt-7 grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Account sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 lg:sticky lg:top-24 lg:mx-0 lg:h-fit lg:flex-col lg:overflow-visible lg:px-0">
          {sections.map(([id, label]) => <button key={id} type="button" aria-current={active === id ? "page" : undefined} onClick={() => { setActive(id); setError(""); setMessage(""); window.history.pushState(window.history.state, "", `${window.location.pathname}#${id}`); }} className={`min-h-11 shrink-0 rounded-md px-4 text-left text-sm font-bold transition-colors ${active === id ? "bg-forest text-white" : "text-ink/50 hover:bg-ink/5 hover:text-ink"}`}>{label}</button>)}
        </nav>

        <section aria-labelledby={`${active}-heading`} className="min-w-0">
          <StatusMessages message={message} error={error} />
          {active === "profile" ? <ProfileSection profile={profile} session={session} onSaved={async (nextProfile) => {
            await writeStudentProfile(nextProfile, session.data?.updatedAt);
            setProfile(nextProfile);
            await refresh();
            trackProductEvent("profile_updated");
            setMessage("Profile saved. Eligibility and For You will use these details.");
          }} /> : null}
          {active === "interests" ? <InterestsSection session={session} profile={profile} savePreferences={savePreferences} onReset={async () => {
            setError("");
            const response = await authenticatedFetch("/api/account/recommendation-reset", { method: "POST", credentials: "same-origin", cache: "no-store" });
            if (!response.ok) {
              setError(readableError(response.status, "Recommendation learning could not be reset."));
              return;
            }
            await refresh();
            trackProductEvent("recommendation_signals_reset");
            setMessage("Learned recommendation signals were reset. Your profile, saved opportunities, and Journey were kept.");
          }} /> : null}
          {active === "notifications" ? <div><SectionHeading id="notifications-heading" eyebrow="Notifications" title="Choose what deserves your attention." description="Essential account messages remain separate from product reminders and optional email."/><NotificationSettings embedded /></div> : null}
          {active === "privacy" ? <PrivacySection session={session} savePreferences={savePreferences} /> : null}
          {active === "appearance" ? <AppearanceSection session={session} savePreferences={savePreferences} /> : null}
          {active === "billing" ? <BillingSection session={session} /> : null}
          {active === "data" ? <DataSection session={session} setError={setError} setMessage={setMessage} /> : null}
        </section>
      </div>
    </div>
  </main>;
}

function ProfileSection({ profile, session, onSaved }: { profile: StudentProfile | null; session: AccountSession; onSaved: (profile: StudentProfile) => Promise<void> }) {
  const [careerOpen, setCareerOpen] = useState(false);
  const focusProfileField = (fieldId: string) => {
    const field = document.getElementById(fieldId);
    field?.focus({ preventScroll: true });
    field?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  };
  return <div>
    <ProfileIdentityCard profile={profile} session={session} onEdit={focusProfileField} />
    <div id="profile-settings" className="mt-10 scroll-mt-28">
      <SectionHeading id="profile-settings-heading" eyebrow="Private details" title="Profile settings." description="Update the private details used for eligibility and recommendations." />
      <StudentProfileForm key={`${session.user?.id ?? "signed-out"}:${session.data?.updatedAt ?? "unknown"}`} mode="edit" session={session} initialProfile={profile} onSave={onSaved} showHeader={false} />
    </div>
    <details className="mt-8 border-t border-ink/12 pt-6" open={careerOpen} onToggle={(event) => setCareerOpen(event.currentTarget.open)}>
      <summary className="min-h-11 cursor-pointer text-sm font-bold text-forest">How UnlockED understands your direction</summary>
      <div className="pt-4">{careerOpen ? <AdvisorBrainProfileTab profile={profile} session={session} /> : null}</div>
    </details>
  </div>;
}

function InterestsSection({ session, profile, savePreferences, onReset }: { session: AccountSession; profile: StudentProfile | null; savePreferences: SavePreferences; onReset: () => Promise<void> }) {
  const initial = session.data?.preferences?.preferredTypes ?? profile?.preferredOpportunityTypes ?? [];
  const [selected, setSelected] = useState(initial);
  const [resetOpen, setResetOpen] = useState(false);
  const useActivity = session.data?.preferences?.useActivityForRecommendations !== false;
  return <div>
    <SectionHeading id="interests-heading" eyebrow="Interests" title="Tell For You what to prioritize." description="These choices influence ranking. Discover still shows the complete catalog." />
    <fieldset className="mt-8">
      <legend className="text-sm font-bold">Opportunity interests</legend>
      <div className="mt-3 flex flex-wrap gap-2">{opportunityInterestOptions.map((item) => {
        const checked = selected.includes(item);
        return <button key={item} type="button" aria-pressed={checked} onClick={() => setSelected((current) => checked ? current.filter((value) => value !== item) : [...current, item])} className={`min-h-11 rounded-full border px-4 text-sm font-bold ${checked ? "border-forest bg-forest text-white" : "border-ink/15 text-ink/55 hover:border-forest hover:text-forest"}`}>{item}</button>;
      })}</div>
      <button type="button" onClick={() => void savePreferences({ preferredTypes: selected }, "Opportunity interests saved.")} className="mt-6 min-h-11 rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-ink">Save interests</button>
    </fieldset>
    <div className="mt-10 border-t border-ink/12 pt-7">
      <h3 className="font-editorial text-2xl font-bold">Learned signals</h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/50">UnlockED can use recent views, saves, Journey activity, and feedback to refine ranking. It does not infer sensitive personal traits.</p>
      <SettingToggle checked={useActivity} label="Use my activity to improve For You" description={useActivity ? "Your recent UnlockED activity can refine recommendations." : "Browsing and feedback no longer affect ranking. Saved and Journey status still prevent duplicate or outdated suggestions."} onChange={(checked) => void savePreferences({ useActivityForRecommendations: checked }, checked ? "Activity-based personalization enabled." : "Activity-based personalization disabled.")} />
      {!resetOpen ? <button type="button" onClick={() => setResetOpen(true)} className="mt-5 min-h-11 text-sm font-bold text-forest hover:text-ink">Reset For You learning</button> : <div className="mt-5 rounded-md border border-ink/15 p-5"><p className="text-sm leading-6 text-ink/60">This clears learned recommendation signals and dismissal history. Your profile, interests, saved opportunities, Journey, and billing remain unchanged.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => void onReset().finally(() => setResetOpen(false))} className="min-h-11 rounded-full bg-ink px-5 text-sm font-bold text-white">Confirm reset</button><button type="button" onClick={() => setResetOpen(false)} className="min-h-11 px-4 text-sm font-bold text-ink/50">Cancel</button></div></div>}
    </div>
  </div>;
}

function PrivacySection({ session, savePreferences }: { session: AccountSession; savePreferences: SavePreferences }) {
  const [privacy, setPrivacy] = useState(session.data?.preferences?.privacy ?? defaultPrivacy());
  const card = privacy.journeyCard;
  const updateCard = <K extends keyof typeof card>(key: K, value: (typeof card)[K]) => setPrivacy((current) => ({ ...current, journeyCard: { ...current.journeyCard, [key]: value } }));
  return <div>
    <SectionHeading id="privacy-heading" eyebrow="Privacy" title="Private by default." description="Your account and Journey are not public. A downloaded Journey Card contains only what you choose to show." />
    <div className="mt-8 border-y border-ink/12">
      <ReadOnlySetting label="Journey visibility" value="Private" description="Only you can view your full Journey while signed in." />
      <ReadOnlySetting label="Account data" value="Private" description="Profile answers and Journey details are used inside your account, not published as a profile." />
    </div>
    <h3 className="mt-9 font-editorial text-2xl font-bold">Journey Card defaults</h3>
    <p className="mt-2 text-sm leading-6 text-ink/50">Defaults apply to future cards. You can still change each card before downloading or sharing it.</p>
    <div className="mt-5 grid gap-5 sm:grid-cols-2">
      <SelectSetting label="Format" value={card.format} onChange={(value) => updateCard("format", value as typeof card.format)} options={[["story","Story"],["square","Square"],["linkedin","LinkedIn"]]} />
      <SelectSetting label="Appearance" value={card.theme} onChange={(value) => updateCard("theme", value as typeof card.theme)} options={[["light","Cream"],["dark","Forest"]]} />
      <SelectSetting label="Name" value={card.nameMode} onChange={(value) => updateCard("nameMode", value as typeof card.nameMode)} options={[["anonymous","Anonymous"],["first_name","First name"],["full_name","Full name"]]} />
    </div>
    <div className="mt-4 border-y border-ink/12">
      <SettingToggle checked={card.includeSchool} label="Include school" description="Show your school on future Journey Cards." onChange={(checked) => updateCard("includeSchool", checked)} />
      <SettingToggle checked={card.includeOrganization} label="Include organization names" description="Show organizations connected to the featured moment." onChange={(checked) => updateCard("includeOrganization", checked)} />
      <SettingToggle checked={card.includeDate} label="Include dates" description="Show milestone or period dates." onChange={(checked) => updateCard("includeDate", checked)} />
      <SettingToggle checked={card.includeBranding} label="Include UnlockED branding" description="Keep the subtle UnlockED attribution on exported cards." onChange={(checked) => updateCard("includeBranding", checked)} />
    </div>
    <button type="button" onClick={() => void savePreferences({ privacy }, "Journey Card privacy defaults saved.")} className="mt-6 min-h-11 rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-ink">Save privacy defaults</button>
  </div>;
}

function AppearanceSection({ session, savePreferences }: { session: AccountSession; savePreferences: SavePreferences }) {
  const pro = isProUser(session.data?.billing);
  const appearance = session.data?.preferences?.appearance ?? "light";
  const reducedMotion = session.data?.preferences?.reducedMotion ?? "system";
  return <div>
    <SectionHeading id="appearance-heading" eyebrow="Appearance" title="Keep UnlockED comfortable." description="System follows your device. Premium appearance options are available with Pro." />
    <div className="mt-8 flex flex-wrap gap-3">{(["light","system","midnight","forest"] as const).map((item) => {
      const premium = item !== "light";
      const disabled = premium && !pro;
      return <button key={item} type="button" disabled={disabled} aria-pressed={appearance === item} onClick={() => void savePreferences({ appearance: item }, `Appearance changed to ${item === "light" ? "Light" : item === "system" ? "System" : item === "midnight" ? "Midnight" : "Forest"}.`)} className={`min-h-11 rounded-full border px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45 ${appearance === item ? "border-forest bg-forest text-white" : "border-ink/15 text-ink/55 hover:border-forest"}`}>{item === "light" ? "Light" : item === "system" ? "System" : item === "midnight" ? "Midnight" : "Forest"}{disabled ? " · Pro" : ""}</button>;
    })}</div>
    <div className="mt-8 max-w-md"><SelectSetting label="Motion" value={reducedMotion === "full" ? "system" : reducedMotion} onChange={(value) => void savePreferences({ reducedMotion: value as UserPreferencesRecord["reducedMotion"] }, value === "reduce" ? "Reduced motion enabled." : "Motion now follows your system setting.")} options={[["system","Use system setting"],["reduce","Reduce motion"]]} /></div>
    {!pro ? <p className="mt-5 text-sm text-ink/50"><Link href="/pricing" className="font-bold text-forest">Compare plans</Link> for premium appearance options. Core account controls remain available on Free.</p> : null}
  </div>;
}

function BillingSection({ session }: { session: AccountSession }) {
  const [availability, setAvailability] = useState<BillingAvailability | null | undefined>(undefined);
  const [loadVersion, setLoadVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setAvailability(undefined);
    fetch("/api/billing/config", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("billing_config_failed")))
      .then((body: BillingAvailability) => { if (active) setAvailability(body); })
      .catch(() => { if (active) setAvailability(null); });
    return () => { active = false; };
  }, [loadVersion]);
  const billing = session.data!.billing;
  const pro = isProUser(billing);
  const period = billing.currentPeriodEnd ? new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(billing.currentPeriodEnd)) : "";
  return <div>
    <SectionHeading id="billing-heading" eyebrow="Plan and billing" title={pro ? "UnlockED Pro" : "UnlockED Free"} description={pro ? "Your entitlement reflects the latest confirmed subscription state." : "Free includes Discover, Journey, and a limited For You preview."} />
    <dl className="mt-8 divide-y divide-ink/10 border-y border-ink/12 text-sm">
      <Definition label="Current plan" value={pro ? `Pro${billing.billingInterval === "year" ? " annual" : billing.billingInterval === "month" ? " monthly" : ""}` : "Free"} />
      <Definition label="Status" value={(billing.status ?? "free").replaceAll("_", " ")} />
      {period ? <Definition label={billing.cancelAtPeriodEnd ? "Access ends" : "Renews"} value={period} /> : null}
    </dl>
    {billing.status === "past_due" ? <p role="alert" className="mt-5 rounded-md bg-amber-50 p-4 text-sm font-bold text-amber-900">Payment needs attention. Open Stripe billing to update your payment method.</p> : null}
    {availability === undefined ? <div className="mt-6 flex gap-3" aria-label="Loading billing actions" aria-busy="true"><SkeletonBlock className="h-11 w-44 rounded-full" /><SkeletonBlock className="h-11 w-32 rounded-full" /><span className="sr-only" role="status">Loading billing actions</span></div> : availability === null ? <div className="mt-6 rounded-xl border border-red-800/20 bg-white p-4" role="alert"><p className="text-sm font-bold text-red-800">Billing actions could not be loaded. Your current plan is unchanged.</p><button type="button" onClick={() => setLoadVersion((value) => value + 1)} className="mt-3 min-h-11 text-sm font-bold text-forest hover:text-ink">Retry billing actions</button></div> : <div className="mt-6 flex flex-wrap gap-3">
      {!pro ? (Object.keys(proPricing) as Array<keyof typeof proPricing>).map((planId) => <BillingCheckoutButton key={planId} planId={planId} configured={availability.checkoutPlans?.[planId] ?? availability.checkoutConfigured} source="profile" className="min-h-11 rounded-full bg-forest px-5 text-sm font-bold text-white disabled:opacity-50">Upgrade {proPricing[planId].label}</BillingCheckoutButton>) : null}
      {billing.hasStripeCustomer && availability.portalConfigured ? <form action="/api/billing/portal" method="post"><button className="min-h-11 rounded-full border border-ink/15 px-5 text-sm font-bold text-ink/60 hover:border-forest hover:text-forest">Manage subscription in Stripe</button></form> : null}
      {!pro ? <Link href="/pricing" className="inline-flex min-h-11 items-center px-3 text-sm font-bold text-forest">Compare plans</Link> : null}
    </div>}
    {availability?.developmentWarning ? <p className="mt-5 rounded-md bg-ink/5 p-4 text-xs leading-5 text-ink/55">{availability.developmentWarning}</p> : null}
  </div>;
}

function DataSection({ session, setError, setMessage }: { session: AccountSession; setError: (value: string) => void; setMessage: (value: string) => void }) {
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  return <div>
    <SectionHeading id="data-heading" eyebrow="Data and account" title="Your data stays yours." description="Download a portable copy, sign out, or permanently delete your account." />
    <div className="mt-8 divide-y divide-ink/10 border-y border-ink/12">
      <ActionRow title="Download your data" description="A JSON file with your profile, preferences, saved opportunities, Journey, notification history, and safe subscription metadata." action={<button type="button" disabled={exporting} onClick={async () => {
        setExporting(true); setError(""); setMessage("");
        try {
          trackProductEvent("data_export_requested");
          const response = await authenticatedFetch("/api/account/export", { method: "POST", credentials: "same-origin", cache: "no-store" });
          if (!response.ok) throw new Error(readableError(response.status, "Your export could not be prepared."));
          const blob = await response.blob();
          const href = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = href;
          link.download = `unlocked-data-${new Date().toISOString().slice(0, 10)}.json`;
          link.click();
          URL.revokeObjectURL(href);
          setMessage("Your data export was downloaded.");
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Your export could not be prepared.");
        } finally { setExporting(false); }
      }} aria-busy={exporting ? "true" : undefined} data-action-state={exporting ? "loading" : "idle"} className="min-h-11 rounded-full border border-ink/15 px-5 text-sm font-bold hover:border-forest hover:text-forest"><DelayedPendingLabel pending={exporting} idle="Download JSON" pendingLabel="Preparing download…" /></button>} />
      <ActionRow title="Signed-in account" description={session.user?.email ?? "Current Google account"} action={<AccountButton compact />} />
    </div>
    <div className="mt-12 border-t border-red-800/20 pt-7">
      <h3 className="font-editorial text-2xl font-bold text-red-900">Delete account</h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/55">This removes your profile, preferences, saved opportunities, Journey, notifications, and active sessions. Required transaction and security records may be retained. An active Stripe subscription is canceled before deletion.</p>
      {!deleteOpen ? <button type="button" onClick={() => { setDeleteOpen(true); trackProductEvent("account_deletion_started"); }} className="mt-5 min-h-11 text-sm font-bold text-red-800">Start account deletion</button> : <div className="mt-5 max-w-xl rounded-md border border-red-800/25 p-5">
        <label htmlFor="delete-confirmation" className="block text-sm font-bold text-red-900">Type DELETE to confirm</label>
        <input id="delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" className="mt-3 min-h-12 w-full border border-red-800/30 bg-white px-4 outline-none focus:border-red-800" />
        <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={confirmation !== "DELETE" || deleting} onClick={async () => {
          setDeleting(true); setError("");
          try {
            const response = await authenticatedFetch("/api/account/delete", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) });
            if (!response.ok) {
              const body = await response.json().catch(() => null) as { error?: string } | null;
              throw new Error(body?.error ?? readableError(response.status, "Your account could not be deleted."));
            }
            clearLocalDashboardState();
            resetAccountSessionCache();
            window.location.replace("/?account=deleted");
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Your account could not be deleted. Your account remains available.");
            setDeleting(false);
          }
        }} aria-busy={deleting ? "true" : undefined} data-action-state={deleting ? "loading" : "idle"} className="min-h-11 rounded-full bg-red-900 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><DelayedPendingLabel pending={deleting} idle="Permanently delete account" pendingLabel="Deleting account…" /></button><button type="button" disabled={deleting} onClick={() => { setDeleteOpen(false); setConfirmation(""); }} className="min-h-11 px-4 text-sm font-bold text-ink/50">Cancel</button></div>
      </div>}
    </div>
  </div>;
}

function AccountLoading() {
  return <AccountPageLoading label="Loading your private account settings" />;
}

function SectionHeading({ id, eyebrow, title, description }: { id: string; eyebrow: string; title: string; description: string }) {
  return <header><p className="rule-label text-forest">{eyebrow}</p><h2 id={id} className="mt-2 font-editorial text-3xl font-bold tracking-[-.02em] text-[var(--unlocked-text)] sm:text-4xl">{title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/50">{description}</p></header>;
}

function StatusMessages({ message, error }: { message: string; error: string }) {
  if (!message && !error) return null;
  return <div role={error ? "alert" : "status"} data-inline-feedback="" data-state={error ? "error" : "success"} className={`mb-6 rounded-md border px-4 py-3 text-sm font-bold ${error ? "border-red-800/20 bg-red-50 text-red-800" : "border-forest/20 bg-forest/5 text-forest"}`}>{error || message}</div>;
}

function SettingToggle({ checked, label, description, onChange }: { checked: boolean; label: string; description: string; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-16 cursor-pointer items-center justify-between gap-5 border-b border-ink/10 py-4 last:border-0"><span><strong className="block text-sm">{label}</strong><small className="mt-1 block max-w-xl text-xs leading-5 text-ink/45">{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 shrink-0 accent-forest"/></label>;
}

function ReadOnlySetting({ label, value, description }: { label: string; value: string; description: string }) {
  return <div className="flex min-h-16 items-center justify-between gap-5 border-b border-ink/10 py-4"><span><strong className="block text-sm">{label}</strong><small className="mt-1 block text-xs leading-5 text-ink/45">{description}</small></span><span className="text-sm font-bold text-forest">{value}</span></div>;
}

function SelectSetting({ label, value, options, onChange }: { label: string; value: string; options: Array<[string,string]>; onChange: (value: string) => void }) {
  const id = useMemo(() => `account-${label.toLowerCase().replaceAll(" ", "-")}`, [label]);
  return <label htmlFor={id} className="block text-sm font-bold">{label}<select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-ink/15 bg-[var(--unlocked-surface)] px-3 text-sm font-normal">{options.map(([option,labelText]) => <option key={option} value={option}>{labelText}</option>)}</select></label>;
}

function Definition({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[8rem_1fr] gap-4 py-4"><dt className="font-bold text-ink/45">{label}</dt><dd className="capitalize text-ink/75">{value}</dd></div>;
}

function ActionRow({ title, description, action }: { title: string; description: string; action: React.ReactNode }) {
  return <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-ink/45">{description}</p></div><div className="shrink-0">{action}</div></div>;
}
