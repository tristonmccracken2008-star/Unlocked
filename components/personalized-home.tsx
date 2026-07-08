"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { schools, type School } from "@/data/seed";
import { findExactSchoolMatches, findSchoolMatches, normalizeSchoolQuery } from "@/data/school-search";
import { ArrowIcon, SearchIcon } from "./icons";
import { readStudentProfile, studentProfileStorageKey, writeStudentProfile, type StudentProfile } from "@/data/student-profile";
import { accountSessionEvent, accountSyncErrorEvent, hydrateAccountData } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";
import { rankOpportunities, recommendedForYou, type RecommendationProfile } from "@/data/recommendations";
import { opportunities, opportunityMajors } from "@/data/opportunities";
import { StudentAdvantageCard } from "./student-advantage-card";
import { WhatsNewFeed } from "./whats-new-feed";
import { SaveOpportunityButton } from "./opportunity-activity";
import { MyJourneyCard } from "./my-journey-card";

const years = [["Freshman", "First year"], ["Sophomore", "Second year"], ["Junior", "Third year"], ["Senior", "Fourth year"], ["Graduate", "Graduate student"]] as const;
const goalOptions = ["Get internships", "Save money", "Find research", "Learn AI", "Build coding skills", "Prepare for graduate school", "Prepare for quant finance", "Start a business", "Networking"];
const topicOptions = ["AI", "Finance", "Computer Science", "Math", "Engineering", "Business", "Medicine", "Startups", "Investing", "Robotics", "Economics"];
const guestPreview = [...opportunities].filter((item)=>item.verification_status==="verified_recently").sort((a,b)=>Number(b.featured)-Number(a.featured)||b.last_verified.localeCompare(a.last_verified)||a.title.localeCompare(b.title)).slice(0,4);

