"use client";
import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { formatValueTotal, getSchoolBenefits, schools, type School } from "@/data/seed";
import { findExactSchoolMatches, findSchoolMatches, normalizeSchoolQuery } from "@/data/school-search";
import { ArrowIcon, SearchIcon } from "./icons";

export function StudentSavingsCalculator() {
  const [slug,setSlug]=useState("");
  const [query,setQuery]=useState("");
  const [showSuggestions,setShowSuggestions]=useState(false);
  const school=schools.find((item)=>item.slug===slug);
  const normalized=normalizeSchoolQuery(query);
  const exactMatches=useMemo(()=>findExactSchoolMatches(schools,query),[query]);
  const suggestions=useMemo(()=>findSchoolMatches(schools,query,6),[query]);
  const stats=useMemo(()=>{if(!school)return null;const items=getSchoolBenefits(school).filter((i)=>i.status==="verified_recently");const count=(c:string)=>items.filter((i)=>i.category===c).length;return{total:items.reduce((s,i)=>s+i.annualValue,0),benefits:items.length,ai:count("AI"),software:count("Software"),shopping:count("Shopping"),finance:count("Finance"),excluded:items.filter((i)=>i.annualValue===0).length}},[school]);

  function choose(selected:School){setSlug(selected.slug);setQuery(selected.name);setShowSuggestions(false)}
  function submit(event:FormEvent){event.preventDefault();if(exactMatches.length===1)return choose(exactMatches[0]);if(suggestions.length===1)return choose(suggestions[0]);setShowSuggestions(true)}

  return <section id="savings-calculator" className="mx-auto max-w-7xl scroll-mt-24 border-x border-ink/20 px-5 py-14 sm:px-8 sm:py-16">
    <div className="grid gap-8 border-y-2 border-ink py-6 lg:grid-cols-[1fr_380px] lg:items-end"><div><p className="rule-label text-forest">Student savings calculator</p><h2 className="mt-2 font-editorial text-3xl font-bold sm:text-4xl">Your benefits, by the numbers.</h2></div>
      <div className="relative"><span className="mb-2 block rule-label text-ink/45">Select institution</span><form onSubmit={submit} className="flex h-12 border-2 border-ink bg-white"><label className="flex min-w-0 flex-1 items-center gap-2 px-3"><SearchIcon className="h-4 w-4 shrink-0 text-ink/40"/><span className="sr-only">Search for a school</span><input value={query} onFocus={()=>setShowSuggestions(true)} onChange={(event)=>{setQuery(event.target.value);setSlug("");setShowSuggestions(true)}} placeholder="Name, abbreviation, or domain" autoComplete="off" aria-controls="calculator-school-suggestions" aria-expanded={showSuggestions&&Boolean(normalized)} className="min-w-0 flex-1 bg-transparent font-bold outline-none placeholder:font-normal placeholder:text-ink/35"/></label><button className="border-l-2 border-ink px-3 text-xs font-bold uppercase tracking-wider hover:bg-paper">Find</button></form>
        {showSuggestions&&normalized&&suggestions.length>0&&<div id="calculator-school-suggestions" role="listbox" aria-label="Matching schools" className="absolute z-20 mt-1 w-full border-2 border-ink bg-white shadow-[6px_6px_0_#10243e]"><p className="px-3 py-2 rule-label text-ink/40">Top matches</p>{suggestions.map((item)=><button key={item.slug} type="button" role="option" aria-selected={item.slug===slug} onMouseDown={(event)=>event.preventDefault()} onClick={()=>choose(item)} className="block w-full border-t border-ink/15 px-3 py-2.5 text-left hover:bg-paper"><span className="block text-sm font-bold">{item.name}</span><span className="block text-xs text-ink/45">{item.domain} · {item.location}</span></button>)}</div>}
        {showSuggestions&&normalized&&suggestions.length===0&&<div id="calculator-school-suggestions" className="absolute z-20 mt-1 w-full border-2 border-ink bg-white p-4 shadow-[6px_6px_0_#10243e]"><p className="font-bold">School not found</p><Link href={`/contact?school=${encodeURIComponent(query)}`} className="mt-2 inline-block border-b border-forest text-sm font-bold text-forest">Request this school</Link></div>}
      </div>
    </div>
    {stats&&school?<><div className="grid border-b-2 border-ink sm:grid-cols-3 lg:grid-cols-6">{[["Verified benefits",stats.benefits],["Known annual value",formatValueTotal(stats.total)],["AI tools",stats.ai],["Software",stats.software],["Shopping",stats.shopping],["Finance",stats.finance]].map(([label,value],i)=><div key={label} className={`border-b border-r border-ink/20 p-4 sm:p-5 ${i<2?"bg-ink text-white":"bg-white"}`}><p className={`rule-label ${i<2?"text-white/50":"text-ink/40"}`}>{label}</p><p className="mt-3 font-editorial text-3xl font-bold">{value}</p></div>)}</div><div className="flex flex-col gap-3 border-b border-ink/20 py-4 text-xs text-ink/50 sm:flex-row sm:justify-between"><p>Estimate uses documented fixed values only; {stats.excluded} variable-value offers are excluded.</p><Link href={`/schools/${school.slug}`} className="flex items-center gap-2 font-bold uppercase tracking-wider text-forest">Open school index <ArrowIcon /></Link></div></>:<p className="border-b-2 border-ink py-8 font-editorial text-xl text-ink/45">Search for and select a school to generate a verified savings summary.</p>}
  </section>;
}
