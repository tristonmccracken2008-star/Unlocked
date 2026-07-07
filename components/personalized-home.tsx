"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { schools, type School } from "@/data/seed";
import { findExactSchoolMatches, findSchoolMatches, normalizeSchoolQuery } from "@/data/school-search";
import { ArrowIcon, SearchIcon } from "./icons";
import { profileSummary, readStudentProfile, studentProfileStorageKey, writeStudentProfile, type StudentProfile } from "@/data/student-profile";
import { recentlyAddedOpportunities, recommendedForYou, type RecommendationProfile } from "@/data/recommendations";
import { deadlineLabel, opportunities, opportunityMajors } from "@/data/opportunities";

const years = ["First year", "Second year", "Third year", "Fourth year", "Graduate student", "Other"];
const quickLinks = [["AI Tools", "/ai"], ["Career", "/career"], ["Research", "/research"], ["Scholarships", "/scholarships"], ["Software", "/software"], ["Benefits", "/benefits"], ["Financial", "/financial"], ["Local", "/local"]];
const guestPreview = [...opportunities].filter((item)=>item.verification_status==="verified_recently").sort((a,b)=>Number(b.featured)-Number(a.featured)||b.last_verified.localeCompare(a.last_verified)||a.title.localeCompare(b.title)).slice(0,4);

export function PersonalizedHome() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    try {
      const parsed = readStudentProfile();
      if (parsed && schools.some((school) => school.slug === parsed.schoolSlug)) setProfile(parsed);
    } catch { localStorage.removeItem(studentProfileStorageKey); }
    setReady(true);
  }, []);

  function save(next: StudentProfile) {
    writeStudentProfile(next);
    setProfile(next);
    setEditing(false);
  }

  // Render the complete guest dashboard in the initial HTML. Local profile data is
  // applied after hydration, but the homepage must never depend on it to look useful.
  if (!ready) return <StudentSetup initialProfile={null} onSave={save} />;
  if (!profile || editing) return <StudentSetup initialProfile={profile} onSave={save} onCancel={profile ? () => setEditing(false) : undefined} />;
  return <StudentDashboard profile={profile} onEdit={() => setEditing(true)} />;
}

