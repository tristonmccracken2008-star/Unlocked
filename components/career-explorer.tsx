"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerGrade, CareerRecord } from "@/data/careers";
import { careerCategories } from "@/data/careers";
import { searchCareers, type CareerFilters, type CareerSort } from "@/lib/careers";
import styles from "./career-explorer.module.css";

const gradeOptions: Array<CareerGrade | "All"> = ["All", "A-", "B+", "B", "C+"];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const initialFilters: CareerFilters = { query: "", category: "All", salary: "All", hours: "All", education: "All", math: "All", coding: "All", people: "All", outlook: "All", aiResilience: "All", aiUpside: "All", workLife: "All", entry: "All", remote: "All", sort: "name" };

function Grade({ value, label }: { value: CareerGrade; label: string }) {
  return <span className={styles.grade} aria-label={`${label}: ${value}`}><b>{value}</b><small>{label}</small></span>;
}

function CareerCard({ career, selected, onCompare }: { career: CareerRecord; selected: boolean; onCompare: () => void }) {
  return <article className={styles.card} data-career-card={career.slug}>
    <div className={styles.cardTop}><div><span>{career.category}</span><h2><Link href={`/careers/${career.slug}`}>{career.name}</Link></h2></div><button type="button" aria-pressed={selected} onClick={onCompare}>{selected ? "Added" : "+ Compare"}</button></div>
    <p>{career.description}</p>
    <dl className={styles.cardFacts}><div><dt>U.S. pay</dt><dd>{career.salary.median ? money.format(career.salary.median) : "Not available"}</dd></div><div><dt>Typical week</dt><dd>{career.hours.minimum}–{career.hours.maximum} hrs</dd></div><div><dt>Education</dt><dd>{career.education.level}</dd></div></dl>
    <div className={styles.cardGrades}><Grade value={career.grades.longTermOutlook.grade} label="Future"/><Grade value={career.grades.aiResilience.grade} label="AI resilience"/><Grade value={career.grades.aiUpside.grade} label="AI upside"/></div>
    <footer><span>{career.ai.impact}</span><Link href={`/careers/${career.slug}`}>Explore career →</Link></footer>
  </article>;
}

function Comparison({ records, onRemove, onClose }: { records: CareerRecord[]; onRemove: (id: string) => void; onClose: () => void }) {
  const rows: Array<[string, (career: CareerRecord) => string]> = [
    ["Representative U.S. pay", (career) => career.salary.median ? money.format(career.salary.median) : "Not reliably available"],
    ["Typical week", (career) => `${career.hours.minimum}–${career.hours.maximum} hours`],
    ["Education", (career) => career.education.level],
    ["Job market", (career) => `${career.grades.jobMarket.grade} · ${career.grades.jobMarket.label}`],
    ["Work-life balance", (career) => `${career.grades.workLife.grade} · ${career.grades.workLife.label}`],
    ["Entry accessibility", (career) => `${career.grades.entryAccessibility.grade} · ${career.grades.entryAccessibility.label}`],
    ["AI resilience", (career) => `${career.grades.aiResilience.grade} · ${career.grades.aiResilience.label}`],
    ["AI upside", (career) => `${career.grades.aiUpside.grade} · ${career.grades.aiUpside.label}`],
    ["Long-term outlook", (career) => `${career.grades.longTermOutlook.grade} · ${career.grades.longTermOutlook.label}`],
    ["Stability", (career) => `${career.grades.stability.grade} · ${career.grades.stability.label}`],
    ["Remote flexibility", (career) => career.remotePotential],
    ["Typical work", (career) => career.responsibilities.slice(0,2).join("; ")],
  ];
  const highestPay = [...records].sort((a,b)=>(b.salary.median??0)-(a.salary.median??0))[0];
  const shortestWeek = [...records].sort((a,b)=>a.hours.maximum-b.hours.maximum)[0];
  const remote = records.filter((career)=>career.remotePotential === "High");
  return <section className={styles.compare} aria-labelledby="career-compare-title"><header><div><p className="rule-label">Career comparison</p><h2 id="career-compare-title">Compare tradeoffs, not winners.</h2></div><button type="button" onClick={onClose}>Close comparison</button></header><div className={styles.differences} aria-label="Major differences"><p><strong>{highestPay.name}</strong> has the highest mapped occupational median in this set.</p><p><strong>{shortestWeek.name}</strong> has the lowest typical upper-hours estimate.</p><p>{remote.length ? <><strong>{remote.map((item)=>item.name).join(" and ")}</strong> {remote.length === 1 ? "has" : "have"} high remote potential.</> : "None of these paths has consistently high remote potential."}</p></div><div className={styles.compareScroll}><table><thead><tr><th>Dimension</th>{records.map((career) => <th key={career.id}><Link href={`/careers/${career.slug}`}>{career.name}</Link><button type="button" onClick={() => onRemove(career.id)} aria-label={`Remove ${career.name} from comparison`}>Remove</button></th>)}</tr></thead><tbody>{rows.map(([label, get]) => <tr key={label}><th>{label}</th>{records.map((career) => <td data-career={career.name} key={career.id}>{get(career)}</td>)}</tr>)}</tbody></table></div><p>No career is declared the winner. These differences use broad U.S. occupational evidence; employer and specialty can matter more than the title.</p></section>;
}

