"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/data/authenticated-request";
import { accountSessionEvent } from "@/data/account-sync";
import { ArrowIcon, CalendarIcon, CheckIcon, CloseIcon } from "@/components/icons";
import type { JourneyCalendarItem, JourneyCalendarModel } from "@/lib/journey-calendar";
import { calendarEventTypeLabels } from "@/lib/journey-calendar";
import type { JourneyCalendarEventType } from "@/lib/account-types";
import styles from "./journey-deadline-calendar.module.css";

type View = "upcoming" | "calendar";
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
      <small data-urgency={item.urgency}>{item.timingLabel}{item.source === "official" ? " · Verified date" : ""}</small>
    </div>
    <div className={styles.eventActions}>
      {destination ? <Link href={destination} aria-label={`Open Journey item for ${item.opportunityTitle ?? item.title}`}><ArrowIcon /></Link> : null}
      {item.opportunityId ? <Link href={`/opportunities/${encodeURIComponent(item.opportunityId)}`} className={styles.textAction}>View opportunity</Link> : null}
      {item.source === "user" ? <button type="button" onClick={() => onEdit(item)} disabled={Boolean(pending)}>Edit</button> : null}
      {item.source === "user" ? <button type="button" onClick={() => onAction(item, item.urgency === "overdue" ? "dismiss" : "complete")} disabled={Boolean(pending)}>{pending === item.id ? "Saving…" : item.urgency === "overdue" ? "Dismiss" : "Done"}</button> : null}
    </div>
  </article>;
}

export function JourneyDeadlineCalendar({ model }: { model: JourneyCalendarModel }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const createRequestIdRef = useRef("");
  const titleId = useId();
  const [view, setView] = useState<View>("upcoming");
  const [month, setMonth] = useState(model.initialMonth);
  const [selectedDate, setSelectedDate] = useState(model.items.find((item) => item.date.startsWith(model.initialMonth))?.date ?? `${model.initialMonth}-01`);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const cells = useMemo(() => monthCells(month), [month]);
  const selectedItems = model.items.filter((item) => item.date === selectedDate);
  const datesWithEvents = useMemo(() => new Set(model.items.map((item) => item.date)), [model.items]);

  useEffect(() => {
    const reset = () => {
      requestRef.current?.abort("account-changed");
      dialogRef.current?.close();
      setSaving(false);
      setPending("");
      setError("");
      setDraft(emptyDraft());
      createRequestIdRef.current = "";
    };
    window.addEventListener(accountSessionEvent, reset);
    return () => { requestRef.current?.abort("unmounted"); window.removeEventListener(accountSessionEvent, reset); };
  }, []);

  function openAdd(date = "") {
    createRequestIdRef.current = `event:${crypto.randomUUID()}`;
    setDraft({ ...emptyDraft(), date });
    setError("");
    dialogRef.current?.showModal();
  }

  function openEdit(item: JourneyCalendarItem) {
    if (item.source !== "user" || item.type === "application_deadline" || item.type === "application_open" || item.type === "program_start") return;
    setDraft({ id: item.id, version: item.version, title: item.title, type: item.type, date: item.date, time: item.time ?? "", opportunityId: item.opportunityId ?? "", reminderMinutesBefore: item.reminderMinutesBefore === undefined ? "" : String(item.reminderMinutesBefore) });
    setError("");
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
    setDraft(emptyDraft());
    setError("");
    createRequestIdRef.current = "";
    addButtonRef.current?.focus();
  }

  async function save() {
    if (!draft.title.trim() || !draft.date || saving) return;
    setSaving(true);
    setError("");
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
        if (response.status === 409) router.refresh();
        return;
      }
      close();
      router.refresh();
    } catch {
      if (!controller.signal.aborted || controller.signal.reason === "timeout") setError(controller.signal.reason === "timeout" ? "Saving took too long. Nothing changed; try again." : "We couldn’t reach UnlockED. Nothing changed.");
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
    try {
      const response = await authenticatedFetch("/api/journey/calendar", { method: "PATCH", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, expectedVersion: item.version, action }) });
      const body = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !body?.ok) {
        setError(errorMessage(response.status, body?.error));
        if (response.status === 409) router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setError("We couldn’t reach UnlockED. Your calendar is unchanged.");
    } finally {
      setPending("");
    }
  }

  return <section className={styles.shell} aria-labelledby="journey-upcoming-heading" data-journey-calendar="">
    <header className={styles.header}>
      <div><p>Schedule</p><h2 id="journey-upcoming-heading">Upcoming</h2></div>
      <div className={styles.headerActions}>
        <div className={styles.toggle} aria-label="Deadline view"><button type="button" aria-pressed={view === "upcoming"} onClick={() => setView("upcoming")}>Upcoming</button><button type="button" aria-pressed={view === "calendar"} onClick={() => setView("calendar")}>Calendar</button></div>
        <button ref={addButtonRef} type="button" className={styles.add} onClick={() => openAdd()}>Add date</button>
      </div>
    </header>
    {error && !dialogRef.current?.open ? <p className={styles.error} role="alert">{error}</p> : null}

    {view === "upcoming" ? <div className={styles.upcoming}>
      {model.groups.length ? model.groups.map((group) => <section key={group.id} className={styles.group} aria-labelledby={`calendar-group-${group.id}`}><h3 id={`calendar-group-${group.id}`}>{group.label}</h3><div>{group.items.slice(0, group.id === "passed" ? 3 : 6).map((item) => <EventRow key={item.id} item={item} onEdit={openEdit} onAction={updateState} pending={pending} />)}</div></section>) : <div className={styles.empty}><CalendarIcon /><h3>Nothing coming up yet.</h3><p>Save opportunities with verified deadlines or add a personal date to start your timeline.</p><div><Link href="/opportunities">Explore opportunities</Link><button type="button" onClick={() => openAdd()}>Add date</button></div></div>}
    </div> : <div className={styles.calendarLayout}>
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
    </div>}

    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId} onCancel={(event) => { if (saving) event.preventDefault(); else close(); }}>
      <form method="dialog" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <header><div><p>Journey date</p><h2 id={titleId}>{draft.id ? "Edit date" : "Add a date"}</h2><span>Keep only what you need to remember.</span></div><button type="button" onClick={close} disabled={saving} aria-label="Close date form"><CloseIcon /></button></header>
        <div className={styles.fields}>
          <label>Title<input required maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Essay draft due" /></label>
          <label>Type<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as JourneyCalendarEventType })}>{Object.entries(calendarEventTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div><label>Date<input required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label>Time <span>Optional</span><input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} /></label></div>
          <label>Journey opportunity <span>Optional</span><select value={draft.opportunityId} onChange={(event) => setDraft({ ...draft, opportunityId: event.target.value })}><option value="">Not linked</option>{model.trackedOptions.map((option) => <option key={option.id} value={option.id}>{option.title} · {option.organization}</option>)}</select></label>
          <label>Reminder <span>Optional</span><select value={draft.reminderMinutesBefore} onChange={(event) => setDraft({ ...draft, reminderMinutesBefore: event.target.value })}><option value="">No reminder</option><option value="0">At the time</option><option value="60">1 hour before</option><option value="1440">1 day before</option><option value="10080">7 days before</option></select></label>
        </div>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <footer><button type="button" onClick={close} disabled={saving}>Cancel</button><button type="submit" disabled={saving || !draft.title.trim() || !draft.date}>{saving ? "Saving…" : <><CheckIcon /> Save date</>}</button></footer>
      </form>
    </dialog>
  </section>;
}
