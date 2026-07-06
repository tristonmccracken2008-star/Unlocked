"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { benefits, getSchoolBenefits, schools, type School } from "@/data/seed";
import { findExactSchoolMatches, findSchoolMatches, normalizeSchoolQuery } from "@/data/school-search";
import { ArrowIcon, CheckIcon, SearchIcon } from "./icons";
import { StatusBadge } from "./status-badge";

type StudentProfile = { schoolSlug: string; year: string; major: string };
const storageKey = "unlocked-student-profile";
const years = ["First year", "Second year", "Third year", "Fourth year", "Graduate student", "Other"];
const comingSoon = ["AI Tools", "Free Software", "Career", "Scholarships", "Local", "Research"];

export function PersonalizedHome() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as StudentProfile;
        if (schools.some((school) => school.slug === parsed.schoolSlug) && parsed.year && parsed.major) setProfile(parsed);
      }
    } catch { localStorage.removeItem(storageKey); }
    setReady(true);
  }, []);

  function save(next: StudentProfile) {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setProfile(next);
  }

  function reset() {
    localStorage.removeItem(storageKey);
    setProfile(null);
  }

  if (!ready) return <section className="min-h-[70vh] border-b-2 border-ink bg-paper" aria-label="Loading student dashboard" />;
  return profile ? <StudentDashboard profile={profile} onEdit={reset} /> : <StudentSetup onSave={save} />;
}