export function CareerExplorer() {
  const [filters, setFilters] = useState<CareerFilters>(initialFilters);
  const [visible, setVisible] = useState(24);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const searchInput = useRef<HTMLInputElement>(null);
  const records = useMemo(() => searchCareers(filters), [filters]);
  const compared = compareIds.map((id) => records.find((record) => record.id === id) ?? searchCareers().find((record) => record.id === id)).filter((record): record is CareerRecord => Boolean(record));
  const update = (next: Partial<CareerFilters>) => { setFilters((current) => ({ ...current, ...next })); setVisible(24); };
  const toggleCompare = (id: string) => setCompareIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current);
  const collection = (kind: string) => {
    if (kind === "pay") update({ sort: "salary", query: "", category: "All" });
    else if (kind === "ai") update({ aiUpside: "A-", sort: "aiUpside" });
    else if (kind === "resilience") update({ aiResilience: "A-", sort: "aiResilience" });
    else if (kind === "balance") update({ workLife: "B+", sort: "workLife" });
    else if (kind === "programming") update({ coding: "High", query: "", category: "All" });
    else if (kind === "no-grad") update({ education: "Bachelor", query: "", category: "All" });
    else if (kind === "people") update({ people: "High", query: "", category: "All" });
    else if (kind === "future") update({ query: "", category: "All", sort: "outlook" });
    else if (kind === "unknown") update({ query: "analyst", category: "All", sort: "name" });
    else update({ query: kind, category: "All", sort: "name" });
  };
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || /input|textarea|select/i.test((event.target as HTMLElement)?.tagName ?? "")) return;
      event.preventDefault(); searchInput.current?.focus();
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  return <main className={`${styles.page} application-studio-theme`} data-careers-explorer>
    <div className={styles.shell}>
      <header className={styles.hero}><div><p className="rule-label text-forest">Discover · United States</p><h1>Explore Careers</h1><p>Compare the work, pay, entry path, tradeoffs, and likely effects of AI across {searchCareers().length} career paths. Grades explain evidence; they do not predict your future.</p></div><Link href="/careers#methodology">Sources & methodology</Link></header>

      <section className={styles.searchPanel} aria-label="Search and filter careers">
        <label className={styles.search}><span className="sr-only">Search careers</span><input ref={searchInput} type="search" value={filters.query} onChange={(event) => update({ query: event.target.value })} placeholder="Search careers, skills, industries, or majors…" autoComplete="off" aria-keyshortcuts="/"/><kbd>/</kbd></label>
        <div className={styles.quick} aria-label="Career collections"><button onClick={() => collection("pay")}>Highest paying</button><button onClick={() => collection("future")}>Strongest 10-year outlook</button><button onClick={() => collection("ai")}>Strong AI upside</button><button onClick={() => collection("resilience")}>Most AI-resilient</button><button onClick={() => collection("balance")}>Work-life balance</button><button onClick={() => collection("mathematics")}>Uses mathematics</button><button onClick={() => collection("programming")}>Uses programming</button><button onClick={() => collection("no-grad")}>Without graduate school</button><button onClick={() => collection("people")}>High human interaction</button><button onClick={() => collection("research")}>Research-heavy</button><button onClick={() => collection("unknown")}>Careers you might not know</button><button onClick={() => collection("Healthcare")}>Healthcare</button><button onClick={() => collection("Finance")}>Finance</button><button onClick={() => collection("Public Service")}>Public service</button></div>
      </section>

      <div className={styles.workspace}>
        <aside className={styles.filters} aria-label="Career filters"><div><h2>Filters</h2><button type="button" onClick={() => setFilters(initialFilters)}>Reset</button></div><Filter label="Career field" value={filters.category} options={["All", ...careerCategories]} onChange={(value) => update({ category: value })}/><Filter label="Salary" value={filters.salary} options={["All", "100k", "150k"]} labels={{ "100k": "$100k+", "150k": "$150k+" }} onChange={(value) => update({ salary: value })}/><Filter label="Typical hours" value={filters.hours} options={["All", "45", "50"]} labels={{ "45": "Up to 45", "50": "Up to 50" }} onChange={(value) => update({ hours: value })}/><Filter label="Education" value={filters.education} options={["All", "High school", "Bachelor", "Master", "Doctor"]} onChange={(value) => update({ education: value })}/><Filter label="Math intensity" value={filters.math} options={["All","Very High","High","Moderate","Low"]} onChange={(value) => update({ math:value })}/><Filter label="Coding intensity" value={filters.coding} options={["All","Very High","High","Moderate","Low"]} onChange={(value) => update({ coding:value })}/><Filter label="People interaction" value={filters.people} options={["All","High","Moderate","Low"]} onChange={(value) => update({ people:value })}/><Filter label="Remote potential" value={filters.remote} options={["All", "High", "Moderate", "Low", "Varies"]} onChange={(value) => update({ remote: value })}/>{[["Long-term outlook","outlook"],["AI resilience","aiResilience"],["AI upside","aiUpside"],["Work-life balance","workLife"],["Entry accessibility","entry"]] .map(([label,key]) => <Filter key={key} label={`${label} at least`} value={filters[key as keyof CareerFilters] as string} options={gradeOptions} onChange={(value) => update({ [key]: value })}/>)}</aside>
        <section className={styles.results} aria-labelledby="career-results-title"><header><div><p className="rule-label text-forest">Career catalog</p><h2 id="career-results-title" aria-live="polite">{records.length} {records.length === 1 ? "career" : "careers"}</h2></div><label>Sort <select value={filters.sort} onChange={(event) => update({ sort: event.target.value as CareerSort })}><option value="name">A–Z</option><option value="salary">Salary: high to low</option><option value="outlook">Best long-term outlook</option><option value="workLife">Best work-life balance</option><option value="aiResilience">Strongest AI resilience</option><option value="aiUpside">Strongest AI upside</option><option value="education">Lowest education barrier</option></select></label></header>{records.length ? <div className={styles.grid}>{records.slice(0,visible).map((career) => <CareerCard key={career.id} career={career} selected={compareIds.includes(career.id)} onCompare={() => toggleCompare(career.id)}/>)}</div> : <div className={styles.empty}><h3>No careers match these filters.</h3><p>Try removing a grade, education, or category filter.</p><button type="button" onClick={() => setFilters(initialFilters)}>Reset filters</button></div>}{visible < records.length ? <button className={styles.more} type="button" onClick={() => setVisible((count) => count + 24)}>Show more careers</button> : null}</section>
      </div>

      <section id="methodology" className={styles.method}><p className="rule-label text-forest">Sources & methodology</p><h2>Grades explain tradeoffs without fake precision.</h2><p>U.S. pay, education, and 2024–34 market direction use mapped Bureau of Labor Statistics occupations. O*NET informs tasks, skills, and work context. AI grades use task routineness, digital share, physical presence, trust, accountability, interpersonal complexity, judgment, complementarity, and market demand. The interface shows letter grades—not decimals—and treats exposure as task change rather than certain job loss.</p><div><a href="https://www.bls.gov/ooh/" target="_blank" rel="noreferrer">BLS Occupational Outlook Handbook</a><a href="https://www.onetonline.org/" target="_blank" rel="noreferrer">O*NET OnLine</a><a href="https://www.ilo.org/publications/generative-ai-and-jobs-refined-global-index-occupational-exposure" target="_blank" rel="noreferrer">ILO–NASK AI exposure research</a><a href="https://www.oecd.org/en/publications/the-oecd-ai-exposure-measure_f3da0f0a-en.html" target="_blank" rel="noreferrer">OECD AI exposure measure</a></div><small>Last updated September 3, 2026. Career-specific roles may map to broader government occupations; each detail page names that basis.</small></section>
    </div>
    {compared.length >= 2 ? <Comparison records={compared} onRemove={toggleCompare} onClose={() => setCompareIds([])}/> : compareIds.length === 1 ? <div className={styles.comparePrompt} role="status"><span>Add one more career to compare.</span><button type="button" onClick={() => setCompareIds([])}>Clear</button></div> : null}
  </main>;
}

function Filter({ label, value, options, labels = {}, onChange }: { label: string; value?: string; options: readonly string[]; labels?: Record<string,string>; onChange: (value: string) => void }) {
  return <label><span>{label}</span><select value={value ?? "All"} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{labels[option] ?? option}</option>)}</select></label>;
}
