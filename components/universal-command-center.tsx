"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { UniversalSearchPayload, UniversalSearchResult } from "@/data/universal-search";
import { authenticatedFetch } from "@/data/authenticated-request";
import { ArrowIcon, BellIcon, BookmarkIcon, CalendarIcon, CloseIcon, PenLineIcon, SearchIcon, SparkIcon, TargetIcon } from "./icons";
import styles from "./universal-command-center.module.css";

type LocalKind = "navigate" | "action" | "learn" | "browse" | "recent";
type CommandResult = Omit<UniversalSearchResult, "kind" | "group" | "score"> & {
  kind: UniversalSearchResult["kind"] | LocalKind;
  group: string;
  score: number;
  keywords?: string;
  private?: boolean;
};

const localCommands: CommandResult[] = [
  { id: "navigate:discover", kind: "navigate", group: "Navigate", title: "Discover", subtitle: "Search the complete opportunity catalog.", href: "/opportunities", score: 0, keywords: "search opportunities browse catalog" },
  { id: "navigate:for-you", kind: "navigate", group: "Navigate", title: "For You", subtitle: "Open your verified personalized shortlist.", href: "/advisor", score: 0, keywords: "recommendations matches personalized" },
  { id: "navigate:journey", kind: "navigate", group: "Navigate", title: "Journey", subtitle: "Manage opportunities, progress, and outcomes.", href: "/", score: 0, keywords: "saved tracked progress active opportunities" },
  { id: "navigate:notifications", kind: "navigate", group: "Navigate", title: "Notifications", subtitle: "Review deadlines, changes, and Journey updates.", href: "/notifications", score: 0, keywords: "alerts reminders updates" },
  { id: "navigate:profile", kind: "navigate", group: "Navigate", title: "Profile", subtitle: "Update your account and personalization.", href: "/profile", score: 0, keywords: "account settings school major dark mode appearance" },
  { id: "navigate:interests", kind: "navigate", group: "Navigate", title: "Interests and goals", subtitle: "Refine the profile used for recommendations.", href: "/profile#interests", score: 0, keywords: "preferences career goals majors" },
  { id: "action:journey", kind: "action", group: "Quick Actions", title: "Open Journey", subtitle: "Return to your active opportunities.", href: "/#active-opportunities", score: 0, keywords: "saved tracked" },
  { id: "action:deadlines", kind: "action", group: "Quick Actions", title: "View deadlines", subtitle: "Open the Smart Deadline Calendar.", href: "/#journey-upcoming-heading", score: 0, keywords: "calendar upcoming due this week dates" },
  { id: "action:explore", kind: "action", group: "Quick Actions", title: "Explore opportunities", subtitle: "Browse all verified catalog listings.", href: "/opportunities", score: 0, keywords: "discover search browse" },
  { id: "action:applications", kind: "action", group: "Quick Actions", title: "Application Command Center", subtitle: "Organize requirements and private application tasks.", href: "/?stage=preparing#active-opportunities", score: 0, keywords: "applications tasks resume essay requirements" },
  { id: "browse:scholarships", kind: "browse", group: "Browse", title: "Browse Scholarships", subtitle: "Funding opportunities from official sources.", href: "/opportunities?type=Scholarship", score: 0, keywords: "scholarship scholarships funding grants awards" },
  { id: "browse:internships", kind: "browse", group: "Browse", title: "Browse Internships", subtitle: "Internships and early-career programs.", href: "/opportunities?type=Career&category=Internships", score: 0, keywords: "internship internships software engineering freshman career" },
  { id: "browse:research", kind: "browse", group: "Browse", title: "Browse Research", subtitle: "Undergraduate research and lab programs.", href: "/opportunities?type=Research", score: 0, keywords: "research lab science undergraduate" },
  { id: "browse:ai", kind: "browse", group: "Browse", title: "Browse AI Tools", subtitle: "Student AI tools and software resources.", href: "/opportunities?type=AI", score: 0, keywords: "ai artificial intelligence tools software" },
  { id: "learn:journey", kind: "learn", group: "Learn UnlockED", title: "How Journey works", subtitle: "Save opportunities and manage progress in one private record.", href: "/learn#journey", score: 0, keywords: "help with journey how does journey work" },
  { id: "learn:deadlines", kind: "learn", group: "Learn UnlockED", title: "Smart Deadline Calendar", subtitle: "See how official deadlines and personal dates work.", href: "/learn#deadlines", score: 0, keywords: "how do deadlines work calendar help" },
  { id: "learn:applications", kind: "learn", group: "Learn UnlockED", title: "Application Command Center", subtitle: "Learn how UnlockED organizes requirements and tasks.", href: "/learn#applications", score: 0, keywords: "application tasks help resume" },
  { id: "learn:cards", kind: "learn", group: "Learn UnlockED", title: "Journey Cards", subtitle: "Learn when confirmed milestones become shareable.", href: "/?guide=journey_card#journey-cards", score: 0, keywords: "journey card share milestone" },
  { id: "learn:all", kind: "learn", group: "Learn UnlockED", title: "Learn UnlockED", subtitle: "Open the concise product guide.", href: "/learn", score: 0, keywords: "help guide learn support" },
];

