"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { accountSessionEvent, clearLocalDashboardState, readAccountSession } from "@/data/account-sync";
import { readCompletedStudentProfile } from "@/data/student-profile";
import type { AccountSession } from "@/lib/account-types";

export function AuthBoundary({children}:{children:React.ReactNode}){
  const pathname=usePathname();const router=useRouter();const[session,setSession]=useState<AccountSession|null>(null);
  const protectedExact = ["/profile", "/my-opportunities", "/scholarships", "/research", "/career", "/build-career", "/ai", "/student-ai-tools", "/university", "/software", "/student-discounts", "/best-edu-email-perks", "/free-student-software", "/save-money", "/get-ahead", "/local", "/financial", "/updates", "/submit-perk", "/school-not-found"];
  const requiresAuth = protectedExact.includes(pathname) || pathname.startsWith("/admin") || pathname.startsWith("/opportunities") || pathname.startsWith("/benefits") || pathname.startsWith("/schools") || pathname.startsWith("/categories");
  const requiresProfile = pathname === "/my-opportunities";
  useEffect(()=>{let active=true;readAccountSession().then((next)=>{if(active)setSession(next)}).catch(()=>{if(active)setSession({authenticated:false,user:null,data:null})});const update=(event:Event)=>setSession((event as CustomEvent<AccountSession>).detail);window.addEventListener(accountSessionEvent,update);return()=>{active=false;window.removeEventListener(accountSessionEvent,update)}},[]);
  useEffect(()=>{if(!requiresAuth||!session)return;if(!session.authenticated){clearLocalDashboardState();router.replace("/");return}const profile=session.data?.profile??readCompletedStudentProfile();if(requiresProfile&&!profile)router.replace("/")},[requiresAuth,requiresProfile,router,session]);
  if(!requiresAuth)return children;
  const profile=session?.data?.profile??(typeof window!=="undefined"?readCompletedStudentProfile():null);
  if(!session?.authenticated||(requiresProfile&&!profile))return <main className="min-h-[65vh] px-5 py-16 sm:px-8"><div className="mx-auto max-w-5xl"><p className="rule-label text-forest">UnlockED</p><h1 className="mt-3 font-editorial text-3xl font-bold">Preparing your workspace.</h1><p className="mt-3 text-sm text-ink/45">Checking your account and saved profile.</p></div></main>;
  return children;
}
