"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { schools, type School } from "@/data/seed";
import { findExactSchoolMatches, findSchoolMatches, normalizeSchoolQuery } from "@/data/school-search";
import { ArrowIcon, SearchIcon } from "./icons";
import { profileSummary, readStudentProfile, studentProfileStorageKey, writeStudentProfile, type StudentProfile } from "@/data/student-profile";
import { rankOpportunities, recommendedForYou, type RecommendationProfile } from "@/data/recommendations";
import { opportunities, opportunityMajors } from "@/data/opportunities";
import { StudentAdvantageCard } from "./student-advantage-card";
import { WhatsNewFeed } from "./whats-new-feed";

const years = [["Freshman", "First year"], ["Sophomore", "Second year"], ["Junior", "Third year"], ["Senior", "Fourth year"], ["Graduate", "Graduate student"]] as const;
const goalOptions = ["Get internships", "Save money", "Find research", "Learn AI", "Build coding skills", "Prepare for graduate school", "Prepare for quant finance", "Start a business", "Networking"];
const topicOptions = ["AI", "Finance", "Computer Science", "Math", "Engineering", "Business", "Medicine", "Startups", "Investing", "Robotics", "Economics"];
const guestPreview = [...opportunities].filter((item)=>item.verification_status==="verified_recently").sort((a,b)=>Number(b.featured)-Number(a.featured)||b.last_verified.localeCompare(a.last_verified)||a.title.localeCompare(b.title)).slice(0,4);

export function PersonalizedHome() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    try {
      const parsed = readStudentProfile();
      if (parsed && schools.some((school) => school.slug === parsed.schoolSlug)) setProfile(parsed);
    } catch { localStorage.removeItem(studentProfileStorageKey); }
    setReady(true);
  }, []);

  function save(next: StudentProfile) {
    const isNewProfile = !profile;
    writeStudentProfile(next);
    setProfile(next);
    setEditing(false);
    setJustCompleted(isNewProfile);
  }

  // Render the complete guest dashboard in the initial HTML. Local profile data is
  // applied after hydration, but the homepage must never depend on it to look useful.
  if (!ready) return <StudentSetup initialProfile={null} onSave={save} />;
  if (!profile || editing) return <StudentSetup initialProfile={profile} onSave={save} onCancel={profile ? () => setEditing(false) : undefined} />;
  if (justCompleted) return <OnboardingComplete profile={profile} onContinue={() => setJustCompleted(false)} />;
  return <StudentDashboard profile={profile} onEdit={() => setEditing(true)} />;
}

