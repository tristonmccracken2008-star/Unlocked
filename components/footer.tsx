"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { accountSessionEvent, readAccountSession } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";

const links=[["About","/about"],["Submit a Perk","/submit-perk"],["Contact","/contact"],["Privacy","/privacy"],["Disclaimer","/disclaimer"]];
export function Footer(){const[session,setSession]=useState<AccountSession|null>(null);useEffect(()=>{let active=true;readAccountSession().then((next)=>{if(active)setSession(next)}).catch(()=>undefined);const update=(event:Event)=>setSession((event as CustomEvent<AccountSession>).detail);window.addEventListener(accountSessionEvent,update);return()=>{active=false;window.removeEventListener(accountSessionEvent,update)}},[]);return <footer className="border-t border-ink/20 bg-paper"><div className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between"><div><Logo/><p className="mt-3 max-w-md text-sm leading-6 text-ink/55">A maintained directory of student opportunities, checked against official sources.</p></div>{session?.authenticated?<nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-ink/65">{links.map(([label,href])=><Link key={href} href={href} className="hover:text-forest">{label}</Link>)}</nav>:null}</div><div className="mt-7 flex flex-col gap-2 border-t border-ink/15 pt-5 text-xs text-ink/45 sm:flex-row sm:justify-between"><p>© 2026 UnlockED</p><p>Always confirm current terms with the official provider.</p></div></div></footer>}
