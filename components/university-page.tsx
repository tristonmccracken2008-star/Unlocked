"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readStudentProfile, type StudentProfile } from "@/data/student-profile";
import { schools } from "@/data/seed";
import { ArrowIcon } from "./icons";

export function UniversityPage() {
  const [profile, setProfile] = useState<StudentProfile | null | undefined>(undefined);
  useEffect(()=>setProfile(readStudentProfile()),[]);
  if (profile === undefined) return <div className="min-h-[60vh]"/>;
  const school = schools.find((item)=>item.slug===profile?.schoolSlug);
  return <section className="mx-auto min-h-[60vh] max-w-7xl border-x border-ink/20 bg-white px-5 py-12 sm:px-8"><p className="rule-label text-forest">University</p><h1 className="mt-3 font-editorial text-4xl font-bold">{school?.name??"Your university directory"}</h1>{school?<><p className="mt-4 max-w-xl text-sm leading-6 text-ink/55">Open your university’s verified benefits index, including national opportunities and any school-specific records supported by official sources.</p><dl className="mt-8 grid max-w-2xl border-l border-t border-ink/15 sm:grid-cols-2"><div className="border-b border-r border-ink/15 p-4"><dt className="rule-label text-ink/35">Domain</dt><dd className="mt-2 font-bold">{school.domain}</dd></div><div className="border-b border-r border-ink/15 p-4"><dt className="rule-label text-ink/35">Location</dt><dd className="mt-2 font-bold">{school.location}</dd></div></dl><Link href={`/schools/${school.slug}`} className="mt-8 inline-flex items-center gap-2 bg-ink px-5 py-3 text-xs font-bold uppercase tracking-wider text-white">Open university page <ArrowIcon/></Link></>:<><p className="mt-4 text-sm text-ink/55">Create your local profile to connect this destination to your university.</p><Link href="/profile" className="mt-6 inline-flex items-center gap-2 border-b border-ink pb-1 text-xs font-bold uppercase tracking-wider">Create profile <ArrowIcon/></Link></>}</section>;
}
