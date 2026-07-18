"use client";

import type { ReactElement, ReactNode } from "react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Opportunity, OpportunityDifficulty, OpportunityType } from "@/data/opportunities";
import { listingOpportunityTypes, type DiscoverCatalogPayload, type DiscoverSortMode } from "@/data/opportunity-listing";
import { schoolDirectory as schools, type School } from "@/data/school-directory";
import { findSchoolMatches, normalizeSchoolQuery } from "@/data/school-search";
import { opportunityTrackerStatuses, readStudentActivity, studentActivityEvent, type OpportunityTrackerStatus, type StudentActivity } from "@/data/student-activity";
import { ArrowIcon, BookmarkIcon, CheckCircleIcon, HeartIcon, PenLineIcon, SearchIcon, SendIcon, TargetIcon, TrophyIcon, XCircleIcon } from "./icons";
import { OpportunityCard } from "./opportunity-card";
import { trackProductEvent } from "@/data/product-analytics";

type FilterState = {
  query: string;
  type: OpportunityType | "All";
  category: string;
  major: string;
  school: string;
  paid: string;
  remote: string;
  difficulty: Exclude<OpportunityDifficulty, null> | "All";
  freshmanFriendly: boolean;
  deadline: string;
  sort: DiscoverSortMode;
};
type IconComponent = (props: { className?: string }) => ReactElement;

const storageKey = "unlocked-discover-filters";
const defaultFilters: FilterState = { query: "", type: "All", category: "All", major: "All", school: "All", paid: "All", remote: "All", difficulty: "All", freshmanFriendly: false, deadline: "All", sort: "Relevant" };
const summaryStatuses: OpportunityTrackerStatus[] = ["Submitted", "Interview", "Accepted", "Completed"];
const statusMeta: Record<OpportunityTrackerStatus, { Icon: IconComponent; accent: string; soft: string }> = {
  Saved: { Icon: BookmarkIcon, accent: "text-forest", soft: "bg-forest/8" },
  Interested: { Icon: HeartIcon, accent: "text-rose-700", soft: "bg-rose-50" },
  Applying: { Icon: PenLineIcon, accent: "text-amber-700", soft: "bg-amber-50" },
  Submitted: { Icon: SendIcon, accent: "text-blue-700", soft: "bg-blue-50" },
  Interview: { Icon: TargetIcon, accent: "text-violet-700", soft: "bg-violet-50" },
  Accepted: { Icon: CheckCircleIcon, accent: "text-emerald-700", soft: "bg-emerald-50" },
  Paused: { Icon: TargetIcon, accent: "text-stone-600", soft: "bg-stone-100" },
  Rejected: { Icon: XCircleIcon, accent: "text-red-700", soft: "bg-red-50" },
  Completed: { Icon: TrophyIcon, accent: "text-forest", soft: "bg-forest/8" },
};
const quickFilters: { label: string; type?: OpportunityType; category?: string }[] = [
  { label: "All" },
  { label: "Scholarships", type: "Scholarship" },
  { label: "Internships", type: "Career", category: "Internships" },
  { label: "AI Tools", type: "AI" },
  { label: "Research", type: "Research" },
  { label: "Benefits", type: "Benefit" },
  { label: "Software", category: "Software" },
  { label: "Career", type: "Career" },
];

function readStoredFilters(): FilterState {
  if (typeof window === "undefined") return defaultFilters;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as Partial<FilterState> | null;
    return { ...defaultFilters, ...parsed };
  } catch {
    return defaultFilters;
  }
}

function statusSummary(status: OpportunityTrackerStatus) {
  if (status === "Interview") return "Interviewing";
  return status;
}

function valueLabel(item: Opportunity) {
  if (item.estimated_value) return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(item.estimated_value);
  if (item.type === "Scholarship") return item.metadata.awardAmountLabel ?? "Amount varies";
  if (item.type === "Benefit") return item.metadata.valueLabel ?? "Student benefit";
  if (item.metadata.compensation === "Paid") return "Paid";
  if (item.remote) return "Remote";
  return item.metadata.studentOffer ?? "See details";
}