export function PersonalizedHome() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [session, setSession] = useState<AccountSession | null>(null);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setSyncError("");
      try {
        const nextSession = await hydrateAccountData();
        if (!active) return;
        setSession(nextSession);
        const parsed = readStudentProfile();
        if (parsed && schools.some((school) => school.slug === parsed.schoolSlug)) setProfile(parsed);
      } catch {
        if (!active) return;
        setSyncError("Account data could not be loaded. Using local guest data for now.");
        try {
          const parsed = readStudentProfile();
          if (parsed && schools.some((school) => school.slug === parsed.schoolSlug)) setProfile(parsed);
        } catch { localStorage.removeItem(studentProfileStorageKey); }
      } finally {
        if (active) setReady(true);
      }
    };
    const onSession = (event: Event) => { const next = (event as CustomEvent<AccountSession>).detail; setSession(next); const parsed = readStudentProfile(); if (parsed && schools.some((school) => school.slug === parsed.schoolSlug)) setProfile(parsed); };
    const onSyncError = (event: Event) => setSyncError((event as CustomEvent<string>).detail);
    window.addEventListener(accountSessionEvent, onSession);
    window.addEventListener(accountSyncErrorEvent, onSyncError);
    void load();
    return () => { active = false; window.removeEventListener(accountSessionEvent, onSession); window.removeEventListener(accountSyncErrorEvent, onSyncError); };
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
  if (!ready) return <div className="min-h-[64vh] px-5 py-16 sm:px-8"><div className="mx-auto max-w-5xl"><p className="rule-label text-forest">Find My Opportunities</p><h1 className="mt-3 font-editorial text-4xl font-bold">Your college advantage starts here.</h1><p className="mt-3 text-sm text-ink/45">Checking for synced profile and opportunity progress.</p></div></div>;
  if (!profile || editing) return <StudentSetup initialProfile={profile} onSave={save} onCancel={profile ? () => setEditing(false) : undefined} />;
  if (justCompleted) return <OnboardingComplete profile={profile} onContinue={() => setJustCompleted(false)} />;
  return <StudentDashboard profile={profile} onEdit={() => setEditing(true)} session={session} syncError={syncError} />;
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
        <div><h2 className="font-editorial text-2xl font-bold">What school do you attend?</h2><p className="mt-1.5 max-w-md text-sm leading-6 text-ink/45">Choose your school so we can prioritize relevant opportunities.</p></div>
        <div className="relative pt-1"><label htmlFor="profile-school" className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink/60">School or university</label><div className={`flex h-13 items-center gap-3 border bg-paper/40 px-4 transition-colors focus-within:border-forest focus-within:bg-white ${selectedSchool?"border-forest":"border-ink/25"}`}><SearchIcon className="h-4 w-4 shrink-0 text-ink/35"/><input id="profile-school" value={schoolQuery} onFocus={()=>setShowSuggestions(true)} onChange={(event)=>{setSchoolQuery(event.target.value);setSelectedSchool(null);setShowSuggestions(true)}} placeholder="Try UChicago, University of Michigan, or umich.edu" autoComplete="off" aria-controls="profile-school-suggestions" aria-expanded={showSuggestions&&Boolean(normalized)} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink/30"/></div>
          {showSuggestions&&normalized&&matches.length>0&&<div id="profile-school-suggestions" role="listbox" aria-label="Matching schools" className="absolute z-20 mt-1 w-full border-2 border-ink bg-white shadow-[6px_6px_0_#10243e]"><p className="px-3 py-2 rule-label text-ink/40">Top matches</p>{matches.map((school)=><button key={school.slug} type="button" role="option" aria-selected={school.slug===selectedSchool?.slug} onMouseDown={(event)=>event.preventDefault()} onClick={()=>choose(school)} className="block w-full border-t border-ink/15 px-3 py-2.5 text-left hover:bg-paper"><span className="block text-sm font-bold">{school.name}</span><span className="block text-xs text-ink/45">{school.domain} · {school.location}</span></button>)}</div>}
          {showSuggestions&&normalized&&matches.length===0&&<div id="profile-school-suggestions" className="absolute z-20 mt-1 w-full border-2 border-ink bg-white p-4 shadow-[6px_6px_0_#10243e]"><p className="font-bold">School not found</p><Link href={`/contact?school=${encodeURIComponent(schoolQuery)}`} className="mt-2 inline-block border-b border-forest text-sm font-bold text-forest">Request this school</Link></div>}
          <p className={`mt-2.5 text-xs leading-5 ${selectedSchool?"font-bold text-forest":"text-ink/40"}`}>{selectedSchool?`${selectedSchool.name} selected`:(schoolQuery?"Select a school from the suggestions before continuing.":"Start typing, then select your school from the suggestions.")}</p>
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
        <div className="flex gap-3 pt-1">{step>1&&<button type="button" onClick={()=>setStep(step-1)} className="min-h-12 border-2 border-ink px-5 text-sm font-bold uppercase tracking-wider">Back</button>}<button type="submit" className="flex min-h-12 flex-1 items-center justify-center gap-2 bg-ink px-6 text-sm font-bold uppercase tracking-[.12em] text-white shadow-[0_6px_18px_rgba(16,36,62,.12)] transition-colors hover:bg-forest">{step===5?(initialProfile?"Save profile":"Build my dashboard"):"Continue"} <ArrowIcon /></button></div>
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
  if (!school) return null;
  const recommendationProfile: RecommendationProfile = { schoolSlug: school.slug, schoolName: school.name, schoolLocation: school.location, major: profile.major, academicYear: profile.year, interests: profile.interests, careerGoals: profile.careerGoal };
  const matches = rankOpportunities(recommendationProfile).filter(({opportunity,score}) => score > 0 && opportunity.verification_status !== "expired");
  const top = matches.slice(0,3);
  const totalValue = matches.filter(({opportunity}) => opportunity.verification_status === "verified_recently" && typeof opportunity.estimated_value === "number").reduce((sum,{opportunity}) => sum + (opportunity.estimated_value ?? 0),0);
  const money = new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});
  return <main className="mx-auto min-h-[72vh] max-w-5xl px-5 py-10 sm:px-8 sm:py-14"><section className="border-y border-ink/20 bg-white px-5 py-9 sm:px-10 sm:py-12"><div className="mx-auto max-w-3xl text-center"><p className="text-2xl" aria-hidden="true">🎉</p><h1 className="mt-3 font-editorial text-4xl font-bold leading-tight sm:text-5xl">Your personalized dashboard is ready.</h1><p className="mx-auto mt-4 max-w-xl text-base leading-7 text-ink/55">We found <strong className="text-ink">{matches.length} opportunities</strong> based on your school, major, year, and goals.</p></div>
    <dl className="mx-auto mt-8 grid max-w-3xl border-y border-ink/15 py-4 sm:grid-cols-2"><div className="px-4 py-2"><dt className="rule-label text-ink/35">Your profile</dt><dd className="mt-2 text-sm font-bold">{school.name} · {profile.major} · {profile.year}</dd><dd className="mt-1 line-clamp-2 text-xs leading-5 text-ink/45">{profile.goals?.join(" · ") || profile.careerGoal}</dd></div><div className="border-t border-ink/15 px-4 py-2 sm:border-l sm:border-t-0"><dt className="rule-label text-ink/35">Documented value available</dt><dd className="mt-2 font-editorial text-3xl font-bold text-forest">{money.format(totalValue)}+</dd><dd className="mt-1 text-xs text-ink/40">Verified matches with known values only.</dd></div></dl>
    <div className="mx-auto mt-8 max-w-3xl"><p className="rule-label text-forest">Top recommendations</p><div className="mt-2 divide-y divide-ink/15 border-y border-ink/15">{top.map(({opportunity},index)=><div key={opportunity.id} className="grid grid-cols-[28px_1fr_auto] items-center gap-3 py-3"><span className="font-mono text-xs text-ink/30">0{index+1}</span><div><p className="font-bold">{opportunity.title}</p><p className="mt-1 text-xs text-ink/40">{opportunity.type} · {opportunity.organization}</p></div><span className="rule-label text-trust">Verified</span></div>)}</div></div>
    <div className="mt-8 text-center"><button type="button" onClick={onContinue} className="inline-flex min-h-12 items-center gap-2 bg-ink px-7 text-sm font-bold uppercase tracking-wider text-white hover:bg-forest">Start Exploring My Dashboard <ArrowIcon/></button><p className="mt-4 text-xs text-ink/40">Your profile is stored only in this browser.</p></div>
  </section></main>;
}

