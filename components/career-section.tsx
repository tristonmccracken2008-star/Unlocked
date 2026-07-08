"use client";

import { useMemo, useState } from "react";
import { academicYears, careerOpportunities, deadlineLabel, opportunityCategories, opportunityMajors, type Compensation, type Opportunity, type OpportunityCategory, type WorkMode } from "@/data/opportunities";
import { ArrowIcon, SearchIcon } from "./icons";
import { SaveOpportunityButton } from "./opportunity-activity";
import { ConfidenceBadge, StatusBadge } from "./status-badge";

type DeadlineFilter = "All" | "Published" | "Rolling or varies" | "Not announced";

function profileMajorTags(major: string) {
  const value = major.toLowerCase();
  const tags: string[] = [];
  if (/computer|software|informatics|coding/.test(value)) tags.push("Computer Science");
  if (/math|statistic|actuar/.test(value)) tags.push("Mathematics", "Data Science");
  if (/data|analytics|machine learning|artificial intelligence|\bai\b/.test(value)) tags.push("Data Science", "Computer Science");
  if (/engineer/.test(value)) tags.push("Engineering");
  if (/physics/.test(value)) tags.push("Physics", "Mathematics");
  if (/biology|chemistry|neuro|science/.test(value)) tags.push("Natural Sciences");
  if (/finance|econom|account/.test(value)) tags.push("Finance", "Business", "Mathematics");
  if (/business|marketing|management/.test(value)) tags.push("Business");
  if (/design|art|media/.test(value)) tags.push("Design");
  if (/social|politic|psychology|sociology/.test(value)) tags.push("Social Sciences");
  return [...new Set(tags)];
}

function relevance(opportunity: Opportunity, major: string, year: string) {
  const tags = profileMajorTags(major);
  let score = opportunity.majors.includes("Any Major") ? 1 : 0;
  score += tags.filter((tag) => opportunity.majors.includes(tag)).length * 5;
  if (opportunity.academic_years.includes(year)) score += 4;
  if (year === "First year" && opportunity.category === "Freshman Programs") score += 10;
  if (tags.includes("Computer Science") && ["Coding", "Engineering"].some((term) => opportunity.description.includes(term))) score += 2;
  if (tags.includes("Mathematics") && ["Jane Street", "Citadel", "Citadel Securities", "Two Sigma", "Hudson River Trading", "SIG", "IMC Trading", "Optiver", "DRW"].includes(opportunity.organization)) score += 4;
  if (tags.some((tag) => ["Computer Science", "Mathematics", "Data Science"].includes(tag)) && opportunity.category === "Undergraduate Research") score += 3;
  return score;
}

