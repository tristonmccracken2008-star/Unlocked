"use client";

import Link from "next/link";
import type { ReactElement } from "react";
import { memo, useEffect, useMemo, useState } from "react";
import { deadlineLabel, type Opportunity } from "@/data/opportunities";
import { opportunityTrackerStatuses, persistStudentActivity, readStudentActivity, removeTrackedOpportunity, replaceStudentActivity, studentActivityEvent, updateOpportunityStatus, type OpportunityTrackerStatus, type StudentActivity } from "@/data/student-activity";
import { ArrowIcon, BookmarkIcon, CheckCircleIcon, CheckIcon, HeartIcon, MoreIcon, MoveIcon, PenLineIcon, SendIcon, TargetIcon, TrophyIcon, XCircleIcon } from "./icons";
import { OrganizationLogo } from "./organization-logo";
import { trackProductEvent } from "@/data/product-analytics";

const filters = ["All", "Scholarships", "AI Tools", "Research", "Internships", "Benefits", "Software"] as const;
type TrackerFilter = (typeof filters)[number];
type Toast = { tone: "success" | "error"; message: string };
type Milestone = { title: string; why: string; date: string; opportunityTitle?: string };
type BoardItem = { opportunity: Opportunity; record: NonNullable<StudentActivity["tracked"]>[string] };
type IconComponent = (props: { className?: string }) => ReactElement;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const statusMeta: Record<OpportunityTrackerStatus, { Icon: IconComponent; description: string; accent: string; soft: string; border: string }> = {
  Saved: { Icon: BookmarkIcon, description: "Ready when you are.", accent: "text-forest", soft: "bg-forest/8", border: "border-forest" },
  Interested: { Icon: HeartIcon, description: "Worth a closer look.", accent: "text-rose-700", soft: "bg-rose-50", border: "border-rose-300" },
  Applying: { Icon: PenLineIcon, description: "Application in motion.", accent: "text-amber-700", soft: "bg-amber-50", border: "border-amber-400" },
  Submitted: { Icon: SendIcon, description: "Sent and tracked.", accent: "text-blue-700", soft: "bg-blue-50", border: "border-blue-400" },
  Interview: { Icon: TargetIcon, description: "Preparing for conversation.", accent: "text-violet-700", soft: "bg-violet-50", border: "border-violet-400" },
  Accepted: { Icon: CheckCircleIcon, description: "Good news to build on.", accent: "text-emerald-700", soft: "bg-emerald-50", border: "border-emerald-500" },
  Rejected: { Icon: XCircleIcon, description: "Closed, but still useful.", accent: "text-red-700", soft: "bg-red-50", border: "border-red-300" },
  Completed: { Icon: TrophyIcon, description: "Finished and resume-ready.", accent: "text-forest", soft: "bg-forest/8", border: "border-forest" },
};

