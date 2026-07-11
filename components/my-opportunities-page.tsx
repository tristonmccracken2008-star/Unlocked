"use client";

import Link from "next/link";
import { memo, useEffect, useMemo, useState } from "react";
import { deadlineLabel, type Opportunity } from "@/data/opportunities";
import { opportunityTrackerStatuses, persistStudentActivity, readStudentActivity, removeTrackedOpportunity, replaceStudentActivity, studentActivityEvent, updateOpportunityStatus, type OpportunityTrackerStatus, type StudentActivity } from "@/data/student-activity";
import { ArrowIcon, CheckIcon } from "./icons";
import { trackProductEvent } from "@/data/product-analytics";

const filters = ["All", "Scholarships", "AI Tools", "Research", "Internships", "Benefits", "Software"] as const;
type TrackerFilter = (typeof filters)[number];
type Toast = { tone: "success" | "error"; message: string };
type Milestone = { title: string; why: string; date: string; opportunityTitle?: string };
type BoardItem = { opportunity: Opportunity; record: NonNullable<StudentActivity["tracked"]>[string] };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const majorStatuses = new Set<OpportunityTrackerStatus>(["Submitted", "Interview", "Accepted", "Completed"]);

const statusMeta: Record<OpportunityTrackerStatus, { icon: string; description: string }> = {
  Saved: { icon: "□", description: "Worth revisiting" },
  Interested: { icon: "♡", description: "Looks promising" },
  Applying: { icon: "↗", description: "Application started" },
  Submitted: { icon: "⌁", description: "Sent in" },
  Interview: { icon: "◎", description: "In conversation" },
  Accepted: { icon: "✓", description: "Good news" },
  Rejected: { icon: "×", description: "Closed out" },
  Completed: { icon: "◉", description: "Finished" },
};

function valueLabel(item: Opportunity) {
  if (item.estimated_value) return `${money.format(item.estimated_value)}+`;
  if (item.type === "Scholarship") return item.metadata.awardAmountLabel ?? "Amount varies";
  if (item.type === "Benefit") return item.metadata.valueLabel ?? "See official source";
  return "See official source";
}

function matchesFilter(item: Opportunity, filter: TrackerFilter) {
  if (filter === "All") return true;
  if (filter === "Scholarships") return item.type === "Scholarship";
  if (filter === "AI Tools") return item.type === "AI";
  if (filter === "Research") return item.type === "Research";
  if (filter === "Internships") return item.type === "Career" && item.category === "Internships";
  if (filter === "Benefits") return item.type === "Benefit";
  return item.category === "Software" || item.tags.some((tag) => tag.toLowerCase().includes("software"));
}

function statusSummary(status: OpportunityTrackerStatus) {
  if (status === "Interested") return "Interested";
  if (status === "Applying") return "Applying";
  if (status === "Interview") return "Interviewing";
  return status;
}

function milestoneFor(status: OpportunityTrackerStatus, before: StudentActivity, after: StudentActivity, opportunity?: Opportunity): Milestone | null {
  const previous = Object.values(before.tracked ?? {});
  const next = Object.values(after.tracked ?? {});
  const date = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const title = opportunity?.title;
  if (status === "Submitted" && !previous.some((item) => ["Submitted", "Interview", "Accepted", "Rejected", "Completed"].includes(item.status))) return { title: "First application submitted", why: "You moved from saving opportunities to actively applying.", date, opportunityTitle: title };
  if (status === "Interview" && !previous.some((item) => item.status === "Interview")) return { title: "First interview recorded", why: "Interview activity creates stronger stories and clearer next steps.", date, opportunityTitle: title };
  if (status === "Accepted" && !previous.some((item) => item.status === "Accepted")) return { title: "First acceptance recorded", why: "This is real progress you can build on in your Journey.", date, opportunityTitle: title };
  if (status === "Completed" && !previous.some((item) => item.status === "Completed")) return { title: "First opportunity completed", why: "Completed opportunities turn interest into evidence.", date, opportunityTitle: title };
  if (next.filter((item) => ["Submitted", "Interview", "Accepted", "Rejected", "Completed"].includes(item.status)).length >= 5 && previous.filter((item) => ["Submitted", "Interview", "Accepted", "Rejected", "Completed"].includes(item.status)).length < 5) return { title: "Five applications tracked", why: "You are building a real application rhythm.", date, opportunityTitle: title };
  if (next.length >= 10 && previous.length < 10) return { title: "Ten opportunities tracked", why: "Your board now reflects a serious opportunity search.", date, opportunityTitle: title };
  return null;
}

