"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { opportunities } from "@/data/opportunities";
import { schools } from "@/data/seed";
import type { AnalyticsSummary } from "@/lib/analytics-types";

const opportunityNames = new Map(opportunities.map((item)=>[item.id,item.title]));
const schoolNames = new Map(schools.map((item)=>[item.slug,item.name]));
function List({ title, items, names }: { title: string; items: [string,number][]; names?: Map<string,string> }) { return <section className="border-t border-ink/15 pt-5"><h2 className="font-editorial text-2xl font-bold">{title}</h2>{items.length?<ol className="mt-4 divide-y divide-ink/10">{items.map(([key,count])=><li key={key} className="flex items-center justify-between gap-4 py-3 text-sm"><span className="font-bold">{names?.get(key)??key}</span><span className="font-mono text-xs text-ink/40">{count}</span></li>)}</ol>:<p className="mt-4 text-sm text-ink/40">No events recorded yet.</p>}</section> }
export function AdminAnalytics() {
  const [data,setData]=useState<AnalyticsSummary|null>(null);const[error,setError]=useState("");
  useEffect(()=>{fetch("/api/analytics/summary",{cache:"no-store"}).then(async(response)=>{const body=await response.json();if(!response.ok)throw new Error(body.error??"Unable to load analytics");return body}).then(setData).catch((reason)=>setError(reason.message))},[]);
  if(error)return <div className="border-y border-red-700/20 py-8"><p className="font-bold text-red-700">{error}</p><p className="mt-2 text-sm text-ink/45">Sign in with an email listed in the ADMIN_EMAILS environment variable.</p><Link href="/api/auth/google" className="mt-4 inline-flex min-h-11 items-center bg-ink px-5 text-xs font-bold uppercase tracking-wider text-white">Sign in</Link></div>;
  if(!data)return <p className="border-y border-ink/15 py-10 text-sm text-ink/45">Loading aggregate analytics…</p>;
  const conversion=(value:number,base:number)=>base?`${Math.round(value/base*100)}%`:"—";
  return <div><dl className="grid gap-px bg-ink/15 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Daily users" value={String(data.dailyUsers)}/><Metric label="Weekly users" value={String(data.weeklyUsers)}/><Metric label="Homepage → onboarding" value={conversion(data.funnel.onboarding,data.funnel.homepage)}/><Metric label="Onboarding → dashboard" value={conversion(data.funnel.dashboard,data.funnel.onboarding)}/><Metric label="Homepage → dashboard" value={conversion(data.funnel.dashboard,data.funnel.homepage)}/></dl><div className="mt-10 grid gap-10 lg:grid-cols-2"><List title="Most viewed opportunities" items={data.mostViewed} names={opportunityNames}/><List title="Most saved opportunities" items={data.mostSaved} names={opportunityNames}/><List title="Most searched schools" items={data.searchedSchools} names={schoolNames}/><List title="Most searched majors" items={data.searchedMajors}/></div></div>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="bg-white p-5"><dt className="rule-label text-ink/35">{label}</dt><dd className="mt-3 font-editorial text-3xl font-bold">{value}</dd></div>}
