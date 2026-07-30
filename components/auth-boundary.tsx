"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { accountSessionEvent, clearLocalDashboardState, readAccountSession } from "@/data/account-sync";
import { readCompletedStudentProfile } from "@/data/student-profile";
import type { AccountSession } from "@/lib/account-types";

export function AuthBoundary({children}:{children:React.ReactNode}){
  const pathname=usePathname();const router=useRouter();const[session,setSession]=useState<AccountSession|null>(null);
  const protectedExact = ["/profile", "/notifications", "/my-opportunities", "/scholarships", "/research", "/career", "/build-career", "/ai", "/student-ai-tools", "/university", "/software", "/student-discounts", "/best-edu-email-perks", "/free-student-software", "/save-money", "/get-ahead", "/local", "/financial", "/updates", "/submit-perk", "/school-not-found"];
  const requiresAuth = protectedExact.includes(pathname) || pathname.startsWith("/admin") || pathname.startsWith("/opportunities") || pathname.startsWith("/benefits") || pathname.startsWith("/schools") || pathname.startsWith("/categories");
  const requiresProfile = pathname === "/my-opportunities";
  useEffect(()=>{let active=true;readAccountSession().then((next)=>{if(active)setSession(next)}).catch(()=>undefined);const update=(event:Event)=>setSession((event as CustomEvent<AccountSession>).detail);window.addEventListener(accountSessionEvent,update);return()=>{active=false;window.removeEventListener(accountSessionEvent,update)}},[]);
  useEffect(()=>{if(!requiresAuth||!session)return;if(!session.authenticated){clearLocalDashboardState();router.replace("/");return}const profile=session.data?.profile??readCompletedStudentProfile();if(requiresProfile&&!profile)router.replace("/")},[requiresAuth,requiresProfile,router,session]);
  if(!requiresAuth)return children;
  const profile=session?.data?.profile??(typeof window!=="undefined"?readCompletedStudentProfile():null);
  if ((session && !session.authenticated) || (session?.authenticated && requiresProfile && !profile)) return <main className="min-h-[65vh] px-5 py-16 sm:px-8" aria-busy="true" aria-label="Preparing your private workspace"><div className="unlocked-skeleton motion-reduce:animate-none mx-auto max-w-5xl"><p className="rule-label text-forest">UnlockED</p><div className="mt-4 h-10 max-w-md rounded-lg bg-ink/8"/><div className="mt-4 h-4 max-w-sm rounded-full bg-ink/8"/><p className="sr-only" role="status" aria-live="polite">Checking your account and saved profile.</p></div></main>;
  return children;
}
