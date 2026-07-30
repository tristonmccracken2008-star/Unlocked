"use client";

import { useEffect, useState } from "react";
import { defaultNotificationPreferences, type NotificationPreferences } from "@/lib/notification-types";
import { accountSessionEvent } from "@/data/account-sync";

const commonTimezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function Toggle({ checked, label, description, onChange }: { checked: boolean; label: string; description: string; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-16 cursor-pointer items-center justify-between gap-5 border-b border-ink/10 py-4 last:border-0">
    <span><strong className="block text-sm">{label}</strong><small className="mt-1 block max-w-xl text-xs leading-5 text-ink/45">{description}</small></span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 shrink-0 accent-forest" />
  </label>;
}

export function NotificationSettings({ embedded = false }: { embedded?: boolean }) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountVersion, setAccountVersion] = useState(0);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage("");
    setMessageKind(null);
    fetch("/api/notifications/preferences", { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((body: { preferences: NotificationPreferences }) => {
        if (active) setPreferences(body.preferences);
      })
      .catch(() => {
        if (active) {
          setPreferences(null);
          setMessageKind("error");
          setMessage("Notification settings could not be loaded. Your existing preferences were not changed.");
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accountVersion, reloadVersion]);

  useEffect(() => {
    const accountChanged = () => {
      setPreferences(null);
      setMessage("");
      setMessageKind(null);
      setLoading(true);
      setAccountVersion((value) => value + 1);
    };
    window.addEventListener(accountSessionEvent, accountChanged);
    return () => window.removeEventListener(accountSessionEvent, accountChanged);
  }, []);

  const detected = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
  const timezones = [...new Set([detected, ...commonTimezones].filter(Boolean))];

  if (loading) return <section id="notifications" aria-busy="true" className={embedded ? "pt-7" : "px-5 pt-6 sm:px-8"}><div className={`${embedded ? "" : "mx-auto max-w-5xl rounded-[2rem] shadow-soft ring-1 ring-ink/8"} unlocked-skeleton h-48 bg-[var(--unlocked-surface)]`}><span className="sr-only" role="status">Loading notification settings</span></div></section>;
  if (!preferences) return <section id="notifications" className={embedded ? "pt-7" : "px-5 pt-6 sm:px-8"}><div className={embedded ? "rounded-xl border border-red-800/20 bg-white p-5" : "mx-auto max-w-5xl rounded-[1.5rem] border border-red-800/20 bg-white p-6 shadow-soft"} role="alert"><p className="text-sm font-bold text-red-800">{message || "Notification settings could not be loaded."}</p><button type="button" onClick={() => setReloadVersion((value) => value + 1)} className="mt-3 min-h-11 text-sm font-bold text-forest hover:text-ink">Retry notification settings</button></div></section>;

  const update = <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => setPreferences((current) => current ? { ...current, [key]: value } : current);

  return <section id="notifications" className={embedded ? "scroll-mt-28 pt-7" : "scroll-mt-28 px-5 pt-6 sm:px-8"}>
    <div className={embedded ? "" : "mx-auto max-w-5xl rounded-[2rem] bg-[var(--unlocked-surface)] p-5 shadow-soft ring-1 ring-ink/8 sm:p-6"}>
      {!embedded ? <><p className="rule-label text-forest">Notifications</p><h2 className="mt-2 font-editorial text-2xl font-bold">Choose what deserves your attention.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-ink/50">Essential deadline protection remains available on Free. Weekly and recommendation emails are off unless you choose them.</p></> : <p className="max-w-2xl text-sm leading-6 text-ink/50">Deadline protection remains available on Free. Weekly and recommendation emails are off unless you choose them.</p>}

      <div className="mt-5 border-y border-ink/10">
        <Toggle checked={preferences.inAppEnabled} label="In-app notifications" description="Show timely updates inside UnlockED." onChange={(checked) => update("inAppEnabled", checked)} />
        <Toggle checked={preferences.emailEnabled} label="Email notifications" description="Allow urgent deadline and reminder emails. Marketing remains separate." onChange={(checked) => update("emailEnabled", checked)} />
        <Toggle checked={preferences.deadlineReminders} label="Deadline reminders" description="Remind you about verified deadlines for active Journey opportunities." onChange={(checked) => update("deadlineReminders", checked)} />
        <Toggle checked={preferences.journeyReminders} label="Journey reminders" description="Deliver reminders you create and occasional factual follow-ups." onChange={(checked) => update("journeyReminders", checked)} />
        <Toggle checked={preferences.opportunityChanges} label="Changes to saved opportunities" description="Tell you when a verified deadline, eligibility rule, location, award, or application status changes." onChange={(checked) => update("opportunityChanges", checked)} />
        <Toggle checked={preferences.weeklyDigest} label="Weekly UnlockED summary" description="Send one short summary only when there are meaningful updates." onChange={(checked) => update("weeklyDigest", checked)} />
        <Toggle checked={preferences.recommendationUpdates} label="New opportunities selected for you" description="Allow at most one restrained recommendation update per week. Off by default." onChange={(checked) => update("recommendationUpdates", checked)} />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-bold">Timezone
          <select value={preferences.timezone} onChange={(event) => update("timezone", event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-ink/15 bg-[var(--unlocked-surface)] px-3 text-sm font-normal">
            {timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">Notification frequency
          <select value={preferences.frequency} onChange={(event) => update("frequency", event.target.value as NotificationPreferences["frequency"])} className="mt-2 min-h-11 w-full rounded-xl border border-ink/15 bg-[var(--unlocked-surface)] px-3 text-sm font-normal">
            <option value="important_only">Important only</option>
            <option value="balanced">Balanced</option>
          </select>
        </label>
      </div>

      <label className="mt-5 flex min-h-11 items-center gap-3 text-sm font-bold">
        <input type="checkbox" checked={preferences.quietHours.enabled} onChange={(event) => update("quietHours", { ...preferences.quietHours, enabled: event.target.checked })} className="h-5 w-5 accent-forest" />
        Hold non-urgent email from 10 PM to 8 AM in my timezone
      </label>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" disabled={saving} onClick={async () => {
          setSaving(true);
          setMessage("");
          setMessageKind(null);
          try {
            const response = await fetch("/api/notifications/preferences", {
              method: "PUT",
              credentials: "same-origin",
              cache: "no-store",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ preferences: { ...preferences, updatedAt: new Date().toISOString() } }),
            });
            if (!response.ok) throw new Error("save_failed");
            const body = await response.json() as { preferences: NotificationPreferences };
            setPreferences(body.preferences);
            setMessageKind("success");
            setMessage("Notification settings saved.");
          } catch {
            setMessageKind("error");
            setMessage("We couldn’t save these settings. Your previous choices are unchanged.");
          } finally {
            setSaving(false);
          }
        }} className="min-h-11 rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-ink disabled:cursor-wait disabled:opacity-60">{saving ? "Saving…" : "Save notification settings"}</button>
        <a href="/notifications" className="inline-flex min-h-11 items-center text-sm font-bold text-forest hover:text-ink">Open notifications</a>
        {message ? <p role={messageKind === "error" ? "alert" : "status"} className={`w-full text-sm font-bold ${messageKind === "error" ? "text-red-800" : "text-forest"}`}>{message}</p> : null}
      </div>
    </div>
  </section>;
}
