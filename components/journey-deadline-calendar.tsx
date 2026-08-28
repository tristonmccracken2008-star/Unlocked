"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/data/authenticated-request";
import { accountSessionEvent } from "@/data/account-sync";
import { ArrowIcon, CalendarIcon, CheckIcon, CloseIcon } from "@/components/icons";
import type { JourneyCalendarItem, JourneyCalendarModel } from "@/lib/journey-calendar";
import { calendarEventTypeLabels } from "@/lib/journey-calendar";
import type { CalendarIntelligenceCluster, CalendarIntelligenceEvent, CalendarIntelligenceHorizon, CalendarIntelligenceModel } from "@/lib/calendar-intelligence";
import type { JourneyCalendarEventType } from "@/lib/account-types";
import styles from "./journey-deadline-calendar.module.css";
import { SmartEmptyState } from "./smart-empty-state";
import { ActionButtonLabel, ActionFeedback } from "./action-feedback";
import { useUndoRecovery } from "./undo-recovery";
import { journeyCalendarAddEvent, type JourneyCalendarAddContext } from "@/data/journey-calendar-context";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { trackProductEvent } from "@/data/product-analytics";
import { dateAfterOfficialDeadline, dateShortcutOptions, explicitDateFromShortcut } from "@/data/form-experience";

type View = "upcoming" | "calendar" | "conflicts";
type Draft = {
  id?: string;
  version?: number;
  title: string;
  type: JourneyCalendarEventType;
  date: string;
  time: string;
  opportunityId: string;
  reminderMinutesBefore: string;
};

const emptyDraft = (): Draft => ({ title: "", type: "personal_target", date: "", time: "", opportunityId: "", reminderMinutesBefore: "" });
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const viewStorageKey = "unlocked:journey-calendar-view:v1";

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00.000Z`));
}

function formatMonth(month: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00.000Z`));
}

function shiftMonth(month: string, offset: number) {
  const [year, value] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, value - 1 + offset, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthCells(month: string) {
  const [year, value] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, value - 1, 1));
  const start = new Date(first.getTime() - first.getUTCDay() * 86_400_000);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10));
}

function eventLabel(item: JourneyCalendarItem) {
  if (item.type === "application_deadline") return "Application deadline";
  if (item.type === "application_open") return "Applications open";
  if (item.type === "program_start") return "Program starts";
  return calendarEventTypeLabels[item.type];
}

function intelligenceEventLabel(item: CalendarIntelligenceEvent) {
  if (item.kind === "application_deadline") return "Application deadline";
  if (item.kind === "personal_task") return "Private application task";
  if (item.kind === "opening_date") return item.relationship === "watching" ? "Watched opening" : "Applications open";
  return "Journey date";
}

