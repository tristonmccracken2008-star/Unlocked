"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deadlineLabel, opportunities, type Opportunity } from "@/data/opportunities";
import { opportunityTrackerStatuses, readStudentActivity, removeTrackedOpportunity, studentActivityEvent, updateOpportunityStatus, type OpportunityTrackerStatus, type StudentActivity } from "@/data/student-activity";
import { ArrowIcon } from "./icons";

const filters = ["All", "Scholarships", "AI Tools", "Research", "Internships", "Benefits", "Software"] as const;
type TrackerFilter = (typeof filters)[number];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

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
  if (status === "Saved") return "Saved";
  if (["Interested", "Applying", "Interview", "Accepted"].includes(status)) return "In Progress";
  return status;
}

export function MyOpportunitiesPage() {
  const [activity, setActivity] = useState<StudentActivity>({ viewed: [], saved: [], claimed: [], tracked: {} });
  const [filter, setFilter] = useState<TrackerFilter>("All");

  useEffect(() => {
    const update = () => setActivity(readStudentActivity());
    update();
    window.addEventListener(studentActivityEvent, update);
    return () => window.removeEventListener(studentActivityEvent, update);
  }, []);

  const savedItems = useMemo(() => {
    const tracked = activity.tracked ?? {};
    return Object.values(tracked).map((record) => {
      const opportunity = opportunities.find((item) => item.id === record.id);
      return opportunity ? { opportunity, record } : null;
    }).filter((item): item is NonNullable<typeof item> => Boolean(item)).filter(({ opportunity }) => matchesFilter(opportunity, filter)).sort((a, b) => b.record.updatedAt.localeCompare(a.record.updatedAt) || a.opportunity.title.localeCompare(b.opportunity.title));
  }, [activity, filter]);

  const stats = useMemo(() => {
    const records = Object.values(activity.tracked ?? {});
    return {
      saved: records.filter((item) => item.status === "Saved").length,
      inProgress: records.filter((item) => ["Interested", "Applying", "Interview", "Accepted"].includes(item.status)).length,
      submitted: records.filter((item) => item.status === "Submitted").length,
      completed: records.filter((item) => item.status === "Completed").length,
    };
  }, [activity]);

  return <section className="px-5 py-10 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-7xl">
      <header className="grid gap-8 border-b border-ink/15 pb-9 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
        <div>
          <p className="rule-label text-forest">Personal opportunity tracker</p>
          <h1 className="mt-3 font-editorial text-4xl font-bold tracking-[-.035em] sm:text-6xl">My Opportunities</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink/55">Save opportunities, organize your next steps, and keep application progress in one place. Changes sync to your account.</p>
        </div>
        <div className="grid grid-cols-2 gap-px bg-ink/15 sm:grid-cols-4 lg:grid-cols-2">
          <Stat label="Saved" value={stats.saved}/>
          <Stat label="In progress" value={stats.inProgress}/>
          <Stat label="Submitted" value={stats.submitted}/>
          <Stat label="Completed" value={stats.completed}/>
        </div>
      </header>

      <div className="mt-7 flex gap-2 overflow-x-auto pb-2" aria-label="Filter saved opportunities">
        {filters.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`min-h-10 shrink-0 border px-4 text-xs font-bold uppercase tracking-wider ${filter === item ? "border-ink bg-ink text-white" : "border-ink/15 bg-white text-ink/55 hover:border-ink/40 hover:text-ink"}`}>{item}</button>)}
      </div>

      {savedItems.length ? <div className="mt-7 grid gap-5 xl:grid-cols-7">
        {opportunityTrackerStatuses.map((status) => {
          const items = savedItems.filter(({ record }) => record.status === status);
          return <section key={status} className="min-w-0 bg-white/60 xl:bg-transparent">
            <div className="sticky top-0 z-10 border-b border-ink/15 bg-paper/95 py-3 backdrop-blur">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-editorial text-xl font-bold">{status}</h2>
                <span className="text-xs font-bold text-ink/35">{items.length}</span>
              </div>
            </div>
            <div className="space-y-3 py-3">
              {items.length ? items.map(({ opportunity, record }) => <TrackedCard key={opportunity.id} opportunity={opportunity} status={record.status}/>) : <div className="border border-dashed border-ink/15 bg-white/50 p-4 text-xs leading-5 text-ink/40">No opportunities here yet.</div>}
            </div>
          </section>;
        })}
      </div> : <div className="mt-10 bg-white px-6 py-16 text-center">
        <p className="font-editorial text-3xl font-bold">{filter === "All" ? "No saved opportunities yet" : "No saved opportunities match this filter"}</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/45">Save any opportunity from the directory or an opportunity detail page, then track it here through applying, submitted, accepted, and completed.</p>
        <Link href="/opportunities" className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-5 text-xs font-bold uppercase tracking-wider text-white hover:bg-forest">Browse opportunities <ArrowIcon/></Link>
      </div>}
    </div>
  </section>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="bg-white p-4"><p className="rule-label text-ink/35">{label}</p><p className="mt-2 font-editorial text-3xl font-bold text-forest">{value}</p></div>;
}

function TrackedCard({ opportunity, status }: { opportunity: Opportunity; status: OpportunityTrackerStatus }) {
  const nextStatuses = opportunityTrackerStatuses.filter((item) => item !== status);
  return <article className="bg-white p-4 shadow-[0_10px_28px_rgba(43,33,26,.055)]">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="rule-label text-forest">{opportunity.type}</p>
        <h3 className="mt-2 font-editorial text-lg font-bold leading-tight"><Link href={`/opportunities/${opportunity.id}`} className="hover:text-forest">{opportunity.title}</Link></h3>
        <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-wider text-ink/35">{opportunity.organization}</p>
      </div>
      <button type="button" onClick={() => removeTrackedOpportunity(opportunity.id)} className="text-[11px] font-bold uppercase tracking-wider text-ink/30 hover:text-ink" aria-label={`Remove ${opportunity.title}`}>Remove</button>
    </div>
    <dl className="mt-4 space-y-2 text-xs">
      <div className="flex justify-between gap-3"><dt className="text-ink/40">Value</dt><dd className="text-right font-bold">{valueLabel(opportunity)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-ink/40">Deadline</dt><dd className="text-right font-bold">{deadlineLabel(opportunity)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-ink/40">Status</dt><dd className="text-right font-bold text-forest">{statusSummary(status)}</dd></div>
    </dl>
    <div className="mt-4 border-t border-ink/10 pt-3">
      <p className="rule-label text-ink/30">Move to</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {nextStatuses.map((item) => <button key={item} type="button" onClick={() => updateOpportunityStatus(opportunity.id, item)} className="min-h-8 border border-ink/15 px-2.5 text-[10px] font-bold uppercase tracking-wider text-ink/50 hover:border-forest hover:text-forest">{item}</button>)}
      </div>
    </div>
  </article>;
}
