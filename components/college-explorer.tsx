"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { College, CollegeQuery } from "@/lib/colleges";
import { ArrowIcon, CloseIcon, SearchIcon } from "./icons";
import { CollegeSaveButton } from "./college-save-button";

type FilterOptions = { states: Array<{ code: string; name: string }>; regions: string[]; programs: Array<{ id: string; label: string }> };
type Collection = { id: string; title: string; description: string; query: CollegeQuery };
const number = new Intl.NumberFormat("en-US");
const percent = (value: number | null) => value === null ? "Not reported" : `${Math.round(value * 100)}%`;
const money = (value: number | null) => value === null ? "Not reported" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

function CollegeRow({ college, saved, compared, toggleCompare }: { college: College; saved: boolean; compared: boolean; toggleCompare: () => void }) {
  return <article className="group grid gap-5 border-t border-ink/10 py-6 first:border-t-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-ink/40">
        <span>{college.city}, {college.state}</span><span aria-hidden="true">·</span><span>{college.ownership}</span>{college.setting ? <><span aria-hidden="true">·</span><span>{college.setting}</span></> : null}
      </div>
      <Link href={`/colleges/${college.slug}`} className="mt-2 inline-flex items-center gap-2 font-editorial text-[1.65rem] font-semibold leading-tight text-[var(--unlocked-text)] transition group-hover:text-forest">
        {college.name}<ArrowIcon className="h-4 w-4 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
      </Link>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink/55">
        <span>{number.format(college.undergraduateEnrollment)} undergraduates</span>
        <span>Acceptance {college.openAdmissions ? "Open admissions" : percent(college.acceptanceRate)}</span>
        <span>Avg. net price {money(college.averageNetPrice)}</span>
      </div>
      {college.programs.length ? <p className="mt-3 text-xs leading-5 text-ink/42">Popular fields in federal data: {college.programs.slice(0, 3).map((program) => program.label).join(" · ")}</p> : null}
    </div>
    <div className="flex items-center gap-2 md:justify-end">
      <label className={`inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-xs font-bold transition ${compared ? "bg-ink text-white" : "text-ink/45 hover:bg-ink/[.05] hover:text-ink"}`}>
        <input type="checkbox" checked={compared} onChange={toggleCompare} className="sr-only" />{compared ? "Comparing" : "Compare"}
      </label>
      <CollegeSaveButton collegeId={college.id} initialSaved={saved} compact />
    </div>
  </article>;
}