export function StudentSetup({ onSave, initialProfile, onCancel }: { onSave: (profile: StudentProfile) => void; initialProfile: StudentProfile | null; onCancel?: () => void }) {
  const initialSchool = schools.find((item) => item.slug === initialProfile?.schoolSlug) ?? null;
  const [step, setStep] = useState(1);
  const [schoolQuery, setSchoolQuery] = useState(initialSchool?.name ?? "");
  const [selectedSchool, setSelectedSchool] = useState<School | null>(initialSchool);
  const [year, setYear] = useState(initialProfile?.year ?? "");
  const [major, setMajor] = useState(initialProfile?.major ?? "");
  const [minor, setMinor] = useState(initialProfile?.minor ?? "");
  const [interests, setInterests] = useState(initialProfile?.interests ?? "");
  const [careerGoal, setCareerGoal] = useState(initialProfile?.careerGoal ?? "");
  const [clubs, setClubs] = useState(initialProfile?.clubs ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const normalized = normalizeSchoolQuery(schoolQuery);
  const matches = useMemo(() => findSchoolMatches(schools, schoolQuery, 6), [schoolQuery]);

  function choose(school: School) {
    setSelectedSchool(school);
    setSchoolQuery(school.name);
    setShowSuggestions(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const exact = findExactSchoolMatches(schools, schoolQuery);
    const school = selectedSchool ?? (exact.length === 1 ? exact[0] : undefined);
    if (step === 1) { if (!school) { setShowSuggestions(true); return; } if (!year || !major.trim()) return; setStep(2); return; }
    if (step === 2) { setStep(3); return; }
    if (!school || !careerGoal.trim() || !interests.trim()) return;
    onSave({ schoolSlug: school.slug, year, major: major.trim(), minor: minor.trim(), careerGoal: careerGoal.trim(), interests: interests.trim(), clubs: clubs.trim() });
  }

  return <>
    <section className="border-b-2 border-ink bg-paper"><div className="mx-auto grid max-w-7xl border-x border-ink/20 lg:grid-cols-[.85fr_1.15fr]">
      <div className="border-b border-ink/20 px-5 py-8 sm:px-8 lg:border-b-0 lg:border-r"><p className="rule-label text-forest">UnlockED student dashboard</p><h1 className="mt-3 max-w-xl font-editorial text-3xl font-bold leading-tight tracking-[-.03em]">Your college advantage starts here.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-ink/55">Discover verified opportunities, benefits, AI tools, scholarships, internships, and resources built around your school, major, and year.</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={()=>document.getElementById("profile-school")?.focus()} className="bg-ink px-4 py-3 text-xs font-bold uppercase tracking-wider text-white">Build My Dashboard</button><Link href="/opportunities" className="border-2 border-ink px-4 py-3 text-xs font-bold uppercase tracking-wider">Browse Opportunities</Link></div>
        <div className="mt-6 border-t-2 border-ink pt-4"><p className="rule-label text-forest">Today’s Best Opportunity</p><Link href={`/opportunities/${guestPreview[0].id}`} className="group mt-2 grid grid-cols-[1fr_auto] gap-4"><div><h2 className="font-editorial text-xl font-bold group-hover:text-forest">{guestPreview[0].title}</h2><p className="mt-1 text-xs text-ink/40">{guestPreview[0].organization} · {guestPreview[0].type}</p></div><ArrowIcon/></Link></div>
        <div className="mt-5"><p className="rule-label text-ink/40">Recommended For You · Preview</p><div className="mt-2 grid sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">{guestPreview.slice(1,4).map((item)=><Link key={item.id} href={`/opportunities/${item.id}`} className="border-t border-ink/15 py-2.5 sm:border-l sm:border-t-0 sm:px-3 sm:first:border-l-0 sm:first:pl-0 lg:border-l-0 lg:border-t lg:px-0 xl:border-l xl:border-t-0 xl:px-3 xl:first:border-l-0 xl:first:pl-0"><p className="text-sm font-bold leading-tight hover:text-forest">{item.title}</p><p className="mt-1 text-[11px] text-ink/40">{item.type}</p></Link>)}</div></div>
      </div>
      <div className="bg-white px-5 py-9 sm:px-8 lg:p-10"><div className="flex items-center justify-between"><p className="rule-label text-ink/40">{initialProfile ? "Edit profile" : "Student setup"} · Step {step} of 3</p>{onCancel&&<button type="button" onClick={onCancel} className="text-xs font-bold uppercase tracking-wider text-ink/50">Cancel</button>}</div><div className="mt-4 grid grid-cols-3 gap-2" aria-hidden="true">{[1,2,3].map((item)=><span key={item} className={`h-1 ${item<=step?"bg-gold":"bg-ink/10"}`}/>)}</div><form onSubmit={submit} className="mt-6 space-y-6">
        {step===1&&<>
        <div className="relative"><label htmlFor="profile-school" className="mb-2 block text-sm font-bold">School</label><div className="flex h-12 items-center gap-2 border-2 border-ink px-3"><SearchIcon className="h-4 w-4 text-ink/40"/><input id="profile-school" value={schoolQuery} onFocus={()=>setShowSuggestions(true)} onChange={(event)=>{setSchoolQuery(event.target.value);setSelectedSchool(null);setShowSuggestions(true)}} placeholder="Name, abbreviation, or .edu domain" autoComplete="off" aria-controls="profile-school-suggestions" aria-expanded={showSuggestions&&Boolean(normalized)} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink/35"/></div>
          {showSuggestions&&normalized&&matches.length>0&&<div id="profile-school-suggestions" role="listbox" aria-label="Matching schools" className="absolute z-20 mt-1 w-full border-2 border-ink bg-white shadow-[6px_6px_0_#10243e]"><p className="px-3 py-2 rule-label text-ink/40">Top matches</p>{matches.map((school)=><button key={school.slug} type="button" role="option" aria-selected={school.slug===selectedSchool?.slug} onMouseDown={(event)=>event.preventDefault()} onClick={()=>choose(school)} className="block w-full border-t border-ink/15 px-3 py-2.5 text-left hover:bg-paper"><span className="block text-sm font-bold">{school.name}</span><span className="block text-xs text-ink/45">{school.domain} · {school.location}</span></button>)}</div>}
          {showSuggestions&&normalized&&matches.length===0&&<div id="profile-school-suggestions" className="absolute z-20 mt-1 w-full border-2 border-ink bg-white p-4 shadow-[6px_6px_0_#10243e]"><p className="font-bold">School not found</p><Link href={`/contact?school=${encodeURIComponent(schoolQuery)}`} className="mt-2 inline-block border-b border-forest text-sm font-bold text-forest">Request this school</Link></div>}
        </div>
        <label className="block"><span className="mb-2 block text-sm font-bold">Year</span><select value={year} onChange={(event)=>setYear(event.target.value)} required className="h-12 w-full border-2 border-ink bg-white px-3 outline-none"><option value="">Select your year</option>{years.map((item)=><option key={item}>{item}</option>)}</select></label>
        <label className="block"><span className="mb-2 block text-sm font-bold">Major</span><select value={major} onChange={(event)=>setMajor(event.target.value)} required className="h-12 w-full border-2 border-ink bg-white px-3 outline-none"><option value="">Select your major</option>{major&&!opportunityMajors.includes(major as (typeof opportunityMajors)[number])&&<option value={major}>{major}</option>}{opportunityMajors.filter((item)=>item!=="All"&&item!=="Any Major").map((item)=><option key={item}>{item}</option>)}</select></label>
        </>}
        {step===2&&<>
        <label className="block"><span className="mb-2 block text-sm font-bold">Minor <span className="font-normal text-ink/40">(optional)</span></span><input value={minor} onChange={(event)=>setMinor(event.target.value)} placeholder="e.g. Mathematics" className="h-12 w-full border-2 border-ink px-3 outline-none placeholder:text-ink/35"/></label>
        <label className="block"><span className="mb-2 block text-sm font-bold">Clubs <span className="font-normal text-ink/40">(optional)</span></span><input value={clubs} onChange={(event)=>setClubs(event.target.value)} placeholder="e.g. Robotics Club, Women in Finance" className="h-12 w-full border-2 border-ink px-3 outline-none placeholder:text-ink/35"/></label>
        </>}
        {step===3&&<>
        <label className="block"><span className="mb-2 block text-sm font-bold">Career goal</span><input value={careerGoal} onChange={(event)=>setCareerGoal(event.target.value)} required placeholder="e.g. Quantitative researcher" className="h-12 w-full border-2 border-ink px-3 outline-none placeholder:text-ink/35"/></label>
        <label className="block"><span className="mb-2 block text-sm font-bold">Interests</span><input value={interests} onChange={(event)=>setInterests(event.target.value)} required placeholder="e.g. Quant, AI, research" className="h-12 w-full border-2 border-ink px-3 outline-none placeholder:text-ink/35"/></label>
        </>}
        <div className="flex gap-3">{step>1&&<button type="button" onClick={()=>setStep(step-1)} className="border-2 border-ink px-5 py-4 text-sm font-bold uppercase tracking-wider">Back</button>}<button type="submit" className="flex flex-1 items-center justify-center gap-2 bg-ink px-5 py-4 text-sm font-bold uppercase tracking-wider text-white hover:bg-forest">{step===1&&!initialProfile?"Build My Dashboard":step===3?(initialProfile?"Save profile":"Open my dashboard"):"Continue"} <ArrowIcon /></button></div>
        <p className="text-xs leading-5 text-ink/40">Your selections stay in this browser. No account is required.</p>
      </form></div>
    </div></section>
  </>;
}

function StudentDashboard({ profile, onEdit }: { profile: StudentProfile; onEdit: () => void }) {
  const school = schools.find((item) => item.slug === profile.schoolSlug);
  if (!school) return null;
  const recommendationProfile: RecommendationProfile = { schoolSlug: school.slug, schoolName: school.name, schoolLocation: school.location, major: profile.major, minor: profile.minor, academicYear: profile.year, interests: profile.interests, careerGoals: profile.careerGoal, clubs: profile.clubs };
  const ranked = recommendedForYou(recommendationProfile, 4);
  const today = ranked[0];
  const recommended = ranked.slice(1, 4);
  const recent = recentlyAddedOpportunities(recommendationProfile, 3);

  return <div className="mx-auto max-w-7xl border-x border-ink/20 bg-white px-5 py-6 sm:px-8">
    <section className="flex flex-col justify-between gap-3 border-b-2 border-ink pb-5 sm:flex-row sm:items-end"><div><p className="rule-label text-forest">Your UnlockED dashboard</p><h1 className="mt-2 font-editorial text-3xl font-bold sm:text-4xl">Welcome back.</h1><p className="mt-2 text-sm text-ink/50">{school.name} · Recommended because you’re a {profileSummary(profile)}.</p></div><button onClick={onEdit} className="self-start border-b border-ink pb-1 text-xs font-bold uppercase tracking-wider hover:text-forest sm:self-auto">Edit profile</button></section>
    <div className="grid lg:grid-cols-[1.1fr_1.9fr]">
      <section className="border-b border-ink/20 py-5 lg:border-r lg:pr-6"><p className="rule-label text-forest">Today’s Best Opportunity</p>{today&&<Link href={`/opportunities/${today.opportunity.id}`} className="group block"><h2 className="mt-3 font-editorial text-2xl font-bold group-hover:text-forest">{today.opportunity.title}</h2><p className="mt-1 text-xs font-bold uppercase tracking-wider text-ink/35">{today.opportunity.organization}</p><p className="mt-3 line-clamp-2 text-sm leading-6 text-ink/55">{today.opportunity.description}</p><span className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider">View opportunity <ArrowIcon /></span></Link>}</section>
      <section className="border-b border-ink/20 py-5 lg:pl-6"><div className="flex items-end justify-between"><p className="rule-label text-forest">Recommended For You</p><Link href="/opportunities" className="text-xs font-bold uppercase tracking-wider">View all</Link></div><div className="mt-3 grid sm:grid-cols-3">{recommended.map(({opportunity})=><Link key={opportunity.id} href={`/opportunities/${opportunity.id}`} className="group border-t border-ink/15 py-3 sm:border-l sm:border-t-0 sm:px-4 sm:first:border-l-0 sm:first:pl-0"><p className="rule-label text-ink/35">{opportunity.type}</p><h3 className="mt-2 font-editorial text-lg font-bold leading-tight group-hover:text-forest">{opportunity.title}</h3><p className="mt-2 text-xs text-ink/40">{opportunity.organization}</p></Link>)}</div></section>
    </div>
    <div className="grid lg:grid-cols-[1.9fr_1.1fr]">
      <section className="border-b border-ink/20 py-5 lg:border-r lg:pr-6"><p className="rule-label text-forest">Explore</p><nav className="mt-3 grid grid-cols-2 border-l border-t border-ink/15 sm:grid-cols-4" aria-label="Opportunity sections">{quickLinks.map(([label,href])=><Link key={href} href={href} className="flex items-center justify-between border-b border-r border-ink/15 px-3 py-3 text-sm font-bold hover:bg-paper hover:text-forest">{label}<ArrowIcon /></Link>)}</nav></section>
      <section className="border-b border-ink/20 py-5 lg:pl-6"><p className="rule-label text-forest">Recent Updates</p><div className="mt-2">{recent.map(({opportunity})=><Link key={opportunity.id} href={`/opportunities/${opportunity.id}`} className="grid grid-cols-[1fr_auto] gap-3 border-b border-ink/15 py-2.5"><div><p className="text-sm font-bold">{opportunity.title}</p><p className="mt-1 text-xs text-ink/40">{opportunity.type} · {opportunity.organization}</p></div><p className="text-xs text-ink/40">{opportunity.application_deadline?deadlineLabel(opportunity):"Updated"}</p></Link>)}</div></section>
    </div>
  </div>;
}
