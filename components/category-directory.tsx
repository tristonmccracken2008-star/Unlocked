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

export type DirectoryKind = "ai" | "career" | "research" | "scholarships" | "software" | "financial" | "local";

const copy: Record<DirectoryKind, [string, string]> = {
  ai: ["AI Tools", "Verified AI access and student offers, ranked for your profile."],
  career: ["Career", "Internships, programs, hackathons, fellowships, and competitions."],
  research: ["Research", "Undergraduate research programs from universities, agencies, and national laboratories."],
  scholarships: ["Scholarships", "Verified awards and funding opportunities matched to your studies."],
  software: ["Software", "Verified software benefits available through student status."],
  financial: ["Financial", "Verified financial benefits and student-focused resources."],
  local: ["Local", "School-specific and nearby opportunities supported by the current database."],
};

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
    if (kind === "financial") source = filterOpportunities({ types: ["Benefit"] }).filter((item) => item.category === "Finance");
    if (kind === "local" && school) source = filterOpportunities({ school: school.slug }).filter((item) => item.school_scope === "School Specific" || item.location.toLowerCase().includes(school.location.split(",")[0].toLowerCase()));
    return recommendationProfile ? rankOpportunities(recommendationProfile, source).map((item) => item.opportunity) : source;
  }, [kind, recommendationProfile, school]);

  if (!ready) return <div className="min-h-[60vh]" />;
  return <div className="mx-auto max-w-7xl border-x border-ink/20 bg-paper">
    <header className="border-b-2 border-ink bg-white px-5 py-8 sm:px-8"><p className="rule-label text-forest">UnlockED directory</p><h1 className="mt-2 font-editorial text-4xl font-bold">{copy[kind][0]}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/55">{copy[kind][1]}</p>{profile&&<p className="mt-4 border-l-2 border-gold pl-3 text-sm font-bold">Personalized for a {profileSummary(profile)}.</p>}{!profile&&<p className="mt-4 text-sm text-ink/50"><Link href="/" className="border-b border-ink font-bold">Create a local profile</Link> to personalize this directory.</p>}</header>
    {!profile || !school ? <GenericList records={records} empty={kind === "local" ? "Create a profile to see school-specific and nearby opportunities." : "No verified opportunities are available in this section yet."} /> : kind === "ai" ? <AIToolsSection profile={recommendationProfile!} /> : kind === "career" ? <CareerSection major={`${profile.major} ${profile.minor??""} ${profile.interests} ${profile.careerGoal}`} year={profile.year} /> : kind === "research" ? <ResearchSection school={school} major={`${profile.major} ${profile.minor??""} ${profile.interests}`} year={profile.year} /> : kind === "scholarships" ? <ScholarshipSection school={school} major={`${profile.major} ${profile.minor??""} ${profile.interests}`} year={profile.year} /> : <GenericList records={records} empty={kind === "local" ? `No verified local or ${school.name}–specific opportunities are available yet.` : "No verified opportunities are available in this section yet."} />}
  </div>;
}

function GenericList({ records, empty }: { records: Opportunity[]; empty: string }) {
  return <section className="px-5 py-8 sm:px-8">{records.length ? <div className="border-y-2 border-ink">{records.map((item)=><OpportunityCard key={item.id} opportunity={item}/>)}</div> : <div className="border-y-2 border-ink bg-white py-14 text-center"><p className="font-editorial text-2xl font-bold">Nothing verified here yet</p><p className="mx-auto mt-2 max-w-lg text-sm text-ink/50">{empty}</p></div>}</section>;
}
