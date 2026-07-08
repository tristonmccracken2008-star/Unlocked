"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { schools } from "@/data/seed";
import type { StudentProfile } from "@/data/student-profile";
import { journeyProgressStorageKey, syncAccountData } from "@/data/account-sync";
import { rankOpportunities, type RecommendationProfile } from "@/data/recommendations";
import type { OpportunityType } from "@/data/opportunities";
import { ArrowIcon, CheckIcon } from "./icons";

type Milestone = { id:string; title:string; description:string; href?:string; signals:string[] };
const undergraduateYears=["First year","Second year","Third year","Fourth year"];
const journeys:Record<string,Milestone[]>={
  "First year":[
    {id:"claim-benefits",title:"Claim your student benefits",description:"Review the verified tools and savings already available to you.",href:"/benefits",signals:["save money","benefit","software","ai"]},
    {id:"first-internship",title:"Work toward your first internship",description:"Explore early-career and freshman-friendly programs.",href:"/career",signals:["internship","career","coding","finance","quant"]},
    {id:"explore-research",title:"Explore undergraduate research",description:"Learn what research looks like in your field before applying.",href:"/research",signals:["research","graduate school","science","math","engineering"]},
  ],
  "Second year":[
    {id:"apply-internships",title:"Apply for internships",description:"Build a focused list of roles that match your experience.",href:"/career",signals:["internship","career","coding","finance","quant"]},
    {id:"career-fairs",title:"Prepare for career fairs",description:"Research employers and practice a concise introduction.",href:"/career",signals:["networking","career","business"]},
    {id:"start-research",title:"Start exploring research placements",description:"Compare verified programs and identify likely mentors or fields.",href:"/research",signals:["research","graduate school","science","math"]},
  ],
  "Third year":[
    {id:"internship-recruiting",title:"Prioritize internship recruiting",description:"Focus on roles that strengthen your post-college direction.",href:"/career",signals:["internship","career","coding","finance","quant"]},
    {id:"graduate-prep",title:"Begin graduate school preparation",description:"Explore research and funding aligned with advanced study.",href:"/research",signals:["graduate school","research","medicine"]},
    {id:"networking",title:"Build your professional network",description:"Create a consistent habit of connecting with peers and professionals.",signals:["networking","business","startups"]},
  ],
  "Fourth year":[
    {id:"full-time-jobs",title:"Prepare for full-time opportunities",description:"Translate your experience into a focused application strategy.",href:"/career",signals:["career","internship","coding","finance","business"]},
    {id:"graduate-applications",title:"Complete graduate school applications",description:"Track programs, requirements, funding, and deadlines.",href:"/research",signals:["graduate school","research","medicine"]},
    {id:"financial-planning",title:"Plan your transition after college",description:"Review verified financial resources and student benefits before graduation.",href:"/financial",signals:["save money","finance","investing"]},
  ],
  "Graduate student":[
    {id:"advanced-research",title:"Deepen your research portfolio",description:"Prioritize funded work that supports your academic direction.",href:"/research",signals:["research","science","medicine","engineering"]},
    {id:"professional-opportunities",title:"Build your next professional step",description:"Identify roles and programs that value advanced study.",href:"/career",signals:["career","internship","business","finance"]},
    {id:"funding",title:"Review funding opportunities",description:"Compare scholarships and financial resources relevant to your work.",href:"/scholarships",signals:["scholarship","save money","finance"]},
  ],
};

const phaseTypes:Record<string,OpportunityType[]>={
  "First year":["AI","Benefit","Career"],
  "Second year":["Career","Research","Scholarship"],
  "Third year":["Career","Research","Scholarship"],
  "Fourth year":["Career","Scholarship","Benefit"],
  "Graduate student":["Research","Career","Scholarship"],
};

function readProgress(){try{const value=JSON.parse(localStorage.getItem(journeyProgressStorageKey)??"{}");return value&&typeof value==="object"?value as Record<string,boolean>:{} }catch{return{}}}

