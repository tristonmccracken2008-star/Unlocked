"use client";

import { useEffect, useMemo, useState } from "react";
import { filterOpportunities, opportunityTypes, type Opportunity, type OpportunityDifficulty, type OpportunityType } from "@/data/opportunities";
import { schools, type School } from "@/data/seed";
import { findSchoolMatches, normalizeSchoolQuery } from "@/data/school-search";
import { OpportunityCard } from "./opportunity-card";
import { SearchIcon } from "./icons";

export function OpportunityFilter({ opportunities }: { opportunities: Opportunity[] }) {
  const [query,setQuery]=useState(""); const [type,setType]=useState<OpportunityType|"All">("All"); const [category,setCategory]=useState("All"); const [major,setMajor]=useState("All"); const [school,setSchool]=useState("All"); const [paid,setPaid]=useState("All"); const [remote,setRemote]=useState("All"); const [difficulty,setDifficulty]=useState<Exclude<OpportunityDifficulty,null>|"All">("All"); const [freshmanFriendly,setFreshmanFriendly]=useState(false); const [deadline,setDeadline]=useState("All"); const [visibleCount,setVisibleCount]=useState(18);
  const majors=["All",...new Set(opportunities.flatMap((item)=>item.majors).filter((item)=>item!=="Any Major"))];
  const categories=["All",...new Set(opportunities.map((item)=>item.category).sort())];
  const visible=useMemo(()=>filterOpportunities({query,types:type==="All"?undefined:[type],category,major,school:school==="All"?undefined:school,paid:paid==="All"?undefined:paid==="Paid",remote:remote==="All"?undefined:remote==="Remote",difficulty,freshmanFriendly,deadline:deadline==="All"?undefined:deadline as "published"|"upcoming"|"rolling"|"not_announced"},opportunities),[category,deadline,difficulty,freshmanFriendly,major,opportunities,paid,query,remote,school,type]);
  useEffect(()=>setVisibleCount(18),[category,deadline,difficulty,freshmanFriendly,major,paid,query,remote,school,type]);
  const displayed=visible.slice(0,visibleCount);
  const activeFilters=[type,category,major,school,deadline,paid,remote,difficulty].filter((item)=>item!=="All").length+(freshmanFriendly?1:0);
  return <>
    <div className="rounded-[2rem] bg-paper p-3 sm:p-4">
      <label className="flex min-h-16 items-center gap-3 rounded-full bg-white px-5 shadow-soft"><SearchIcon className="h-4 w-4 text-forest"/><span className="sr-only">Search all opportunities</span><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search scholarships, internships, research..." className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink/35"/></label>
      <div className="mt-3 flex flex-wrap gap-2">
        {opportunityTypes.slice(0,4).map((option)=><button key={option} type="button" onClick={()=>setType(type===option?"All":option)} className={`rounded-full px-4 py-2 text-xs font-bold ${type===option?"bg-forest text-white":"bg-white text-ink/50 hover:text-forest"}`}>{option}</button>)}
      </div>
      <details className="mt-4 border-t border-ink/10 pt-4">
        <summary className="cursor-pointer text-sm font-bold text-ink/50 hover:text-forest">Advanced filters{activeFilters?` · ${activeFilters} active`:""}</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Select label="Type" value={type} setValue={(value)=>setType(value as OpportunityType|"All")} options={["All",...opportunityTypes]}/><Select label="Category" value={category} setValue={setCategory} options={categories}/><SchoolFilter value={school} setValue={setSchool}/><Select label="Major" value={major} setValue={setMajor} options={majors}/><Select label="Deadline" value={deadline} setValue={setDeadline} options={["All","published","upcoming","rolling","not_announced"]}/><Select label="Value" value={paid} setValue={setPaid} options={["All","Paid","Unpaid"]}/><Select label="Format" value={remote} setValue={setRemote} options={["All","Remote","In Person"]}/><Select label="Difficulty" value={difficulty} setValue={(value)=>setDifficulty(value as Exclude<OpportunityDifficulty,null>|"All")} options={["All","Open","Competitive","Highly Competitive"]}/><label className="flex h-14 items-center gap-3 rounded-2xl bg-white px-4 text-sm font-bold text-ink/55"><input type="checkbox" checked={freshmanFriendly} onChange={(event)=>setFreshmanFriendly(event.target.checked)}/> Freshman-friendly</label></div>
      </details>
    </div>
    <div className="mt-12 flex items-end justify-between gap-4 border-b border-ink/10 pb-5"><div><p className="rule-label text-forest">Results</p><h2 className="mt-2 font-editorial text-3xl font-bold tracking-[-.025em]">Best matches</h2></div><p className="shrink-0 text-sm font-bold text-ink/45">{visible.length} results</p></div><div className="divide-y divide-ink/10">{displayed.map((item)=><OpportunityCard key={item.id} opportunity={item}/>)}</div>{visible.length>displayed.length&&<div className="border-t border-ink/10 bg-white py-7 text-center"><button onClick={()=>setVisibleCount((count)=>Math.min(count+18,visible.length))} className="min-h-11 rounded-full border border-ink/15 px-6 text-sm font-bold text-ink/65 hover:border-forest hover:text-forest">Show more</button></div>}{!visible.length&&<div className="rounded-[2rem] bg-paper px-6 py-12 text-center"><p className="font-editorial text-2xl font-bold">No verified matches yet</p><p className="mt-2 text-sm text-ink/45">Try one broader search or remove a filter.</p></div>}
  </>;
}

function SchoolFilter({value,setValue}:{value:string;setValue:(value:string)=>void}){
  const selected=schools.find((item)=>item.slug===value);const[query,setQuery]=useState(selected?.name??"");const[open,setOpen]=useState(false);const matches=useMemo(()=>findSchoolMatches(schools,query,6),[query]);const normalized=normalizeSchoolQuery(query);
  function choose(item:School){setValue(item.slug);setQuery(item.name);setOpen(false)}
  return <div className="relative rounded-2xl bg-white px-4"><label className="flex h-14 items-center justify-between gap-3"><span className="rule-label text-ink/40">School</span><input value={query} onFocus={()=>setOpen(true)} onChange={(event)=>{setQuery(event.target.value);setValue("All");setOpen(true)}} placeholder="All schools" className="min-w-0 max-w-[68%] bg-transparent text-right text-sm font-bold outline-none placeholder:text-ink/35"/></label>{open&&normalized&&<div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-soft">{matches.length?matches.map((item)=><button key={item.slug} type="button" onMouseDown={(event)=>event.preventDefault()} onClick={()=>choose(item)} className="block w-full border-b border-ink/10 px-4 py-3 text-left text-sm font-bold last:border-b-0 hover:bg-paper">{item.name}<span className="block text-[11px] font-normal text-ink/40">{item.domain}</span></button>):<p className="px-4 py-3 text-xs text-ink/50">School not found</p>}</div>}</div>
}

function Select({label,value,setValue,options}:{label:string;value:string;setValue:(value:string)=>void;options:readonly string[]}){const allLabels:Record<string,string>={Type:"All types",Category:"All categories",Major:"All majors",Value:"Any value",Deadline:"Any deadline",Format:"Any format",Difficulty:"Any difficulty"};return <label className="flex h-14 items-center justify-between gap-3 rounded-2xl bg-white px-4"><span className="rule-label text-ink/40">{label}</span><select value={value} onChange={(event)=>setValue(event.target.value)} className="min-w-0 max-w-[68%] bg-transparent text-sm font-bold outline-none">{options.map((option)=><option key={option} value={option}>{option==="All"?allLabels[label]:option.replaceAll("_"," ")}</option>)}</select></label>}
