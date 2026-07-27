"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { NotificationRecord } from "@/lib/notification-types";
import { accountSessionEvent } from "@/data/account-sync";

type CenterResponse = {
  notifications: NotificationRecord[];
  unreadCount: number;
  nextCursor: number | null;
};

function relativeTime(timestamp: string) {
  const value = Date.parse(timestamp);
  if (!Number.isFinite(value)) return "";
  const difference = Date.now() - value;
  if (difference < 60_000) return "Just now";
  if (difference < 3_600_000) return `${Math.max(1, Math.floor(difference / 60_000))}m ago`;
  if (difference < 86_400_000) return `${Math.max(1, Math.floor(difference / 3_600_000))}h ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

async function updateNotification(action: "read" | "dismiss" | "acted" | "mark_all_read", notificationId?: string) {
  const response = await fetch("/api/notifications", {
    method: "PATCH",
    credentials: "same-origin",
    cache: "no-store",
    keepalive: action === "acted",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, notificationId }),
  });
  if (!response.ok) throw new Error("Notification update failed.");
  return await response.json();
}

export function NotificationCenter() {
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [accountVersion, setAccountVersion] = useState(0);

  async function load(cursor = 0) {
    const response = await fetch(`/api/notifications?cursor=${cursor}`, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("Notifications could not be loaded.");
    return await response.json() as CenterResponse;
  }

  useEffect(() => {
    let active = true;
    load().then((body) => {
      if (!active) return;
      setItems(body.notifications);
      setUnreadCount(body.unreadCount);
      setNextCursor(body.nextCursor);
    }).catch(() => {
      if (active) setError("We couldn’t load your updates. Try again.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [accountVersion]);

  useEffect(() => {
    const accountChanged = () => {
      setItems([]);
      setUnreadCount(0);
      setNextCursor(null);
      setError("");
      setLoading(true);
      setAccountVersion((value) => value + 1);
    };
    window.addEventListener(accountSessionEvent, accountChanged);
    return () => window.removeEventListener(accountSessionEvent, accountChanged);
  }, []);

  const groups = useMemo(() => {
    const today = new Date().toDateString();
    return [
      { label: "Today", items: items.filter((item) => new Date(item.createdAt).toDateString() === today) },
      { label: "Earlier", items: items.filter((item) => new Date(item.createdAt).toDateString() !== today) },
    ].filter((group) => group.items.length);
  }, [items]);

  async function markAll() {
    const previous = items;
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now, state: item.state === "delivered" ? "read" : item.state })));
    setUnreadCount(0);
    try {
      await updateNotification("mark_all_read");
      window.dispatchEvent(new Event("unlocked:notifications-updated"));
    } catch {
      setItems(previous);
      setUnreadCount(previous.filter((item) => !item.readAt).length);
      setError("We couldn’t mark those updates as read.");
    }
  }

  async function dismiss(item: NotificationRecord) {
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    if (!item.readAt) setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await updateNotification("dismiss", item.id);
      window.dispatchEvent(new Event("unlocked:notifications-updated"));
    } catch {
      setItems((current) => [item, ...current].sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
      if (!item.readAt) setUnreadCount((count) => count + 1);
      setError("We couldn’t dismiss that update.");
    }
  }

  return <main className="px-5 py-10 pb-28 sm:px-8 sm:py-14">
    <section className="mx-auto max-w-4xl">
      <header className="flex flex-col gap-5 border-b border-ink/15 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="rule-label text-forest">Notifications</p>
          <h1 className="mt-2 font-editorial text-4xl font-bold sm:text-5xl">Useful updates, nothing more.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/55">Deadline reminders, Journey follow-ups, and meaningful changes to opportunities you saved.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/profile#notifications" className="inline-flex min-h-11 items-center text-sm font-bold text-forest hover:text-ink">Settings</Link>
          {unreadCount ? <button type="button" onClick={() => void markAll()} className="min-h-11 rounded-full border border-ink/15 px-4 text-sm font-bold text-ink/60 hover:border-forest hover:text-forest">Mark all read</button> : null}
        </div>
      </header>

      <div aria-live="polite" className="sr-only">{loading ? "Loading notifications" : `${unreadCount} unread notifications`}</div>
      {error ? <div role="alert" className="mt-6 flex items-center justify-between gap-4 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"><span>{error}</span><button type="button" onClick={() => window.location.reload()} className="min-h-11 px-3 font-bold">Retry</button></div> : null}

      {loading ? <div aria-hidden="true" className="mt-8 space-y-3 animate-pulse">
        {[0, 1, 2].map((item) => <div key={item} className="h-32 bg-[var(--unlocked-surface)] shadow-soft ring-1 ring-ink/6" />)}
      </div> : null}

      {!loading && !items.length ? <section className="py-20 text-center">
        <div className="mx-auto h-12 w-px bg-forest/30" />
        <h2 className="mt-5 font-editorial text-3xl font-bold">Nothing needs your attention.</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/50">When a saved deadline approaches or something important changes, it will appear here.</p>
        <Link href="/opportunities" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-ink">Explore opportunities</Link>
      </section> : null}

      {groups.map((group) => <section key={group.label} aria-labelledby={`notifications-${group.label.toLowerCase()}`} className="mt-10">
        <h2 id={`notifications-${group.label.toLowerCase()}`} className="font-editorial text-2xl font-bold">{group.label}</h2>
        <ol className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
          {group.items.map((item) => <li key={item.id} className={`relative grid gap-4 py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${item.readAt ? "opacity-70" : ""}`}>
            <div className="flex min-w-0 gap-4">
              <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? "border border-ink/25 bg-transparent" : item.priority === "high" ? "bg-gold" : "bg-forest"}`} aria-hidden="true" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="font-editorial text-xl font-bold">{item.title}</h3>
                  <time dateTime={item.createdAt} className="text-xs font-semibold text-ink/35">{relativeTime(item.createdAt)}</time>
                  {!item.readAt ? <span className="sr-only">Unread</span> : <span className="sr-only">Read</span>}
                </div>
                {item.organization ? <p className="mt-1 text-xs font-bold uppercase tracking-wider text-forest">{item.organization}</p> : null}
                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/55">{item.body}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-6 sm:pl-0">
              <Link href={item.actionHref} onClick={() => {
                void updateNotification("acted", item.id).then(() => window.dispatchEvent(new Event("unlocked:notifications-updated")));
              }} className="inline-flex min-h-11 items-center rounded-full bg-forest px-4 text-sm font-bold text-white hover:bg-ink">{item.actionLabel}</Link>
              {!item.readAt ? <button type="button" onClick={async () => {
                const previous = items;
                const now = new Date().toISOString();
                setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, readAt: now, state: "read" } : candidate));
                setUnreadCount((count) => Math.max(0, count - 1));
                try {
                  await updateNotification("read", item.id);
                  window.dispatchEvent(new Event("unlocked:notifications-updated"));
                } catch {
                  setItems(previous);
                  setUnreadCount((count) => count + 1);
                  setError("We couldn’t mark that update as read.");
                }
              }} className="min-h-11 px-3 text-sm font-bold text-ink/40 hover:text-forest" aria-label={`Mark as read: ${item.title}`}>Mark read</button> : null}
              <button type="button" onClick={() => void dismiss(item)} className="min-h-11 px-3 text-sm font-bold text-ink/40 hover:text-forest" aria-label={`Dismiss: ${item.title}`}>Dismiss</button>
            </div>
          </li>)}
        </ol>
      </section>)}

      {nextCursor !== null ? <div className="mt-8 text-center"><button type="button" disabled={loadingMore} onClick={async () => {
        setLoadingMore(true);
        setError("");
        try {
          const body = await load(nextCursor);
          setItems((current) => [...current, ...body.notifications.filter((item) => !current.some((existing) => existing.id === item.id))]);
          setNextCursor(body.nextCursor);
        } catch {
          setError("We couldn’t load older updates.");
        } finally {
          setLoadingMore(false);
        }
      }} className="min-h-11 rounded-full border border-ink/15 px-5 text-sm font-bold text-ink/60 hover:border-forest hover:text-forest disabled:opacity-60">{loadingMore ? "Loading…" : "Show older updates"}</button></div> : null}
    </section>
  </main>;
}
