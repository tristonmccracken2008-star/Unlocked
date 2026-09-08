"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { College } from "@/lib/colleges";
import { collegeApplicationPlanLabels, collegeInterestLabels, collegeInterestStates, type CollegeListRecord, verifiedCollegeAdmissions } from "@/data/college-admissions";
import { ArrowIcon } from "./icons";

type Item = { college: College; record: CollegeListRecord };
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));

export function MyCollegeList({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems); const [view, setView] = useState("all"); const [pending, setPending] = useState(""); const [error, setError] = useState("");
  const visible = useMemo(() => items.filter(({ record }) => view === "all" || (view === "decisions" ? record.interestState === "decision_received" : record.interestState === view)), [items, view]);
  async function update(collegeId: string, changes: Record<string, unknown>) {
    setPending(collegeId); setError(""); const before = items;
    setItems((current) => current.map((item) => item.record.collegeId === collegeId ? { ...item, record: { ...item.record, ...changes } } : item));
    try {
      const response = await fetch("/api/college-admissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_college", collegeId, ...changes }) });
      const body = await response.json() as { error?: string; savedColleges?: CollegeListRecord[] }; if (!response.ok || !body.savedColleges) throw new Error(body.error ?? "Update failed");
      setItems((current) => current.map((item) => ({ ...item, record: body.savedColleges!.find((record) => record.collegeId === item.college.id) ?? item.record })));
    } catch (cause) { setItems(before); setError(cause instanceof Error ? cause.message : "Could not update the college."); } finally { setPending(""); }
  }
  return <main className="min-h-screen px-5 pb-28 pt-12 sm:px-8 sm:pt-16"><div className="mx-auto max-w-6xl">
    <p className="rule-label text-forest">Your admissions workspace</p><div className="mt-3 flex flex-wrap items-end justify-between gap-6"><div><h1 className="font-editorial text-5xl font-semibold text-[var(--unlocked-text)]">My College List</h1><p className="mt-4 max-w-xl text-base leading-7 text-ink/52">The schools you are exploring and what you are doing next. No odds, labels, or pressure.</p></div><div className="flex gap-2"><Link href="/admissions" className="inline-flex min-h-11 items-center rounded-full border border-forest/20 px-4 text-sm font-bold text-forest hover:bg-mint/60">Admissions Journey</Link><Link href="/colleges" className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-bold text-white">Explore colleges</Link></div></div>
    <nav aria-label="College list views" className="mt-9 flex gap-1 overflow-x-auto border-b border-ink/10 pb-3">{[["all", "All"], ["exploring", "Exploring"], ["planning_to_apply", "Planning"], ["applied", "Applied"], ["decisions", "Decisions"]].map(([id, label]) => <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-bold transition ${view === id ? "bg-forest text-white" : "text-ink/45 hover:bg-forest/[.06] hover:text-forest"}`}>{label}</button>)}</nav>
    {error ? <p role="status" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p> : null}
    {visible.length ? <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-ink/10 bg-[var(--unlocked-surface)] px-5 shadow-soft sm:px-8">{visible.map(({ college, record }) => {
      const verified = verifiedCollegeAdmissions[college.id]; const selectedDeadline = verified?.deadlines.find((item) => item.plan === record.application?.plan); const remaining = (record.application?.tasks ?? []).filter((task) => !task.completed).length;
      return <article key={college.id} className="grid gap-5 border-t border-ink/10 py-6 first:border-t-0 lg:grid-cols-[minmax(15rem,1.5fr)_minmax(11rem,.7fr)_minmax(12rem,.8fr)_auto] lg:items-center">
        <div className="min-w-0"><div className="flex items-center gap-2"><button type="button" disabled={pending === college.id} onClick={() => update(college.id, { favorite: !record.favorite })} aria-label={record.favorite ? `Remove ${college.name} from top choices` : `Mark ${college.name} as a top choice`} aria-pressed={record.favorite} className={`text-xl ${record.favorite ? "text-amber-500" : "text-ink/20 hover:text-amber-500"}`}>★</button><p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/38">{college.city}, {college.state}</p></div><Link href={`/colleges/${college.slug}`} className="mt-2 block font-editorial text-2xl font-semibold leading-tight text-[var(--unlocked-text)] hover:text-forest">{college.name}</Link>{record.favorite ? <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[.08em] text-amber-800">Top choice · student selected</span> : null}</div>
        <label className="text-xs font-bold text-ink/42">Interest state<select value={record.interestState} disabled={pending === college.id} onChange={(event) => update(college.id, { interestState: event.target.value })} className="mt-2 block min-h-11 w-full rounded-xl border border-ink/10 bg-white/60 px-3 text-sm font-semibold text-ink">{collegeInterestStates.map((state) => <option key={state} value={state}>{collegeInterestLabels[state]}</option>)}</select></label>
        <div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/38">Next known date</p><p className="mt-2 text-sm font-bold text-[var(--unlocked-text)]">{selectedDeadline ? dateLabel(selectedDeadline.date) : "Current deadline not verified"}</p><p className="mt-1 text-xs leading-5 text-ink/42">{selectedDeadline?.label ?? (record.application?.plan && record.application.plan !== "unknown" ? collegeApplicationPlanLabels[record.application.plan] : "Choose and verify an application plan")}{remaining ? ` · ${remaining} open task${remaining === 1 ? "" : "s"}` : ""}</p></div>
        <Link href={`/colleges/${college.slug}/application`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ink/10 px-4 text-sm font-bold text-forest hover:bg-mint/60">Open workspace <ArrowIcon /></Link>
      </article>;
    })}</div> : <div className="mt-12 rounded-[1.75rem] border border-dashed border-ink/15 p-12 text-center"><h2 className="font-editorial text-3xl font-semibold">Nothing in this view yet.</h2><p className="mt-3 text-sm text-ink/50">Move a college here when your own interest changes.</p></div>}
  </div></main>;
}
