"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { GlobalSearch } from "./global-search";
import { AccountButton } from "./account-auth";
import { accountSessionEvent, readAccountSession } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";

export function Header() {
  const[session,setSession]=useState<AccountSession|null>(null);
  useEffect(()=>{let active=true;readAccountSession().then((next)=>{if(active)setSession(next)}).catch(()=>{if(active)setSession({authenticated:false,user:null,data:null})});const update=(event:Event)=>setSession((event as CustomEvent<AccountSession>).detail);window.addEventListener(accountSessionEvent,update);return()=>{active=false;window.removeEventListener(accountSessionEvent,update)}},[]);
  const destinations=[["Dashboard","/"],["Opportunities","/opportunities"],["Career","/build-career"],["University","/university"],["Saved","/my-opportunities"],["Profile","/profile"]];
  const publicDestinations=[["Opportunities","/opportunities"],["Benefits","/benefits"],["Scholarships","/scholarships"],["AI Tools","/ai"]];
  if(!session?.authenticated)return <header className="border-b border-ink/15 bg-paper"><div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-x-5 px-5 sm:px-8 md:grid-cols-[auto_1fr_auto]"><Logo className="py-3.5"/><nav aria-label="Public navigation" className="scrollbar-none col-span-2 -mx-5 flex overflow-x-auto border-t border-ink/10 px-5 text-[11px] font-bold uppercase tracking-[.08em] sm:-mx-8 sm:px-8 md:col-span-1 md:mx-0 md:justify-end md:border-t-0 md:px-0">{publicDestinations.map(([label,href])=><Link key={href} href={href} className="flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-ink/65 hover:border-gold hover:text-ink md:min-h-14">{label}</Link>)}</nav><div className="py-3.5"><AccountButton compact/></div></div></header>;
  return <header className="border-b border-ink/20 bg-paper"><div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] gap-x-5 px-5 sm:px-8 md:grid-cols-[auto_minmax(180px,224px)_1fr_auto] md:items-center"><Logo className="py-3.5"/><div className="justify-self-end py-3.5 md:hidden"><AccountButton compact/></div><div className="col-span-2 pb-3 md:col-span-1 md:py-2"><GlobalSearch/></div><nav aria-label="Primary navigation" className="scrollbar-none col-span-2 -mx-5 flex overflow-x-auto border-t border-ink/10 px-5 text-[11px] font-bold uppercase tracking-[.08em] sm:-mx-8 sm:px-8 md:col-span-1 md:mx-0 md:justify-end md:border-t-0 md:px-0">{destinations.map(([label,href])=><Link key={href} href={href} className="flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-ink/65 hover:border-gold hover:text-ink md:min-h-14 md:px-2 lg:px-3">{label}</Link>)}</nav><div className="hidden md:block"><AccountButton compact/></div></div></header>;
}