export function CollegeExplorer({ initialColleges, initialTotal, initialQuery = {}, filters, collections, savedIds }: { initialColleges: College[]; initialTotal: number; initialQuery?: CollegeQuery; filters: FilterOptions; collections: Collection[]; savedIds: string[] }) {
  const [colleges, setColleges] = useState(initialColleges);
  const [total, setTotal] = useState(initialTotal);
  const [query, setQuery] = useState(initialQuery.query ?? "");
  const [state, setState] = useState(initialQuery.state ?? "");
  const [ownership, setOwnership] = useState(initialQuery.ownership ?? "");
  const [setting, setSetting] = useState(initialQuery.setting ?? "");
  const [program, setProgram] = useState(initialQuery.program ?? "");
  const [size, setSize] = useState(initialQuery.size ?? "");
  const [designation, setDesignation] = useState(initialQuery.designation ?? "");
  const [advanced, setAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const params = useMemo(() => {
    const value = new URLSearchParams();
    if (query) value.set("q", query); if (state) value.set("state", state); if (ownership) value.set("ownership", ownership);
    if (setting) value.set("setting", setting); if (program) value.set("program", program); if (size) value.set("size", size); if (designation) value.set("designation", designation); value.set("page", String(page));
    return value;
  }, [query, state, ownership, setting, program, size, designation, page]);

  useEffect(() => {
    if (!query && !state && !ownership && !setting && !program && !size && !designation && page === 1) { setColleges(initialColleges); setTotal(initialTotal); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/colleges?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search failed");
        const body = await response.json() as { colleges: College[]; total: number };
        setColleges(body.colleges); setTotal(body.total);
      } catch (error) { if ((error as Error).name !== "AbortError") setColleges([]); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [params, initialColleges, initialTotal, query, state, ownership, setting, program, size, designation, page]);

  function applyCollection(collection: Collection) {
    setQuery(""); setState(collection.query.state ?? ""); setOwnership(collection.query.ownership ?? ""); setSetting(collection.query.setting ?? ""); setProgram(collection.query.program ?? ""); setSize(collection.query.size ?? ""); setDesignation(collection.query.designation ?? ""); setPage(1);
    document.getElementById("college-results")?.scrollIntoView({ behavior: "smooth" });
  }
  function toggleCompare(id: string) { setCompare((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current); }

  return <main className="min-h-screen pb-32">
    <section className="border-b border-ink/10 px-5 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-16">
      <div className="mx-auto max-w-6xl">
        <p className="rule-label text-forest">Colleges</p>
        <h1 className="mt-4 max-w-3xl font-editorial text-5xl font-semibold leading-[1.02] text-[var(--unlocked-text)] sm:text-6xl">Find places worth learning more about.</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-ink/52">Search by college, place, or field. Understand the differences without a manufactured ranking.</p>
        <div className="relative mt-9 max-w-3xl">
          <SearchIcon className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-forest" />
          <label htmlFor="college-search" className="sr-only">Search colleges, majors, and locations</label>
          <input id="college-search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Try “computer science Chicago” or “small colleges”" className="min-h-16 w-full rounded-2xl border border-ink/10 bg-white/70 pl-14 pr-5 text-base text-ink shadow-[0_16px_50px_rgba(43,33,26,.06)] outline-none transition placeholder:text-ink/32 focus:border-forest/35 focus:ring-4 focus:ring-forest/8" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <select aria-label="State" value={state} onChange={(event) => { setState(event.target.value); setPage(1); }} className="min-h-11 rounded-full border border-ink/10 bg-white/60 px-4 text-sm font-semibold text-ink/60"><option value="">All locations</option>{filters.states.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select>
          <select aria-label="School type" value={ownership} onChange={(event) => { setOwnership(event.target.value); setPage(1); }} className="min-h-11 rounded-full border border-ink/10 bg-white/60 px-4 text-sm font-semibold text-ink/60"><option value="">Public + private</option><option>Public</option><option>Private nonprofit</option><option>Private for-profit</option></select>
          <select aria-label="Setting" value={setting} onChange={(event) => { setSetting(event.target.value); setPage(1); }} className="min-h-11 rounded-full border border-ink/10 bg-white/60 px-4 text-sm font-semibold text-ink/60"><option value="">Every setting</option>{["Urban", "Suburban", "Town", "Rural"].map((item) => <option key={item}>{item}</option>)}</select>
          <button type="button" onClick={() => setAdvanced((value) => !value)} className="min-h-11 rounded-full px-4 text-sm font-bold text-forest hover:bg-forest/[.06]">{advanced ? "Fewer filters" : "More filters"}</button>
        </div>
        {advanced ? <div className="mt-3 flex flex-wrap gap-2 border-t border-ink/8 pt-4">
          <select aria-label="Academic field" value={program} onChange={(event) => { setProgram(event.target.value); setPage(1); }} className="min-h-11 max-w-full rounded-full border border-ink/10 bg-white/60 px-4 text-sm font-semibold text-ink/60"><option value="">Every academic field</option>{filters.programs.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          <select aria-label="Undergraduate size" value={size} onChange={(event) => { setSize(event.target.value); setPage(1); }} className="min-h-11 rounded-full border border-ink/10 bg-white/60 px-4 text-sm font-semibold text-ink/60"><option value="">Every size</option>{["Small", "Medium", "Large", "Very large"].map((item) => <option key={item}>{item}</option>)}</select>
        </div> : null}
      </div>
    </section>

    {!query && !state && !ownership && !setting && !program && !size && !designation ? <section className="px-5 py-10 sm:px-8"><div className="mx-auto max-w-6xl"><div className="flex items-end justify-between gap-4"><div><p className="rule-label text-ink/40">Starting points</p><h2 className="mt-2 font-editorial text-3xl font-semibold text-[var(--unlocked-text)]">Explore a direction</h2></div><Link href="/colleges/saved" className="text-sm font-bold text-forest">Saved colleges →</Link></div><div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 sm:grid-cols-2 lg:grid-cols-3">{collections.map((collection) => <button key={collection.id} type="button" onClick={() => applyCollection(collection)} className="min-h-36 bg-[var(--unlocked-surface)] p-6 text-left transition hover:bg-mint/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-forest/25"><span className="font-editorial text-xl font-semibold text-[var(--unlocked-text)]">{collection.title}</span><span className="mt-2 block text-sm leading-6 text-ink/48">{collection.description}</span></button>)}</div></div></section> : null}

    <section id="college-results" className="scroll-mt-24 px-5 py-10 sm:px-8"><div className="mx-auto max-w-6xl rounded-[1.75rem] border border-ink/10 bg-[var(--unlocked-surface)] px-5 shadow-soft sm:px-8">
      <div className="flex min-h-20 items-center justify-between gap-4 border-b border-ink/10"><div><p className="text-sm font-bold text-[var(--unlocked-text)]">{total.toLocaleString()} colleges</p><p className="mt-1 text-xs text-ink/40">Official federal institution data · no ranking order</p></div>{loading ? <span role="status" className="text-xs font-bold text-forest">Searching…</span> : null}</div>
      {colleges.length ? colleges.map((college) => <CollegeRow key={college.id} college={college} saved={savedIds.includes(college.id)} compared={compare.includes(college.id)} toggleCompare={() => toggleCompare(college.id)} />) : <div className="py-20 text-center"><h2 className="font-editorial text-2xl font-semibold">No colleges found</h2><p className="mt-2 text-sm text-ink/50">Try a broader place, field, or fewer filters.</p></div>}
      <div className="flex items-center justify-between border-t border-ink/10 py-5"><button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="min-h-11 px-3 text-sm font-bold text-forest disabled:opacity-30">← Previous</button><span className="text-xs font-semibold text-ink/40">Page {page}</span><button type="button" disabled={page * 18 >= total} onClick={() => setPage((value) => value + 1)} className="min-h-11 px-3 text-sm font-bold text-forest disabled:opacity-30">Next →</button></div>
    </div></section>

    {compare.length ? <div className="fixed inset-x-4 bottom-20 z-30 mx-auto flex max-w-xl items-center justify-between gap-4 rounded-2xl border border-white/10 bg-ink/95 p-3 pl-5 text-white shadow-[0_24px_70px_rgba(24,21,19,.28)] backdrop-blur-xl lg:bottom-6"><div><p className="text-sm font-bold">{compare.length} selected</p><p className="text-[11px] text-white/55">Choose 2–4 colleges</p></div><div className="flex items-center gap-1"><button type="button" onClick={() => setCompare([])} aria-label="Clear comparison" className="grid h-11 w-11 place-items-center rounded-full text-white/60 hover:bg-white/10"><CloseIcon /></button><Link aria-disabled={compare.length < 2} href={compare.length >= 2 ? `/colleges/compare?ids=${compare.join(",")}` : "#"} className={`inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-bold text-forest ${compare.length < 2 ? "pointer-events-none opacity-45" : ""}`}>Compare</Link></div></div> : null}
  </main>;
}