function StudentSetup({ onSave }: { onSave: (profile: StudentProfile) => void }) {
  const [schoolQuery, setSchoolQuery] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [year, setYear] = useState("");
  const [major, setMajor] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const normalized = normalizeSchoolQuery(schoolQuery);
  const matches = useMemo(() => findSchoolMatches(schools, schoolQuery, 8), [schoolQuery]);

  function choose(school: School) {
    setSelectedSchool(school);
    setSchoolQuery(school.name);
    setShowSuggestions(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const exact = findExactSchoolMatches(schools, schoolQuery);
    const school = selectedSchool ?? (exact.length === 1 ? exact[0] : undefined);
    if (!school) { setShowSuggestions(true); return; }
    if (!year || !major.trim()) return;
    onSave({ schoolSlug: school.slug, year, major: major.trim() });
  }

  return <>
    <section className="border-b-2 border-ink bg-paper"><div className="mx-auto grid max-w-7xl border-x border-ink/20 lg:grid-cols-[.85fr_1.15fr]">
      <div className="border-b border-ink/20 px-5 py-14 sm:px-8 sm:py-20 lg:border-b-0 lg:border-r lg:py-24"><p className="rule-label text-forest">Build your UnlockED profile</p><h1 className="mt-5 max-w-xl font-editorial text-5xl font-bold leading-[1.02] tracking-[-.045em] sm:text-6xl">Everything your student status unlocks—organized for you.</h1><p className="mt-7 max-w-xl text-lg leading-8 text-ink/60">Tell us where and what you study. We’ll start with verified benefits and build the rest of your student opportunity dashboard over time.</p></div>
      <div className="bg-white px-5 py-12 sm:px-8 lg:p-12"><p className="rule-label text-ink/40">Student setup · 3 fields</p><form onSubmit={submit} className="mt-7 space-y-7">
        <div className="relative"><label htmlFor="profile-school" className="mb-2 block text-sm font-bold">School</label><div className="flex h-12 items-center gap-2 border-2 border-ink px-3"><SearchIcon className="h-4 w-4 text-ink/40"/><input id="profile-school" value={schoolQuery} onFocus={()=>setShowSuggestions(true)} onChange={(event)=>{setSchoolQuery(event.target.value);setSelectedSchool(null);setShowSuggestions(true)}} placeholder="Name, abbreviation, or .edu domain" autoComplete="off" aria-controls="profile-school-suggestions" aria-expanded={showSuggestions&&Boolean(normalized)} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink/35"/></div>
          {showSuggestions&&normalized&&matches.length>0&&<div id="profile-school-suggestions" role="listbox" aria-label="Matching schools" className="absolute z-20 mt-1 w-full border-2 border-ink bg-white shadow-[6px_6px_0_#10243e]"><p className="px-3 py-2 rule-label text-ink/40">Top matches</p>{matches.map((school)=><button key={school.slug} type="button" role="option" aria-selected={school.slug===selectedSchool?.slug} onMouseDown={(event)=>event.preventDefault()} onClick={()=>choose(school)} className="block w-full border-t border-ink/15 px-3 py-2.5 text-left hover:bg-paper"><span className="block text-sm font-bold">{school.name}</span><span className="block text-xs text-ink/45">{school.domain} · {school.location}</span></button>)}</div>}
          {showSuggestions&&normalized&&matches.length===0&&<div id="profile-school-suggestions" className="absolute z-20 mt-1 w-full border-2 border-ink bg-white p-4 shadow-[6px_6px_0_#10243e]"><p className="font-bold">School not found</p><Link href={`/contact?school=${encodeURIComponent(schoolQuery)}`} className="mt-2 inline-block border-b border-forest text-sm font-bold text-forest">Request this school</Link></div>}
        </div>
        <label className="block"><span className="mb-2 block text-sm font-bold">Year</span><select value={year} onChange={(event)=>setYear(event.target.value)} required className="h-12 w-full border-2 border-ink bg-white px-3 outline-none"><option value="">Select your year</option>{years.map((item)=><option key={item}>{item}</option>)}</select></label>
        <label className="block"><span className="mb-2 block text-sm font-bold">Major</span><input value={major} onChange={(event)=>setMajor(event.target.value)} required placeholder="e.g. Computer Science" className="h-12 w-full border-2 border-ink px-3 outline-none placeholder:text-ink/35"/></label>
        <button type="submit" className="flex w-full items-center justify-center gap-2 bg-ink px-5 py-4 text-sm font-bold uppercase tracking-wider text-white hover:bg-forest">Open my dashboard <ArrowIcon /></button>
        <p className="text-xs leading-5 text-ink/40">Your selections stay in this browser. No account is required.</p>
      </form></div>
    </div></section>
  </>;
}

function StudentDashboard({ profile, onEdit }: { profile: StudentProfile; onEdit: () => void }) {
  const school = schools.find((item) => item.slug === profile.schoolSlug);
  if (!school) return null;
  const schoolBenefits = getSchoolBenefits(school).filter((item) => item.status === "verified_recently");
  const allVerified = benefits.filter((item) => item.status === "verified_recently").length;
  const featured = schoolBenefits.slice(0, 6);

  return <div className="mx-auto max-w-7xl border-x border-ink/20 bg-paper">
    <section className="grid border-b-2 border-ink bg-white lg:grid-cols-[1fr_300px]"><div className="px-5 py-10 sm:px-8"><p className="rule-label text-forest">Your UnlockED dashboard</p><h1 className="mt-3 font-editorial text-4xl font-bold sm:text-5xl">Welcome to your student home.</h1><p className="mt-4 text-sm text-ink/55">{school.name} · {profile.year} · {profile.major}</p><button onClick={onEdit} className="mt-5 border-b border-ink pb-1 text-xs font-bold uppercase tracking-wider hover:border-forest hover:text-forest">Edit student profile</button></div>
      <div className="border-t-2 border-ink bg-ink p-7 text-white lg:border-l-2 lg:border-t-0"><p className="rule-label text-white/50">Student Opportunities Unlocked</p><p className="mt-5 font-editorial text-5xl font-bold">{schoolBenefits.length} <span className="text-2xl text-white/45">/ {allVerified}</span></p><div className="mt-5 h-1.5 bg-white/15"><div className="h-full bg-lime" style={{width:`${allVerified ? Math.min(100,schoolBenefits.length/allVerified*100) : 0}%`}}/></div><p className="mt-3 text-xs leading-5 text-white/50">Based only on currently verified benefits in the database.</p></div>
    </section>

    <section className="px-5 py-10 sm:px-8"><div className="flex items-end justify-between gap-4 border-b-2 border-ink pb-4"><div><p className="rule-label text-forest">Available now</p><h2 className="mt-2 font-editorial text-3xl font-bold">Benefits</h2></div><Link href={`/schools/${school.slug}`} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">View full school index <ArrowIcon /></Link></div>
      <div className="border-b-2 border-ink">{featured.map((item,index)=><Link href={`/benefits/${item.slug}`} key={item.slug} className="group grid gap-3 border-b border-ink/20 bg-white px-4 py-5 last:border-b-0 sm:grid-cols-[36px_1fr_170px] sm:items-center"><span className="hidden font-mono text-xs text-ink/30 sm:block">{String(index+1).padStart(2,"0")}</span><div><div className="flex flex-wrap items-center gap-3"><span className="rule-label text-forest">{item.category}</span><StatusBadge status={item.status}/></div><h3 className="mt-2 font-editorial text-xl font-bold group-hover:text-forest">{item.name}</h3><p className="mt-1 text-sm text-ink/45">{item.scope === "national" ? "National student benefit" : `${school.name}–specific benefit`}</p></div><div className="sm:text-right"><p className="font-bold text-forest">{item.value}</p><p className="mt-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider">Details <ArrowIcon /></p></div></Link>)}</div>
      {featured.length===0&&<div className="border-b-2 border-ink bg-white py-10 text-center"><p className="font-bold">No verified benefits available yet.</p></div>}
    </section>

    <section className="border-t-2 border-ink bg-white"><div className="grid sm:grid-cols-2 lg:grid-cols-3">{comingSoon.map((title)=><div key={title} className="min-h-40 border-b border-r border-ink/20 p-6"><div className="flex items-center justify-between"><h2 className="font-editorial text-2xl font-bold">{title}</h2><CheckIcon className="h-4 w-4 text-ink/20"/></div><p className="mt-12 rule-label text-ink/35">Coming Soon</p></div>)}</div></section>
  </div>;
}