export function CareerSection({ major, year }: { major: string; year: string }) {
  const [query, setQuery] = useState("");
  const [majorFilter, setMajorFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("All");
  const [paidFilter, setPaidFilter] = useState<Compensation | "All">("All");
  const [modeFilter, setModeFilter] = useState<WorkMode | "All">("All");
  const [categoryFilter, setCategoryFilter] = useState<OpportunityCategory | "All">("All");

  const personalized = useMemo(() => [...careerOpportunities].sort((a,b) => relevance(b,major,year)-relevance(a,major,year) || a.title.localeCompare(b.title)).slice(0,6), [major,year]);
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return careerOpportunities.filter((item) => {
      const deadlineMatches = deadlineFilter === "All" || (deadlineFilter === "Published" && Boolean(item.application_deadline)) || (deadlineFilter === "Rolling or varies" && ["rolling","varies"].includes(item.metadata.deadlineType ?? "")) || (deadlineFilter === "Not announced" && item.metadata.deadlineType === "not_announced");
      return (!search || `${item.title} ${item.organization} ${item.description} ${item.majors.join(" ")}`.toLowerCase().includes(search)) && (majorFilter === "All" || item.majors.includes("Any Major") || item.majors.includes(majorFilter)) && (yearFilter === "All" || item.academic_years.includes(yearFilter)) && deadlineMatches && (paidFilter === "All" || item.metadata.compensation === paidFilter) && (modeFilter === "All" || item.metadata.workMode === modeFilter) && (categoryFilter === "All" || item.category === categoryFilter);
    }).sort((a,b) => relevance(b,major,year)-relevance(a,major,year) || a.title.localeCompare(b.title));
  }, [categoryFilter, deadlineFilter, major, majorFilter, modeFilter, paidFilter, query, year, yearFilter]);

  const card = (item: Opportunity, index: number) => <article key={item.id} className="grid gap-4 border-b border-ink/20 bg-white px-4 py-5 last:border-b-0 lg:grid-cols-[36px_1fr_190px_150px] lg:items-start">
    <span className="hidden pt-1 font-mono text-xs text-ink/30 lg:block">{String(index+1).padStart(2,"0")}</span>
    <div><div className="flex flex-wrap items-center gap-3"><span className="rule-label text-forest">{item.category}</span><StatusBadge status={item.verification_status}/><ConfidenceBadge status={item.verification_status}/><span className="rule-label border-l border-ink/20 pl-3 text-ink/40">{item.school_scope}</span></div><h3 className="mt-2 font-editorial text-xl font-bold">{item.title}</h3><p className="mt-1 text-xs font-bold uppercase tracking-wider text-ink/35">{item.organization}</p><p className="mt-3 text-sm leading-6 text-ink/55">{item.description}</p><p className="mt-3 text-xs leading-5 text-ink/45"><span className="font-bold">Eligibility:</span> {item.eligibility}</p><p className="mt-2 text-xs text-ink/45">{item.majors.join(" · ")} · {item.academic_years.join(" · ")}</p></div>
    <div className="border-t-2 border-forest pt-4 lg:border-l-2 lg:border-t-0 lg:pl-4 lg:pt-0"><p className="rule-label text-ink/35">Application deadline</p><p className="mt-2 font-editorial text-xl font-bold text-forest">{deadlineLabel(item)}</p><p className="mt-4 text-xs text-ink/45">{item.location}</p><p className="mt-2 text-xs font-bold">{item.metadata.compensation} · {item.metadata.workMode}</p></div>
    <div className="lg:text-right"><p className="rule-label text-ink/35">Editorial estimate</p><p className="mt-2 text-xs"><span className="font-bold">Difficulty:</span> {item.difficulty}</p><p className="mt-1 text-xs"><span className="font-bold">Prestige:</span> {item.prestige}</p><p className="mt-3 text-[11px] text-ink/35">Verified {item.last_verified}</p><SaveOpportunityButton opportunityId={item.id} className="mt-4 w-full border border-ink/15 px-4 text-ink/55 hover:border-forest hover:text-forest lg:w-auto"/><a href={item.official_source} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 border-b border-ink pb-1 text-xs font-bold uppercase tracking-wider hover:border-forest hover:text-forest">Official source <ArrowIcon /></a></div>
  </article>;

  return <section className="border-t-2 border-ink px-5 py-10 sm:px-8" aria-labelledby="career-title">
    <div className="border-b-2 border-ink pb-4"><p className="rule-label text-forest">Personalized for {major} · {year}</p><h2 id="career-title" className="mt-2 font-editorial text-3xl font-bold">Opportunities For You</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-ink/50">Prioritized by your major and academic year. Deadlines marked “Not announced” or “Varies” are intentionally left undated until an official source publishes one.</p></div>
    <div className="border-b-2 border-ink">{personalized.map(card)}</div>

    <div className="mt-12 flex items-end justify-between gap-4 border-b-2 border-ink pb-4"><div><p className="rule-label text-forest">Career directory</p><h2 className="mt-2 font-editorial text-3xl font-bold">All verified opportunities</h2></div><p className="text-sm font-bold text-ink/45">{visible.length} of {careerOpportunities.length}</p></div>
    <div className="grid border-b border-ink/20 bg-white lg:grid-cols-[1fr_220px_220px]"><label className="flex h-14 items-center gap-3 px-4"><SearchIcon className="h-4 w-4 text-ink/40"/><span className="sr-only">Search opportunities</span><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search roles, organizations, or skills" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink/35"/></label><Filter label="Category" value={categoryFilter} setValue={(value)=>setCategoryFilter(value as OpportunityCategory|"All")} options={opportunityCategories}/><Filter label="Major" value={majorFilter} setValue={setMajorFilter} options={opportunityMajors}/></div>
    <div className="grid border-b-2 border-ink bg-white sm:grid-cols-2 lg:grid-cols-4"><Filter label="Year" value={yearFilter} setValue={setYearFilter} options={academicYears}/><Filter label="Deadline" value={deadlineFilter} setValue={(value)=>setDeadlineFilter(value as DeadlineFilter)} options={["All","Published","Rolling or varies","Not announced"]}/><Filter label="Paid" value={paidFilter} setValue={(value)=>setPaidFilter(value as Compensation|"All")} options={["All","Paid","Unpaid","Varies"]}/><Filter label="Format" value={modeFilter} setValue={(value)=>setModeFilter(value as WorkMode|"All")} options={["All","Remote","Hybrid","In Person","Varies"]}/></div>
    <div className="border-b-2 border-ink">{visible.map(card)}</div>
    {visible.length===0&&<div className="border-b-2 border-ink bg-white py-12 text-center"><p className="font-editorial text-2xl font-bold">No matching opportunities</p><p className="mt-2 text-sm text-ink/45">Try broadening one of the filters.</p></div>}
  </section>;
}

function Filter({label,value,setValue,options}:{label:string;value:string;setValue:(value:string)=>void;options:readonly string[]}) {
  return <label className="flex h-14 items-center justify-between gap-3 border-t border-ink/20 px-4 sm:border-l lg:border-t-0"><span className="rule-label text-ink/40">{label}</span><select value={value} onChange={(event)=>setValue(event.target.value)} className="min-w-0 bg-transparent text-sm font-bold outline-none">{options.map((option)=><option key={option}>{option}</option>)}</select></label>;
}
