"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Opportunity, OpportunityDifficulty, OpportunityType } from "@/data/opportunities";
import {
  discoverExplorationPaths,
  discoverSearchStarters,
  listingOpportunityTypes,
  type DiscoverCatalogPayload,
  type DiscoverRecovery,
  type DiscoverSortMode,
} from "@/data/opportunity-listing";
import { schoolDirectory as schools, type School } from "@/data/school-directory";
import { findSchoolMatches, normalizeSchoolQuery } from "@/data/school-search";
import { trackProductEvent } from "@/data/product-analytics";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { ArrowIcon, CloseIcon, SearchIcon } from "./icons";
import { OpportunityCard } from "./opportunity-card";
import { LoadingRegion, SkeletonBlock } from "./loading-system";
import { DelayedPendingLabel } from "./delayed-pending-label";
import { SmartEmptyState } from "./smart-empty-state";

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

type FilterKey = keyof Omit<FilterState, "sort">;
type ActiveFilter = { key: FilterKey; label: string };

const storageKey = "unlocked-discover-filters";
const scrollKey = "unlocked-discover-scroll";
const resultPageSize = 16;
const deadlineOptions = ["All", "open", "upcoming", "rolling", "closed", "recurring"] as const;
const sortOptions: DiscoverSortMode[] = ["Relevant", "Newest", "Deadline", "Alphabetical"];
const defaultFilters: FilterState = {
  query: "",
  type: "All",
  category: "All",
  major: "All",
  school: "All",
  paid: "All",
  remote: "All",
  difficulty: "All",
  freshmanFriendly: false,
  deadline: "All",
  sort: "Relevant",
};
const quickFilters: { label: string; type?: OpportunityType; category?: string }[] = [
  { label: "All" },
  { label: "Scholarships", type: "Scholarship" },
  { label: "Internships", type: "Career", category: "Internships" },
  { label: "Research", type: "Research" },
  { label: "AI Tools", type: "AI" },
  { label: "Benefits", type: "Benefit" },
  { label: "Software", category: "Software" },
  { label: "Career", type: "Career" },
];

function bounded(value: string | null, maximum: number) {
  return value?.trim().slice(0, maximum) ?? "";
}

function storedFilters(): FilterState {
  if (typeof window === "undefined") return defaultFilters;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as Partial<FilterState> | null;
    if (!parsed || typeof parsed !== "object") return defaultFilters;
    return {
      ...defaultFilters,
      query: typeof parsed.query === "string" ? parsed.query.slice(0, 120) : "",
      type: listingOpportunityTypes.includes(parsed.type as OpportunityType) ? parsed.type as OpportunityType : "All",
      category: typeof parsed.category === "string" ? parsed.category.slice(0, 80) : "All",
      major: typeof parsed.major === "string" ? parsed.major.slice(0, 80) : "All",
      school: typeof parsed.school === "string" ? parsed.school.slice(0, 160) : "All",
      paid: parsed.paid === "Paid" || parsed.paid === "Unpaid" ? parsed.paid : "All",
      remote: parsed.remote === "Remote" || parsed.remote === "In Person" ? parsed.remote : "All",
      difficulty: ["Open", "Competitive", "Highly Competitive"].includes(parsed.difficulty ?? "") ? parsed.difficulty as FilterState["difficulty"] : "All",
      freshmanFriendly: parsed.freshmanFriendly === true,
      deadline: deadlineOptions.includes(parsed.deadline as typeof deadlineOptions[number]) ? parsed.deadline as FilterState["deadline"] : "All",
      sort: sortOptions.includes(parsed.sort as DiscoverSortMode) ? parsed.sort as DiscoverSortMode : "Relevant",
    };
  } catch {
    return defaultFilters;
  }
}

function filtersFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const recognized = ["query", "type", "category", "major", "school", "paid", "remote", "difficulty", "freshmanFriendly", "deadline", "sort", "limit"];
  const base = recognized.some((key) => params.has(key)) ? defaultFilters : storedFilters();
  const requestedType = bounded(params.get("type"), 40);
  const requestedDifficulty = bounded(params.get("difficulty"), 40);
  const requestedDeadline = bounded(params.get("deadline"), 40);
  const requestedSort = bounded(params.get("sort"), 40) as DiscoverSortMode;
  const filters: FilterState = {
    ...base,
    ...(params.has("query") ? { query: bounded(params.get("query"), 120) } : {}),
    ...(params.has("type") ? { type: listingOpportunityTypes.includes(requestedType as OpportunityType) ? requestedType as OpportunityType : "All" } : {}),
    ...(params.has("category") ? { category: bounded(params.get("category"), 80) || "All" } : {}),
    ...(params.has("major") ? { major: bounded(params.get("major"), 80) || "All" } : {}),
    ...(params.has("school") ? { school: bounded(params.get("school"), 160) || "All" } : {}),
    ...(params.has("paid") ? { paid: ["Paid", "Unpaid"].includes(params.get("paid") ?? "") ? params.get("paid")! : "All" } : {}),
    ...(params.has("remote") ? { remote: ["Remote", "In Person"].includes(params.get("remote") ?? "") ? params.get("remote")! : "All" } : {}),
    ...(params.has("difficulty") ? { difficulty: ["Open", "Competitive", "Highly Competitive"].includes(requestedDifficulty) ? requestedDifficulty as FilterState["difficulty"] : "All" } : {}),
    ...(params.has("freshmanFriendly") ? { freshmanFriendly: params.get("freshmanFriendly") === "true" } : {}),
    ...(params.has("deadline") ? { deadline: deadlineOptions.includes(requestedDeadline as typeof deadlineOptions[number]) ? requestedDeadline : "All" } : {}),
    ...(params.has("sort") ? { sort: sortOptions.includes(requestedSort) ? requestedSort : "Relevant" } : {}),
  };
  const requestedLimit = Number(params.get("limit") ?? resultPageSize);
  const limit = Number.isFinite(requestedLimit) ? Math.min(64, Math.max(resultPageSize, Math.floor(requestedLimit / resultPageSize) * resultPageSize)) : resultPageSize;
  return { filters, limit };
}

function urlForFilters(filters: FilterState, limit: number) {
  const params = new URLSearchParams();
  const values: [string, string][] = [
    ["query", filters.query.trim()],
    ["type", filters.type],
    ["category", filters.category],
    ["major", filters.major],
    ["school", filters.school],
    ["paid", filters.paid],
    ["remote", filters.remote],
    ["difficulty", filters.difficulty],
    ["deadline", filters.deadline],
    ["sort", filters.sort],
  ];
  for (const [key, value] of values) {
    const defaultValue = key === "sort" ? "Relevant" : "All";
    if (value && value !== defaultValue) params.set(key, value);
  }
  if (filters.freshmanFriendly) params.set("freshmanFriendly", "true");
  if (limit > resultPageSize) params.set("limit", String(limit));
  return params;
}

function clearValue(key: FilterKey): Partial<FilterState> {
  if (key === "freshmanFriendly") return { freshmanFriendly: false };
  if (key === "query") return { query: "" };
  return { [key]: "All" } as Partial<FilterState>;
}

function schoolLabel(slug: string) {
  return schools.find((school) => school.slug === slug)?.name ?? slug;
}

function activeFilterLabels(filters: FilterState): ActiveFilter[] {
  const active: ActiveFilter[] = [];
  if (filters.query.trim()) active.push({ key: "query", label: `Search: ${filters.query.trim()}` });
  if (filters.type !== "All") active.push({ key: "type", label: filters.type });
  if (filters.category !== "All") active.push({ key: "category", label: filters.category });
  if (filters.major !== "All") active.push({ key: "major", label: filters.major });
  if (filters.school !== "All") active.push({ key: "school", label: schoolLabel(filters.school) });
  if (filters.paid !== "All") active.push({ key: "paid", label: filters.paid });
  if (filters.remote !== "All") active.push({ key: "remote", label: filters.remote });
  if (filters.difficulty !== "All") active.push({ key: "difficulty", label: filters.difficulty });
  if (filters.freshmanFriendly) active.push({ key: "freshmanFriendly", label: "Freshman-friendly" });
  if (filters.deadline !== "All") active.push({ key: "deadline", label: deadlineLabel(filters.deadline) });
  return active;
}

function deadlineLabel(value: string) {
  return {
    open: "Open now",
    upcoming: "Opening soon",
    rolling: "Rolling",
    closed: "Closed",
    recurring: "Recurring",
  }[value] ?? value;
}

function recoveryUpdate(filter: DiscoverRecovery["filter"]): Partial<FilterState> {
  return filter === "freshmanFriendly" ? { freshmanFriendly: false } : { [filter]: "All" } as Partial<FilterState>;
}

