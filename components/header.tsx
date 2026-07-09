"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { AccountButton } from "./account-auth";
import { accountSessionEvent, readAccountSession } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";

export function Header() {
  const[session,setSession]=useState<AccountSession|null>(null);
  useEffect(()=>{let active=true;readAccountSession().then((next)=>{if(active)setSession(next)}).catch(()=>{if(active)setSession({authenticated:false,user:null,data:null})});const update=(event:Event)=>setSession((event as CustomEvent<AccountSession>).detail);window.addEventListener(accountSessionEvent,update);return()=>{active=false;window.removeEventListener(accountSessionEvent,update)}},[]);
  const destinations=[["Discover","/opportunities"],["Saved","/my-opportunities"],["Profile","/profile"]];
  if(!session?.authenticated)return <header className="border-b border-ink/10 bg-paper/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 sm:px-8"><Logo className="py-4"/><div className="py-4"><AccountButton compact/></div></div></header>;
  return <header className="border-b border-ink/10 bg-paper/95 backdrop-blur"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 sm:px-8"><Logo/><nav aria-label="Primary navigation" className="order-3 flex w-full gap-1 text-sm font-bold text-ink/55 sm:order-none sm:w-auto">{destinations.map(([label,href])=><Link key={href} href={href} className="rounded-full px-4 py-2 hover:bg-white hover:text-forest">{label}</Link>)}</nav><AccountButton compact/></div></header>;
}