export function OpportunityFilter({ opportunities: initialOpportunities = [] }: { opportunities?: Opportunity[] }) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>(initialOpportunities);
  const [loaded, setLoaded] = useState(initialOpportunities.length > 0);
  const [refreshing, setRefreshing] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [filtersReady, setFiltersReady] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [visibleCount, setVisibleCount] = useState(16);
  const [totalMatches, setTotalMatches] = useState(initialOpportunities.length);
  const [categories, setCategories] = useState<string[]>(["All", ...new Set(initialOpportunities.map((item) => item.category).sort())]);
  const [majors, setMajors] = useState<string[]>(["All", ...new Set(initialOpportunities.flatMap((item) => item.majors).filter((item) => item !== "Any Major").sort())]);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [activity, setActivity] = useState<StudentActivity>({ viewed: [], saved: [], claimed: [], tracked: {} });
  const [reloadToken, setReloadToken] = useState(0);
  const hydrated = useRef(false);
  const trackedFilters = useRef(false);
  const loadedRef = useRef(initialOpportunities.length > 0);
  const deferredQuery = useDeferredValue(filters.query);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stored = readStoredFilters();
    const nextQuery = params.get("query");
    const nextCategory = params.get("category");
    const nextType = params.get("type");
    setFilters({
      ...stored,
      ...(nextQuery ? { query: nextQuery } : {}),
      ...(nextCategory ? { category: nextCategory } : {}),
      ...(nextType && listingOpportunityTypes.includes(nextType as OpportunityType) ? { type: nextType as OpportunityType } : {}),
    });
    hydrated.current = true;
    setFiltersReady(true);
    const update = () => setActivity(readStudentActivity());
    update();
    window.addEventListener(studentActivityEvent, update);
    return () => window.removeEventListener(studentActivityEvent, update);
  }, []);

  const requestKey = useMemo(() => {
    const params = new URLSearchParams({ view: "discover", limit: String(visibleCount), sort: filters.sort });
    const values: Record<string, string> = {
      query: deferredQuery.trim(),
      type: filters.type,
      category: filters.category,
      major: filters.major,
      school: filters.school,
      paid: filters.paid,
      remote: filters.remote,
      difficulty: filters.difficulty,
      deadline: filters.deadline,
    };
    for (const [key, value] of Object.entries(values)) if (value && value !== "All") params.set(key, value);
    if (filters.freshmanFriendly) params.set("freshmanFriendly", "true");
    return params.toString();
  }, [deferredQuery, filters.category, filters.deadline, filters.difficulty, filters.freshmanFriendly, filters.major, filters.paid, filters.remote, filters.school, filters.sort, filters.type, visibleCount]);

  useEffect(() => {
    if (!filtersReady) return;
    const controller = new AbortController();
    const delay = loadedRef.current ? 120 : 0;
    const timer = window.setTimeout(async () => {
      const startedAt = performance.now();
      setCatalogError("");
      if (loadedRef.current) setRefreshing(true);
      try {
        const response = await fetch(`/api/opportunities?${requestKey}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`catalog_${response.status}`);
        const body = await response.json() as DiscoverCatalogPayload;
        setOpportunities(body.opportunities);
        setTotalMatches(body.total);
        setCategories(["All", ...body.facets.categories]);
        setMajors(["All", ...body.facets.majors]);
        setTypeCounts(body.facets.typeCounts);
        loadedRef.current = true;
        setLoaded(true);
        performance.measure("unlocked:discover:catalog", { start: startedAt, end: performance.now() });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCatalogError("We couldn’t refresh opportunities. Try again.");
        if (!loadedRef.current) setLoaded(true);
      } finally {
        if (!controller.signal.aborted) setRefreshing(false);
      }
    }, delay);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [filtersReady, reloadToken, requestKey]);

  useEffect(() => { trackProductEvent("discover_opened"); }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    sessionStorage.setItem(storageKey, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    if (filters.query.trim().length < 2) return;
    const timer = window.setTimeout(() => trackProductEvent("search_performed", { searchType: "opportunity", searchValue: filters.query.trim() }), 500);
    return () => window.clearTimeout(timer);
  }, [filters.query]);
  useEffect(() => {
    if (!trackedFilters.current) { trackedFilters.current = true; return; }
    trackProductEvent("filter_applied", { filterName: "discover", filterValue: JSON.stringify(filters) });
  }, [filters]);

  const activeFilters = [filters.type, filters.category, filters.major, filters.school, filters.deadline, filters.paid, filters.remote, filters.difficulty].filter((item) => item !== "All").length + (filters.freshmanFriendly ? 1 : 0) + (filters.query.trim() ? 1 : 0);
  const statusCounts = useMemo(() => Object.fromEntries(opportunityTrackerStatuses.map((status) => [status, Object.values(activity.tracked ?? {}).filter((record) => record.status === status).length])) as Record<OpportunityTrackerStatus, number>, [activity.tracked]);

  function update(partial: Partial<FilterState>) {
    setVisibleCount(16);
    setFilters((current) => ({ ...current, ...partial }));
  }

  function clearFilters() {
    setVisibleCount(16);
    setFilters(defaultFilters);
    setMobileFiltersOpen(false);
  }

  function applyQuickFilter(item: (typeof quickFilters)[number]) {
    update({ type: item.type ?? "All", category: item.category ?? "All" });
  }

  return <>
    <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_660px] lg:items-center">
      <div>
        <p className="rule-label text-forest">Discover opportunities</p>
        <h1 className="mt-4 max-w-4xl font-editorial text-5xl font-bold leading-[.98] tracking-[-.055em] text-ink sm:text-7xl">Find the right opportunity.</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-ink/58">Search thousands of scholarships, internships, research programs, AI tools, and student benefits.</p>
      </div>
      <div className="grid overflow-hidden rounded-[1.4rem] bg-white/90 shadow-[0_22px_70px_rgba(43,33,26,.08)] ring-1 ring-ink/8 sm:grid-cols-4">
        {summaryStatuses.map((status) => <SummaryCard key={status} label={statusSummary(status)} value={statusCounts[status]} status={status} />)}
      </div>
    </header>

    <section className="mt-8 max-w-5xl rounded-[2rem] bg-white/42 p-3 shadow-[0_18px_60px_rgba(43,33,26,.05)] ring-1 ring-ink/6 sm:p-4" aria-label="Search opportunities">
      <label className="flex min-h-16 items-center gap-4 rounded-full bg-white px-5 shadow-[0_14px_38px_rgba(43,33,26,.075)] ring-1 ring-ink/7 focus-within:ring-2 focus-within:ring-forest/30">
        <SearchIcon className="h-5 w-5 text-forest" />
        <span className="sr-only">Search all opportunities</span>
        <input value={filters.query} onChange={(event) => update({ query: event.target.value })} placeholder="Search scholarships, internships, research, benefits..." className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-ink/35" />
      </label>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {quickFilters.map((item) => {
          const active = filters.type === (item.type ?? "All") && filters.category === (item.category ?? "All");
          return <button key={item.label} type="button" onClick={() => applyQuickFilter(item)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition duration-200 focus:outline-none focus:ring-2 focus:ring-forest/35 ${active ? "bg-forest text-white shadow-[0_12px_28px_rgba(31,95,67,.18)]" : "bg-white text-ink/58 hover:text-forest"}`}>{item.label}<span className={`rounded-md px-1.5 py-0.5 text-[11px] ${active ? "bg-white/18" : "bg-forest/8 text-forest"}`}>{typeCounts[item.label] ?? 0}</span></button>;
        })}
      </div>
    </section>

    <div className="mt-8 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <FilterPanel filters={filters} update={update} clearFilters={clearFilters} activeFilters={activeFilters} categories={categories} majors={majors} />
      </aside>

      <main>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="rule-label text-forest">Recommended for you</p>
            <h2 className="mt-2 font-editorial text-3xl font-bold tracking-[-.025em]">Top opportunities</h2>
            <p className="mt-1 text-sm text-ink/50">Personalized by search, filters, and real opportunity ranking.</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileFiltersOpen(true)} className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-white px-4 text-sm font-bold text-ink/60 shadow-[0_10px_26px_rgba(43,33,26,.045)] lg:hidden">Filters{activeFilters ? ` · ${activeFilters}` : ""}</button>
            <label className="flex min-h-11 items-center gap-3 rounded-full border border-ink/12 bg-white px-4 text-sm font-bold text-ink/55 shadow-[0_10px_26px_rgba(43,33,26,.045)]">
              <span>Sort by</span>
              <select value={filters.sort} onChange={(event) => update({ sort: event.target.value as DiscoverSortMode })} className="bg-transparent text-forest outline-none">
                {(["Relevant", "Newest", "Deadline", "Alphabetical"] as const).map((option) => <option key={option} value={option}>{option === "Relevant" ? "Most relevant" : option}</option>)}
              </select>
            </label>
          </div>
        </div>

        {refreshing ? <p className="mt-4 text-xs font-bold text-ink/40" role="status">Updating results…</p> : null}
        {catalogError && opportunities.length ? <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-white/70 px-4 py-3 text-sm text-ink/55" role="alert"><span>{catalogError}</span><button type="button" onClick={() => setReloadToken((value) => value + 1)} className="min-h-11 font-bold text-forest">Retry</button></div> : null}
        {!loaded ? <ResultSkeleton /> : catalogError && !opportunities.length ? <CatalogUnavailable retry={() => setReloadToken((value) => value + 1)} /> : opportunities.length ? <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {opportunities.map((item) => <OpportunityCard key={item.id} opportunity={item} />)}
          </div>
          {totalMatches > opportunities.length && <div className="py-7 text-center"><button onClick={() => setVisibleCount((count) => Math.min(count + 16, totalMatches))} disabled={refreshing} className="min-h-12 rounded-full border border-ink/15 bg-white px-6 text-sm font-bold text-forest shadow-[0_10px_26px_rgba(43,33,26,.045)] hover:border-forest disabled:cursor-wait disabled:opacity-60">{refreshing ? "Loading…" : "Show more opportunities"} <ArrowIcon className="inline h-3.5 w-3.5" /></button></div>}
        </> : <EmptyResults clearFilters={clearFilters} />}
      </main>
    </div>

    {mobileFiltersOpen && <div className="fixed inset-0 z-50 bg-ink/35 px-4 py-6 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
      <div className="ml-auto flex max-h-full max-w-md flex-col overflow-hidden rounded-[2rem] bg-paper shadow-[0_30px_90px_rgba(43,33,26,.25)]">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4"><p className="font-bold">Filters</p><button type="button" onClick={() => setMobileFiltersOpen(false)} className="rounded-full px-3 py-2 text-sm font-bold text-ink/50 hover:bg-white">Close</button></div>
        <div className="overflow-y-auto p-4"><FilterPanel filters={filters} update={update} clearFilters={clearFilters} activeFilters={activeFilters} categories={categories} majors={majors} /></div>
      </div>
    </div>}
  </>;
}

function SummaryCard({ label, value, status }: { label: string; value: number; status: OpportunityTrackerStatus }) {
  const { Icon, soft, accent } = statusMeta[status];
  return <section className="flex min-h-32 flex-col items-start justify-center gap-5 border-ink/8 p-5 text-left sm:border-r sm:last:border-r-0">
    <span className="flex w-full items-center justify-between gap-4"><span className="text-xs font-black text-ink/70">{label}</span><span className={`grid h-9 w-9 place-items-center rounded-full ${soft} ${accent}`}><Icon className="h-[18px] w-[18px]" /></span></span>
    <span className="font-editorial text-5xl font-bold leading-none text-forest">{value}</span>
  </section>;
}

function FilterPanel({ filters, update, clearFilters, activeFilters, categories, majors }: { filters: FilterState; update: (partial: Partial<FilterState>) => void; clearFilters: () => void; activeFilters: number; categories: string[]; majors: string[] }) {
  return <section className="rounded-[1.75rem] bg-white/58 p-5 shadow-[0_18px_60px_rgba(43,33,26,.045)] ring-1 ring-ink/6">
    <div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-4"><p className="rule-label text-ink/45">Filters</p><button type="button" onClick={clearFilters} className="text-xs font-black text-forest hover:text-ink">{activeFilters ? "Clear all" : "Reset"}</button></div>
    <div className="mt-5 space-y-5">
      <FilterGroup title="Category">
        <Select label="Type" value={filters.type} setValue={(value) => update({ type: value as OpportunityType | "All" })} options={["All", ...listingOpportunityTypes]} />
        <Select label="Category" value={filters.category} setValue={(value) => update({ category: value })} options={categories} />
      </FilterGroup>
      <FilterGroup title="Fit">
        <SchoolFilter value={filters.school} setValue={(value) => update({ school: value })} />
        <Select label="Major" value={filters.major} setValue={(value) => update({ major: value })} options={majors} />
        <label className="flex min-h-11 items-center gap-3 rounded-xl bg-paper/70 px-3 text-sm font-bold text-ink/60"><input type="checkbox" checked={filters.freshmanFriendly} onChange={(event) => update({ freshmanFriendly: event.target.checked })} className="h-4 w-4 accent-forest" /> Freshman-friendly</label>
      </FilterGroup>
      <FilterGroup title="Details">
        <Select label="Deadline" value={filters.deadline} setValue={(value) => update({ deadline: value })} options={["All", "published", "upcoming", "rolling", "not_announced"]} />
        <Select label="Value" value={filters.paid} setValue={(value) => update({ paid: value })} options={["All", "Paid", "Unpaid"]} />
        <Select label="Format" value={filters.remote} setValue={(value) => update({ remote: value })} options={["All", "Remote", "In Person"]} />
        <Select label="Difficulty" value={filters.difficulty} setValue={(value) => update({ difficulty: value as Exclude<OpportunityDifficulty, null> | "All" })} options={["All", "Open", "Competitive", "Highly Competitive"]} />
      </FilterGroup>
    </div>
  </section>;
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return <details open className="group">
    <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-black text-ink"><span>{title}</span><span className="text-ink/35 transition group-open:rotate-180">⌄</span></summary>
    <div className="mt-3 space-y-2">{children}</div>
  </details>;
}

function ResultSkeleton() {
  return <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Loading opportunities">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-72 rounded-[1.5rem] bg-white/70 p-5 shadow-[0_16px_42px_rgba(43,33,26,.045)] ring-1 ring-ink/6"><div className="h-3 w-24 rounded-full bg-paper" /><div className="mt-5 h-8 rounded-full bg-paper" /><div className="mt-3 h-4 w-2/3 rounded-full bg-paper" /><div className="mt-6 h-16 rounded-2xl bg-paper" /><div className="mt-8 h-11 rounded-full bg-paper" /></div>)}</div>;
}