export function OpportunityFilter({ opportunities: initialOpportunities = [] }: { opportunities?: Opportunity[] }) {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [loaded, setLoaded] = useState(initialOpportunities.length > 0);
  const [refreshing, setRefreshing] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [filtersReady, setFiltersReady] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [visibleCount, setVisibleCount] = useState(resultPageSize);
  const [totalMatches, setTotalMatches] = useState(initialOpportunities.length);
  const [categories, setCategories] = useState(["All", ...new Set(initialOpportunities.map((item) => item.category).sort())]);
  const [majors, setMajors] = useState(["All", ...new Set(initialOpportunities.flatMap((item) => item.majors).filter((item) => item !== "Any Major").sort())]);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [explorationCounts, setExplorationCounts] = useState<Record<string, number>>({});
  const [recovery, setRecovery] = useState<DiscoverRecovery | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const deferredQuery = useDeferredValue(filters.query);
  const loadedRef = useRef(initialOpportunities.length > 0);
  const hydrated = useRef(false);
  const restoredScroll = useRef(false);
  const pendingScroll = useRef<number | null>(null);
  const filterTrigger = useRef<HTMLButtonElement | null>(null);
  const closeFilterButton = useRef<HTMLButtonElement | null>(null);
  const filterDialog = useRef<HTMLDivElement | null>(null);
  const resultGrid = useRef<HTMLDivElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const initial = filtersFromLocation();
    setFilters(initial.filters);
    setVisibleCount(initial.limit);
    try {
      const stored = JSON.parse(sessionStorage.getItem(scrollKey) ?? "null") as { url?: string; y?: number; savedAt?: number } | null;
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (stored?.url === currentUrl && typeof stored.y === "number" && Date.now() - (stored.savedAt ?? 0) < 10 * 60_000) pendingScroll.current = stored.y;
    } catch {
      sessionStorage.removeItem(scrollKey);
    }
    hydrated.current = true;
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    const saveScroll = () => {
      sessionStorage.setItem(scrollKey, JSON.stringify({
        url: `${window.location.pathname}${window.location.search}`,
        y: window.scrollY,
        savedAt: Date.now(),
      }));
    };
    window.addEventListener("pagehide", saveScroll);
    return () => window.removeEventListener("pagehide", saveScroll);
  }, []);

  useEffect(() => {
    if (!filtersReady || !hydrated.current) return;
    sessionStorage.setItem(storageKey, JSON.stringify(filters));
    const params = urlForFilters(filters, visibleCount);
    const next = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
    window.history.replaceState(window.history.state, "", next);
  }, [filters, filtersReady, visibleCount]);

  const requestKey = useMemo(() => {
    const params = urlForFilters({ ...filters, query: deferredQuery }, visibleCount);
    params.set("view", "discover");
    params.set("limit", String(visibleCount));
    return params.toString();
  }, [deferredQuery, filters, visibleCount]);

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
        setExplorationCounts(body.facets.explorationCounts);
        setRecovery(body.recovery);
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
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filtersReady, reloadToken, requestKey]);

  useEffect(() => {
    if (!loaded || restoredScroll.current || pendingScroll.current === null) return;
    const y = pendingScroll.current;
    restoredScroll.current = true;
    pendingScroll.current = null;
    sessionStorage.removeItem(scrollKey);
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" }));
  }, [loaded]);

  useEffect(() => {
    if (!opportunities.length) return;
    const byId = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));
    const nodes = resultGrid.current?.querySelectorAll<HTMLElement>("[data-discover-opportunity]") ?? [];
    const record = (element: HTMLElement) => {
      const opportunity = byId.get(element.dataset.discoverOpportunity ?? "");
      if (!opportunity) return;
      trackProductEvent(productIntelligenceEvents.discoverResultImpression, {
        opportunityId: opportunity.id,
        category: opportunity.category,
        source: "discover",
      }, { dedupeKey: `discover-impression:${opportunity.id}`, dedupeWindowMs: 30 * 60_000 });
    };
    if (!("IntersectionObserver" in window)) {
      [...nodes].slice(0, 6).forEach(record);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        record(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.25 });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [opportunities]);

  useEffect(() => {
    trackProductEvent("discover_opened");
  }, []);

  useEffect(() => {
    if (!loaded || catalogError || totalMatches !== 0) return;
    trackProductEvent(productIntelligenceEvents.discoverZeroResult, { source: "discover" }, {
      dedupeKey: `discover-zero:${activeFilterLabels(filters).length}`,
      dedupeWindowMs: 30_000,
    });
  }, [catalogError, filters, loaded, totalMatches]);

  useEffect(() => {
    if (filters.query.trim().length < 2) return;
    const timer = window.setTimeout(() => {
      trackProductEvent("search_performed", { searchType: "opportunity" });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [filters.query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.matches("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !editing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        searchInput.current?.focus();
        searchInput.current?.select();
      } else if (event.key === "Escape" && document.activeElement === searchInput.current && filters.query) {
        event.preventDefault();
        update({ query: "" });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [filters.query]);

  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeFilterButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileFiltersOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(filterDialog.current?.querySelectorAll<HTMLElement>("button, input, select, [href], [tabindex]:not([tabindex='-1'])") ?? [])].filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      filterTrigger.current?.focus();
    };
  }, [mobileFiltersOpen]);

  const activeFilters = useMemo(() => activeFilterLabels(filters), [filters]);

  function update(partial: Partial<FilterState>, eventName?: FilterKey) {
    setVisibleCount(resultPageSize);
    setFilters((current) => ({ ...current, ...partial }));
    if (eventName && eventName !== "query") trackProductEvent("filter_applied", { filterName: eventName });
  }

  function clearFilters() {
    setVisibleCount(resultPageSize);
    setFilters(defaultFilters);
    setMobileFiltersOpen(false);
  }

  function broadenFilters() {
    setVisibleCount(resultPageSize);
    setFilters((current) => ({ ...defaultFilters, query: current.query, sort: current.sort }));
  }

  function applyQuickFilter(item: (typeof quickFilters)[number]) {
    setVisibleCount(resultPageSize);
    setFilters((current) => ({ ...current, type: item.type ?? "All", category: item.category ?? "All" }));
    trackProductEvent("filter_applied", { filterName: "type" });
  }

  function applyExplorationPath(path: (typeof discoverExplorationPaths)[number]) {
    setVisibleCount(resultPageSize);
    setFilters((current) => ({ ...current, query: "", type: path.type ?? "All", category: path.category ?? "All", sort: "Relevant" }));
    trackProductEvent("filter_applied", { filterName: "exploration_path" });
  }

  const isBlankExploration = !filters.query.trim() && activeFilters.length === 0;

  const hasRestrictiveFilters = activeFilters.some((filter) => filter.key !== "query");

  return <>
    <header className="max-w-4xl">
      <p className="rule-label text-forest">Discover opportunities</p>
      <h1 className="mt-4 font-editorial text-5xl font-semibold leading-[1] text-ink sm:text-6xl">Find what’s out there.</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-ink/60">Search UnlockED’s complete catalog of scholarships, internships, research, student tools, and benefits.</p>
      <Link href="/careers" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-forest/20 bg-white/65 px-4 text-sm font-bold text-forest hover:border-forest/45">Exploring the work itself? Browse careers →</Link>
    </header>

    <section data-discover-search-shell="" className="mt-8 max-w-5xl rounded-[1.5rem] bg-white/50 p-3 shadow-[0_18px_55px_rgba(43,33,26,.05)] ring-1 ring-ink/10 sm:p-4" aria-label="Search opportunities">
      <div data-search-surface="" className="flex min-h-16 items-center gap-4 rounded-2xl border border-transparent bg-white px-5 shadow-[0_12px_34px_rgba(43,33,26,.065)] ring-1 ring-ink/10">
        <SearchIcon className="h-5 w-5 text-forest" />
        <label htmlFor="discover-search" className="sr-only">Search all opportunities</label>
        <input ref={searchInput} id="discover-search" type="search" value={filters.query} onChange={(event) => update({ query: event.target.value })} maxLength={120} autoComplete="off" enterKeyHint="search" aria-keyshortcuts="/ Escape" placeholder="Try “first-year software internship” or “Chicago scholarship”" className="discover-search-input min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-ink/35" />
        {filters.query ? <button type="button" onClick={() => { update({ query: "" }); searchInput.current?.focus(); }} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink/40 hover:bg-paper hover:text-forest" aria-label="Clear opportunity search"><CloseIcon className="h-4 w-4" /></button> : null}
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="Browse by category">
        {quickFilters.map((item) => {
          const active = filters.type === (item.type ?? "All") && filters.category === (item.category ?? "All");
          return <button key={item.label} type="button" onClick={() => applyQuickFilter(item)} aria-pressed={active} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition duration-200 focus:outline-none focus:ring-2 focus:ring-forest/35 ${active ? "bg-forest text-white shadow-[0_10px_24px_rgba(31,95,67,.16)]" : "bg-white text-ink/60 hover:text-forest"}`}>{item.label}<span aria-hidden="true" className={`rounded-md px-1.5 py-0.5 text-[11px] ${active ? "bg-white/20" : "bg-forest/10 text-forest"}`}>{typeCounts[item.label] ?? 0}</span></button>;
        })}
      </div>
    </section>

    {isBlankExploration ? <StartExploring explorationCounts={explorationCounts} choosePath={applyExplorationPath} chooseSearch={(query) => { update({ query }); searchInput.current?.focus(); }} /> : null}

    {activeFilters.length ? <div className="mt-4 flex max-w-5xl flex-wrap items-center gap-2" aria-label="Active filters">
      {activeFilters.map((filter) => <button key={filter.key} type="button" onClick={() => update(clearValue(filter.key), filter.key)} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-forest/20 bg-white/80 px-3 text-xs font-bold text-ink/60 shadow-[0_4px_14px_rgba(43,33,26,.025)] hover:border-forest/45 hover:text-forest" aria-label={`Remove ${filter.label} filter`}><span className="max-w-[16rem] truncate">{filter.label}</span><CloseIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /></button>)}
      <button type="button" onClick={clearFilters} className="min-h-11 px-2 text-xs font-bold text-forest hover:text-ink">Clear all</button>
    </div> : null}

    <div className="mt-9 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <FilterPanel filters={filters} update={update} clearFilters={clearFilters} activeFilterCount={activeFilters.length} categories={categories} majors={majors} />
      </aside>

      <main aria-busy={refreshing} data-filter-results="" data-refreshing={refreshing ? "true" : undefined}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="rule-label text-forest">{filters.query.trim() ? "Search results" : activeFilters.length ? "Filtered catalog" : "Browse all opportunities"}</p>
            <h2 className="mt-2 font-editorial text-3xl font-bold" role="status" aria-live="polite" aria-atomic="true">{loaded ? `${totalMatches.toLocaleString()} ${totalMatches === 1 ? "opportunity" : "opportunities"}` : "Opportunities"}<span className="sr-only">{refreshing ? ", updating" : ", ready"}</span></h2>
            <p className="mt-1 text-sm text-ink/50">{filters.query.trim() ? "Best title, organization, and subject matches appear first." : "Explore the catalog without personalized ranking or hidden profile filters."}</p>
          </div>
          <div className="flex items-center gap-3">
            <button ref={filterTrigger} type="button" onClick={() => setMobileFiltersOpen(true)} className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/15 bg-white px-4 text-sm font-bold text-ink/60 shadow-[0_8px_22px_rgba(43,33,26,.04)] lg:hidden">Filters{activeFilters.length ? ` · ${activeFilters.length}` : ""}</button>
            <label className="flex min-h-11 items-center gap-3 rounded-full border border-ink/15 bg-white px-4 text-sm font-bold text-ink/55 shadow-[0_8px_22px_rgba(43,33,26,.04)] focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
              <span>Sort</span>
              <select value={filters.sort} onChange={(event) => { update({ sort: event.target.value as DiscoverSortMode }); trackProductEvent("filter_applied", { filterName: "sort" }); }} className="cursor-pointer bg-transparent text-forest outline-none">
                {sortOptions.map((option) => <option key={option} value={option}>{option === "Relevant" ? "Most relevant" : option}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="min-h-5">
          {refreshing ? <p className="mt-4 text-xs font-bold text-ink/40" role="status">Updating results…</p> : null}
        </div>
        {catalogError && opportunities.length ? <div className="mt-1 flex items-center justify-between gap-4 rounded-xl bg-white/70 px-4 py-3 text-sm text-ink/55" role="alert"><span>{catalogError}</span><button type="button" onClick={() => setReloadToken((value) => value + 1)} className="min-h-11 font-bold text-forest">Retry</button></div> : null}
        {!loaded ? <ResultSkeleton /> : catalogError && !opportunities.length ? <CatalogUnavailable retry={() => setReloadToken((value) => value + 1)} /> : opportunities.length ? <>
          {totalMatches > 0 && totalMatches <= 4 && hasRestrictiveFilters ? <LowResultRecovery total={totalMatches} broadenFilters={broadenFilters} hasQuery={Boolean(filters.query.trim())} /> : null}
          <div ref={resultGrid} className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {opportunities.map((item) => <OpportunityCard key={item.id} opportunity={item} source="discover" />)}
          </div>
          {totalMatches > opportunities.length ? <div className="py-7 text-center"><button type="button" onClick={() => setVisibleCount((count) => Math.min(count + resultPageSize, totalMatches))} disabled={refreshing} aria-busy={refreshing ? "true" : undefined} data-action-state={refreshing ? "loading" : "idle"} className="min-h-12 rounded-full border border-ink/15 bg-white px-6 text-sm font-bold text-forest shadow-[0_8px_22px_rgba(43,33,26,.04)] hover:border-forest disabled:cursor-wait disabled:opacity-60"><DelayedPendingLabel pending={refreshing} idle={<>Show more ({(totalMatches - opportunities.length).toLocaleString()} remaining) <ArrowIcon className="inline h-3.5 w-3.5" /></>} pendingLabel="Updating results…" /></button></div> : null}
        </> : <EmptyResults recovery={recovery} removeRecovery={() => recovery && update(recoveryUpdate(recovery.filter), recovery.filter)} clearQuery={() => update({ query: "" })} clearFilters={clearFilters} hasQuery={Boolean(filters.query.trim())} hasFilters={hasRestrictiveFilters} />}
      </main>
    </div>

    {mobileFiltersOpen ? <div data-modal-overlay="" className="fixed inset-0 z-50 bg-ink/35 px-3 py-[max(1rem,env(safe-area-inset-top))] lg:hidden" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileFiltersOpen(false); }}>
      <div ref={filterDialog} data-modal-surface="" className="ml-auto flex max-h-full max-w-md flex-col overflow-hidden rounded-[1.5rem] bg-paper shadow-[0_30px_90px_rgba(43,33,26,.25)]" role="dialog" aria-modal="true" aria-labelledby="mobile-filter-title">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4"><p id="mobile-filter-title" className="font-bold">Filter opportunities</p><button ref={closeFilterButton} type="button" onClick={() => setMobileFiltersOpen(false)} className="min-h-11 rounded-full px-3 text-sm font-bold text-ink/50 hover:bg-white">Close</button></div>
        <div className="overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><FilterPanel filters={filters} update={update} clearFilters={clearFilters} activeFilterCount={activeFilters.length} categories={categories} majors={majors} /></div>
      </div>
    </div> : null}
  </>;
}

function FilterPanel({ filters, update, clearFilters, activeFilterCount, categories, majors }: { filters: FilterState; update: (partial: Partial<FilterState>, eventName?: FilterKey) => void; clearFilters: () => void; activeFilterCount: number; categories: string[]; majors: string[] }) {
  return <section data-discover-filter-panel="" className="rounded-[1.25rem] bg-white/70 p-5 shadow-[0_14px_45px_rgba(43,33,26,.04)] ring-1 ring-ink/10">
    <div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-4"><p className="rule-label text-ink/45">Filters</p><button type="button" onClick={clearFilters} className="min-h-11 text-xs font-black text-forest hover:text-ink">{activeFilterCount ? "Clear all" : "Reset"}</button></div>
    <div className="mt-5 space-y-5">
      <FilterGroup title="Opportunity">
        <Select label="Type" value={filters.type} setValue={(value) => update({ type: value as OpportunityType | "All" }, "type")} options={["All", ...listingOpportunityTypes]} />
        <Select label="Category" value={filters.category} setValue={(value) => update({ category: value }, "category")} options={categories} />
      </FilterGroup>
      <FilterGroup title="Availability">
        <Select label="Deadline" value={filters.deadline} setValue={(value) => update({ deadline: value }, "deadline")} options={deadlineOptions} />
      </FilterGroup>
      <details className="group border-t border-ink/10 pt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-black text-ink"><span>More filters</span><span aria-hidden="true" className="text-ink/35 transition group-open:rotate-180">⌄</span></summary>
        <p className="mb-3 text-xs leading-5 text-ink/45">Use these when the listing provides enough detail.</p>
        <div className="space-y-5">
          <FilterGroup title="Eligibility">
            <SchoolFilter value={filters.school} setValue={(value) => update({ school: value }, "school")} />
            <Select label="Major" value={filters.major} setValue={(value) => update({ major: value }, "major")} options={majors} />
            <label data-discover-filter-row="" data-active={filters.freshmanFriendly ? "true" : "false"} className="flex min-h-11 items-center gap-3 rounded-xl border border-transparent bg-paper/70 px-3 text-sm font-bold text-ink/60"><input type="checkbox" checked={filters.freshmanFriendly} onChange={(event) => update({ freshmanFriendly: event.target.checked }, "freshmanFriendly")} className="h-5 w-5 rounded accent-forest" /> Freshman-friendly</label>
          </FilterGroup>
          <FilterGroup title="Details">
            <Select label="Value" value={filters.paid} setValue={(value) => update({ paid: value }, "paid")} options={["All", "Paid", "Unpaid"]} />
            <Select label="Format" value={filters.remote} setValue={(value) => update({ remote: value }, "remote")} options={["All", "Remote", "In Person"]} />
            <Select label="Difficulty" value={filters.difficulty} setValue={(value) => update({ difficulty: value as FilterState["difficulty"] }, "difficulty")} options={["All", "Open", "Competitive", "Highly Competitive"]} />
          </FilterGroup>
        </div>
      </details>
    </div>
  </section>;
}

function StartExploring({ explorationCounts, choosePath, chooseSearch }: { explorationCounts: Record<string, number>; choosePath: (path: (typeof discoverExplorationPaths)[number]) => void; chooseSearch: (query: string) => void }) {
  return <section className="mt-9 max-w-5xl border-y border-ink/10 py-6" aria-labelledby="start-exploring-title">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="rule-label text-forest">Start exploring</p><h2 id="start-exploring-title" className="mt-2 font-editorial text-2xl font-bold">Browse by what you’re looking for.</h2></div><p className="max-w-md text-sm leading-6 text-ink/50">These paths organize the complete catalog. They do not use your profile or activity.</p></div>
    <div className="mt-5 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">{discoverExplorationPaths.map((path) => <button key={path.label} type="button" onClick={() => choosePath(path)} className="group flex min-h-20 items-center justify-between gap-4 border-b border-ink/10 py-3 text-left focus:outline-none focus:ring-2 focus:ring-forest/25"><span><span className="block text-sm font-bold text-ink group-hover:text-forest">{path.label}</span><span className="mt-1 block text-xs leading-5 text-ink/45">{path.description}</span></span><span className="shrink-0 font-mono text-xs text-ink/35">{(explorationCounts[path.label] ?? 0).toLocaleString()}</span></button>)}</div>
    <div className="mt-5 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-bold text-ink/40">Try a search</span>{discoverSearchStarters.map((query) => <button key={query} type="button" onClick={() => chooseSearch(query)} className="min-h-11 rounded-full border border-ink/10 bg-white px-3 text-xs font-bold text-ink/55 hover:border-forest/30 hover:text-forest">{query}</button>)}</div>
  </section>;
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return <details open className="group">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-black text-ink"><span>{title}</span><span aria-hidden="true" className="text-ink/35 transition group-open:rotate-180">⌄</span></summary>
    <div className="mt-2 space-y-2">{children}</div>
  </details>;
}

function ResultSkeleton() {
  return <LoadingRegion label="Loading opportunities" className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-[23rem] rounded-[1.25rem] bg-white/70 p-5 shadow-[0_14px_40px_rgba(43,33,26,.04)] ring-1 ring-ink/10"><SkeletonBlock className="h-3 w-24 rounded-full" /><SkeletonBlock className="mt-5 h-8 rounded-md" /><SkeletonBlock className="mt-3 h-4 w-2/3 rounded-full" /><SkeletonBlock className="mt-6 h-16 rounded-lg" /><SkeletonBlock className="mt-8 h-11 rounded-xl" /></div>)}</LoadingRegion>;
}

function EmptyResults({ recovery, removeRecovery, clearQuery, clearFilters, hasQuery, hasFilters }: { recovery: DiscoverRecovery | null; removeRecovery: () => void; clearQuery: () => void; clearFilters: () => void; hasQuery: boolean; hasFilters: boolean }) {
  const title = hasFilters || hasQuery ? "No opportunities match this search." : "Nothing available here right now.";
  const description = recovery
    ? `Removing one filter reveals ${recovery.resultCount.toLocaleString()} ${recovery.resultCount === 1 ? "opportunity" : "opportunities"}.`
    : hasFilters || hasQuery
      ? "Try adjusting your keywords or removing the filters that are narrowing this view."
      : "New verified opportunities are added and updated over time.";
  const primaryAction = recovery
    ? { label: `Use ${recovery.label}`, onClick: removeRecovery }
    : hasQuery
      ? { label: "Clear search", onClick: clearQuery }
      : hasFilters
        ? { label: "Clear filters", onClick: clearFilters }
        : undefined;
  const secondaryAction = (hasQuery && hasFilters) || recovery ? { label: "Browse all opportunities", onClick: clearFilters } : undefined;
  return <SmartEmptyState className="mt-2" title={title} description={description} primaryAction={primaryAction} secondaryAction={secondaryAction} icon={SearchIcon} />;
}

function LowResultRecovery({ total, broadenFilters, hasQuery }: { total: number; broadenFilters: () => void; hasQuery: boolean }) {
  return <div className="mt-5 flex flex-col gap-2 rounded-xl border border-ink/10 bg-white/55 px-4 py-3 text-sm text-ink/55 sm:flex-row sm:items-center sm:justify-between">
    <p>Only {total} {total === 1 ? "match" : "matches"}. {hasQuery ? "Keep your search and remove the other filters." : "Broaden the filters to see more."}</p>
    <button type="button" onClick={broadenFilters} className="min-h-11 shrink-0 self-start font-bold text-forest hover:text-ink sm:self-auto">Broaden filters</button>
  </div>;
}

function CatalogUnavailable({ retry }: { retry: () => void }) {
  return <div className="mt-2 rounded-[1.5rem] bg-white/70 px-6 py-14 text-center shadow-[0_16px_50px_rgba(43,33,26,.04)] ring-1 ring-ink/10" role="alert">
    <p className="font-editorial text-3xl font-bold">Opportunities are temporarily unavailable.</p>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/50">Your search and filters are still here. Try loading the catalog again.</p>
    <button type="button" onClick={retry} className="mt-7 min-h-12 rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-ink">Retry</button>
  </div>;
}

function SchoolFilter({ value, setValue }: { value: string; setValue: (value: string) => void }) {
  const selected = schools.find((item) => item.slug === value);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => findSchoolMatches(schools, query, 6), [query]);
  const normalized = normalizeSchoolQuery(query);

  useEffect(() => {
    if (value === "All" && selected === undefined && query && !open) setQuery("");
  }, [open, query, selected, value]);

  function choose(item: School) {
    setValue(item.slug);
    setQuery(item.name);
    setOpen(false);
  }

  return <div data-discover-filter-row="" data-active={value !== "All" ? "true" : "false"} className="relative rounded-xl border border-transparent bg-paper/70 px-3">
    <label className="flex min-h-11 items-center justify-between gap-3"><span className="text-sm font-bold text-ink/45">School</span><input value={query} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onChange={(event) => { setQuery(event.target.value); setValue("All"); setOpen(true); }} placeholder="All schools" autoComplete="off" className="min-w-0 max-w-[62%] bg-transparent text-right text-sm font-bold outline-none placeholder:text-ink/35" /></label>
    {open && normalized ? <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-soft">{matches.length ? matches.map((item) => <button key={item.slug} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)} className="block min-h-11 w-full border-b border-ink/10 px-4 py-3 text-left text-sm font-bold last:border-b-0 hover:bg-paper">{item.name}<span className="block text-[11px] font-normal text-ink/40">{item.domain}</span></button>) : <p className="px-4 py-3 text-xs text-ink/50">School not found</p>}</div> : null}
  </div>;
}

function Select({ label, value, setValue, options }: { label: string; value: string; setValue: (value: string) => void; options: readonly string[] }) {
  const allLabels: Record<string, string> = { Type: "All types", Category: "All categories", Major: "All majors", Value: "Any value", Deadline: "Any deadline", Format: "Any format", Difficulty: "Any difficulty" };
  return <label data-discover-filter-row="" data-active={value !== "All" ? "true" : "false"} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-transparent bg-paper/70 px-3"><span className="text-sm font-bold text-ink/45">{label}</span><select value={value} onChange={(event) => setValue(event.target.value)} className="min-w-0 max-w-[62%] cursor-pointer bg-transparent text-right text-sm font-bold capitalize outline-none">{options.map((option) => <option key={option} value={option}>{option === "All" ? allLabels[label] : label === "Deadline" ? deadlineLabel(option) : option.replaceAll("_", " ")}</option>)}</select></label>;
}