function filterCounts(items: BoardItem[]) {
  return Object.fromEntries(filters.map((filter) => [filter, filter === "All" ? items.length : items.filter(({ opportunity }) => matchesFilter(opportunity, filter)).length])) as Record<TrackerFilter, number>;
}

export function MyOpportunitiesPage() {
  const [activity, setActivity] = useState<StudentActivity>({ viewed: [], saved: [], claimed: [], tracked: {} });
  const [opportunitiesById, setOpportunitiesById] = useState<Record<string, Opportunity>>({});
  const [filter, setFilter] = useState<TrackerFilter>("All");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setActivity(readStudentActivity());
    update();
    trackProductEvent("journey_board_opened");
    window.addEventListener(studentActivityEvent, update);
    return () => window.removeEventListener(studentActivityEvent, update);
  }, []);

  useEffect(() => {
    const ids = Object.keys(activity.tracked ?? {});
    if (!ids.length) { setOpportunitiesById({}); return; }
    let active = true;
    fetch(`/api/opportunities?ids=${encodeURIComponent(ids.join(","))}`).then((response) => response.ok ? response.json() : Promise.reject()).then((body: { opportunities: Opportunity[] }) => {
      if (active) setOpportunitiesById(Object.fromEntries(body.opportunities.map((item) => [item.id, item])));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [activity.tracked]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const allItems = useMemo(() => {
    const tracked = activity.tracked ?? {};
    return Object.values(tracked).map((record) => {
      const opportunity = opportunitiesById[record.id];
      return opportunity ? { opportunity, record } : null;
    }).filter((item): item is BoardItem => Boolean(item)).sort((a, b) => b.record.updatedAt.localeCompare(a.record.updatedAt) || a.opportunity.title.localeCompare(b.opportunity.title));
  }, [activity.tracked, opportunitiesById]);

  const visibleItems = useMemo(() => allItems.filter(({ opportunity }) => matchesFilter(opportunity, filter)), [allItems, filter]);
  const byStatus = useMemo(() => Object.fromEntries(opportunityTrackerStatuses.map((status) => [status, visibleItems.filter(({ record }) => record.status === status)])) as Record<OpportunityTrackerStatus, BoardItem[]>, [visibleItems]);
  const counts = useMemo(() => filterCounts(allItems), [allItems]);
  const statusCounts = useMemo(() => Object.fromEntries(opportunityTrackerStatuses.map((status) => [status, Object.values(activity.tracked ?? {}).filter((record) => record.status === status).length])) as Record<OpportunityTrackerStatus, number>, [activity.tracked]);

  async function moveOpportunity(opportunity: Opportunity, nextStatus: OpportunityTrackerStatus, source: "menu" | "drag") {
    const previous = readStudentActivity();
    const next = updateOpportunityStatus(opportunity.id, nextStatus, false);
    setActivity(next);
    setOpenMenu(null);
    setToast({ tone: "success", message: `Moved to ${nextStatus}` });
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
    trackProductEvent(source === "drag" ? "opportunity_drag_completed" : "opportunity_status_changed", { opportunityId: opportunity.id, status: nextStatus });
    trackProductEvent("status_changed", { opportunityId: opportunity.id, status: nextStatus });
    if (["Applying", "Submitted", "Interview", "Accepted", "Rejected", "Completed"].includes(nextStatus)) trackProductEvent("application_recorded", { opportunityId: opportunity.id, status: nextStatus });
    const unlocked = milestoneFor(nextStatus, previous, next, opportunity);
    if (unlocked) {
      setMilestone(unlocked);
      trackProductEvent("milestone_unlocked", { opportunityId: opportunity.id, status: nextStatus, milestoneTitle: unlocked.title });
    }
    try {
      await persistStudentActivity(next);
    } catch {
      replaceStudentActivity(previous);
      setActivity(previous);
      setToast({ tone: "error", message: "Could not save that move. Restored the previous status." });
      if (source === "drag") trackProductEvent("opportunity_drag_failed", { opportunityId: opportunity.id, status: nextStatus });
    }
  }

  function remove(opportunity: Opportunity) {
    removeTrackedOpportunity(opportunity.id);
    setToast({ tone: "success", message: "Removed from Journey Board" });
  }

  function changeFilter(next: TrackerFilter) {
    setFilter(next);
    trackProductEvent("journey_filter_changed", { filterName: "journey_board", filterValue: next });
  }

  return <section className="bg-paper px-5 py-10 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-[112rem]">
      <header className="grid gap-8 border-b border-ink/10 pb-10 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-end">
        <div>
          <p className="rule-label text-forest">Personal opportunity tracker</p>
          <h1 className="mt-3 font-editorial text-5xl font-bold tracking-[-.045em] text-forest sm:text-7xl">Journey Board</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink/60">Save opportunities, move them through your pipeline, and watch your journey grow.</p>
          <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-forest"><CheckIcon className="h-4 w-4"/> All changes save automatically.</p>
        </div>
        <div className="grid overflow-hidden rounded-[1.25rem] bg-white shadow-soft ring-1 ring-ink/8 sm:grid-cols-2">
          <SummaryCard label="Submitted" value={statusCounts.Submitted} icon={statusMeta.Submitted.icon} onClick={() => changeFilter("All")} />
          <SummaryCard label="Completed" value={statusCounts.Completed} icon={statusMeta.Completed.icon} onClick={() => changeFilter("All")} />
        </div>
      </header>

      <div className="mt-6 flex gap-3 overflow-x-auto pb-3" aria-label="Filter saved opportunities">
        {filters.map((item) => <button key={item} type="button" onClick={() => changeFilter(item)} className={`inline-flex min-h-12 shrink-0 items-center gap-3 rounded-xl border px-5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-forest/40 ${filter === item ? "border-forest bg-forest text-white shadow-soft" : "border-ink/10 bg-white text-ink hover:border-forest/30 hover:text-forest"}`}>{item}<span className={`rounded-md px-2 py-1 text-xs ${filter === item ? "bg-white/18 text-white" : "bg-forest/8 text-forest"}`}>{counts[item]}</span></button>)}
      </div>

      {allItems.length ? <div className="mt-7 overflow-x-auto pb-6">
        <div className="grid min-w-[1680px] grid-cols-8 gap-5">
          {opportunityTrackerStatuses.map((status) => <Lane key={status} status={status} items={byStatus[status]} openMenu={openMenu} setOpenMenu={setOpenMenu} moveOpportunity={moveOpportunity} remove={remove} draggingId={draggingId} setDraggingId={setDraggingId} />)}
        </div>
      </div> : <div className="mt-10 rounded-[2rem] bg-white px-6 py-16 text-center shadow-soft ring-1 ring-ink/8">
        <p className="font-editorial text-3xl font-bold">Your board is ready.</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/50">Save an opportunity from Discover and it will appear here with a clear next step.</p>
        <Link href="/opportunities" className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-bold text-white hover:bg-forest">Open Discover <ArrowIcon/></Link>
      </div>}
    </div>
    <div aria-live="polite" className="sr-only">{toast?.message}</div>
    {toast && <div role="status" className={`fixed bottom-24 left-5 right-5 z-50 rounded-2xl px-5 py-4 text-sm font-bold shadow-soft sm:left-auto sm:right-6 sm:w-96 ${toast.tone === "success" ? "bg-forest text-white" : "bg-red-700 text-white"}`}>{toast.message}</div>}
    {milestone && <MilestonePanel milestone={milestone} close={() => setMilestone(null)} />}
  </section>;
}

function SummaryCard({ label, value, icon, onClick }: { label: string; value: number; icon: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group flex min-h-36 flex-col items-start justify-between border-ink/10 p-6 text-left first:border-r hover:bg-paper/70 focus:outline-none focus:ring-2 focus:ring-forest/30">
    <span className="flex w-full items-center justify-between gap-4"><span className="rule-label text-ink/55">{label}</span><span className="grid h-9 w-9 place-items-center rounded-full bg-forest/10 text-lg text-forest">{icon}</span></span>
    <span className="font-editorial text-5xl font-bold text-forest">{value}</span>
    <span className="flex items-center gap-2 text-sm font-bold text-ink group-hover:text-forest">View all <ArrowIcon className="h-3.5 w-3.5"/></span>
  </button>;
}

function Lane({ status, items, openMenu, setOpenMenu, moveOpportunity, remove, draggingId, setDraggingId }: { status: OpportunityTrackerStatus; items: BoardItem[]; openMenu: string | null; setOpenMenu: (id: string | null) => void; moveOpportunity: (opportunity: Opportunity, status: OpportunityTrackerStatus, source: "menu" | "drag") => void; remove: (opportunity: Opportunity) => void; draggingId: string | null; setDraggingId: (id: string | null) => void }) {
  const activeDrop = Boolean(draggingId);
  return <section className="min-w-0" onDragOver={(event) => { if (draggingId) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); setDraggingId(null); if (!id || items.some(({ opportunity }) => opportunity.id === id)) return; const opportunity = window.__unlockedDraggedOpportunity; if (opportunity?.id) void moveOpportunity(opportunity, status, "drag"); else trackProductEvent("opportunity_drag_failed", { opportunityId: id, status }); }}>
    <div className={`mb-3 flex items-center justify-between border-b pb-3 ${items.length ? "border-forest" : "border-ink/10"}`}>
      <h2 className="flex items-center gap-2 text-base font-bold text-ink"><span className="text-xl text-forest" aria-hidden>{statusMeta[status].icon}</span>{status}</h2>
      <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-ink/50">{items.length}</span>
    </div>
    <div className={`min-h-80 rounded-[1.25rem] border border-dashed p-2 transition ${activeDrop ? "border-forest/40 bg-forest/[.03]" : "border-transparent"}`}>
      {items.length ? <div className="space-y-4">{items.map(({ opportunity, record }) => <TrackedCard key={opportunity.id} opportunity={opportunity} status={record.status} open={openMenu === opportunity.id} setOpen={(open) => setOpenMenu(open ? opportunity.id : null)} moveOpportunity={moveOpportunity} remove={remove} setDraggingId={setDraggingId} />)}</div> : <EmptyLane status={status} />}
    </div>
  </section>;
}

declare global {
  interface Window { __unlockedDraggedOpportunity?: Opportunity }
}

const TrackedCard = memo(function TrackedCard({ opportunity, status, open, setOpen, moveOpportunity, remove, setDraggingId }: { opportunity: Opportunity; status: OpportunityTrackerStatus; open: boolean; setOpen: (open: boolean) => void; moveOpportunity: (opportunity: Opportunity, status: OpportunityTrackerStatus, source: "menu" | "drag") => void; remove: (opportunity: Opportunity) => void; setDraggingId: (id: string | null) => void }) {
  const nextStatuses = opportunityTrackerStatuses.filter((item) => item !== status);
  return <article data-opportunity-id={opportunity.id} data-opportunity-title={opportunity.title} draggable onDragStart={(event) => { window.__unlockedDraggedOpportunity = opportunity; event.dataTransfer.setData("text/plain", opportunity.id); event.dataTransfer.effectAllowed = "move"; setDraggingId(opportunity.id); trackProductEvent("opportunity_drag_started", { opportunityId: opportunity.id, status }); }} onDragEnd={() => setDraggingId(null)} className="group rounded-[1.25rem] bg-white p-5 shadow-[0_18px_40px_rgba(43,33,26,.08)] ring-1 ring-ink/6 transition hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(43,33,26,.12)] focus-within:ring-2 focus-within:ring-forest/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wider text-forest">{opportunity.type}</p>
        <h3 className="mt-3 font-editorial text-xl font-bold leading-tight"><Link href={`/opportunities/${opportunity.id}`} className="hover:text-forest focus:outline-none focus:ring-2 focus:ring-forest/30">{opportunity.title}</Link></h3>
        <p className="mt-2 truncate text-xs font-bold text-ink/45">{opportunity.organization}</p>
      </div>
      <div className="flex items-center gap-1 text-forest"><span aria-label="Saved" title="Saved" className="text-xl">□</span><button type="button" onClick={() => remove(opportunity)} className="grid h-9 w-9 place-items-center rounded-full text-xl text-ink/35 hover:bg-paper hover:text-ink" aria-label={`Remove ${opportunity.title}`}>⋯</button></div>
    </div>
    <dl className="mt-6 space-y-3 text-sm">
      <div className="flex justify-between gap-3"><dt className="text-ink/48">Value</dt><dd className="text-right font-bold">{valueLabel(opportunity)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-ink/48">Deadline</dt><dd className="text-right font-bold">{deadlineLabel(opportunity)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-ink/48">Status</dt><dd className="text-right font-bold text-forest">{statusSummary(status)}</dd></div>
    </dl>
    <div className="relative mt-5">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen(!open); if (!open) trackProductEvent("opportunity_status_menu_opened", { opportunityId: opportunity.id, status }); }} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-forest/45 px-4 text-sm font-black text-forest transition hover:bg-forest hover:text-white focus:outline-none focus:ring-2 focus:ring-forest/35"><span aria-hidden>↔</span> Move to... <span aria-hidden>⌄</span></button>
      {open && <div role="menu" className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-ink/10 bg-white p-2 shadow-[0_20px_60px_rgba(43,33,26,.18)]">
        {nextStatuses.map((item) => <button key={item} role="menuitem" type="button" onClick={() => void moveOpportunity(opportunity, item, "menu")} className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-bold text-ink hover:bg-paper focus:bg-paper focus:outline-none"><span className="flex items-center gap-2"><span className="text-forest">{statusMeta[item].icon}</span>{item}</span><span className="text-xs text-ink/35">{statusMeta[item].description}</span></button>)}
      </div>}
    </div>
  </article>;
});

function EmptyLane({ status }: { status: OpportunityTrackerStatus }) {
  return <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-ink/14 bg-white/35 px-5 text-center text-sm text-ink/50">
    <div className="mb-4 grid h-11 w-11 place-items-center rounded-full border border-ink/15 text-2xl text-ink/40">{statusMeta[status].icon}</div>
    <p className="font-bold text-ink/65">No opportunities here yet.</p>
    <p className="mt-2 max-w-36 text-xs leading-5">{statusMeta[status].description}</p>
  </div>;
}

function MilestonePanel({ milestone, close }: { milestone: Milestone; close: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-ink/35 px-5" role="dialog" aria-modal="true" aria-labelledby="milestone-title">
    <section className="w-full max-w-lg rounded-[2rem] bg-paper p-7 shadow-[0_30px_90px_rgba(43,33,26,.28)]">
      <p className="rule-label text-forest">Milestone unlocked</p>
      <h2 id="milestone-title" className="mt-3 font-editorial text-4xl font-bold tracking-[-.035em] text-forest">{milestone.title}</h2>
      <p className="mt-4 text-sm leading-7 text-ink/60">{milestone.why}</p>
      {milestone.opportunityTitle && <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-ink/70">{milestone.opportunityTitle}</p>}
      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink/35">{milestone.date}</p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Link href="/" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-ink">View Journey</Link>
        <button type="button" onClick={close} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-bold text-ink/60 hover:border-forest hover:text-forest">Keep tracking</button>
      </div>
    </section>
  </div>;
}
