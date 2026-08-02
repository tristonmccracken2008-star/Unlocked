"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { NotificationRecord, NotificationType } from "@/lib/notification-types";
import { groupNotifications, notificationTimestamp } from "@/lib/notification-presentation";
import { accountSessionEvent } from "@/data/account-sync";
import { ArrowIcon, BellIcon, BookmarkIcon, CalendarIcon, CheckCircleIcon, CheckIcon, CloseIcon, ListIcon, SparkIcon, TargetIcon } from "./icons";
import { OrganizationMark } from "./organization-logo";
import { LoadingRegion, SkeletonBlock } from "./loading-system";
import { DelayedPendingLabel } from "./delayed-pending-label";
import styles from "./notification-center.module.css";

type CenterResponse = {
  notifications: NotificationRecord[];
  unreadCount: number;
  nextCursor: number | null;
};

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

function notificationTone(type: NotificationType) {
  if (type === "deadline_reminder") return "deadline";
  if (type === "opportunity_change") return "change";
  if (type === "account") return "account";
  return "journey";
}

function NotificationTypeIcon({ type }: { type: NotificationType }) {
  if (type === "deadline_reminder") return <CalendarIcon />;
  if (type === "journey_reminder" || type === "journey_follow_up") return <BookmarkIcon />;
  if (type === "opportunity_change") return <SparkIcon />;
  if (type === "weekly_digest") return <ListIcon />;
  if (type === "recommendation_update") return <TargetIcon />;
  if (type === "milestone") return <SparkIcon />;
  return <BellIcon />;
}

function NotificationSkeleton() {
  return <div data-notification-skeleton=""><LoadingRegion label="Loading notifications" className={styles.loading}>
    <SkeletonBlock className={styles.skeletonHeading} />
    {[0, 1, 2].map((item) => <div key={item} className={styles.skeletonCard}>
      <SkeletonBlock className={styles.skeletonIcon} />
      <div className={styles.skeletonCopy}><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
      <SkeletonBlock className={styles.skeletonAction} />
    </div>)}
  </LoadingRegion></div>;
}

