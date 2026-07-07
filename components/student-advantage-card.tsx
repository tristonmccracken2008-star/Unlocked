"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { School } from "@/data/seed";
import type { StudentProfile } from "@/data/student-profile";
import { opportunities, type OpportunityType } from "@/data/opportunities";
import { recommendedForYou, type RecommendationProfile } from "@/data/recommendations";
import { readStudentActivity, studentActivityEvent, type StudentActivity } from "@/data/student-activity";
import { ArrowIcon, CheckIcon } from "./icons";

const empty: StudentActivity = { viewed: [], saved: [], claimed: [] };
const percent = (count: number, target: number) => target ? Math.min(100, Math.round(count / target * 100)) : 100;

export function StudentAdvantageCard({ profile, school }: { profile: StudentProfile; school: School }) {
  const [activity, setActivity] = useState<StudentActivity>(empty);
  useEffect(() => { const update=()=>setActivity(readStudentActivity());update();window.addEventListener(studentActivityEvent,update);return()=>window.removeEventListener(studentActivityEvent,update); }, []);
  const result = useMemo(() => {
    const study=`${profile.major} ${profile.minor??""}`.toLowerCase();
    const verified=opportunities.filter((item)=>{
      const schoolEligible=item.school_scope==="National"||item.schools.includes(school.slug);
      const yearEligible=item.academic_years.includes("Any Year")||item.academic_years.includes(profile.year);
      const majorEligible=item.majors.includes("Any Major")||item.majors.some((major)=>study.includes(major.toLowerCase())||major.toLowerCase().includes(profile.major.toLowerCase()));
      return item.verification_status==="verified_recently"&&schoolEligible&&yearEligible&&majorEligible;
    });
    const viewed=new Set(activity.viewed),saved=new Set(activity.saved),claimed=new Set(activity.claimed);
    const typeItems=(type:OpportunityType)=>verified.filter((item)=>item.type===type);
    const viewedType=(type:OpportunityType)=>typeItems(type).filter((item)=>viewed.has(item.id)).length;
    const profileFields=[profile.schoolSlug,profile.major,profile.year,profile.careerGoal,profile.interests];
    const profilePercent=percent(profileFields.filter((item)=>item?.trim()).length,profileFields.length);
    const discoveredPercent=percent(verified.filter((item)=>viewed.has(item.id)).length,20);
    const savedPercent=percent(verified.filter((item)=>saved.has(item.id)).length,5);
    const schoolItems=verified.filter((item)=>item.school_scope==="School Specific");
    const schoolPercent=schoolItems.length?percent(schoolItems.filter((item)=>viewed.has(item.id)).length,Math.min(5,schoolItems.length)):100;
    const aiPercent=percent(typeItems("AI").filter((item)=>claimed.has(item.id)).length,Math.min(5,typeItems("AI").length));
    const careerPercent=percent(viewedType("Career"),Math.min(10,typeItems("Career").length));
    const researchPercent=percent(viewedType("Research"),Math.min(10,typeItems("Research").length));
    const scholarshipPercent=percent(viewedType("Scholarship"),Math.min(10,typeItems("Scholarship").length));
    const benefitsPercent=percent(typeItems("Benefit").filter((item)=>viewed.has(item.id)||claimed.has(item.id)).length,Math.min(10,typeItems("Benefit").length));
    const score=Math.round(profilePercent*.20+discoveredPercent*.15+savedPercent*.10+schoolPercent*.10+aiPercent*.10+careerPercent*.10+researchPercent*.10+scholarshipPercent*.10+benefitsPercent*.05);
    const remaining=verified.filter((item)=>!claimed.has(item.id)&&typeof item.estimated_value==="number"&&item.estimated_value>0).reduce((sum,item)=>sum+(item.estimated_value??0),0);
    const recommendationProfile:RecommendationProfile={schoolSlug:school.slug,schoolName:school.name,schoolLocation:school.location,major:profile.major,minor:profile.minor,academicYear:profile.year,interests:profile.interests,careerGoals:profile.careerGoal,clubs:profile.clubs};
    const next=recommendedForYou(recommendationProfile,20).map((item)=>item.opportunity).find((item)=>!claimed.has(item.id)&&!viewed.has(item.id))??recommendedForYou(recommendationProfile,1)[0]?.opportunity;
    return{score,profilePercent,aiPercent,careerPercent,researchPercent,scholarshipPercent,benefitsPercent,remaining,next,viewed:activity.viewed.length,saved:activity.saved.length,schoolPercent,schoolAvailable:schoolItems.length};
  },[activity,profile,school]);
  const money=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});
  const rows=[["Profile complete",result.profilePercent],["AI tools claimed",result.aiPercent],["Career explored",result.careerPercent],["Research explored",result.researchPercent],["Scholarships viewed",result.scholarshipPercent],["Benefits explored",result.benefitsPercent]] as const;
  return <section className="border-b-2 border-ink bg-paper py-6" aria-labelledby="advantage-title"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="rule-label text-forest">Your Student Advantage</p><h2 id="advantage-title" className="mt-2 font-editorial text-3xl font-bold">Overall Advantage Score</h2></div><p className="font-editorial text-4xl font-bold text-forest">{result.score} <span className="text-xl text-ink/35">/ 100</span></p></div><div className="mt-4 h-2 bg-ink/10" role="progressbar" aria-valuenow={result.score} aria-valuemin={0} aria-valuemax={100} aria-label="Student Advantage Score"><div className="h-full bg-gold transition-[width]" style={{width:`${result.score}%`}}/></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_.7fr]"><div><div className="grid grid-cols-2 border-l border-t border-ink/15 sm:grid-cols-3">{rows.map(([label,value])=><div key={label} className="border-b border-r border-ink/15 bg-white p-3"><p className="text-xs font-bold text-ink/55">{label}</p><p className="mt-2 font-editorial text-xl font-bold">{label==="Profile complete"&&value===100?<span className="inline-flex items-center gap-1 text-trust"><CheckIcon className="h-4 w-4"/> Complete</span>:`${value}%`}</p></div>)}</div><p className="mt-3 text-xs text-ink/45">{result.viewed} opportunities viewed · {result.saved} saved · {result.schoolAvailable?`${result.schoolPercent}% of verified school-specific opportunities explored`:"No verified school-specific opportunities available yet"}</p></div>
      <div className="border-l-2 border-ink pl-5"><p className="rule-label text-ink/40">Potential value remaining</p><p className="mt-2 font-editorial text-3xl font-bold text-forest">{money.format(result.remaining)}+</p><p className="mt-1 text-[11px] leading-5 text-ink/40">Verified opportunities with documented values only.</p>{result.next&&<div className="mt-5 border-t border-ink/20 pt-4"><p className="rule-label text-ink/40">Next best action</p><Link href={`/opportunities/${result.next.id}`} className="group mt-2 block"><p className="font-bold group-hover:text-forest">{result.next.type==="Benefit"||result.next.type==="AI"?"Claim":"Explore"} {result.next.title}</p><p className="mt-1 text-xs text-ink/45">Estimated value: {result.next.estimated_value?`${money.format(result.next.estimated_value)}+`:"Value varies"}</p><span className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider">Take action <ArrowIcon/></span></Link></div>}</div></div>
  </section>;
}
