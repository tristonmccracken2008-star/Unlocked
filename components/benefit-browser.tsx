"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Benefit, categories, formatValueTotal } from "@/data/seed";
import { ArrowIcon, SearchIcon } from "./icons";
import { StatusBadge } from "./status-badge";
type Sort = "value" | "newest" | "alphabetical";

export function BenefitBrowser({ benefits }: { benefits: Benefit[] }) {
  const [active, setActive] = useState("All"); const [query, setQuery] = useState(""); const [sort, setSort] = useState<Sort>("value");
  const totalValue = benefits.reduce((sum, item) => sum + item.annualValue, 0);
  const nationalCount = benefits.filter((item) => item.scope === "national").length;
  const schoolCount = benefits.filter((item) => item.scope === "school").length;
  const visible = useMemo(() => benefits.filter((item) => (active === "All" || item.category === active) && `${item.name} ${item.provider} ${item.description}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => sort === "value" ? b.annualValue-a.annualValue : sort === "newest" ? b.verifiedAt.localeCompare(a.verifiedAt) : a.name.localeCompare(b.name)), [active, benefits, query, sort]);
  return <>
    <div className="border-2 border-ink bg-white">
      <div className="grid md:grid-cols-[1fr_220px]"><label className="flex h-14 items-center gap-3 px-4"><SearchIcon className="h-5 w-5 text-ink/40" /><span className="sr-only">Search benefits</span><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search this benefit index" className="min-w-0 flex-1 bg-transparent outline-none" /></label><label className="flex h-14 items-center justify-between gap-3 border-t-2 border-ink px-4 text-sm md:border-l-2 md:border-t-0"><span className="rule-label text-ink/45">Sort</span><select value={sort} onChange={(e)=>setSort(e.target.value as Sort)} className="bg-transparent font-bold outline-none"><option value="value">Known value</option><option value="newest">Recently verified</option><option value="alphabetical">A–Z</option></select></label></div>
      <div className="scrollbar-none flex overflow-x-auto border-t border-ink/20" aria-label="Filter benefits by category">{categories.map((category)=><button key={category} onClick={()=>setActive(category)} className={`border-r border-ink/20 px-4 py-3 text-xs font-bold uppercase tracking-wider ${active===category ? "bg-ink text-white" : "hover:bg-paper"}`}>{category}</button>)}</div>
    </div>
    <div className="mt-10 flex flex-col justify-between gap-4 border-b-2 border-ink pb-4 sm:flex-row sm:items-end"><div><p className="rule-label text-forest">Results</p><h2 className="mt-2 font-editorial text-3xl font-bold">{active === "All" ? "Benefit directory" : `${active} benefits`}</h2><p className="mt-1 text-sm text-ink/45">{visible.length} verified offers · {nationalCount} national · {schoolCount} school-specific</p></div><div className="sm:text-right"><p className="rule-label text-ink/40">Documented annual savings</p><p className="mt-1 font-editorial text-3xl font-bold text-forest">{formatValueTotal(totalValue)}</p><p className="text-[11px] text-ink/40">Fixed-value offers only</p></div></div>
    <div className="border-b-2 border-ink">
      {visible.map((item, index)=><article key={item.slug} className="grid gap-4 border-b border-ink/20 bg-transparent py-5 last:border-0 md:grid-cols-[36px_1fr_160px_140px] md:items-center">
        <span className="hidden font-mono text-xs text-ink/30 md:block">{String(index+1).padStart(2,"0")}</span>
        <div><div className="mb-2 flex flex-wrap items-center gap-3"><span className="rule-label text-forest">{item.category}</span><span className="rule-label border-l border-ink/25 pl-3 text-ink/40">{item.scope === "national" ? "National" : "School-specific"}</span><StatusBadge status={item.status} /></div><h3 className="font-editorial text-xl font-bold"><Link href={`/benefits/${item.slug}`} className="hover:text-forest hover:underline">{item.name}</Link></h3><p className="mt-1 text-sm leading-5 text-ink/55">{item.description}</p><p className="mt-2 text-xs text-ink/40">Eligibility: {item.eligibility}</p></div>
        <div className="border-l border-ink/15 pl-4"><p className="rule-label text-ink/35">Offer value</p><p className="mt-1 text-sm font-bold text-forest">{item.value}</p><p className="mt-2 text-xs text-ink/35">{item.provider}</p></div>
        <div className="flex items-center justify-between gap-3 md:block md:text-right"><p className="text-xs text-ink/40">Updated {item.verified}</p><Link href={`/benefits/${item.slug}`} className="mt-2 inline-flex items-center gap-2 border-b border-ink pb-1 text-xs font-bold uppercase tracking-wider hover:border-forest hover:text-forest">Details <ArrowIcon /></Link></div>
      </article>)}
    </div>
    {visible.length===0 && <div className="border-b-2 border-ink py-16 text-center"><p className="font-editorial text-2xl font-bold">No matching benefits</p><p className="mt-2 text-sm text-ink/45">Try another keyword or category.</p></div>}
  </>;
}