export function MyJourneyCard({profile}:{profile:StudentProfile}){
  const[progress,setProgress]=useState<Record<string,boolean>>({});
  useEffect(()=>setProgress(readProgress()),[]);
  const school=schools.find((item)=>item.slug===profile.schoolSlug);
  const years=profile.year==="Graduate student"?["Graduate student"]:undergraduateYears;
  const context=`${profile.major} ${profile.interests} ${profile.careerGoal} ${(profile.goals??[]).join(" ")} ${(profile.topics??[]).join(" ")}`.toLowerCase();
  const roadmap=useMemo(()=>years.map((year)=>{
    const milestones=journeys[year]??[];
    const highlighted=[...milestones].filter((item)=>!progress[`${year}:${item.id}`]).sort((a,b)=>b.signals.filter((signal)=>context.includes(signal)).length-a.signals.filter((signal)=>context.includes(signal)).length)[0]?.id;
    if(!school)return{year,milestones,highlighted,opportunities:[]};
    const recommendationProfile:RecommendationProfile={schoolSlug:school.slug,schoolName:school.name,schoolLocation:school.location,major:profile.major,minor:profile.minor,academicYear:year,interests:profile.interests,careerGoals:profile.careerGoal,clubs:profile.clubs};
    const ranked=rankOpportunities(recommendationProfile).filter(({opportunity,score})=>score>0&&opportunity.verification_status==="verified"&&(opportunity.academic_years.includes("Any Year")||opportunity.academic_years.includes(year)));
    const opportunities=phaseTypes[year].map((type)=>ranked.find(({opportunity})=>opportunity.type===type)).filter((item):item is NonNullable<typeof item>=>Boolean(item));
    return{year,milestones,highlighted,opportunities};
  }),[context,profile,progress,school,years]);
  const totalMilestones=roadmap.reduce((sum,phase)=>sum+phase.milestones.length,0);
  const completed=roadmap.reduce((sum,phase)=>sum+phase.milestones.filter((item)=>progress[`${phase.year}:${item.id}`]).length,0);
  function toggle(year:string,item:Milestone){const key=`${year}:${item.id}`;const next={...progress,[key]:!progress[key]};setProgress(next);localStorage.setItem(journeyProgressStorageKey,JSON.stringify(next));syncAccountData({journeyProgress:next})}

  return <section className="mt-10 bg-white py-14 sm:py-20" aria-labelledby="journey-title">
    <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="rule-label text-forest">Opportunity roadmap</p><h2 id="journey-title" className="mt-3 font-editorial text-4xl font-bold tracking-[-.03em] sm:text-5xl">Your path through college</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-ink/45">A personalized sequence of milestones and verified opportunities based on your school, major, year, interests, and goals.</p></div><div className="min-w-44"><p className="text-sm font-bold text-ink/50">{completed} of {totalMilestones} milestones complete</p><div className="mt-3 h-1 bg-ink/8" role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={totalMilestones} aria-label="Roadmap milestones completed"><div className="h-full bg-gold transition-[width]" style={{width:`${totalMilestones?completed/totalMilestones*100:0}%`}}/></div></div></div>
    <div className="relative mt-12 before:absolute before:bottom-5 before:left-[15px] before:top-5 before:w-px before:bg-ink/15 sm:before:left-[19px]">{roadmap.map((phase,index)=>{const current=phase.year===profile.year;return <article key={phase.year} className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-5 pb-12 last:pb-0 sm:grid-cols-[40px_minmax(0,1fr)] sm:gap-8"><div className={`relative z-10 grid h-8 w-8 place-items-center rounded-full border text-xs font-bold sm:h-10 sm:w-10 ${current?"border-gold bg-gold text-white":"border-ink/20 bg-white text-ink/40"}`}>{index+1}</div><div className={current?"bg-paper px-5 py-6 sm:px-8 sm:py-8":"pt-1"}><div className="flex flex-wrap items-center gap-3"><h3 className="font-editorial text-2xl font-bold">{phase.year}</h3>{current&&<span className="rule-label text-forest">You are here</span>}</div><div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,.8fr)]"><div className="divide-y divide-ink/10">{phase.milestones.map((item)=>{const key=`${phase.year}:${item.id}`,done=Boolean(progress[key]),recommended=current&&item.id===phase.highlighted;return <div key={item.id} className="flex gap-3 py-3 first:pt-0"><button type="button" onClick={()=>toggle(phase.year,item)} aria-label={`${done?"Mark incomplete":"Mark complete"}: ${item.title}`} className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center border ${done?"border-trust bg-trust text-white":"border-ink/20 bg-white hover:border-ink"}`}>{done&&<CheckIcon className="h-3.5 w-3.5"/>}</button><div><div className="flex flex-wrap items-center gap-2"><h4 className={`text-sm font-bold ${done?"text-ink/35 line-through":""}`}>{item.title}</h4>{recommended&&<span className="text-[10px] font-bold uppercase tracking-wider text-forest">Recommended next</span>}</div><p className="mt-1 text-xs leading-5 text-ink/40">{item.description}</p></div></div>})}</div><div><p className="rule-label text-ink/35">Recommended opportunities</p><div className="mt-2 divide-y divide-ink/10 border-y border-ink/10">{phase.opportunities.map(({opportunity})=><Link key={opportunity.id} href={`/opportunities/${opportunity.id}`} className="group flex items-center justify-between gap-4 py-3"><span className="min-w-0"><span className="block truncate text-sm font-bold group-hover:text-forest">{opportunity.title}</span><span className="mt-1 block text-[11px] text-ink/40">{opportunity.type} · {opportunity.organization}</span></span><ArrowIcon className="h-4 w-4 shrink-0 text-ink/25 group-hover:text-forest"/></Link>)}</div></div></div></div></article>})}</div>
  </section>;
}