function StudentDashboard({ profile, onEdit, session, syncError }: { profile: StudentProfile; onEdit: () => void; session: AccountSession | null; syncError: string }) {
  const school = schools.find((item) => item.slug === profile.schoolSlug);
  if (!school) return null;
  const recommendationProfile: RecommendationProfile = { schoolSlug: school.slug, schoolName: school.name, schoolLocation: school.location, major: profile.major, minor: profile.minor, academicYear: profile.year, interests: profile.interests, careerGoals: profile.careerGoal, clubs: profile.clubs };
  const rankedRecommendations = recommendedForYou(recommendationProfile, 4);
  const focus = rankedRecommendations[0];
  const recommended = rankedRecommendations.slice(1, 4);
  const allRanked = rankOpportunities(recommendationProfile).filter(({opportunity,score}) => opportunity.verification_status !== "expired" && score > 0);
  const verifiedMatches = allRanked.filter(({opportunity}) => opportunity.verification_status === "verified_recently");
  const documentedValue = verifiedMatches.reduce((sum,{opportunity}) => sum + (opportunity.estimated_value ?? 0), 0);
  const dashboardSections = [
    ["Best AI tool", "AI", "/ai"],
    ["Scholarship", "Scholarship", "/scholarships"],
    ["Career opportunity", "Career", "/career"],
    ["Research", "Research", "/research"],
  ].map(([label,type,href]) => ({ label, href, opportunity: allRanked.find((item) => item.opportunity.type === type)?.opportunity }));

  const money = new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});
  const valueLabel = (value:number|null) => value ? `${money.format(value)}+` : "Value not published";
  const dashboardInsight = verifiedMatches.length > 100
    ? "You have a broad range of verified options—start with the strongest match today."
    : verifiedMatches.length > 25
      ? "Your profile has several strong matches. One focused step today will move you forward."
      : "Your best next step is ready. Start there, then explore the wider match list.";
  const quickActions = [["Find Scholarships","/scholarships"],["Find AI Tools","/ai"],["Find Research","/research"],["Find Internships","/career"]];
  return <div className="mx-auto max-w-6xl bg-white px-5 py-14 sm:px-8 sm:py-20">
    <section className="pb-20 sm:pb-24">{focus&&<><div className="flex flex-col gap-8 pb-10 sm:pb-12 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex flex-wrap items-center gap-x-5 gap-y-2"><p className="rule-label text-forest">Your dashboard</p><button onClick={onEdit} className="text-xs font-bold uppercase tracking-wider text-ink/35 hover:text-forest">Edit profile</button></div><h1 className="mt-5 font-editorial text-4xl font-bold leading-tight tracking-[-.04em] sm:text-6xl">Welcome back.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-ink/50">{dashboardInsight}</p><p className="mt-4 text-xs font-bold uppercase tracking-wider text-ink/35">{school.name} · {profile.major} · {profile.year}</p><p className={`mt-3 text-xs font-bold ${session?.authenticated ? "text-trust" : "text-ink/40"}`}>{session?.authenticated ? "Your dashboard is synced." : "Sign in to save your dashboard across devices."}</p>{syncError&&<p className="mt-2 text-xs font-bold text-red-700">{syncError}</p>}</div><dl className="grid grid-cols-2 gap-x-8 border-y border-ink/15 py-4 sm:gap-x-12 lg:min-w-[360px]"><div><dt className="rule-label text-ink/35">Verified matches</dt><dd className="mt-2 font-editorial text-3xl font-bold text-ink">{verifiedMatches.length}</dd></div><div><dt className="rule-label text-ink/35">Documented value</dt><dd className="mt-2 font-editorial text-3xl font-bold text-forest">{documentedValue ? `${money.format(documentedValue)}+` : "Unknown"}</dd></div></dl></div><div className="relative overflow-hidden bg-paper px-6 py-9 shadow-[0_18px_50px_rgba(16,36,62,.07)] sm:px-10 sm:py-12"><span className="absolute inset-y-0 left-0 w-1 bg-gold" aria-hidden="true"/><div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-end"><div><p className="rule-label text-forest">Today’s Focus</p><p className="mt-7 text-xs font-bold uppercase tracking-wider text-ink/30">{focus.opportunity.organization}</p><h2 className="mt-3 max-w-4xl font-editorial text-4xl font-bold leading-[1.06] tracking-[-.04em] sm:text-5xl lg:text-6xl">{focus.opportunity.title}</h2><p className="mt-6 max-w-2xl text-base leading-8 text-ink/50">{focus.reasons[0]?`Selected because it is a ${focus.reasons[0].toLowerCase()}.`:"Selected because it closely matches your school, major, year, and interests."}</p></div><div><p className="rule-label text-ink/30">Estimated value</p><p className="mt-2 font-editorial text-3xl font-bold text-forest">{valueLabel(focus.opportunity.estimated_value)}</p><Link href={`/opportunities/${focus.opportunity.id}`} className="mt-7 flex min-h-12 items-center justify-center bg-ink px-5 text-xs font-bold uppercase tracking-wider text-white hover:bg-forest">Explore Opportunity</Link></div></div></div></>}
    </section>
    <StudentAdvantageCard profile={profile} school={school}/>
    <section className="py-20" aria-labelledby="dashboard-recommendations"><div className="flex items-end justify-between gap-4"><div><p className="rule-label text-forest">Selected for your profile</p><h2 id="dashboard-recommendations" className="mt-3 font-editorial text-3xl font-bold tracking-[-.02em] sm:text-4xl">Recommended For You</h2></div><Link href="/opportunities" className="text-xs font-bold uppercase tracking-wider text-ink/45 hover:text-forest">View all</Link></div><div className="mt-9 grid gap-7 lg:grid-cols-3">{recommended.map(({opportunity,reasons})=><article key={opportunity.id} className="flex min-h-72 flex-col bg-white p-7 shadow-[0_10px_32px_rgba(16,36,62,.06)]"><div><p className="rule-label text-forest">{opportunity.type}</p><h3 className="mt-4 font-editorial text-2xl font-bold leading-tight tracking-[-.015em]">{opportunity.title}</h3><p className="mt-2 text-xs font-bold uppercase tracking-wider text-ink/30">{opportunity.organization}</p></div><div className="mt-6"><p className="rule-label text-ink/30">Estimated value</p><p className="mt-1 text-sm font-bold">{valueLabel(opportunity.estimated_value)}</p><p className="mt-5 line-clamp-2 text-sm leading-7 text-ink/45">{reasons[0] ? `Recommended because it is a ${reasons[0].toLowerCase()}.` : "Recommended based on your school, major, year, and interests."}</p></div><div className="mt-auto flex items-center gap-3 pt-7"><Link href={`/opportunities/${opportunity.id}`} className="flex min-h-11 flex-1 items-center justify-center gap-2 bg-ink px-4 text-xs font-bold uppercase tracking-wider text-white hover:bg-forest">View details <ArrowIcon/></Link><SaveOpportunityButton opportunityId={opportunity.id} className="px-3 text-ink/55 hover:text-forest"/></div></article>)}</div></section>
    <nav aria-label="Quick actions" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{quickActions.map(([label,href])=><Link key={href} href={href} className="group flex min-h-16 items-center justify-between bg-paper px-4 text-sm font-bold text-ink/65 hover:bg-white hover:text-forest">{label}<ArrowIcon className="h-4 w-4 text-ink/25 group-hover:text-forest"/></Link>)}</nav>
    <MyJourneyCard profile={profile}/>
    <details className="group border-b border-ink/15 py-5"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold"><span>More from your personalized dashboard</span><span className="text-xl font-normal text-ink/40 group-open:rotate-45">+</span></summary><div className="mt-6 grid gap-8 lg:grid-cols-[1.9fr_1.1fr]"><section><div className="flex items-end justify-between"><p className="rule-label text-forest">Built around your profile</p><Link href="/opportunities" className="text-xs font-bold uppercase tracking-wider">Browse all</Link></div><div className="mt-3 grid border-l border-t border-ink/15 sm:grid-cols-2">{dashboardSections.map(({label,href,opportunity})=><Link key={label} href={opportunity?`/opportunities/${opportunity.id}`:href} className="group/item border-b border-r border-ink/15 px-3 py-3 hover:bg-paper"><p className="rule-label text-ink/35">{label}</p><p className="mt-1 text-sm font-bold leading-tight group-hover/item:text-forest">{opportunity?.title??"Browse verified opportunities"}</p></Link>)}</div></section><section><WhatsNewFeed limit={5} /></section></div></details>
  </div>;
}