const recentKey = "unlocked:universal-search-recents:v1";
const groupOrder = ["Recent", "Quick Actions", "Your Journey", "Upcoming", "Application tasks", "Navigate", "Browse", "Opportunities", "Learn UnlockED"];

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function localScore(result: CommandResult, query: string, pathname: string) {
  const needle = normalize(query);
  const title = normalize(result.title);
  const haystack = normalize(`${result.title} ${result.subtitle} ${result.keywords ?? ""}`);
  if (!needle) return 0;
  let score = title === needle ? 1_100 : title.startsWith(needle) ? 820 : title.includes(needle) ? 680 : haystack.includes(needle) ? 520 : 0;
  if (!score) {
    const tokens = needle.split(" ");
    if (tokens.every((token) => haystack.split(" ").some((part) => part === token || part.startsWith(token)))) score = 390;
  }
  if (score && pathname === "/" && /journey|calendar|deadline|application/.test(haystack)) score += 80;
  if (score && pathname.startsWith("/opportunities") && result.kind === "browse") score += 60;
  return score;
}

function ResultIcon({ kind }: { kind: CommandResult["kind"] }) {
  if (kind === "journey" || kind === "recent") return <BookmarkIcon />;
  if (kind === "deadline") return <CalendarIcon />;
  if (kind === "task") return <TargetIcon />;
  if (kind === "opportunity" || kind === "browse") return <SearchIcon />;
  if (kind === "learn") return <SparkIcon />;
  if (kind === "navigate") return <ArrowIcon />;
  return <PenLineIcon />;
}

function Highlight({ value, query }: { value: string; query: string }) {
  const needle = query.trim();
  if (!needle) return value;
  const index = value.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
  if (index < 0) return value;
  return <>{value.slice(0, index)}<mark>{value.slice(index, index + needle.length)}</mark>{value.slice(index + needle.length)}</>;
}

function readRecents(): CommandResult[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(recentKey) ?? "[]") as Array<Partial<CommandResult>>;
    return parsed.flatMap((item): CommandResult[] => typeof item.id === "string" && typeof item.title === "string" && typeof item.subtitle === "string" && typeof item.href === "string" && item.href.startsWith("/")
      ? [{ id: item.id, kind: "recent", group: "Recent", title: item.title.slice(0, 120), subtitle: item.subtitle.slice(0, 160), href: item.href.slice(0, 300), score: 0 }]
      : []).slice(0, 4);
  } catch {
    return [];
  }
}