const summaryStatuses: OpportunityTrackerStatus[] = ["Submitted", "Interview", "Accepted", "Completed"];

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

  return <section className="bg-[radial-gradient(circle_at_top_left,rgba(231,216,189,.45),transparent_34rem),#f6f0e6] px-5 py-10 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-[112rem]">
      <header className="grid gap-8 border-b border-ink/10 pb-10 lg:grid-cols-[minmax(0,1fr)_660px] lg:items-end">
        <div>
          <p className="rule-label text-forest">Personal opportunity tracker</p>
          <h1 className="mt-3 font-editorial text-5xl font-bold leading-[.94] tracking-[-.05em] text-forest sm:text-7xl">Journey Board</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink/58">Track opportunities, move them through your pipeline, and keep every next step in one calm place.</p>
          <p className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-white/70 px-4 text-sm font-bold text-forest shadow-[0_10px_30px_rgba(43,33,26,.05)] ring-1 ring-ink/8"><CheckIcon className="h-4 w-4"/> All changes save automatically</p>
        </div>
        <div className="grid overflow-hidden rounded-[1.4rem] bg-white/90 shadow-[0_22px_70px_rgba(43,33,26,.08)] ring-1 ring-ink/8 sm:grid-cols-4">
          {summaryStatuses.map((status) => <SummaryCard key={status} label={statusSummary(status)} value={statusCounts[status]} status={status} />)}
        </div>
      </header>

      <div className="mt-6" aria-label="Filter saved opportunities">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {filters.map((item) => <button key={item} type="button" onClick={() => changeFilter(item)} className={`inline-flex min-h-12 shrink-0 items-center gap-3 rounded-xl border px-5 text-sm font-bold shadow-[0_8px_24px_rgba(43,33,26,.04)] transition duration-200 focus:outline-none focus:ring-2 focus:ring-forest/40 ${filter === item ? "border-forest bg-forest text-white shadow-[0_16px_34px_rgba(31,95,67,.18)]" : "border-ink/10 bg-white/82 text-ink hover:-translate-y-0.5 hover:border-forest/25 hover:text-forest motion-reduce:hover:translate-y-0"}`}>{item}<span className={`rounded-md px-2 py-1 text-xs ${filter === item ? "bg-white/18 text-white" : "bg-forest/8 text-forest"}`}>{counts[item]}</span></button>)}
        </div>
      </div>

      {allItems.length ? <div className="mt-7 overflow-x-auto pb-6">
        <div className="grid min-w-[1680px] grid-cols-8 gap-5">
          {opportunityTrackerStatuses.map((status) => <Lane key={status} status={status} items={byStatus[status]} openMenu={openMenu} setOpenMenu={setOpenMenu} moveOpportunity={moveOpportunity} remove={remove} draggingId={draggingId} setDraggingId={setDraggingId} />)}
        </div>
        <StatusLegend />
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

function SummaryCard({ label, value, status }: { label: string; value: number; status: OpportunityTrackerStatus }) {
  const { Icon, soft, accent } = statusMeta[status];
  return <section className="flex min-h-32 flex-col items-start justify-center gap-5 border-ink/8 p-5 text-left sm:border-r sm:last:border-r-0">
    <span className="flex w-full items-center justify-between gap-4"><span className="text-xs font-black text-ink/70">{label}</span><span className={`grid h-9 w-9 place-items-center rounded-full ${soft} ${accent}`}><Icon className="h-[18px] w-[18px]"/></span></span>
    <span className="font-editorial text-5xl font-bold leading-none text-forest">{value}</span>
  </section>;
}

function Lane({ status, items, openMenu, setOpenMenu, moveOpportunity, remove, draggingId, setDraggingId }: { status: OpportunityTrackerStatus; items: BoardItem[]; openMenu: string | null; setOpenMenu: (id: string | null) => void; moveOpportunity: (opportunity: Opportunity, status: OpportunityTrackerStatus, source: "menu" | "drag") => void; remove: (opportunity: Opportunity) => void; draggingId: string | null; setDraggingId: (id: string | null) => void }) {
  const activeDrop = Boolean(draggingId);
  const { Icon, accent, border, soft } = statusMeta[status];
  return <section className="min-w-0" onDragOver={(event) => { if (draggingId) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); setDraggingId(null); const opportunity = window.__unlockedDraggedOpportunity; window.__unlockedDraggedOpportunity = undefined; if (!id || items.some(({ opportunity: item }) => item.id === id)) return; if (opportunity?.id) void moveOpportunity(opportunity, status, "drag"); else trackProductEvent("opportunity_drag_failed", { opportunityId: id, status }); }}>
    <div className={`mb-3 rounded-t-2xl border-b-2 bg-white/55 px-4 py-4 shadow-[0_8px_24px_rgba(43,33,26,.035)] ${items.length ? border : "border-ink/10"}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-black text-ink"><span className={`grid h-8 w-8 place-items-center rounded-full ${soft} ${accent}`} aria-hidden><Icon className="h-[18px] w-[18px]"/></span>{statusSummary(status)}</h2>
        <span className="rounded-lg bg-paper px-2.5 py-1 text-xs font-black text-ink/50">{items.length}</span>
      </div>
    </div>
    <div className={`min-h-80 rounded-[1.25rem] border border-dashed p-2 transition duration-200 ${activeDrop ? "border-forest/40 bg-forest/[.035]" : "border-transparent"}`}>
      {items.length ? <div className="space-y-4">{items.map(({ opportunity, record }) => <TrackedCard key={opportunity.id} opportunity={opportunity} status={record.status} open={openMenu === opportunity.id} setOpen={(open) => setOpenMenu(open ? opportunity.id : null)} moveOpportunity={moveOpportunity} remove={remove} setDraggingId={setDraggingId} />)}</div> : <EmptyLane status={status} />}
    </div>
  </section>;
}

declare global {
  interface Window { __unlockedDraggedOpportunity?: Opportunity }
}

const TrackedCard = memo(function TrackedCard({ opportunity, status, open, setOpen, moveOpportunity, remove, setDraggingId }: { opportunity: Opportunity; status: OpportunityTrackerStatus; open: boolean; setOpen: (open: boolean) => void; moveOpportunity: (opportunity: Opportunity, status: OpportunityTrackerStatus, source: "menu" | "drag") => void; remove: (opportunity: Opportunity) => void; setDraggingId: (id: string | null) => void }) {
  const nextStatuses = opportunityTrackerStatuses.filter((item) => item !== status);
  const { Icon, accent, soft } = statusMeta[status];
  return <article data-opportunity-id={opportunity.id} data-opportunity-title={opportunity.title} draggable onDragStart={(event) => { window.__unlockedDraggedOpportunity = opportunity; event.dataTransfer.setData("text/plain", opportunity.id); event.dataTransfer.effectAllowed = "move"; setDraggingId(opportunity.id); trackProductEvent("opportunity_drag_started", { opportunityId: opportunity.id, status }); }} onDragEnd={() => { setDraggingId(null); window.__unlockedDraggedOpportunity = undefined; }} className="group rounded-[1.35rem] bg-white/95 p-5 shadow-[0_16px_42px_rgba(43,33,26,.075)] ring-1 ring-ink/7 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(43,33,26,.12)] focus-within:ring-2 focus-within:ring-forest/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-start gap-3"><OrganizationLogo opportunity={opportunity} size="sm"/><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.16em] text-forest">{opportunity.type}</p>
        <h3 className="mt-2 font-editorial text-xl font-bold leading-[1.08] tracking-[-.02em]"><Link href={`/opportunities/${opportunity.id}`} className="rounded-sm hover:text-forest focus:outline-none focus:ring-2 focus:ring-forest/30">{opportunity.title}</Link></h3>
        <p className="mt-2 truncate text-xs font-bold text-ink/42">{opportunity.organization}</p></div></div>
      </div>
      <div className="flex items-center gap-1 text-forest"><span aria-label={statusSummary(status)} title={statusSummary(status)} className={`grid h-8 w-8 place-items-center rounded-full ${soft} ${accent}`}><Icon className="h-4 w-4"/></span><button type="button" onClick={() => remove(opportunity)} className="grid h-9 w-9 place-items-center rounded-full text-ink/35 hover:bg-paper hover:text-ink focus:outline-none focus:ring-2 focus:ring-forest/30" aria-label={`Remove ${opportunity.title}`}><MoreIcon className="h-4 w-4"/></button></div>
    </div>
    <dl className="mt-6 space-y-3 text-sm">
      <div className="flex justify-between gap-3"><dt className="text-ink/46">Value</dt><dd className="text-right font-black">{valueLabel(opportunity)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-ink/46">Deadline</dt><dd className="text-right font-black">{deadlineLabel(opportunity)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-ink/46">Status</dt><dd className={`text-right font-black ${accent}`}>{statusSummary(status)}</dd></div>
    </dl>
    <div className="relative mt-5">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen(!open); if (!open) trackProductEvent("opportunity_status_menu_opened", { opportunityId: opportunity.id, status }); }} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-forest/40 bg-white px-4 text-sm font-black text-forest shadow-[0_8px_22px_rgba(43,33,26,.045)] transition duration-200 hover:border-forest hover:bg-forest hover:text-white hover:shadow-[0_14px_30px_rgba(31,95,67,.16)] focus:outline-none focus:ring-2 focus:ring-forest/35"><MoveIcon/> Move to... <span aria-hidden className={`transition duration-200 ${open ? "rotate-180" : ""}`}>⌄</span></button>
      {open && <div role="menu" className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-ink/10 bg-white/95 p-2 shadow-[0_24px_70px_rgba(43,33,26,.2)] backdrop-blur">
        <p className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[.14em] text-ink/35">Move to</p>
        {nextStatuses.map((item) => {
          const next = statusMeta[item];
          const NextIcon = next.Icon;
          return <button key={item} role="menuitem" type="button" onClick={() => void moveOpportunity(opportunity, item, "menu")} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-bold text-ink transition hover:bg-paper focus:bg-paper focus:outline-none">
            <span className="flex min-w-0 items-center gap-2"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${next.soft} ${next.accent}`}><NextIcon className="h-3.5 w-3.5"/></span>{statusSummary(item)}</span>
            <span className="truncate text-xs font-bold text-ink/35">{next.description}</span>
          </button>;
        })}
      </div>}
    </div>
  </article>;
});

function StatusLegend() {
  return <div className="mt-5 flex min-w-[1120px] items-center justify-center gap-7 rounded-full bg-white/45 px-5 py-3 text-xs font-bold text-ink/45 ring-1 ring-ink/6">
    {opportunityTrackerStatuses.map((status) => {
      const { Icon, accent } = statusMeta[status];
      return <span key={status} className="inline-flex items-center gap-2"><Icon className={`h-4 w-4 ${accent}`}/>{statusSummary(status)}</span>;
    })}
  </div>;
}

function EmptyLane({ status }: { status: OpportunityTrackerStatus }) {
  const { Icon, accent, soft } = statusMeta[status];
  return <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-ink/14 bg-white/35 px-5 text-center text-sm text-ink/50">
    <div className={`mb-4 grid h-12 w-12 place-items-center rounded-full ${soft} ${accent}`}><Icon className="h-5 w-5"/></div>
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