export function StudentSetup({ onSave, initialProfile, onCancel }: { onSave: (profile: StudentProfile) => void; initialProfile: StudentProfile | null; onCancel?: () => void }) {
  const initialSchool = schools.find((item) => item.slug === initialProfile?.schoolSlug) ?? null;
  const [step, setStep] = useState(1);
  const [schoolQuery, setSchoolQuery] = useState(initialSchool?.name ?? "");
  const [selectedSchool, setSelectedSchool] = useState<School | null>(initialSchool);
  const [year, setYear] = useState(initialProfile?.year ?? "");
  const [major, setMajor] = useState(initialProfile?.major ?? "");
  const [goals, setGoals] = useState<string[]>(initialProfile?.goals ?? initialProfile?.careerGoal.split(", ").filter(Boolean) ?? []);
  const [topics, setTopics] = useState<string[]>(initialProfile?.topics ?? initialProfile?.interests.split(", ").filter(Boolean) ?? []);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMajorSuggestions, setShowMajorSuggestions] = useState(false);
  const normalized = normalizeSchoolQuery(schoolQuery);
  const matches = useMemo(() => findSchoolMatches(schools, schoolQuery, 6), [schoolQuery]);
  const majorMatches = useMemo(() => opportunityMajors.filter((item) => item !== "All" && item !== "Any Major" && item.toLowerCase().includes(major.trim().toLowerCase())).slice(0, 6), [major]);

  function choose(school: School) {
    setSelectedSchool(school);
    setSchoolQuery(school.name);
    setShowSuggestions(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const exact = findExactSchoolMatches(schools, schoolQuery);
    const school = selectedSchool ?? (exact.length === 1 ? exact[0] : undefined);
    if (step === 1) { if (!school) { setShowSuggestions(true); return; } setStep(2); return; }
    if (step === 2) { if (!major.trim()) return; setStep(3); return; }
    if (step === 3) { if (!year) return; setStep(4); return; }
    if (step === 4) { if (!goals.length) return; setStep(5); return; }
    if (!school || !topics.length) return;
    onSave({ schoolSlug: school.slug, year, major: major.trim(), careerGoal: goals.join(", "), interests: topics.join(", "), goals, topics });
  }

  function toggle(value: string, current: string[], update: (next: string[]) => void) {
    update(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  return <>
    <section className="border-b-2 border-ink bg-paper"><div className="mx-auto grid max-w-6xl border-x border-ink/20 lg:grid-cols-[1.05fr_.95fr]">
      <div className="border-b border-ink/20 px-5 py-7 sm:px-8 lg:border-b-0 lg:border-r"><p className="rule-label text-forest">UnlockED student dashboard</p><h1 className="mt-3 max-w-xl font-editorial text-3xl font-bold leading-[1.08] tracking-[-.035em] sm:text-4xl">Your college advantage starts here.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-ink/55">Discover verified opportunities, benefits, AI tools, scholarships, internships, and resources built around your school, major, and year.</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={()=>document.getElementById("profile-school")?.focus()} className="inline-flex min-h-11 items-center border-2 border-ink bg-ink px-5 text-xs font-bold uppercase tracking-wider text-white hover:bg-forest">Build My Dashboard</button><Link href="/opportunities" className="inline-flex min-h-11 items-center border-2 border-ink px-5 text-xs font-bold uppercase tracking-wider hover:bg-white">Browse Opportunities</Link></div>
        <div className="mt-6 border-t-2 border-ink pt-4"><p className="rule-label text-forest">Today’s Best Opportunity</p><Link href={`/opportunities/${guestPreview[0].id}`} className="group mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-l-2 border-gold bg-white px-4 py-3"><div className="min-w-0"><h2 className="font-editorial text-xl font-bold leading-tight group-hover:text-forest">{guestPreview[0].title}</h2><p className="mt-1 text-xs text-ink/40">{guestPreview[0].organization} · {guestPreview[0].type}</p></div><ArrowIcon/></Link></div>
        <div className="mt-4"><p className="rule-label text-ink/40">Recommended For You</p><div className="mt-2 grid border-l border-t border-ink/15 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">{guestPreview.slice(1,4).map((item)=><Link key={item.id} href={`/opportunities/${item.id}`} className="border-b border-r border-ink/15 bg-white px-3 py-3"><p className="text-sm font-bold leading-tight hover:text-forest">{item.title}</p><p className="mt-1 text-[11px] text-ink/40">{item.type}</p></Link>)}</div></div>
      </div>
      <div className="bg-white px-5 py-7 sm:px-8"><div className="flex items-center justify-between"><div><p className="rule-label text-forest">Find My Opportunities</p><p className="mt-1 text-xs text-ink/40">Step {step} of 5 · Stored only in this browser</p></div>{onCancel&&<button type="button" onClick={onCancel} className="min-h-11 px-2 text-xs font-bold uppercase tracking-wider text-ink/50">Cancel</button>}</div><div className="mt-3 grid grid-cols-5 gap-2" aria-hidden="true">{[1,2,3,4,5].map((item)=><span key={item} className={`h-1 ${item<=step?"bg-gold":"bg-ink/10"}`}/>)}</div><form onSubmit={submit} className="mt-5 space-y-4">
        {step===1&&<>
        <div><h2 className="font-editorial text-2xl font-bold">What school do you attend?</h2><p className="mt-1 text-sm text-ink/45">Search by name, abbreviation, or .edu domain.</p></div>
        <div className="relative"><label htmlFor="profile-school" className="mb-1.5 block text-sm font-bold">School</label><div className="flex h-11 items-center gap-2 border-2 border-ink px-3"><SearchIcon className="h-4 w-4 text-ink/40"/><input id="profile-school" value={schoolQuery} onFocus={()=>setShowSuggestions(true)} onChange={(event)=>{setSchoolQuery(event.target.value);setSelectedSchool(null);setShowSuggestions(true)}} placeholder="Name, abbreviation, or .edu domain" autoComplete="off" aria-controls="profile-school-suggestions" aria-expanded={showSuggestions&&Boolean(normalized)} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink/35"/></div>
          {showSuggestions&&normalized&&matches.length>0&&<div id="profile-school-suggestions" role="listbox" aria-label="Matching schools" className="absolute z-20 mt-1 w-full border-2 border-ink bg-white shadow-[6px_6px_0_#10243e]"><p className="px-3 py-2 rule-label text-ink/40">Top matches</p>{matches.map((school)=><button key={school.slug} type="button" role="option" aria-selected={school.slug===selectedSchool?.slug} onMouseDown={(event)=>event.preventDefault()} onClick={()=>choose(school)} className="block w-full border-t border-ink/15 px-3 py-2.5 text-left hover:bg-paper"><span className="block text-sm font-bold">{school.name}</span><span className="block text-xs text-ink/45">{school.domain} · {school.location}</span></button>)}</div>}
          {showSuggestions&&normalized&&matches.length===0&&<div id="profile-school-suggestions" className="absolute z-20 mt-1 w-full border-2 border-ink bg-white p-4 shadow-[6px_6px_0_#10243e]"><p className="font-bold">School not found</p><Link href={`/contact?school=${encodeURIComponent(schoolQuery)}`} className="mt-2 inline-block border-b border-forest text-sm font-bold text-forest">Request this school</Link></div>}
        </div>
        </>}
        {step===2&&<>
        <div><h2 className="font-editorial text-2xl font-bold">What is your major?</h2><p className="mt-1 text-sm text-ink/45">Start typing to search the available fields of study.</p></div>
        <div className="relative"><label htmlFor="profile-major" className="mb-1.5 block text-sm font-bold">Major</label><div className="flex h-11 items-center gap-2 border-2 border-ink px-3"><SearchIcon className="h-4 w-4 text-ink/40"/><input id="profile-major" value={major} onFocus={()=>setShowMajorSuggestions(true)} onChange={(event)=>{setMajor(event.target.value);setShowMajorSuggestions(true)}} placeholder="Search majors" autoComplete="off" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink/35"/></div>{showMajorSuggestions&&majorMatches.length>0&&<div className="absolute z-20 mt-1 w-full border-2 border-ink bg-white">{majorMatches.map((item)=><button key={item} type="button" onMouseDown={(event)=>event.preventDefault()} onClick={()=>{setMajor(item);setShowMajorSuggestions(false)}} className="block w-full border-b border-ink/15 px-3 py-2.5 text-left text-sm font-bold last:border-b-0 hover:bg-paper">{item}</button>)}</div>}</div>
        </>}
        {step===3&&<>
        <div><h2 className="font-editorial text-2xl font-bold">What year are you?</h2><p className="mt-1 text-sm text-ink/45">We use this to prioritize opportunities you can apply for now.</p></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{years.map(([label,value])=><button key={value} type="button" aria-pressed={year===value} onClick={()=>setYear(value)} className={`min-h-12 border px-3 text-sm font-bold ${year===value?"border-ink bg-ink text-white":"border-ink/20 hover:border-ink"}`}>{label}</button>)}</div>
        </>}
        {step===4&&<>
        <div><h2 className="font-editorial text-2xl font-bold">What are your goals?</h2><p className="mt-1 text-sm text-ink/45">Choose all that apply.</p></div>
        <ChoiceGrid options={goalOptions} selected={goals} onToggle={(value)=>toggle(value,goals,setGoals)}/>
        </>}
        {step===5&&<>
        <div><h2 className="font-editorial text-2xl font-bold">Which topics interest you most?</h2><p className="mt-1 text-sm text-ink/45">Choose all that apply. You can change these later.</p></div>
        <ChoiceGrid options={topicOptions} selected={topics} onToggle={(value)=>toggle(value,topics,setTopics)}/>
        </>}
        <div className="flex gap-3">{step>1&&<button type="button" onClick={()=>setStep(step-1)} className="min-h-12 border-2 border-ink px-5 text-sm font-bold uppercase tracking-wider">Back</button>}<button type="submit" className="flex min-h-12 flex-1 items-center justify-center gap-2 bg-ink px-5 text-sm font-bold uppercase tracking-wider text-white hover:bg-forest">{step===5?(initialProfile?"Save profile":"Build my dashboard"):"Continue"} <ArrowIcon /></button></div>
        <p className="text-xs leading-5 text-ink/40">Your selections stay in this browser. No account is required.</p>
      </form></div>
    </div></section>
  </>;
}

function ChoiceGrid({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return <div className="grid grid-cols-2 gap-2">{options.map((option)=><button key={option} type="button" aria-pressed={selected.includes(option)} onClick={()=>onToggle(option)} className={`min-h-11 border px-3 py-2 text-left text-sm font-bold ${selected.includes(option)?"border-ink bg-ink text-white":"border-ink/20 hover:border-ink"}`}>{option}</button>)}</div>;
}

function OnboardingComplete({ profile, onContinue }: { profile: StudentProfile; onContinue: () => void }) {
  const school = schools.find((item) => item.slug === profile.schoolSlug);
  return <main className="mx-auto grid min-h-[68vh] max-w-6xl place-items-center px-5 py-12 sm:px-8"><section className="w-full max-w-2xl border-y-2 border-ink bg-white px-5 py-10 text-center sm:px-10"><p className="rule-label text-trust">Profile complete</p><h1 className="mt-3 font-editorial text-4xl font-bold">Your personalized UnlockED dashboard is ready.</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-ink/55">Recommendations are now ranked for {school?.name}, {profile.major}, and your selected goals and interests.</p><button type="button" onClick={onContinue} className="mt-7 inline-flex min-h-12 items-center gap-2 bg-ink px-6 text-sm font-bold uppercase tracking-wider text-white hover:bg-forest">Open my dashboard <ArrowIcon/></button><p className="mt-4 text-xs text-ink/40">Your profile is stored only in this browser.</p></section></main>;
}

function StudentDashboard({ profile, onEdit }: { profile: StudentProfile; onEdit: () => void }) {
  const school = schools.find((item) => item.slug === profile.schoolSlug);
  if (!school) return null;
  const recommendationProfile: RecommendationProfile = { schoolSlug: school.slug, schoolName: school.name, schoolLocation: school.location, major: profile.major, minor: profile.minor, academicYear: profile.year, interests: profile.interests, careerGoals: profile.careerGoal, clubs: profile.clubs };
  const ranked = recommendedForYou(recommendationProfile, 4);
  const today = ranked[0];
  const recommended = ranked.slice(1, 4);
  const allRanked = rankOpportunities(recommendationProfile).filter(({opportunity}) => opportunity.verification_status !== "expired");
  const dashboardSections = [
    ["Best AI tool", "AI", "/ai"],
    ["Scholarship", "Scholarship", "/scholarships"],
    ["Career opportunity", "Career", "/career"],
    ["Research", "Research", "/research"],
  ].map(([label,type,href]) => ({ label, href, opportunity: allRanked.find((item) => item.opportunity.type === type)?.opportunity }));

  return <div className="mx-auto max-w-6xl border-x border-ink/20 bg-white px-5 py-5 sm:px-8">
    <section className="flex flex-col justify-between gap-3 border-b-2 border-ink pb-5 sm:flex-row sm:items-end"><div><p className="rule-label text-forest">Your UnlockED dashboard</p><h1 className="mt-2 font-editorial text-3xl font-bold sm:text-4xl">Welcome back.</h1><p className="mt-2 text-sm text-ink/50">{school.name} · Recommended because you’re a {profileSummary(profile)}.</p></div><button onClick={onEdit} className="self-start border-b border-ink pb-1 text-xs font-bold uppercase tracking-wider hover:text-forest sm:self-auto">Edit profile</button></section>
    <StudentAdvantageCard profile={profile} school={school}/>
    <div className="grid lg:grid-cols-[1.1fr_1.9fr]">
      <section className="border-b border-ink/20 py-5 lg:border-r lg:pr-6"><p className="rule-label text-forest">Today’s Best Opportunity</p>{today&&<Link href={`/opportunities/${today.opportunity.id}`} className="group block"><h2 className="mt-3 font-editorial text-2xl font-bold group-hover:text-forest">{today.opportunity.title}</h2><p className="mt-1 text-xs font-bold uppercase tracking-wider text-ink/35">{today.opportunity.organization}</p><p className="mt-3 line-clamp-2 text-sm leading-6 text-ink/55">{today.opportunity.description}</p><span className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider">View opportunity <ArrowIcon /></span></Link>}</section>
      <section className="border-b border-ink/20 py-5 lg:pl-6"><div className="flex items-end justify-between"><p className="rule-label text-forest">Recommended For You</p><Link href="/opportunities" className="text-xs font-bold uppercase tracking-wider">View all</Link></div><div className="mt-3 grid sm:grid-cols-3">{recommended.map(({opportunity})=><Link key={opportunity.id} href={`/opportunities/${opportunity.id}`} className="group border-t border-ink/15 py-3 sm:border-l sm:border-t-0 sm:px-4 sm:first:border-l-0 sm:first:pl-0"><p className="rule-label text-ink/35">{opportunity.type}</p><h3 className="mt-2 font-editorial text-lg font-bold leading-tight group-hover:text-forest">{opportunity.title}</h3><p className="mt-2 text-xs text-ink/40">{opportunity.organization}</p></Link>)}</div></section>
    </div>
    <div className="grid lg:grid-cols-[1.9fr_1.1fr]">
      <section className="border-b border-ink/20 py-5 lg:border-r lg:pr-6"><div className="flex items-end justify-between"><p className="rule-label text-forest">Built around your profile</p><Link href="/opportunities" className="text-xs font-bold uppercase tracking-wider">Browse all</Link></div><div className="mt-3 grid border-l border-t border-ink/15 sm:grid-cols-2">{dashboardSections.map(({label,href,opportunity})=><Link key={label} href={opportunity?`/opportunities/${opportunity.id}`:href} className="group border-b border-r border-ink/15 px-3 py-3 hover:bg-paper"><p className="rule-label text-ink/35">{label}</p><p className="mt-1 text-sm font-bold leading-tight group-hover:text-forest">{opportunity?.title??"Browse verified opportunities"}</p></Link>)}</div></section>
      <section className="border-b border-ink/20 py-5 lg:pl-6"><WhatsNewFeed limit={5} /></section>
    </div>
  </div>;
}