export function UniversalCommandCenter({ onClose, restoreFocus }: { onClose: () => void; restoreFocus: () => void }) {
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<UniversalSearchResult[]>([]);
  const [recents, setRecents] = useState<CommandResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setRecents(readRecents());
    inputRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      requestRef.current?.abort("closed");
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    setActiveIndex(0);
    setError("");
    requestRef.current?.abort("superseded");
    if (normalized.length < 2) {
      setRemote([]);
      setLoading(false);
      setShowLoading(false);
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    const start = window.setTimeout(async () => {
      setLoading(true);
      const delayed = window.setTimeout(() => setShowLoading(true), 260);
      const timeout = window.setTimeout(() => controller.abort("timeout"), 5_000);
      try {
        const response = await authenticatedFetch(`/api/search?q=${encodeURIComponent(normalized)}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const body = await response.json().catch(() => null) as UniversalSearchPayload | { error?: string } | null;
        if (!response.ok || !body || !("results" in body)) throw new Error("Search unavailable");
        if (!controller.signal.aborted) setRemote(body.results);
      } catch {
        if (!controller.signal.aborted || controller.signal.reason === "timeout") setError("Opportunity search is unavailable. Navigation still works.");
      } finally {
        window.clearTimeout(delayed);
        window.clearTimeout(timeout);
        if (requestRef.current === controller) requestRef.current = null;
        if (!controller.signal.aborted || controller.signal.reason === "timeout") {
          setLoading(false);
          setShowLoading(false);
        }
      }
    }, 140);
    return () => { window.clearTimeout(start); controller.abort("superseded"); };
  }, [query]);

  const results = useMemo(() => {
    const normalized = query.trim();
    if (!normalized) return [
      ...recents,
      ...localCommands.filter((item) => item.group === "Quick Actions").slice(0, 3),
      ...localCommands.filter((item) => item.group === "Navigate").slice(0, 4),
    ];
    const local = localCommands.map((item) => ({ ...item, score: localScore(item, normalized, pathname) })).filter((item) => item.score > 0);
    const merged = [...local, ...remote.map((item): CommandResult => ({ ...item, private: item.kind !== "opportunity" }))];
    const seen = new Set<string>();
    return merged.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).filter((item) => {
      const key = `${item.href}:${item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 18);
  }, [pathname, query, recents, remote]);

  const groups = useMemo(() => groupOrder.flatMap((group) => {
    const items = results.filter((item) => item.group === group);
    return items.length ? [{ group, items }] : [];
  }), [results]);

  function close() {
    onClose();
    restoreFocus();
  }

  function remember(result: CommandResult) {
    if (result.private || ["journey", "deadline", "task"].includes(result.kind)) return;
    const next = [{ id: result.id, title: result.title, subtitle: result.subtitle, href: result.href }, ...readRecents().filter((item) => item.id !== result.id)].slice(0, 4);
    localStorage.setItem(recentKey, JSON.stringify(next));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + direction + Math.max(results.length, 1)) % Math.max(results.length, 1));
      return;
    }
    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      document.getElementById(`${listboxId}-option-${activeIndex}`)?.click();
    }
  }

  let flatIndex = -1;
  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className={styles.panel} role="dialog" aria-modal="true" aria-label="Search UnlockED" data-universal-command-center="">
      <div className={styles.searchRow}>
        <SearchIcon aria-hidden="true" />
        <input ref={inputRef} role="combobox" aria-label="Search UnlockED" aria-expanded="true" aria-controls={listboxId} aria-activedescendant={results[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined} autoComplete="off" spellCheck={false} placeholder="Search UnlockED…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} />
        {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><CloseIcon /></button> : <kbd aria-label="Escape">esc</kbd>}
      </div>
      <div className={styles.results} id={listboxId} role="listbox" aria-label="Search results">
        {groups.map(({ group, items }) => <section key={group} role="group" aria-label={group} className={styles.group}>
          <h2>{group}{group === "Your Journey" || group === "Upcoming" || group === "Application tasks" ? <span>Private</span> : null}</h2>
          {items.map((result) => {
            flatIndex += 1;
            const index = flatIndex;
            return <a id={`${listboxId}-option-${index}`} key={result.id} href={result.href} role="option" aria-selected={activeIndex === index} data-active={activeIndex === index ? "true" : undefined} onMouseEnter={() => setActiveIndex(index)} onClick={() => { remember(result); onClose(); }}>
              <span className={styles.resultIcon} aria-hidden="true"><ResultIcon kind={result.kind} /></span>
              <span className={styles.resultCopy}><strong><Highlight value={result.title} query={query} /></strong><small>{result.subtitle}</small></span>
              <ArrowIcon className={styles.arrow} aria-hidden="true" />
            </a>;
          })}
        </section>)}
        {!results.length && !loading ? <div className={styles.empty}><strong>No results for “{query.trim()}”</strong><span>Try another phrase or continue in Discover.</span><a href={`/opportunities?query=${encodeURIComponent(query.trim())}`}>Search all opportunities in Discover <ArrowIcon /></a></div> : null}
        {showLoading ? <p className={styles.loading} role="status">Searching opportunities…</p> : null}
        {error ? <p className={styles.error} role="status">{error}</p> : null}
      </div>
      <footer><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span><kbd>esc</kbd> Close</span></footer>
      <div className="sr-only" aria-live="polite">{loading ? "Searching opportunities" : `${results.length} results available`}</div>
    </section>
  </div>;
}
