"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { StudentProfile } from "@/data/student-profile";
import { ArrowIcon, CheckIcon } from "./icons";

type Milestone = { id:string; title:string; description:string; href?:string; signals:string[] };
const journeyStorageKey="unlocked-journey-progress";
const journeys:Record<string,Milestone[]>={
  "First year":[
    {id:"claim-benefits",title:"Claim your student benefits",description:"Review the verified tools and savings already available to you.",href:"/benefits",signals:["save money","benefit","software","ai"]},
    {id:"first-internship",title:"Work toward your first internship",description:"Explore early-career and freshman-friendly programs.",href:"/career",signals:["internship","career","coding","finance","quant"]},
    {id:"join-club",title:"Join a student organization",description:"Choose one community connected to your interests or goals.",signals:["networking","club","leadership"]},
    {id:"explore-research",title:"Explore undergraduate research",description:"Learn what research looks like in your field before applying.",href:"/research",signals:["research","graduate school","science","math","engineering"]},
    {id:"linkedin-profile",title:"Build a professional profile",description:"Create a clear record of your coursework, projects, and interests.",signals:["networking","internship","career"]},
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

function readProgress(){try{const value=JSON.parse(localStorage.getItem(journeyStorageKey)??"{}");return value&&typeof value==="object"?value as Record<string,boolean>:{} }catch{return{}}}

export function MyJourneyCard({profile}:{profile:StudentProfile}){
  const[progress,setProgress]=useState<Record<string,boolean>>({});
  useEffect(()=>setProgress(readProgress()),[]);
  const milestones=journeys[profile.year]??journeys["First year"];
  const context=`${profile.major} ${profile.interests} ${profile.careerGoal} ${(profile.goals??[]).join(" ")} ${(profile.topics??[]).join(" ")}`.toLowerCase();
  const highlighted=useMemo(()=>[...milestones].filter((item)=>!progress[`${profile.year}:${item.id}`]).sort((a,b)=>b.signals.filter((signal)=>context.includes(signal)).length-a.signals.filter((signal)=>context.includes(signal)).length)[0]?.id,[context,milestones,profile.year,progress]);
  const completed=milestones.filter((item)=>progress[`${profile.year}:${item.id}`]).length;
  function toggle(item:Milestone){const key=`${profile.year}:${item.id}`;const next={...progress,[key]:!progress[key]};setProgress(next);localStorage.setItem(journeyStorageKey,JSON.stringify(next))}
  return <section className="mt-4 bg-white py-10 sm:py-12" aria-labelledby="journey-title"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="rule-label text-forest">My Journey · {profile.year}</p><h2 id="journey-title" className="mt-2 font-editorial text-3xl font-bold">Your next college milestones</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-ink/45">A simple path based on your year, goals, and interests.</p></div><p className="text-sm font-bold text-ink/45">{completed} of {milestones.length} complete</p></div><div className="mt-5 h-1 bg-ink/8" role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={milestones.length} aria-label="Journey milestones completed"><div className="h-full bg-gold transition-[width]" style={{width:`${milestones.length?completed/milestones.length*100:0}%`}}/></div><div className="mt-7 divide-y divide-ink/10">{milestones.map((item)=>{const key=`${profile.year}:${item.id}`,done=Boolean(progress[key]),featured=item.id===highlighted;return <article key={item.id} className={`grid gap-4 py-4 sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:items-center ${featured?"bg-paper/70 px-4":"px-1"}`}><button type="button" onClick={()=>toggle(item)} aria-label={`${done?"Mark incomplete":"Mark complete"}: ${item.title}`} className={`grid h-7 w-7 place-items-center border ${done?"border-trust bg-trust text-white":"border-ink/25 bg-white hover:border-ink"}`}>{done&&<CheckIcon className="h-4 w-4"/>}</button><div><div className="flex flex-wrap items-center gap-2"><h3 className={`font-bold ${done?"text-ink/40 line-through":""}`}>{item.title}</h3>{featured&&<span className="rule-label text-forest">Recommended next</span>}</div><p className="mt-1 text-sm leading-6 text-ink/45">{item.description}</p></div>{item.href&&<Link href={item.href} className="inline-flex min-h-10 items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink/55 hover:text-forest">Explore <ArrowIcon className="h-4 w-4"/></Link>}</article>})}</div></section>
}
