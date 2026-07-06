"use client";

import { useMemo, useState } from "react";
import { aiOfferLabels, aiOfferTypes, aiToolCategories, aiTools, type AIOfferType, type AIToolCategory } from "@/data/ai-tools";
import { ArrowIcon, SearchIcon } from "./icons";

const offerFilterLabels: Record<(typeof aiOfferTypes)[number], string> = { All: "All access types", ...aiOfferLabels };

export function AIToolsSection() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof aiToolCategories)[number]>("All");
  const [offerType, setOfferType] = useState<(typeof aiOfferTypes)[number]>("All");
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return aiTools.filter((tool) => (category === "All" || tool.category === category) && (offerType === "All" || tool.offerType === offerType) && (!search || `${tool.name} ${tool.company} ${tool.description} ${tool.studentOffer}`.toLowerCase().includes(search)));
  }, [category, offerType, query]);

  return <section className="border-t-2 border-ink px-5 py-10 sm:px-8" aria-labelledby="ai-tools-title">
    <div className="flex flex-col justify-between gap-4 border-b-2 border-ink pb-4 sm:flex-row sm:items-end"><div><p className="rule-label text-forest">Explore the catalog</p><h2 id="ai-tools-title" className="mt-2 font-editorial text-3xl font-bold">AI Tools</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-ink/50">Compare official access information without assuming every free plan is a student benefit.</p></div><p className="text-sm font-bold text-ink/45">{visible.length} of {aiTools.length} tools</p></div>
    <div className="grid border-b-2 border-ink bg-white lg:grid-cols-[1fr_220px_230px]">
      <label className="flex h-14 items-center gap-3 px-4"><SearchIcon className="h-4 w-4 text-ink/40"/><span className="sr-only">Search AI tools</span><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search tools, companies, or offers" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink/35"/></label>
      <label className="flex h-14 items-center justify-between gap-3 border-t border-ink/20 px-4 lg:border-l lg:border-t-0"><span className="rule-label text-ink/40">Category</span><select value={category} onChange={(event)=>setCategory(event.target.value as AIToolCategory | "All")} className="min-w-0 bg-transparent text-sm font-bold outline-none">{aiToolCategories.map((item)=><option key={item}>{item}</option>)}</select></label>
      <label className="flex h-14 items-center justify-between gap-3 border-t border-ink/20 px-4 lg:border-l lg:border-t-0"><span className="rule-label text-ink/40">Access</span><select value={offerType} onChange={(event)=>setOfferType(event.target.value as AIOfferType | "All")} className="min-w-0 bg-transparent text-sm font-bold outline-none">{aiOfferTypes.map((item)=><option key={item} value={item}>{offerFilterLabels[item]}</option>)}</select></label>
    </div>
    <div className="border-b-2 border-ink">{visible.map((tool,index)=><article key={tool.slug} className="grid gap-4 border-b border-ink/20 bg-white px-4 py-5 last:border-b-0 lg:grid-cols-[36px_1fr_210px_150px] lg:items-start">
      <span className="hidden pt-1 font-mono text-xs text-ink/30 lg:block">{String(index+1).padStart(2,"0")}</span>
      <div><div className="flex flex-wrap items-center gap-3"><span className="rule-label text-forest">{tool.category}</span><span className={`rule-label border-l border-ink/20 pl-3 ${tool.verificationStatus==="verified_recently"?"text-trust":"text-amber-700"}`}>{tool.verificationStatus==="verified_recently"?"Verified Recently":"Needs Review"}</span></div><h3 className="mt-2 font-editorial text-xl font-bold">{tool.name}</h3><p className="mt-1 text-xs font-bold uppercase tracking-wider text-ink/35">{tool.company}</p><p className="mt-3 text-sm leading-6 text-ink/55">{tool.description}</p><p className="mt-3 text-sm leading-6"><span className="font-bold">Student offer:</span> {tool.studentOffer}</p><p className="mt-1 text-xs leading-5 text-ink/45"><span className="font-bold">Eligibility:</span> {tool.eligibility}</p></div>
      <div className="border-l border-ink/15 pl-4"><p className="rule-label text-ink/35">Access type</p><p className="mt-2 text-sm font-bold text-forest">{aiOfferLabels[tool.offerType]}</p><p className="mt-5 rule-label text-ink/35">Estimated value</p><p className="mt-2 text-sm font-bold">{tool.estimatedAnnualValue===null?"Unknown":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(tool.estimatedAnnualValue)}</p></div>
      <div className="lg:text-right"><p className="text-xs text-ink/40">Last verified {tool.lastVerifiedAt}</p><a href={tool.officialSourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 border-b border-ink pb-1 text-xs font-bold uppercase tracking-wider hover:border-forest hover:text-forest">Official source <ArrowIcon /></a></div>
    </article>)}</div>
    {visible.length===0&&<div className="border-b-2 border-ink bg-white py-12 text-center"><p className="font-editorial text-2xl font-bold">No matching AI tools</p><p className="mt-2 text-sm text-ink/45">Try another search or filter.</p></div>}
  </section>;
}
