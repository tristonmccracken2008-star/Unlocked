"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { School } from "@/data/seed";
import { readStudentProfile, type StudentProfile } from "@/data/student-profile";
import { rankOpportunities, type RecommendationProfile } from "@/data/recommendations";
import { opportunities } from "@/data/opportunities";
import { ArrowIcon } from "./icons";

export function SchoolPersonalizedRecommendations({school}:{school:School}){
  const[profile,setProfile]=useState<StudentProfile|null>(null);
  useEffect(()=>setProfile(readStudentProfile()),[]);
  const matches=useMemo(()=>{if(!profile||profile.schoolSlug!==school.slug)return[];const input:RecommendationProfile={schoolSlug:school.slug,schoolName:school.name,schoolLocation:school.location,major:profile.major,minor:profile.minor,academicYear:profile.year,interests:profile.interests,careerGoals:profile.careerGoal,clubs:profile.clubs};const eligible=opportunities.filter((item)=>item.verification_status!=="expired"&&(item.school_scope==="National"||item.schools.includes(school.slug)));return rankOpportunities(input,eligible).slice(0,3)},[profile,school]);
  if(!profile||profile.schoolSlug!==school.slug)return null;
  return <section className="py-12" aria-labelledby="school-personalized"><p className="rule-label text-forest">Personalized for your profile</p><h2 id="school-personalized" className="mt-2 font-editorial text-3xl font-bold">Recommended at {school.name}</h2><p className="mt-2 text-sm text-ink/45">Ranked for {profile.major} · {profile.year}.</p><div className="mt-6 divide-y divide-ink/15 border-y border-ink/15">{matches.map(({opportunity,reasons})=><Link key={opportunity.id} href={`/opportunities/${opportunity.id}`} className="group grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="rule-label text-forest">{opportunity.type}</p><h3 className="mt-1 font-editorial text-xl font-bold group-hover:text-forest">{opportunity.title}</h3><p className="mt-1 text-xs text-ink/40">{opportunity.organization} · {reasons[0]??"Matches your profile"}</p></div><ArrowIcon/></Link>)}</div></section>
}