function EmptyResults({ clearFilters }: { clearFilters: () => void }) {
  return <div className="mt-6 rounded-[2rem] bg-white/70 px-6 py-14 text-center shadow-[0_18px_60px_rgba(43,33,26,.045)] ring-1 ring-ink/6">
    <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-forest/8 text-forest"><SearchIcon className="h-6 w-6" /></div>
    <p className="mt-5 font-editorial text-3xl font-bold">No opportunities matched your filters.</p>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/50">Try a broader search, remove one filter, or browse everything available in UnlockED.</p>
    <button type="button" onClick={clearFilters} className="mt-7 min-h-12 rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-ink">Browse all opportunities</button>
  </div>;
}

function CatalogUnavailable({ retry }: { retry: () => void }) {
  return <div className="mt-6 rounded-[2rem] bg-white/70 px-6 py-14 text-center shadow-[0_18px_60px_rgba(43,33,26,.045)] ring-1 ring-ink/6" role="alert">
    <p className="font-editorial text-3xl font-bold">Opportunities are temporarily unavailable.</p>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/50">Your filters are still here. Retry when you’re ready.</p>
    <button type="button" onClick={retry} className="mt-7 min-h-12 rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-ink">Retry</button>
  </div>;
}

function SchoolFilter({ value, setValue }: { value: string; setValue: (value: string) => void }) {
  const selected = schools.find((item) => item.slug === value);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => findSchoolMatches(schools, query, 6), [query]);
  const normalized = normalizeSchoolQuery(query);
  function choose(item: School) { setValue(item.slug); setQuery(item.name); setOpen(false); }
  return <div className="relative rounded-xl bg-paper/70 px-3">
    <label className="flex min-h-11 items-center justify-between gap-3"><span className="text-sm font-bold text-ink/45">School</span><input value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setValue("All"); setOpen(true); }} placeholder="All schools" className="min-w-0 max-w-[62%] bg-transparent text-right text-sm font-bold outline-none placeholder:text-ink/35" /></label>
    {open && normalized && <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-soft">{matches.length ? matches.map((item) => <button key={item.slug} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)} className="block w-full border-b border-ink/10 px-4 py-3 text-left text-sm font-bold last:border-b-0 hover:bg-paper">{item.name}<span className="block text-[11px] font-normal text-ink/40">{item.domain}</span></button>) : <p className="px-4 py-3 text-xs text-ink/50">School not found</p>}</div>}
  </div>;
}

function Select({ label, value, setValue, options }: { label: string; value: string; setValue: (value: string) => void; options: readonly string[] }) {
  const allLabels: Record<string, string> = { Type: "All types", Category: "All categories", Major: "All majors", Value: "Any value", Deadline: "Any deadline", Format: "Any format", Difficulty: "Any difficulty" };
  return <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-paper/70 px-3"><span className="text-sm font-bold text-ink/45">{label}</span><select value={value} onChange={(event) => setValue(event.target.value)} className="min-w-0 max-w-[62%] bg-transparent text-right text-sm font-bold capitalize outline-none">{options.map((option) => <option key={option} value={option}>{option === "All" ? allLabels[label] : option.replaceAll("_", " ")}</option>)}</select></label>;
}
