"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { School } from "@/data/seed";
import type { StudentProfile } from "@/data/student-profile";
import { opportunities, type OpportunityType } from "@/data/opportunities";
import { recommendedForYou, type RecommendationProfile } from "@/data/recommendations";
import { readStudentActivity, studentActivityEvent, type StudentActivity } from "@/data/student-activity";
import { CheckIcon } from "./icons";

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
      return item.verification_status==="verified"&&schoolEligible&&yearEligible&&majorEligible;
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
  const insight=result.score<25?"You’re just getting started.":result.score<50?"You’re building momentum.":result.score<75?"You’re making strong progress.":"You’re getting real value from your student status.";
  return <section className="bg-paper px-6 py-10 shadow-[0_16px_45px_rgba(43,33,26,.08)] sm:px-10 sm:py-11" aria-labelledby="advantage-title"><div className="grid gap-10 md:grid-cols-[220px_minmax(0,1fr)] md:gap-12"><div className="flex flex-col items-center text-center md:items-start md:text-left"><p className="rule-label text-forest">Your Student Advantage</p><div role="progressbar" aria-valuenow={result.score} aria-valuemin={0} aria-valuemax={100} aria-label="Student Advantage Score" className="mt-5 grid h-36 w-36 place-items-center rounded-full" style={{background:`conic-gradient(#1f5f43 ${result.score*3.6}deg, rgba(43,33,26,.08) 0)`}}><div className="grid h-32 w-32 place-items-center rounded-full bg-paper text-center"><p className="font-editorial text-5xl font-bold text-forest">{result.score}<span className="block text-[10px] font-sans font-bold uppercase tracking-wider text-ink/35">out of 100</span></p></div></div><h2 id="advantage-title" className="mt-6 font-editorial text-xl font-bold">{insight}</h2><p className="mt-2 text-xs leading-5 text-ink/45">{result.viewed} viewed · {result.saved} saved</p></div>
    <div className="flex flex-col justify-center"><p className="rule-label text-ink/40">Potential value remaining</p><p className="mt-3 font-editorial text-4xl font-bold text-forest">{money.format(result.remaining)}+</p><p className="mt-2 max-w-sm text-sm leading-6 text-ink/40">Based only on verified opportunities with documented values.</p></div></div>
    <details className="group mt-7 border-t border-ink/10 pt-4"><summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold uppercase tracking-wider text-ink/55"><span>View score breakdown</span><span className="text-lg font-normal group-open:rotate-45">+</span></summary><div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">{rows.map(([label,value])=><div key={label}><p className="text-xs font-bold text-ink/50">{label}</p><p className="mt-1 font-editorial text-lg font-bold">{label==="Profile complete"&&value===100?<span className="inline-flex items-center gap-1 text-trust"><CheckIcon className="h-4 w-4"/> Complete</span>:`${value}%`}</p></div>)}</div><p className="mt-4 text-xs text-ink/45">{result.schoolAvailable?`${result.schoolPercent}% of verified school-specific opportunities explored`:"No verified school-specific opportunities available yet"}</p></details>
  </section>;
}