function formatDateRange(startDate: string, endDate: string) {
  if (startDate === endDate) return formatDay(startDate);
  const start = new Date(`${startDate}T12:00:00.000Z`);
  const end = new Date(`${endDate}T12:00:00.000Z`);
  const sameMonth = startDate.slice(0, 7) === endDate.slice(0, 7);
  const first = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(start);
  const last = new Intl.DateTimeFormat("en-US", sameMonth ? { day: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" }).format(end);
  return `${first}–${last}`;
}

function clusterHeadline(cluster: CalendarIntelligenceCluster) {
  const parts = [
    cluster.deadlineCount ? `${cluster.deadlineCount} application ${cluster.deadlineCount === 1 ? "deadline" : "deadlines"}` : "",
    cluster.taskCount ? `${cluster.taskCount} private ${cluster.taskCount === 1 ? "task" : "tasks"}` : "",
    cluster.openingCount ? `${cluster.openingCount} watched ${cluster.openingCount === 1 ? "opening" : "openings"}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function IntelligenceEventList({ events, label }: { events: CalendarIntelligenceEvent[]; label: string }) {
  if (!events.length) return null;
  return <section className={styles.intelligenceEventGroup}><h4>{label}</h4><ol>{events.map((event) => <li key={event.id}>
    <time dateTime={event.date}>{formatDay(event.date)}</time>
    <div><strong>{event.title}</strong><span>{intelligenceEventLabel(event)}{event.organization ? ` · ${event.organization}` : ""}</span>{event.workspace?.requirementChangeLabel ? <small>{event.workspace.requirementChangeLabel}</small> : null}</div>
  </li>)}</ol></section>;
}

function CalendarIntelligence({ model, horizon, onHorizon }: { model: CalendarIntelligenceModel; horizon: CalendarIntelligenceHorizon; onHorizon: (horizon: CalendarIntelligenceHorizon) => void }) {
  const period = model.periods[String(horizon) as `${CalendarIntelligenceHorizon}`];
  const featured = period.clusters.find((cluster) => cluster.id === period.featuredClusterId);
  const hasDates = period.fixedCount + period.userEditableCount > 0;
  return <div className={styles.intelligence} data-calendar-intelligence="">
    <div className={styles.intelligenceIntro}>
      <p>Conflict Planning groups nearby deadlines and tasks so you can spot busy periods early. Official dates never move.</p>
      <div className={styles.horizonToggle} aria-label="Conflict planning horizon">{([30, 60, 90] as const).map((days) => <button key={days} type="button" aria-pressed={horizon === days} onClick={() => onHorizon(days)}>{days === 90 ? "Next 90 days" : `Next ${days} days`}</button>)}</div>
    </div>
    {hasDates ? <>
      <dl className={styles.intelligenceSummary}>
        <div><dt>Fixed provider dates</dt><dd>{period.fixedCount}</dd></div>
        <div><dt>Your editable dates</dt><dd>{period.userEditableCount}</dd></div>
        <div><dt>Application deadlines</dt><dd>{period.deadlineCount}</dd></div>
        <div><dt>Private tasks</dt><dd>{period.taskCount}</dd></div>
      </dl>
      {featured ? <p className={styles.busiest}><span>Busiest period</span><strong>{formatDateRange(featured.startDate, featured.endDate)}</strong><small>{clusterHeadline(featured)}</small></p> : <p className={styles.calmState}>No nearby date clusters in the next {horizon} days. Your dates remain visible below.</p>}
      {period.clusters.length ? <section className={styles.clusters} aria-labelledby="calendar-busy-periods"><header><div><p>Upcoming concentration</p><h3 id="calendar-busy-periods">Busy periods</h3></div><span>{period.clusters.length} {period.clusters.length === 1 ? "period" : "periods"}</span></header>{period.clusters.map((cluster) => {
        const fixed = cluster.events.filter((event) => event.dateControl === "fixed");
        const editable = cluster.events.filter((event) => event.dateControl === "user_editable");
        return <details key={cluster.id} className={styles.cluster} data-featured={cluster.id === period.featuredClusterId ? "true" : undefined} onToggle={(event) => { if (event.currentTarget.open) trackProductEvent(productIntelligenceEvents.calendarClusterOpened, { source: cluster.sameDay ? "same_day" : "multi_day", action: String(horizon) }); }}>
          <summary><time dateTime={cluster.startDate}>{formatDateRange(cluster.startDate, cluster.endDate)}</time><span><strong>{clusterHeadline(cluster)}</strong><small>{cluster.sameDay ? "Same-day fixed dates" : `${cluster.spanDays}-day period`} · {cluster.applicationCount} ${cluster.applicationCount === 1 ? "application" : "applications"}</small></span><ArrowIcon /></summary>
          <div className={styles.clusterDetails}>
            <div className={styles.clusterContext}>
              <span>{cluster.fixedCount} fixed</span><span>{cluster.userEditableCount} user-editable</span>
              {cluster.missingMaterialApplicationCount ? <span>{cluster.missingMaterialApplicationCount} {cluster.missingMaterialApplicationCount === 1 ? "application needs" : "applications need"} Materials</span> : null}
              {cluster.requirementChangeCount ? <span>{cluster.requirementChangeCount} recent verified requirement {cluster.requirementChangeCount === 1 ? "change" : "changes"}</span> : null}
            </div>
            <IntelligenceEventList events={fixed} label="Fixed dates" />
            <IntelligenceEventList events={editable} label="Your dates" />
            <nav className={styles.clusterActions} aria-label={`Actions for ${formatDateRange(cluster.startDate, cluster.endDate)}`}>
              {cluster.applicationCount ? <Link href="/applications" onClick={() => trackProductEvent(productIntelligenceEvents.calendarClusterToApplication, { source: cluster.sameDay ? "same_day" : "multi_day" })}>View affected applications <ArrowIcon /></Link> : null}
              {cluster.missingMaterialApplicationCount ? <Link href="/materials">Open Materials <ArrowIcon /></Link> : null}
              {cluster.userEditableCount ? <Link href="/applications">Review task dates <ArrowIcon /></Link> : null}
            </nav>
          </div>
        </details>;
      })}</section> : null}
      {period.unclustered.length ? <details className={styles.otherDates}><summary>Other dates in this horizon <span>{period.unclustered.length}</span></summary><div><IntelligenceEventList events={period.unclustered} label="Upcoming dates" /></div></details> : null}
      {period.monthSummaries.length ? <section className={styles.monthSummaries} aria-labelledby="calendar-month-summary"><header><p>At a glance</p><h3 id="calendar-month-summary">By month</h3></header><div>{period.monthSummaries.map((month) => <dl key={month.month}><dt>{formatMonth(month.month)}</dt><dd>{month.deadlineCount} {month.deadlineCount === 1 ? "deadline" : "deadlines"}</dd><dd>{month.taskCount} {month.taskCount === 1 ? "task" : "tasks"}</dd>{month.openingCount ? <dd>{month.openingCount} watched {month.openingCount === 1 ? "opening" : "openings"}</dd> : null}</dl>)}</div></section> : null}
      {model.undatedTaskCount ? <p className={styles.undated}>{model.undatedTaskCount} incomplete application {model.undatedTaskCount === 1 ? "task has" : "tasks have"} no due date. <Link href="/applications">Review tasks</Link></p> : null}
    </> : <SmartEmptyState compact title="No upcoming application dates yet." description="Verified dates from Journey, Applications, and watched opportunities will appear here. Conflict Planning only creates a busy period when dates actually cluster." primaryAction={{ label: "Explore opportunities", href: "/opportunities" }} secondaryAction={{ label: "Open Planner", href: "/planner" }} icon={CalendarIcon} />}
  </div>;
}

function errorMessage(status: number, fallback?: string) {
  if (status === 401) return "Your session ended. Sign in again to update your calendar.";
  if (status === 403) return "This calendar update could not be verified. Refresh and try again.";
  if (status === 409) return "This date changed elsewhere. Refreshing the latest version.";
  if (status === 423) return "Another calendar update is still saving. Try again in a moment.";
  return fallback || "We couldn’t save this date. Nothing changed.";
}

function EventRow({ item, onEdit, onAction, pending }: {
  item: JourneyCalendarItem;
  onEdit: (item: JourneyCalendarItem) => void;
  onAction: (item: JourneyCalendarItem, action: "complete" | "dismiss") => void;
  pending: string;
}) {
  const destination = item.opportunityId ? `/#journey-record-${encodeURIComponent(item.opportunityId)}` : undefined;
  return <article className={styles.event} data-urgency={item.urgency}>
    <time dateTime={`${item.date}${item.time ? `T${item.time}` : ""}`}><strong>{formatDay(item.date)}</strong>{item.time ? <span>{new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(`2000-01-01T${item.time}:00`))}</span> : null}</time>
    <div>
      <p>{item.source === "official" ? item.opportunityTitle ?? item.title : item.title}</p>
      <span>{item.source === "official"
        ? `${eventLabel(item)}${item.organization ? ` · ${item.organization}` : ""}`
        : item.source === "application_task"
          ? `Application task${item.opportunityTitle ? ` · ${item.opportunityTitle}` : ""}`
          : `${eventLabel(item)}${item.opportunityTitle ? ` · ${item.opportunityTitle}` : ""}`}</span>
      <small data-urgency={item.urgency}>{item.timingLabel}{item.source === "official" ? " · Official date · Verified" : item.source === "user" ? " · Your date · Editable" : ""}</small>
    </div>
    <div className={styles.eventActions}>
      {destination ? <Link href={destination} aria-label={`Open Journey item for ${item.opportunityTitle ?? item.title}`}><ArrowIcon /></Link> : null}
      {item.opportunityId ? <Link href={`/opportunities/${encodeURIComponent(item.opportunityId)}`} className={styles.textAction}>View opportunity</Link> : null}
      {item.source === "user" ? <button type="button" onClick={() => onEdit(item)} disabled={Boolean(pending)}>Edit</button> : null}
      {item.source === "user" ? <button type="button" onClick={() => onAction(item, item.urgency === "overdue" ? "dismiss" : "complete")} disabled={Boolean(pending)} aria-busy={pending === item.id ? "true" : undefined} data-action-state={pending === item.id ? "loading" : "idle"}><ActionButtonLabel phase={pending === item.id ? "pending" : "idle"} idle={item.urgency === "overdue" ? "Dismiss" : "Done"} pending="Saving…" /></button> : null}
    </div>
  </article>;
}

function EventGroups({ groups, onEdit, onAction, pending, idPrefix = "primary" }: {
  groups: JourneyCalendarModel["groups"];
  onEdit: (item: JourneyCalendarItem) => void;
  onAction: (item: JourneyCalendarItem, action: "complete" | "dismiss") => void;
  pending: string;
  idPrefix?: string;
}) {
  return groups.map((group) => <section key={group.id} className={styles.group} aria-labelledby={`calendar-group-${idPrefix}-${group.id}`}><h3 id={`calendar-group-${idPrefix}-${group.id}`}>{group.label}</h3><div>{group.items.map((item) => <EventRow key={item.id} item={item} onEdit={onEdit} onAction={onAction} pending={pending} />)}</div></section>);
}

export function JourneyDeadlineCalendar({ model, intelligence }: { model: JourneyCalendarModel; intelligence: CalendarIntelligenceModel }) {
  const router = useRouter();
  const { offerUndo } = useUndoRecovery();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const createRequestIdRef = useRef("");
  const contextualTriggerRef = useRef<HTMLButtonElement | null>(null);
  const openedDraftRef = useRef<Draft>(emptyDraft());
  const titleId = useId();
  const [view, setView] = useState<View>("upcoming");
  const [horizon, setHorizon] = useState<CalendarIntelligenceHorizon>(30);
  const [month, setMonth] = useState(model.initialMonth);
  const [selectedDate, setSelectedDate] = useState(model.items.find((item) => item.date.startsWith(model.initialMonth))?.date ?? `${model.initialMonth}-01`);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [context, setContext] = useState<JourneyCalendarAddContext | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(openedDraftRef.current);
  const cells = useMemo(() => monthCells(month), [month]);
  const selectedItems = model.items.filter((item) => item.date === selectedDate);
  const datesWithEvents = useMemo(() => new Set(model.items.map((item) => item.date)), [model.items]);
  const { primaryGroups, additionalGroups, additionalCount } = useMemo(() => {
    let remaining = 5;
    const primary: JourneyCalendarModel["groups"] = [];
    const additional: JourneyCalendarModel["groups"] = [];
    for (const group of model.groups) {
      const primaryItems = group.id === "passed" ? [] : group.items.slice(0, remaining);
      const additionalItems = group.items.slice(primaryItems.length);
      if (primaryItems.length) primary.push({ ...group, items: primaryItems });
      if (additionalItems.length) additional.push({ ...group, items: additionalItems });
      remaining -= primaryItems.length;
    }
    return { primaryGroups: primary, additionalGroups: additional, additionalCount: additional.reduce((count, group) => count + group.items.length, 0) };
  }, [model.groups]);

  useEffect(() => {
    try {
      const remembered = sessionStorage.getItem(viewStorageKey);
      const requested = new URLSearchParams(window.location.search).get("calendar");
      const initial = requested === "conflicts" ? "conflicts" : remembered;
      if (initial === "calendar" || initial === "upcoming" || initial === "conflicts") setView(initial);
    } catch { /* Session preference is best effort. */ }
    const contextualAdd = (event: Event) => {
      const detail = (event as CustomEvent<JourneyCalendarAddContext>).detail;
      if (!detail || !model.trackedOptions.some((item) => item.id === detail.opportunityId)) return;
      contextualTriggerRef.current = detail.trigger ?? null;
      openAdd("", detail);
      document.querySelector("[data-journey-calendar]")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    };
    const reset = () => {
      requestRef.current?.abort("account-changed");
      dialogRef.current?.close();
      setSaving(false);
      setPending("");
      setError("");
      setFeedback("");
      setRetry(null);
      setDraft(emptyDraft());
      setContext(null);
      createRequestIdRef.current = "";
    };
    window.addEventListener(accountSessionEvent, reset);
    window.addEventListener(journeyCalendarAddEvent, contextualAdd);
    return () => { requestRef.current?.abort("unmounted"); window.removeEventListener(accountSessionEvent, reset); window.removeEventListener(journeyCalendarAddEvent, contextualAdd); };
  }, [model.trackedOptions]);

  function selectView(next: View) {
    setView(next);
    trackProductEvent(productIntelligenceEvents.calendarViewChanged, { action: next });
    if (next === "conflicts") trackProductEvent(productIntelligenceEvents.calendarIntelligenceOpened, { source: "journey_calendar" });
    try { sessionStorage.setItem(viewStorageKey, next); } catch { /* Session preference is best effort. */ }
  }

  function openAdd(date = "", addContext: JourneyCalendarAddContext | null = null) {
    createRequestIdRef.current = `event:${crypto.randomUUID()}`;
    setContext(addContext);
    const nextDraft = { ...emptyDraft(), date, ...(addContext ? { title: addContext.title, type: addContext.type, opportunityId: addContext.opportunityId, reminderMinutesBefore: addContext.reminderMinutesBefore === undefined ? "" : String(addContext.reminderMinutesBefore) } : {}) };
    openedDraftRef.current = nextDraft;
    setDraft(nextDraft);
    setError("");
    setFeedback("");
    setRetry(null);
    dialogRef.current?.showModal();
  }

  function openEdit(item: JourneyCalendarItem) {
    if (item.source !== "user" || item.type === "application_deadline" || item.type === "application_open" || item.type === "program_start") return;
    const nextDraft = { id: item.id, version: item.version, title: item.title, type: item.type, date: item.date, time: item.time ?? "", opportunityId: item.opportunityId ?? "", reminderMinutesBefore: item.reminderMinutesBefore === undefined ? "" : String(item.reminderMinutesBefore) };
    openedDraftRef.current = nextDraft;
    setContext(null);
    setDraft(nextDraft);
    setError("");
    setFeedback("");
    setRetry(null);
    dialogRef.current?.showModal();
  }

  function close(force = false) {
    if (saving) return;
    if (!force && dirty && !window.confirm("Discard this unsaved date?")) return;
    dialogRef.current?.close();
    const cleared = emptyDraft();
    openedDraftRef.current = cleared;
    setDraft(cleared);
    setContext(null);
    setError("");
    createRequestIdRef.current = "";
    (contextualTriggerRef.current ?? addButtonRef.current)?.focus();
    contextualTriggerRef.current = null;
  }

  async function save() {
    if (!draft.title.trim() || !draft.date || saving) return;
    setSaving(true);
    setError("");
    setFeedback("");
    setRetry(null);
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), 8_000);
    try {
      const response = await authenticatedFetch("/api/journey/calendar", {
        method: draft.id ? "PATCH" : "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          ...(draft.id ? { id: draft.id, expectedVersion: draft.version, action: "update" } : { idempotencyKey: createRequestIdRef.current }),
          title: draft.title,
          type: draft.type,
          date: draft.date,
          time: draft.time || undefined,
          opportunityId: draft.opportunityId || undefined,
          reminderMinutesBefore: draft.reminderMinutesBefore === "" ? undefined : Number(draft.reminderMinutesBefore),
        }),
      });
      const body = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !body?.ok) {
        setError(errorMessage(response.status, body?.error));
        setRetry(() => () => void save());
        if (response.status === 409) router.refresh();
        return;
      }
      const savedMessage = draft.id ? "Date updated." : "Date added.";
      if (!draft.id && context) trackProductEvent(productIntelligenceEvents.smartDefaultInteraction, { action: "accepted", source: context.type });
      close(true);
      setFeedback(savedMessage);
      router.refresh();
    } catch {
      if (!controller.signal.aborted || controller.signal.reason === "timeout") {
        setError(controller.signal.reason === "timeout" ? "Saving took too long. Your previous calendar is still intact." : "We couldn’t reach UnlockED. Your previous calendar is still intact.");
        setRetry(() => () => void save());
      }
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
      setSaving(false);
    }
  }

  async function updateState(item: JourneyCalendarItem, action: "complete" | "dismiss") {
    if (pending) return;
    setPending(item.id);
    setError("");
    setFeedback("");
    setRetry(null);
    try {
      const response = await authenticatedFetch("/api/journey/calendar", { method: "PATCH", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, expectedVersion: item.version, action }) });
      const body = await response.json().catch(() => null) as { ok?: boolean; error?: string; event?: { version: number } } | null;
      if (!response.ok || !body?.ok) {
        setError(errorMessage(response.status, body?.error));
        setRetry(() => () => void updateState(item, action));
        if (response.status === 409) router.refresh();
        return;
      }
      const version = body.event?.version;
      if (version === undefined) throw new Error("Calendar response was incomplete");
      offerUndo({
        message: action === "complete" ? "Date completed." : "Reminder dismissed.",
        restoredMessage: action === "complete" ? "Date restored." : "Reminder restored.",
        undo: async () => {
          const restored = await authenticatedFetch("/api/journey/calendar", {
            method: "PATCH",
            credentials: "same-origin",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: item.id, expectedVersion: version, action: "restore" }),
          });
          if (!restored.ok) throw new Error("Calendar restore failed");
          router.refresh();
        },
      });
      router.refresh();
    } catch {
      setError("We couldn’t reach UnlockED. Your calendar is unchanged.");
      setRetry(() => () => void updateState(item, action));
    } finally {
      setPending("");
    }
  }

  return <section id="journey-calendar" className={styles.shell} aria-labelledby="journey-upcoming-heading" data-journey-calendar="" data-guide-anchor="journey-calendar">
    <header className={styles.header}>
      <div><p>Schedule</p><h2 id="journey-upcoming-heading">{view === "conflicts" ? "Conflict Planning" : "Upcoming"}</h2></div>
      <div className={styles.headerActions}>
        <div className={styles.toggle} aria-label="Deadline view"><button type="button" aria-pressed={view === "upcoming"} onClick={() => selectView("upcoming")}>Upcoming</button><button type="button" aria-pressed={view === "calendar"} onClick={() => selectView("calendar")}>Calendar</button><button type="button" aria-pressed={view === "conflicts"} onClick={() => selectView("conflicts")}>Busy periods</button></div>
        <button ref={addButtonRef} type="button" className={styles.add} onClick={() => openAdd()}>Add date</button>
      </div>
    </header>
    {view !== "conflicts" && model.items.some((item) => item.source === "official") ? <p className={styles.automaticNote}>Verified official dates appear automatically. Personal dates remain yours to edit.</p> : null}
    {feedback ? <ActionFeedback message={feedback} state="success" level="routine" /> : null}
    {error && !dialogRef.current?.open ? <ActionFeedback message={error} state="error" action={retry ? { label: "Try again", onClick: retry, pending: Boolean(pending) } : undefined} /> : null}

    {view === "upcoming" ? <div className={styles.upcoming}>
      {model.groups.length ? <><EventGroups groups={primaryGroups} onEdit={openEdit} onAction={updateState} pending={pending} />{additionalCount ? <details className={styles.additional}><summary>Show {additionalCount} more {additionalCount === 1 ? "date" : "dates"}</summary><div><EventGroups groups={additionalGroups} onEdit={openEdit} onAction={updateState} pending={pending} idPrefix="additional" /></div></details> : null}</> : <SmartEmptyState compact title="Nothing coming up yet." description="Opportunity deadlines and the dates you add yourself will appear here." primaryAction={{ label: "Add date", onClick: () => openAdd() }} secondaryAction={model.trackedOptions.length ? { label: "Explore opportunities", href: "/opportunities" } : undefined} icon={CalendarIcon} />}
    </div> : view === "calendar" ? <div className={styles.calendarLayout}>
      <div className={styles.calendar}>
        <header><button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><ArrowIcon /></button><h3 aria-live="polite">{formatMonth(month)}</h3><button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month"><ArrowIcon /></button></header>
        <div className={styles.weekdays} aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
        <div className={styles.grid} role="grid" aria-label={formatMonth(month)}>{cells.map((date) => {
          const inMonth = date.startsWith(month);
          const hasEvents = datesWithEvents.has(date);
          return <button key={date} type="button" role="gridcell" aria-selected={selectedDate === date} data-outside={!inMonth ? "true" : undefined} data-events={hasEvents ? "true" : undefined} onClick={() => setSelectedDate(date)}><time dateTime={date}>{Number(date.slice(8))}</time>{hasEvents ? <span className="sr-only">Has events</span> : null}</button>;
        })}</div>
      </div>
      <aside className={styles.dayPanel} aria-live="polite"><header><div><p>Selected day</p><h3>{formatDay(selectedDate)}</h3></div><button type="button" onClick={() => openAdd(selectedDate)}>Add date</button></header>{selectedItems.length ? selectedItems.map((item) => <EventRow key={item.id} item={item} onEdit={openEdit} onAction={updateState} pending={pending} />) : <p className={styles.noDayEvents}>No dates on this day.</p>}</aside>
    </div> : <CalendarIntelligence model={intelligence} horizon={horizon} onHorizon={setHorizon} />}

    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!saving) close(); }}>
      <form method="dialog" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <header><div><p>Journey date</p><h2 id={titleId}>{draft.id ? "Edit date" : "Add a date"}</h2><span>Keep only what you need to remember.</span></div><button type="button" onClick={() => close()} disabled={saving} aria-label="Close date form"><CloseIcon /></button></header>
        <div className={styles.fields}>
          <label>Title<input required maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Essay draft due" /></label>
          <label>Date<input required type="date" value={draft.date} onChange={(event) => { setDraft({ ...draft, date: event.target.value }); setError(""); }} /></label>
          {!draft.id ? <div className={styles.dateShortcuts} aria-label="Date shortcuts">{dateShortcutOptions.map((option) => <button key={option.id} type="button" onClick={() => setDraft({ ...draft, date: explicitDateFromShortcut(option.days) })}>{option.label}</button>)}</div> : null}
          {draft.date ? <p className={styles.explicitDate}>Selected date: <strong>{formatDay(draft.date)}</strong>{model.timezone ? ` · ${model.timezone.replaceAll("_", " ")}` : ""}</p> : null}
          {dateAfterOfficialDeadline(draft.date, context?.officialDeadline) ? <p className={styles.deadlineWarning} role="status">This personal target is after the verified official deadline of {formatDay(context!.officialDeadline!)}. You can still save it.</p> : null}
          {context && !draft.id ? <p className={styles.contextLink}><span>Linked opportunity</span><strong>{context.opportunityTitle}</strong></p> : null}
          <details className={styles.moreOptions} open={Boolean(draft.id)} onToggle={(event) => { if (event.currentTarget.open && !draft.id) trackProductEvent(productIntelligenceEvents.smartDefaultInteraction, { action: "optional_settings_opened", source: context?.type ?? "global_calendar" }); }}>
            <summary>More options</summary>
            <div>
              <label>Type<select value={draft.type} onChange={(event) => { setDraft({ ...draft, type: event.target.value as JourneyCalendarEventType }); if (context) trackProductEvent(productIntelligenceEvents.smartDefaultInteraction, { action: "changed", source: "date_type" }); }}>{Object.entries(calendarEventTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Time <span>Optional</span><input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} /></label>
              {!context || draft.id ? <label>Journey opportunity <span>Optional</span><select value={draft.opportunityId} onChange={(event) => setDraft({ ...draft, opportunityId: event.target.value })}><option value="">Not linked</option>{model.trackedOptions.map((option) => <option key={option.id} value={option.id}>{option.title} · {option.organization}</option>)}</select></label> : null}
              <label>Reminder <span>Suggested, optional</span><select value={draft.reminderMinutesBefore} onChange={(event) => { setDraft({ ...draft, reminderMinutesBefore: event.target.value }); if (context) trackProductEvent(productIntelligenceEvents.smartDefaultInteraction, { action: "changed", source: "reminder" }); }}><option value="">No reminder</option><option value="0">At the time</option><option value="60">1 hour before</option><option value="1440">1 day before</option><option value="10080">7 days before</option></select></label>
            </div>
          </details>
        </div>
        {error ? <ActionFeedback message={`${error} Your entries are still here.`} state="error" level="confirmatory" /> : null}
        <footer><button type="button" onClick={() => close()} disabled={saving}>Cancel</button><button type="submit" disabled={saving || !draft.title.trim() || !draft.date} aria-busy={saving ? "true" : undefined} data-action-state={saving ? "loading" : "idle"}><ActionButtonLabel phase={saving ? "pending" : "idle"} idle={<><CheckIcon /> Save date</>} pending={draft.id ? "Updating date…" : "Adding date…"} /></button></footer>
      </form>
    </dialog>
  </section>;
}