export function NotificationCenter() {
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [accountVersion, setAccountVersion] = useState(0);
  const [arrivingIds, setArrivingIds] = useState<Set<string>>(() => new Set());
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(() => new Set());
  const [arrivalAnnouncement, setArrivalAnnouncement] = useState("");
  const arrivalTimerRef = useRef<number | null>(null);
  const accountVersionRef = useRef(0);
  const groupsRef = useRef<HTMLDivElement | null>(null);
  const previousPositionsRef = useRef<Map<string, number> | null>(null);

  function capturePositions() {
    const positions = new Map<string, number>();
    groupsRef.current?.querySelectorAll<HTMLElement>("[data-notification-id]").forEach((element) => {
      positions.set(element.dataset.notificationId!, element.getBoundingClientRect().top);
    });
    previousPositionsRef.current = positions;
  }

  useLayoutEffect(() => {
    const previous = previousPositionsRef.current;
    previousPositionsRef.current = null;
    if (!previous || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    groupsRef.current?.querySelectorAll<HTMLElement>("[data-notification-id]").forEach((element) => {
      const priorTop = previous.get(element.dataset.notificationId!);
      if (priorTop === undefined) return;
      const offset = priorTop - element.getBoundingClientRect().top;
      if (Math.abs(offset) < 1) return;
      element.animate([
        { transform: `translate3d(0, ${offset}px, 0)` },
        { transform: "translate3d(0, 0, 0)" },
      ], { duration: 240, easing: "cubic-bezier(.2, .7, .2, 1)" });
    });
  }, [items]);

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
    let active = true;
    const refresh = () => {
      void load().then((body) => {
        if (!active) return;
        capturePositions();
        setItems((current) => {
          const currentIds = new Set(current.map((item) => item.id));
          const newIds = body.notifications.filter((item) => !currentIds.has(item.id)).map((item) => item.id);
          if (newIds.length) {
            setArrivingIds(new Set(newIds));
            setArrivalAnnouncement(newIds.length === 1 ? "One new notification arrived." : `${newIds.length} new notifications arrived.`);
            if (arrivalTimerRef.current) window.clearTimeout(arrivalTimerRef.current);
            arrivalTimerRef.current = window.setTimeout(() => setArrivingIds(new Set()), 700);
          }
          return body.notifications;
        });
        setUnreadCount(body.unreadCount);
        setNextCursor(body.nextCursor);
      }).catch(() => undefined);
    };
    window.addEventListener("unlocked:notifications-updated", refresh);
    return () => {
      active = false;
      if (arrivalTimerRef.current) window.clearTimeout(arrivalTimerRef.current);
      window.removeEventListener("unlocked:notifications-updated", refresh);
    };
  }, [accountVersion]);

  useEffect(() => {
    const accountChanged = () => {
      accountVersionRef.current += 1;
      setItems([]);
      setUnreadCount(0);
      setNextCursor(null);
      setError("");
      setLoading(true);
      setDismissingIds(new Set());
      setAccountVersion((value) => value + 1);
    };
    window.addEventListener(accountSessionEvent, accountChanged);
    return () => window.removeEventListener(accountSessionEvent, accountChanged);
  }, []);

  const groups = useMemo(() => groupNotifications(items), [items]);

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

  async function markRead(item: NotificationRecord) {
    if (item.readAt) return;
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
  }

  async function dismiss(item: NotificationRecord) {
    if (dismissingIds.has(item.id)) return;
    const requestAccountVersion = accountVersionRef.current;
    setDismissingIds((current) => new Set(current).add(item.id));
    const request = updateNotification("dismiss", item.id).then(() => true).catch(() => false);
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    if (accountVersionRef.current !== requestAccountVersion) return;
    capturePositions();
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    if (!item.readAt) setUnreadCount((count) => Math.max(0, count - 1));
    const saved = await request;
    if (accountVersionRef.current !== requestAccountVersion) return;
    if (saved) {
      window.dispatchEvent(new Event("unlocked:notifications-updated"));
    } else {
      capturePositions();
      setItems((current) => [item, ...current].sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
      if (!item.readAt) setUnreadCount((count) => count + 1);
      setError("We couldn’t dismiss that update.");
    }
    setDismissingIds((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
  }

  return <main className={styles.page}>
    <section className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <p className="rule-label text-forest">Notifications</p>
          <h1 className="mt-2 font-editorial text-4xl font-bold sm:text-5xl">Useful updates, nothing more.</h1>
          <p className="mt-3 text-sm leading-6 text-ink/55">Deadline reminders, Journey follow-ups, and meaningful changes to opportunities you saved.</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/profile#notifications" className={styles.settings}>Settings</Link>
          {unreadCount ? <button type="button" onClick={() => void markAll()} className={styles.markAll}>Mark all read</button> : null}
        </div>
      </header>

      <div aria-live="polite" className="sr-only">{loading ? "Loading notifications" : `${unreadCount} unread notifications`}</div>
      <p aria-live="polite" className="sr-only">{arrivalAnnouncement}</p>
      {error ? <div role="alert" data-inline-feedback="" data-state="error" className={styles.error}><span>{error}</span><button type="button" onClick={() => window.location.reload()}>Retry</button></div> : null}

      {loading ? <NotificationSkeleton /> : null}

      {!loading && !items.length ? <section className={styles.empty}>
        <span className={styles.emptyIcon} aria-hidden="true"><CheckCircleIcon className="h-6 w-6" /></span>
        <h2>You’re all caught up.</h2>
        <p>Important updates about your saved opportunities and Journey will appear here.</p>
        <Link href="/opportunities">Explore opportunities</Link>
      </section> : null}

      <div ref={groupsRef} className={styles.groups}>
        {groups.map((group) => {
          const headingId = `notifications-${group.label.toLowerCase().replaceAll(" ", "-")}`;
          return <section key={group.label} aria-labelledby={headingId} className={styles.group} data-notification-group={group.label}>
            <h2 id={headingId} className={styles.groupHeading}>{group.label}</h2>
            <ol className={styles.list}>
              {group.items.map((item) => <li key={item.id} data-notification-item="" data-notification-id={item.id} data-notification-item-arrived={arrivingIds.has(item.id) ? "true" : undefined} data-read={item.readAt ? "true" : "false"} data-dismissing={dismissingIds.has(item.id) ? "true" : undefined} className={styles.item}>
                <div className={styles.content}>
                  <span className={styles.iconWrap}>
                    {item.organization ? <OrganizationMark organization={item.organization} size="sm" /> : <span className={styles.icon} data-tone={notificationTone(item.type)} aria-hidden="true"><NotificationTypeIcon type={item.type} /></span>}
                    <span className={styles.unreadIndicator} data-visible={item.readAt ? "false" : "true"} />
                  </span>
                  <div className={styles.copy}>
                    <div className={styles.titleRow}>
                      <h3 className={styles.title}>{item.title}</h3>
                      <time dateTime={item.createdAt} className={styles.timestamp}>{notificationTimestamp(item.createdAt)}</time>
                      {!item.readAt ? <span className="sr-only">Unread</span> : <span className="sr-only">Read</span>}
                    </div>
                    {item.organization ? <p className={styles.organization}>{item.organization}</p> : null}
                    <p className={styles.body}>{item.body}</p>
                  </div>
                </div>
                <div className={styles.actions}>
                  <Link href={item.actionHref} onClick={() => {
                    void updateNotification("acted", item.id)
                      .then(() => window.dispatchEvent(new Event("unlocked:notifications-updated")))
                      .catch(() => setError("The update opened, but its notification state could not be saved."));
                  }} className={styles.primaryAction}>{item.actionLabel} <ArrowIcon /></Link>
                  <button type="button" onClick={() => void markRead(item)} disabled={Boolean(item.readAt)} data-read={item.readAt ? "true" : "false"} className={`${styles.iconAction} ${styles.readAction}`} aria-label={item.readAt ? `Read: ${item.title}` : `Mark as read: ${item.title}`} title={item.readAt ? "Read" : "Mark as read"}><CheckIcon /></button>
                  <button type="button" onClick={() => void dismiss(item)} disabled={dismissingIds.has(item.id)} className={styles.iconAction} aria-label={`Dismiss: ${item.title}`} title="Dismiss"><CloseIcon /></button>
                </div>
              </li>)}
            </ol>
          </section>;
        })}
      </div>

      {nextCursor !== null ? <div className={styles.loadMoreWrap}><button type="button" disabled={loadingMore} onClick={async () => {
        setLoadingMore(true);
        setError("");
        try {
          const body = await load(nextCursor);
          capturePositions();
          setItems((current) => [...current, ...body.notifications.filter((item) => !current.some((existing) => existing.id === item.id))]);
          setNextCursor(body.nextCursor);
        } catch {
          setError("We couldn’t load older updates.");
        } finally {
          setLoadingMore(false);
        }
      }} aria-busy={loadingMore ? "true" : undefined} data-action-state={loadingMore ? "loading" : "idle"} className={styles.loadMore}><DelayedPendingLabel pending={loadingMore} idle="Show older updates" pendingLabel="Loading older updates…" /></button></div> : null}
    </section>
  </main>;
}
