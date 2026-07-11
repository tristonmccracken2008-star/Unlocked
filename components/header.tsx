"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { AccountButton } from "./account-auth";
import { accountSessionEvent, readAccountSession } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";

export function Header() {
  const[session,setSession]=useState<AccountSession|null>(null);
  const pathname=usePathname();
  useEffect(()=>{let active=true;readAccountSession().then((next)=>{if(active)setSession(next)}).catch(()=>{if(active)setSession({authenticated:false,user:null,data:null})});const update=(event:Event)=>setSession((event as CustomEvent<AccountSession>).detail);window.addEventListener(accountSessionEvent,update);return()=>{active=false;window.removeEventListener(accountSessionEvent,update)}},[]);
  const destinations=[["Discover","/opportunities"],["For You","/advisor"],["Journey","/"]];
  if(!session?.authenticated)return <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/90 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 sm:px-8"><Logo className="py-4"/><div className="py-4"><AccountButton compact/></div></div></header>;
  return <>
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/90 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 sm:px-8"><Logo/><nav aria-label="Primary navigation" className="order-3 hidden w-full gap-1 overflow-x-auto rounded-full bg-white/48 p-1 text-sm font-bold text-ink/55 shadow-[0_10px_30px_rgba(43,33,26,.04)] ring-1 ring-ink/6 sm:order-none sm:flex sm:w-auto">{destinations.map(([label,href])=>{const active=href==="/"?pathname==="/":pathname?.startsWith(href);return <Link key={href} href={href} aria-current={active?"page":undefined} className={`rounded-full px-4 py-2 transition duration-200 ${active?"bg-white text-forest shadow-[0_8px_20px_rgba(43,33,26,.08)]":"hover:bg-white/75 hover:text-forest"}`}>{label}</Link>})}</nav><div className="flex items-center gap-3"><Link href="/profile" className={`rounded-full px-3 py-2 text-xs font-bold transition duration-200 ${pathname?.startsWith("/profile")?"bg-white text-forest shadow-[0_8px_20px_rgba(43,33,26,.08)]":"text-ink/45 hover:bg-white/75 hover:text-forest"}`}>Profile</Link><AccountButton compact/></div></div></header>
    <nav aria-label="Mobile navigation" className="fixed inset-x-4 bottom-4 z-40 grid grid-cols-3 rounded-full bg-ink/95 p-1 text-xs font-bold text-white shadow-[0_20px_60px_rgba(43,33,26,.24)] backdrop-blur sm:hidden">{destinations.map(([label,href])=>{const active=href==="/"?pathname==="/":pathname?.startsWith(href);return <Link key={href} href={href} aria-current={active?"page":undefined} className={`rounded-full px-3 py-3 text-center transition duration-200 ${active?"bg-white text-forest":"text-white/70 hover:text-white"}`}>{label}</Link>})}</nav>
  </>;
}
