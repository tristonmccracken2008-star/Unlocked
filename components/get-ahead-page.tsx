"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { opportunities, type Opportunity } from "@/data/opportunities";
import { rankOpportunities, type RecommendationProfile } from "@/data/recommendations";
import { readStudentProfile } from "@/data/student-profile";
import { readStudentActivity, studentActivityEvent, toggleSavedOpportunity } from "@/data/student-activity";
import { schools } from "@/data/seed";
import { ArrowIcon, CheckIcon } from "./icons";
import { StatusBadge } from "./status-badge";

const categories = [
  { title: "AI Tools", href: "/ai", description: "Verified tools for research, coding, writing, and study.", matches: (item: Opportunity) => item.type === "AI" },
  { title: "Free Software", href: "/software", description: "Education licenses and professional tools available to students.", matches: (item: Opportunity) => item.type === "Benefit" && item.category === "Software" },
  { title: "Student Benefits", href: "/benefits", description: "Documented offers and resources unlocked by student status.", matches: (item: Opportunity) => item.type === "Benefit" },
  { title: "Hidden Gems", href: "/opportunities", description: "High-quality opportunities that are easy to overlook.", matches: (item: Opportunity) => item.hidden_gem },
] as const;

function valueLabel(item: Opportunity) {
  if (typeof item.estimated_value === "number") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(item.estimated_value);
  return item.type === "Scholarship" ? item.metadata.awardAmountLabel ?? "Value not published" : item.type === "Benefit" ? item.metadata.valueLabel ?? "Value not published" : "Value not published";
}

function impact(item: Opportunity) {
  const audience = item.majors.includes("Any Major") ? "students across majors" : `${item.majors.slice(0, 2).join(" and ")} students`;
  const first = item.type === "AI" ? `This gives ${audience} a verified way to evaluate ${item.category.toLowerCase()} workflows.` : item.type === "Benefit" ? `This can help eligible ${audience} access a documented student offer from ${item.organization}.` : `This gives ${audience} a verified path to explore ${item.category.toLowerCase()}.`;
  return `${first} Actual value depends on eligibility, current terms, and how often it is used.`;
}

