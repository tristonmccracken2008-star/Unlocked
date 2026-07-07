"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readStudentProfile, type StudentProfile } from "@/data/student-profile";
import { schools } from "@/data/seed";
import { ArrowIcon } from "./icons";

export function UniversityPage() {
  const [profile,setProfile]=useState<StudentProfile|null|undefined>(undefined);
  useEffect(()=>setProfile(readStudentProfile()),[]);
  if(profile===undefined)return <div className="min-h-[60vh]"/>;
  const school=schools.find((item)=>item.slug===profile?.schoolSlug);
  return <main className="mx-auto min-h-[60vh] max-w-6xl border-x border-ink/20 bg-white px-5 py-10 sm:px-8 sm:py-12"><nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink/40"><Link href="/">Dashboard</Link><span>/</span><span className="text-forest">My University</span></nav><header className="mt-6"><p className="rule-label text-forest">Everything unique to your school</p><h1 className="mt-3 font-editorial text-4xl font-bold">{school?.name??"Connect your university"}</h1>{school?<p className="mt-4 max-w-2xl text-sm leading-6 text-ink/55">Find verified school-specific opportunities, local resources, campus discounts, and your complete university benefit index.</p>:<p className="mt-4 text-sm text-ink/55">Create your local profile to connect this destination to your university.</p>}</header>{school?<><dl className="mt-7 grid max-w-2xl border-l border-t border-ink/15 sm:grid-cols-2"><div className="border-b border-r border-ink/15 p-4"><dt className="rule-label text-ink/35">Domain</dt><dd className="mt-2 font-bold">{school.domain}</dd></div><div className="border-b border-r border-ink/15 p-4"><dt className="rule-label text-ink/35">Location</dt><dd className="mt-2 font-bold">{school.location}</dd></div></dl><section className="mt-8 grid border-l border-t border-ink/15 sm:grid-cols-2 lg:grid-cols-4">{[{title:"University Page",href:`/schools/${school.slug}`,text:"Open your verified school benefit index."},{title:"School-Specific",href:"/local",text:"See opportunities explicitly verified for your school."},{title:"Local Resources",href:"/local",text:"Browse nearby and campus-connected resources."},{title:"Campus Discounts",href:"/categories/campus",text:"Review verified campus benefit listings."}].map((item)=><Link key={item.title} href={item.href} className="group flex min-h-36 flex-col border-b border-r border-ink/15 p-4 hover:bg-paper"><h2 className="font-editorial text-xl font-bold group-hover:text-forest">{item.title}</h2><p className="mt-2 text-sm leading-6 text-ink/50">{item.text}</p><span className="mt-auto pt-3"><ArrowIcon/></span></Link>)}</section></>:<Link href="/profile" className="mt-6 inline-flex min-h-11 items-center gap-2 border-b border-ink pb-1 text-xs font-bold uppercase tracking-wider">Create profile <ArrowIcon/></Link>}</main>;
}
