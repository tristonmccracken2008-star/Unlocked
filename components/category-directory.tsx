"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readStudentProfile, profileSummary, type StudentProfile } from "@/data/student-profile";
import { schools } from "@/data/seed";
import { filterOpportunities, type Opportunity } from "@/data/opportunities";
import { rankOpportunities, type RecommendationProfile } from "@/data/recommendations";
import { AIToolsSection } from "./ai-tools-section";
import { CareerSection } from "./career-section";
import { ResearchSection } from "./research-section";
import { ScholarshipSection } from "./scholarship-section";
import { OpportunityCard } from "./opportunity-card";

export type DirectoryKind = "ai" | "career" | "research" | "scholarships" | "software" | "benefits" | "financial" | "local";

const copy: Record<DirectoryKind, [string, string]> = {
  ai: ["AI tools for real student work", "Compare verified access for writing, coding, research, design, and productivity—ranked for your profile."],
  career: ["Career opportunities worth applying for", "Find verified internships, early-career programs, hackathons, fellowships, and competitions with clear deadlines."],
  research: ["Undergraduate research you can pursue", "Explore verified programs from universities, public agencies, and national laboratories matched to your studies."],
  scholarships: ["Scholarships matched to your studies", "Compare verified awards, eligibility requirements, deadlines, and official application sources."],
  software: ["Professional software available to students", "Find verified education licenses and software benefits you can use for coursework and projects."],
  benefits: ["Verified benefits your student status unlocks", "Compare national and university-specific offers with documented eligibility, value, and official sources."],
  financial: ["Financial resources built for students", "Review verified banking, budgeting, and financial benefits without unsupported savings claims."],
  local: ["Opportunities connected to your campus", "See verified school-specific and nearby resources supported by the current database."],
};
const goal: Record<DirectoryKind, [string,string]> = { ai:["Get Ahead","/get-ahead"], software:["Get Ahead","/get-ahead"], benefits:["Get Ahead","/get-ahead"], career:["Build Your Career","/build-career"], research:["Build Your Career","/build-career"], scholarships:["Save Money","/save-money"], financial:["Save Money","/save-money"], local:["My University","/university"] };

export function CategoryDirectory({ kind }: { kind: DirectoryKind }) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { setProfile(readStudentProfile()); setReady(true); }, []);
  const school = schools.find((item) => item.slug === profile?.schoolSlug);
  const recommendationProfile: RecommendationProfile | null = profile && school ? { schoolSlug: school.slug, schoolName: school.name, schoolLocation: school.location, major: profile.major, minor: profile.minor, academicYear: profile.year, interests: profile.interests, careerGoals: profile.careerGoal, clubs: profile.clubs } : null;

  const records = useMemo(() => {
    let source: Opportunity[] = [];
    if (kind === "ai") source = filterOpportunities({ types: ["AI"] });
    if (kind === "career") source = filterOpportunities({ types: ["Career"] });
    if (kind === "research") source = filterOpportunities({ types: ["Research"] });
    if (kind === "scholarships") source = filterOpportunities({ types: ["Scholarship"] });
    if (kind === "software") source = filterOpportunities({ types: ["Benefit"] }).filter((item) => item.category === "Software");
    if (kind === "benefits") source = filterOpportunities({ types: ["Benefit"] });
    if (kind === "financial") source = filterOpportunities({ types: ["Benefit"] }).filter((item) => item.category === "Finance");
    if (kind === "local" && school) source = filterOpportunities({ school: school.slug }).filter((item) => item.school_scope === "School Specific" || item.location.toLowerCase().includes(school.location.split(",")[0].toLowerCase()));
    return recommendationProfile ? rankOpportunities(recommendationProfile, source).map((item) => item.opportunity) : source;
  }, [kind, recommendationProfile, school]);

  if (!ready) return <div className="min-h-[60vh]" />;
  return <div className="mx-auto max-w-7xl bg-paper">
    <header className="bg-white px-5 py-12 sm:px-8 sm:py-16"><nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink/35"><Link href="/">Dashboard</Link><span>/</span><Link href={goal[kind][1]} className="text-forest">{goal[kind][0]}</Link><span>/</span><span>{copy[kind][0]}</span></nav><p className="rule-label text-forest">Verified student resource directory</p><h1 className="mt-3 max-w-4xl font-editorial text-4xl font-bold tracking-[-.03em] sm:text-5xl">{copy[kind][0]}</h1><p className="mt-5 max-w-2xl text-base leading-7 text-ink/50">{copy[kind][1]}</p>{profile&&<p className="mt-6 text-sm font-bold text-ink/60">Personalized for a {profileSummary(profile)}.</p>}{!profile&&<p className="mt-6 text-sm text-ink/45"><Link href="/" className="font-bold text-forest">Create a local profile</Link> to personalize this directory.</p>}</header>
    {!profile || !school ? <GenericList records={records} empty={kind === "local" ? "Create a profile to see school-specific and nearby opportunities." : "No verified opportunities are available in this section yet."} /> : kind === "ai" ? <AIToolsSection profile={recommendationProfile!} /> : kind === "career" ? <CareerSection major={`${profile.major} ${profile.minor??""} ${profile.interests} ${profile.careerGoal}`} year={profile.year} /> : kind === "research" ? <ResearchSection school={school} major={`${profile.major} ${profile.minor??""} ${profile.interests}`} year={profile.year} /> : kind === "scholarships" ? <ScholarshipSection school={school} major={`${profile.major} ${profile.minor??""} ${profile.interests}`} year={profile.year} /> : <GenericList records={records} empty={kind === "local" ? `No verified local or ${school.name}–specific opportunities are available yet.` : "No verified opportunities are available in this section yet."} />}
  </div>;
}

function GenericList({ records, empty }: { records: Opportunity[]; empty: string }) {
  return <section className="px-5 py-10 sm:px-8 sm:py-14">{records.length ? <div>{records.map((item)=><OpportunityCard key={item.id} opportunity={item}/>)}</div> : <div className="bg-white py-16 text-center"><p className="font-editorial text-2xl font-bold">Nothing verified here yet</p><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-ink/45">{empty}</p></div>}</section>;
}