export function GetAheadPage() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<ReturnType<typeof readStudentProfile>>(null);
  useEffect(() => { setProfile(readStudentProfile()); setReady(true); }, []);

  const ranked = useMemo(() => {
    const source = opportunities.filter((item) => item.verification_status !== "expired" && (item.type === "AI" || item.type === "Benefit" || item.hidden_gem));
    const school = schools.find((item) => item.slug === profile?.schoolSlug);
    if (!profile || !school) return [...source].sort((a,b) => Number(b.featured)-Number(a.featured) || b.last_verified.localeCompare(a.last_verified)).map((opportunity) => ({ opportunity }));
    const recommendationProfile: RecommendationProfile = { schoolSlug: school.slug, schoolName: school.name, schoolLocation: school.location, major: profile.major, minor: profile.minor, academicYear: profile.year, interests: profile.interests, careerGoals: profile.careerGoal, clubs: profile.clubs };
    return rankOpportunities(recommendationProfile, source);
  }, [profile]);

  const featured = ranked[0]?.opportunity;
  const recommended = ranked.slice(1, 4).map((item) => item.opportunity);
  const recent = [...new Map(opportunities.filter((item) => item.verification_status !== "expired" && (item.type === "AI" || item.type === "Benefit" || item.hidden_gem)).map((item) => [item.id,item])).values()].sort((a,b) => b.date_added.localeCompare(a.date_added) || a.title.localeCompare(b.title)).slice(0,5);

  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
    <header><p className="rule-label text-forest">Student tools and advantages</p><h1 className="mt-3 font-editorial text-5xl font-bold tracking-[-.035em] sm:text-6xl">Get Ahead</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-ink/55">Discover the highest-impact opportunities that give you an advantage during college.</p>
      <div className="mt-9 grid gap-px bg-ink/15 sm:grid-cols-2 lg:grid-cols-4">{categories.map((category)=><Link key={category.title} href={category.href} className="group flex min-h-44 flex-col bg-white p-5 hover:bg-paper"><div className="flex items-start justify-between gap-4"><h2 className="font-editorial text-2xl font-bold group-hover:text-forest">{category.title}</h2><ArrowIcon className="mt-1 h-5 w-5 shrink-0"/></div><p className="mt-3 text-sm leading-6 text-ink/50">{category.description}</p><p className="mt-auto pt-5 text-xs font-bold uppercase tracking-wider text-forest">{opportunities.filter((item)=>item.verification_status!=="expired"&&category.matches(item)).length} opportunities</p></Link>)}</div>
    </header>

    {featured&&<section className="py-14 sm:py-16" aria-labelledby="featured-title"><p className="rule-label text-forest">Featured opportunity</p><div className="mt-3 grid gap-8 bg-ink px-6 py-8 text-white sm:px-9 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-end"><div><div className="flex flex-wrap items-center gap-3"><StatusBadge status={featured.verification_status}/><span className="rule-label text-white/45">{featured.type}</span></div><p className="mt-6 text-xs font-bold uppercase tracking-wider text-white/45">{featured.organization}</p><h2 id="featured-title" className="mt-2 max-w-3xl font-editorial text-3xl font-bold leading-tight sm:text-4xl">{featured.title}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-white/65">{impact(featured)}</p></div><div className="border-t border-white/20 pt-5 lg:border-l lg:border-t-0 lg:pl-6"><p className="rule-label text-white/45">Estimated value</p><p className="mt-2 font-editorial text-2xl font-bold text-lime">{valueLabel(featured)}</p><Link href={`/opportunities/${featured.id}`} className="mt-6 flex min-h-12 items-center justify-center gap-2 bg-lime px-5 text-sm font-bold text-ink hover:bg-white">View opportunity <ArrowIcon/></Link></div></div></section>}

    <section className="border-t border-ink/15 py-12" aria-labelledby="recommended-title"><div className="flex items-end justify-between gap-4"><div><p className="rule-label text-forest">Personalized shortlist</p><h2 id="recommended-title" className="mt-2 font-editorial text-3xl font-bold">Recommended For You</h2></div><Link href="/opportunities" className="text-xs font-bold uppercase tracking-wider hover:text-forest">View all</Link></div><div className="mt-6 divide-y divide-ink/15 border-y border-ink/15">{recommended.map((item)=><article key={item.id} className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-center"><div><p className="rule-label text-forest">{item.type}</p><h3 className="mt-1 font-editorial text-xl font-bold"><Link href={`/opportunities/${item.id}`} className="hover:text-forest">{item.title}</Link></h3><p className="mt-1 text-xs text-ink/40">{item.organization}</p></div><div><p className="rule-label text-ink/35">Estimated value</p><p className="mt-1 text-sm font-bold">{valueLabel(item)}</p></div><SaveButton opportunityId={item.id}/></article>)}</div>{ready&&!profile&&<p className="mt-4 text-xs text-ink/45"><Link href="/profile" className="font-bold text-forest">Build your profile</Link> to personalize this shortlist.</p>}</section>

    <section className="border-t border-ink/15 py-12" aria-labelledby="browse-title"><p className="rule-label text-forest">Browse by purpose</p><h2 id="browse-title" className="mt-2 font-editorial text-3xl font-bold">Browse Categories</h2><div className="mt-6 grid gap-x-8 border-y border-ink/15 sm:grid-cols-2">{categories.map((category)=><Link key={category.title} href={category.href} className="group flex items-center justify-between gap-5 border-b border-ink/15 py-5 sm:[&:nth-last-child(-n+2)]:border-b-0"><div><h3 className="font-editorial text-xl font-bold group-hover:text-forest">{category.title}</h3><p className="mt-1 text-sm text-ink/45">{category.description}</p></div><ArrowIcon className="shrink-0"/></Link>)}</div></section>

    <section className="border-t border-ink/15 py-12" aria-labelledby="recent-title"><div className="flex items-end justify-between"><div><p className="rule-label text-forest">Database updates</p><h2 id="recent-title" className="mt-2 font-editorial text-3xl font-bold">Recently Added</h2></div><Link href="/updates" className="text-xs font-bold uppercase tracking-wider hover:text-forest">View updates</Link></div><div className="mt-5 divide-y divide-ink/15 border-y border-ink/15">{recent.map((item)=><Link key={item.id} href={`/opportunities/${item.id}`} className="group grid grid-cols-[1fr_auto] items-center gap-4 py-3.5"><div><p className="text-sm font-bold group-hover:text-forest">{item.title}</p><p className="mt-1 text-xs text-ink/40">{item.type} · {item.organization}</p></div><time dateTime={item.date_added} className="text-xs text-ink/40">{item.date_added}</time></Link>)}</div></section>
  </main>;
}

function SaveButton({ opportunityId }: { opportunityId: string }) {
  const [saved,setSaved]=useState(false);
  useEffect(()=>{const update=()=>setSaved(readStudentActivity().saved.includes(opportunityId));update();window.addEventListener(studentActivityEvent,update);return()=>window.removeEventListener(studentActivityEvent,update)},[opportunityId]);
  return <button type="button" onClick={()=>{toggleSavedOpportunity(opportunityId);setSaved(readStudentActivity().saved.includes(opportunityId))}} className="inline-flex min-h-11 items-center justify-center gap-2 border border-ink/20 px-4 text-xs font-bold uppercase tracking-wider hover:border-ink sm:justify-self-end">{saved?<><CheckIcon className="h-4 w-4"/> Saved</>:"Save"}</button>;
}
