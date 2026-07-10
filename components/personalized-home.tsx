"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { schools, type School } from "@/data/seed";
import { findExactSchoolMatches, findSchoolMatches, normalizeSchoolQuery } from "@/data/school-search";
import { ArrowIcon, SearchIcon } from "./icons";
import { readCompletedStudentProfile, writeStudentProfile, type StudentProfile } from "@/data/student-profile";
import { accountSessionEvent, accountSyncErrorEvent, clearLocalDashboardState, hydrateAccountData } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";
import { expiringSoonOpportunities, recommendedForYou, type RecommendationProfile } from "@/data/recommendations";
import { deadlineLabel, opportunities, opportunityMajors, type Opportunity } from "@/data/opportunities";
import { readStudentActivity, studentActivityEvent, type StudentActivity } from "@/data/student-activity";
import { SaveOpportunityButton } from "./opportunity-activity";
import { trackProductEvent } from "@/data/product-analytics";
import { createAdvisorProfile, runAdvisorEngine, type AdvisorEngineResult } from "@/data/advisor-engine";
import { getRoadmap } from "@/data/roadmap-engine";
import { inferApplicationsFromActivity, readStudentProgress, studentProgressEvent, type StudentProgress } from "@/data/student-progress";
import { getMilestoneForAdvisor, type Milestone } from "@/data/milestone-engine";
import { buildAdvisorTimeline } from "@/data/advisor-timeline";
import type { AdvisorAction, AdvisorOutput, FeedbackType, RankedAdvisorOpportunity, RecommendationCoaching } from "@/lib/advisor/types";

const graduationYears = Array.from({ length: 9 }, (_, index) => String(new Date().getFullYear() + index));
const interestSuggestions = ["Scholarships", "Research", "Internships", "AI", "Software", "Startups", "Finance", "Medicine", "Engineering"];
const careerGoalSuggestions = ["Get an internship", "Find funding", "Join a research lab", "Build technical skills", "Prepare for graduate school", "Explore careers"];

function academicYearFromGraduationYear(value: string) {
  const gradYear = Number(value);
  if (!Number.isFinite(gradYear)) return "Graduate student";
  const yearsUntilGraduation = gradYear - new Date().getFullYear();
  if (yearsUntilGraduation >= 4) return "First year";
  if (yearsUntilGraduation === 3) return "Second year";
  if (yearsUntilGraduation === 2) return "Third year";
  if (yearsUntilGraduation === 1) return "Fourth year";
  return "Graduate student";
}

function displayName(profile: StudentProfile, session: AccountSession | null) {
  return profile.firstName?.trim() || session?.user?.name?.split(" ")[0] || "there";
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function recommendationProfile(profile: StudentProfile, school: School, activity?: StudentActivity): RecommendationProfile {
  return { schoolSlug: school.slug, schoolName: school.name, schoolLocation: school.location, major: profile.major, minor: profile.minor, academicYear: profile.year, interests: profile.interests, careerGoals: profile.careerGoal, clubs: profile.clubs, savedOpportunityIds: activity?.saved, viewedOpportunityIds: activity?.viewed };
}

export function PersonalizedHome() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [session, setSession] = useState<AccountSession | null>(null);
  const [syncError, setSyncError] = useState("");
  const trackedView = useRef("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setSyncError("");
      try {
        const nextSession = await hydrateAccountData();
        if (!active) return;
        setSession(nextSession);
        if (nextSession.authenticated) {
          const parsed = readCompletedStudentProfile();
          setProfile(parsed && schools.some((school) => school.slug === parsed.schoolSlug) ? parsed : null);
        } else setProfile(null);
      } catch {
        if (!active) return;
        setSyncError("We could not verify your account. Please sign in again.");
        setSession({ authenticated: false, user: null, data: null });
        setProfile(null);
      } finally {
        if (active) setReady(true);
      }
    };
    const onSession = (event: Event) => {
      const next = (event as CustomEvent<AccountSession>).detail;
      setSession(next);
      if (!next.authenticated) {
        clearLocalDashboardState();
        setProfile(null);
        return;
      }
      const parsed = readCompletedStudentProfile();
      setProfile(parsed && schools.some((school) => school.slug === parsed.schoolSlug) ? parsed : null);
    };
    const onSyncError = (event: Event) => setSyncError((event as CustomEvent<string>).detail);
    window.addEventListener(accountSessionEvent, onSession);
    window.addEventListener(accountSyncErrorEvent, onSyncError);
    void load();
    return () => { active = false; window.removeEventListener(accountSessionEvent, onSession); window.removeEventListener(accountSyncErrorEvent, onSyncError); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const view = profile ? "dashboard" : !session?.authenticated ? "homepage" : "onboarding";
    if (trackedView.current === view) return;
    trackedView.current = view;
    trackProductEvent(view === "dashboard" ? "dashboard_visit" : view === "homepage" ? "homepage_visit" : "page_visit");
  }, [profile, ready, session?.authenticated]);

  async function save(next: StudentProfile) {
    await writeStudentProfile(next);
    setProfile(next);
    trackProductEvent("onboarding_completed", { searchType: "school", searchValue: next.schoolSlug });
  }

  if (!ready) return <WorkspaceLoading />;
  if (!session?.authenticated) return <LoggedOutLanding />;
  if (!profile) return <AdvisorInterview session={session} onSave={save} />;
  return <StudentDashboard profile={profile} session={session} syncError={syncError} />;
}

function WorkspaceLoading() {
  return <main className="min-h-[64vh] px-5 py-20 sm:px-8"><div className="mx-auto max-w-5xl"><p className="rule-label text-forest">UnlockED</p><h1 className="mt-4 font-editorial text-5xl font-bold tracking-[-.04em]">Preparing your workspace.</h1><p className="mt-4 text-sm text-ink/45">Checking your account and saved profile.</p></div></main>;
}

function LoggedOutLanding() {
  const [authIssue, setAuthIssue] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth");
    if (auth === "unavailable") setAuthIssue("Google sign-in is temporarily unavailable. Please try again in a moment.");
    if (auth === "failed") setAuthIssue("Sign-in could not be completed. Please try again.");
    if (auth === "unavailable" || auth === "failed") {
      params.delete("auth");
      const query = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
  }, []);
  return <main className="bg-paper">
    <section className="px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
        <div className="max-w-5xl">
          <p className="rule-label text-forest">College opportunities, finally in one place</p>
          <h1 className="mt-6 max-w-5xl font-editorial text-6xl font-bold leading-[.96] tracking-[-.055em] text-ink sm:text-8xl">Find what college forgot to tell you about.</h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-ink/60">UnlockED turns scattered scholarships, research, internships, AI tools, student benefits, and career resources into a quiet dashboard built around you.</p>
          <p className="mt-5 max-w-xl text-sm leading-7 text-ink/45">Sign in with Google, complete one short profile, and start with the opportunities most likely to matter.</p>
          {authIssue && <div role="alert" className="mt-7 max-w-2xl rounded-2xl border border-red-700/20 bg-white px-5 py-4 text-sm font-bold leading-6 text-red-700">{authIssue}</div>}
        </div>
        <div className="rounded-[2rem] bg-white/75 p-4 shadow-soft ring-1 ring-ink/8">
          <div className="rounded-[1.4rem] bg-paper p-5">
            <div className="flex items-center justify-between border-b border-ink/10 pb-4"><p className="rule-label text-forest">Today</p><span className="text-xs font-bold text-ink/35">Verified</span></div>
            <div className="py-6">
              <p className="text-xs font-bold uppercase tracking-wider text-ink/35">Best match</p>
              <h2 className="mt-3 font-editorial text-3xl font-bold leading-tight">A scholarship, internship, or tool you would have missed.</h2>
              <p className="mt-4 text-sm leading-6 text-ink/50">Ranked by your school, major, year, and goals. Always linked back to the official source.</p>
            </div>
            <div className="grid gap-2 border-t border-ink/10 pt-4 text-sm">
              {["Recommended for you","Saved opportunities","Upcoming deadlines"].map((item)=><div key={item} className="flex items-center justify-between rounded-full bg-white px-4 py-3"><span className="font-bold">{item}</span><span className="text-forest">→</span></div>)}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-16 grid max-w-7xl gap-8 border-t border-ink/10 pt-10 md:grid-cols-3">
        <section><p className="rule-label text-forest">Simple</p><p className="mt-3 text-sm leading-7 text-ink/55">One dashboard. One best next step. No noisy checklist.</p></section>
        <section><p className="rule-label text-forest">Personal</p><p className="mt-3 text-sm leading-7 text-ink/55">Recommendations follow your school, major, graduation year, and goals.</p></section>
        <section><p className="rule-label text-forest">Sourced</p><p className="mt-3 text-sm leading-7 text-ink/55">Listings point to official sources with verification context.</p></section>
      </div>
    </section>
  </main>;
}

const interviewCareerGoals = ["Software Engineering", "Medicine", "Law", "Research", "Graduate School", "Investment Banking", "Consulting", "Entrepreneurship", "Undecided"];
const interviewExperience = ["No experience", "Some projects", "Research", "Internship", "Leadership", "Work experience"];
const interviewInterests = ["AI", "Finance", "Healthcare", "Robotics", "Climate", "Education", "Public Policy", "Startups"];
const interviewGoals = ["Find internship", "Join research", "Win scholarships", "Build resume", "Network", "Learn skills", "Explore careers"];
const interviewAvailability = ["1-2 hours/week", "3-5 hours/week", "6-10 hours/week", "10+ hours/week"];
const interviewOpportunityTypes = ["Scholarships", "Research", "Internships", "Competitions", "Study Abroad", "Leadership", "Fellowships", "Campus Jobs"];

function AdvisorInterview({ session, onSave }: { session: AccountSession | null; onSave: (profile: StudentProfile) => void | Promise<void> }) {
  const nameParts = session?.user?.name?.split(" ").filter(Boolean) ?? [];
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState(nameParts[0] ?? "");
  const [lastName, setLastName] = useState(nameParts.slice(1).join(" "));
  const [schoolQuery, setSchoolQuery] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [major, setMajor] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [careerGoal, setCareerGoal] = useState("");
  const [currentExperience, setCurrentExperience] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [primaryGoals, setPrimaryGoals] = useState<string[]>([]);
  const [weeklyAvailability, setWeeklyAvailability] = useState("");
  const [preferredOpportunityTypes, setPreferredOpportunityTypes] = useState<string[]>([]);
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const [showMajorSuggestions, setShowMajorSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const normalizedSchool = normalizeSchoolQuery(schoolQuery);
  const schoolMatches = useMemo(() => findSchoolMatches(schools, schoolQuery, 5), [schoolQuery]);
  const majorMatches = useMemo(() => opportunityMajors.filter((item) => item !== "All" && item !== "Any Major" && item.toLowerCase().includes(major.trim().toLowerCase())).slice(0, 6), [major]);
  const totalSteps = 10;

  function toggle(value: string, values: string[], update: (next: string[]) => void) {
    update(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  function valid(index = step) {
    if (index === 0) return Boolean(firstName.trim());
    if (index === 1) return Boolean(selectedSchool);
    if (index === 2) return Boolean(major.trim());
    if (index === 3) return Boolean(graduationYear);
    if (index === 4) return Boolean(careerGoal);
    if (index === 5) return Boolean(currentExperience);
    if (index === 6) return interests.length > 0;
    if (index === 7) return primaryGoals.length > 0;
    if (index === 8) return Boolean(weeklyAvailability);
    if (index === 9) return preferredOpportunityTypes.length > 0;
    return true;
  }

  async function finish() {
    if (!selectedSchool || !valid(9)) return;
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    await onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      schoolSlug: selectedSchool.slug,
      major: major.trim(),
      graduationYear,
      year: academicYearFromGraduationYear(graduationYear),
      careerGoal,
      interests: interests.join(", "),
      currentExperience,
      weeklyAvailability,
      preferredOpportunityTypes,
      goals: primaryGoals,
      topics: interests,
      advisorInterview: { careerGoal, currentExperience, interests, primaryGoals, weeklyAvailability, preferredOpportunityTypes, completedAt: new Date().toISOString() },
    });
  }

  function next() {
    if (!valid()) { setError("Answer this question to continue."); return; }
    setError("");
    if (step === totalSteps - 1) void finish();
    else setStep((value) => Math.min(value + 1, totalSteps - 1));
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && !(event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); next(); }
    if (event.key === "Escape" && step > 0) setStep((value) => value - 1);
  }

  const progress = ((step + 1) / totalSteps) * 100;

  if (saving) return <main className="min-h-[68vh] px-5 py-20 sm:px-8"><section className="mx-auto max-w-3xl text-center"><p className="rule-label text-forest">Advisor Interview</p><h1 className="mt-5 font-editorial text-5xl font-bold tracking-[-.045em] sm:text-7xl">We&apos;re building your personalized advisor.</h1><div className="mx-auto mt-10 h-2 w-36 overflow-hidden rounded-full bg-paper"><div className="h-full w-1/2 animate-pulse rounded-full bg-forest" /></div><p className="mt-5 text-sm text-ink/45">Turning your answers into a focused dashboard.</p></section></main>;

  return <main className="min-h-[72vh] px-5 py-10 sm:px-8 sm:py-14" onKeyDown={onKeyDown}>
    <section className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <p className="rule-label text-forest">Advisor Interview</p>
        <p className="text-xs font-bold text-ink/35">{step + 1} / {totalSteps}</p>
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-forest transition-all duration-300" style={{ width: `${progress}%` }} /></div>
      <div key={step} className="min-h-[430px] py-12 transition-opacity duration-300">
        {step === 0 && <InterviewQuestion eyebrow="Your name" title="What should UnlockED call you?"><div className="grid gap-4 sm:grid-cols-2"><input autoFocus value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First name" className="min-h-14 border-b border-ink/20 bg-transparent text-2xl font-bold outline-none placeholder:text-ink/25 focus:border-forest"/><input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Last name optional" className="min-h-14 border-b border-ink/20 bg-transparent text-2xl font-bold outline-none placeholder:text-ink/25 focus:border-forest"/></div></InterviewQuestion>}
        {step === 1 && <InterviewQuestion eyebrow="School" title="Where are you studying?"><div className="relative"><input autoFocus value={schoolQuery} onFocus={() => setShowSchoolSuggestions(true)} onChange={(event) => { setSchoolQuery(event.target.value); setSelectedSchool(null); setShowSchoolSuggestions(true); }} placeholder="Search your school" className="min-h-14 w-full border-b border-ink/20 bg-transparent text-2xl font-bold outline-none placeholder:text-ink/25 focus:border-forest"/>{showSchoolSuggestions && normalizedSchool && <div className="absolute z-20 mt-3 w-full rounded-2xl border border-ink/10 bg-white shadow-soft">{schoolMatches.length ? schoolMatches.map((school) => <button key={school.slug} type="button" onClick={() => { setSelectedSchool(school); setSchoolQuery(school.name); setShowSchoolSuggestions(false); }} className="block w-full border-b border-ink/10 px-5 py-4 text-left last:border-b-0 hover:bg-paper"><span className="block font-bold">{school.name}</span><span className="text-xs text-ink/40">{school.location} · {school.domain}</span></button>) : <p className="px-5 py-4 text-sm text-ink/45">No supported school found yet.</p>}</div>}</div></InterviewQuestion>}
        {step === 2 && <InterviewQuestion eyebrow="Major" title="What are you studying?"><div className="relative"><input autoFocus value={major} onFocus={() => setShowMajorSuggestions(true)} onChange={(event) => { setMajor(event.target.value); setShowMajorSuggestions(true); }} placeholder="Computer Science, Finance, Biology..." className="min-h-14 w-full border-b border-ink/20 bg-transparent text-2xl font-bold outline-none placeholder:text-ink/25 focus:border-forest"/>{showMajorSuggestions && major.trim() && majorMatches.length > 0 && <div className="absolute z-20 mt-3 w-full rounded-2xl border border-ink/10 bg-white shadow-soft">{majorMatches.map((item) => <button key={item} type="button" onClick={() => { setMajor(item); setShowMajorSuggestions(false); }} className="block w-full border-b border-ink/10 px-5 py-4 text-left font-bold last:border-b-0 hover:bg-paper">{item}</button>)}</div>}</div></InterviewQuestion>}
        {step === 3 && <InterviewQuestion eyebrow="Timeline" title="When do you expect to graduate?"><div className="grid gap-2 sm:grid-cols-3">{graduationYears.map((year) => <Choice key={year} selected={graduationYear === year} onClick={() => setGraduationYear(year)}>{year}</Choice>)}</div></InterviewQuestion>}
        {step === 4 && <InterviewQuestion eyebrow="Direction" title="What career direction feels most relevant right now?"><ChoiceGrid options={interviewCareerGoals} value={careerGoal} setValue={setCareerGoal} /></InterviewQuestion>}
        {step === 5 && <InterviewQuestion eyebrow="Experience" title="What experience are you bringing in?"><ChoiceGrid options={interviewExperience} value={currentExperience} setValue={setCurrentExperience} /></InterviewQuestion>}
        {step === 6 && <InterviewQuestion eyebrow="Interests" title="What topics should your advisor pay attention to?"><MultiChoiceGrid options={interviewInterests} values={interests} toggle={(value) => toggle(value, interests, setInterests)} /></InterviewQuestion>}
        {step === 7 && <InterviewQuestion eyebrow="This year" title="What do you want to make progress on first?"><MultiChoiceGrid options={interviewGoals} values={primaryGoals} toggle={(value) => toggle(value, primaryGoals, setPrimaryGoals)} /></InterviewQuestion>}
        {step === 8 && <InterviewQuestion eyebrow="Time" title="How much time can you realistically spend each week?"><ChoiceGrid options={interviewAvailability} value={weeklyAvailability} setValue={setWeeklyAvailability} /></InterviewQuestion>}
        {step === 9 && <InterviewQuestion eyebrow="Opportunities" title="What should UnlockED prioritize for you?"><MultiChoiceGrid options={interviewOpportunityTypes} values={preferredOpportunityTypes} toggle={(value) => toggle(value, preferredOpportunityTypes, setPreferredOpportunityTypes)} /></InterviewQuestion>}
      </div>
      {error && <p role="alert" className="mb-4 text-sm font-bold text-red-700">{error}</p>}
      <div className="flex items-center justify-between border-t border-ink/10 pt-5">
        <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} className="text-sm font-bold text-ink/45 hover:text-forest disabled:opacity-30">Back</button>
        <button type="button" onClick={next} disabled={!valid()} className="min-h-12 rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-35">{step === totalSteps - 1 ? "Build my advisor" : "Continue"}</button>
      </div>
      <p className="mt-4 text-xs text-ink/35">Press Enter to continue. Press Escape to go back.</p>
    </section>
  </main>;
}

function InterviewQuestion({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <div><p className="rule-label text-forest">{eyebrow}</p><h1 className="mt-4 font-editorial text-5xl font-bold leading-[1.02] tracking-[-.045em] sm:text-6xl">{title}</h1><div className="mt-10">{children}</div></div>;
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`min-h-12 rounded-full px-5 text-left text-sm font-bold transition ${selected ? "bg-forest text-white" : "bg-paper text-ink/65 hover:bg-ink hover:text-white"}`}>{children}</button>;
}

function ChoiceGrid({ options, value, setValue }: { options: string[]; value: string; setValue: (value: string) => void }) {
  return <div className="grid gap-2 sm:grid-cols-2">{options.map((option) => <Choice key={option} selected={value === option} onClick={() => setValue(option)}>{option}</Choice>)}</div>;
}

function MultiChoiceGrid({ options, values, toggle }: { options: string[]; values: string[]; toggle: (value: string) => void }) {
  return <div className="grid gap-2 sm:grid-cols-2">{options.map((option) => <Choice key={option} selected={values.includes(option)} onClick={() => toggle(option)}>{option}</Choice>)}</div>;
}

export function StudentProfileForm({ mode, session, initialProfile, onSave, onCancel }: { mode: "onboarding" | "edit"; session: AccountSession | null; initialProfile?: StudentProfile | null; onSave: (profile: StudentProfile) => void | Promise<void>; onCancel?: () => void }) {
  const initialSchool = schools.find((item) => item.slug === initialProfile?.schoolSlug) ?? null;
  const nameParts = session?.user?.name?.split(" ").filter(Boolean) ?? [];
  const [firstName, setFirstName] = useState(initialProfile?.firstName ?? nameParts[0] ?? "");
  const [lastName, setLastName] = useState(initialProfile?.lastName ?? nameParts.slice(1).join(" "));
  const [schoolQuery, setSchoolQuery] = useState(initialSchool?.name ?? "");
  const [selectedSchool, setSelectedSchool] = useState<School | null>(initialSchool);
  const [major, setMajor] = useState(initialProfile?.major ?? "");
  const [graduationYear, setGraduationYear] = useState(initialProfile?.graduationYear ?? "");
  const [interests, setInterests] = useState(initialProfile?.interests ?? "");
  const [careerGoal, setCareerGoal] = useState(initialProfile?.careerGoal ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMajorSuggestions, setShowMajorSuggestions] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const normalized = normalizeSchoolQuery(schoolQuery);
  const matches = useMemo(() => findSchoolMatches(schools, schoolQuery, 6), [schoolQuery]);
  const majorMatches = useMemo(() => opportunityMajors.filter((item) => item !== "All" && item !== "Any Major" && item.toLowerCase().includes(major.trim().toLowerCase())).slice(0, 6), [major]);

  function chooseSchool(school: School) {
    setSelectedSchool(school);
    setSchoolQuery(school.name);
    setShowSuggestions(false);
  }

  function addToken(value: string, current: string, update: (next: string) => void) {
    const tokens = current.split(",").map((item) => item.trim()).filter(Boolean);
    if (!tokens.includes(value)) update([...tokens, value].join(", "));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const exact = findExactSchoolMatches(schools, schoolQuery);
    const school = selectedSchool ?? (exact.length === 1 ? exact[0] : undefined);
    if (!firstName.trim()) { setError("Add your first name so UnlockED can personalize your workspace."); return; }
    if (!school) { setError("Choose your school from the suggestions."); setShowSuggestions(true); return; }
    if (!major.trim()) { setError("Add your major."); return; }
    if (!graduationYear) { setError("Choose your graduation year."); return; }
    if (!interests.trim()) { setError("Add at least one interest."); return; }
    if (!careerGoal.trim()) { setError("Add one career goal."); return; }
    setError("");
    setSaving(true);
    try {
      await onSave({
      ...initialProfile,
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      schoolSlug: school.slug,
      major: major.trim(),
      graduationYear,
      year: academicYearFromGraduationYear(graduationYear),
      careerGoal: careerGoal.trim(),
      interests: interests.trim(),
      goals: careerGoal.split(",").map((item) => item.trim()).filter(Boolean),
      topics: interests.split(",").map((item) => item.trim()).filter(Boolean),
      });
    } catch {
      setError("Your profile could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="px-5 py-10 sm:px-8 sm:py-14">
    <section className="mx-auto max-w-3xl">
      <p className="rule-label text-forest">{mode === "edit" ? "Edit profile" : "First things first"}</p>
      <h1 className="mt-3 font-editorial text-4xl font-bold tracking-[-.03em] sm:text-5xl">{mode === "edit" ? "Update your profile." : "Tell UnlockED what fits you."}</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/55">{mode === "edit" ? "Change anything here. Your dashboard updates after you save." : "You only do this once. UnlockED uses these details to build your dashboard."}</p>
      <form onSubmit={submit} className="mt-8 space-y-7 border-t border-ink/15 pt-8">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <TextField id="first-name" label="First name" value={firstName} setValue={setFirstName} required />
          <TextField id="last-name" label="Last name" value={lastName} setValue={setLastName} />
        </div>
        <div className="relative">
          <label htmlFor="profile-school" className="mb-2 block text-sm font-bold">School</label>
          <div className={`flex min-h-12 items-center gap-3 border bg-white px-4 focus-within:border-forest ${selectedSchool ? "border-forest" : "border-ink/20"}`}>
            <SearchIcon className="h-4 w-4 shrink-0 text-ink/35"/>
            <input id="profile-school" value={schoolQuery} onFocus={() => setShowSuggestions(true)} onChange={(event) => { setSchoolQuery(event.target.value); setSelectedSchool(null); setShowSuggestions(true); }} placeholder="Search your university" autoComplete="off" aria-controls="profile-school-suggestions" aria-expanded={showSuggestions && Boolean(normalized)} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink/30"/>
          </div>
          {showSuggestions && normalized && matches.length > 0 && <div id="profile-school-suggestions" role="listbox" aria-label="Matching schools" className="absolute z-20 mt-1 w-full border border-ink/20 bg-white shadow-soft">{matches.map((school) => <button key={school.slug} type="button" role="option" aria-selected={school.slug === selectedSchool?.slug} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseSchool(school)} className="block w-full border-b border-ink/10 px-4 py-3 text-left last:border-b-0 hover:bg-paper"><span className="block text-sm font-bold">{school.name}</span><span className="block text-xs text-ink/45">{school.domain} · {school.location}</span></button>)}</div>}
          {showSuggestions && normalized && matches.length === 0 && <div id="profile-school-suggestions" className="absolute z-20 mt-1 w-full border border-ink/20 bg-white p-4 shadow-soft"><p className="font-bold">School not found</p><Link href={`/contact?school=${encodeURIComponent(schoolQuery)}`} className="mt-2 inline-block border-b border-forest text-sm font-bold text-forest">Request this school</Link></div>}
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          <div className="relative">
            <label htmlFor="profile-major" className="mb-2 block text-sm font-bold">Major</label>
            <input id="profile-major" value={major} onFocus={() => setShowMajorSuggestions(true)} onChange={(event) => { setMajor(event.target.value); setShowMajorSuggestions(true); }} placeholder="Computer Science, Finance, Biology..." autoComplete="off" className="min-h-12 w-full border border-ink/20 bg-white px-4 outline-none focus:border-forest"/>
            {showMajorSuggestions && majorMatches.length > 0 && <div className="absolute z-20 mt-1 w-full border border-ink/20 bg-white shadow-soft">{majorMatches.map((item) => <button key={item} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setMajor(item); setShowMajorSuggestions(false); }} className="block w-full border-b border-ink/10 px-4 py-3 text-left text-sm font-bold last:border-b-0 hover:bg-paper">{item}</button>)}</div>}
          </div>
          <label className="block"><span className="mb-2 block text-sm font-bold">Graduation year</span><select value={graduationYear} onChange={(event) => setGraduationYear(event.target.value)} className="min-h-12 w-full border border-ink/20 bg-white px-4 outline-none focus:border-forest"><option value="">Choose year</option>{graduationYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        </div>
        <TokenField id="profile-interests" label="Interests" value={interests} setValue={setInterests} suggestions={interestSuggestions} onAdd={addToken} placeholder="AI, research, scholarships" />
        <TokenField id="profile-goals" label="Career goals" value={careerGoal} setValue={setCareerGoal} suggestions={careerGoalSuggestions} onAdd={addToken} placeholder="Get an internship, join a lab" />
        {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
        <div className="flex flex-col gap-3 border-t border-ink/15 pt-6 sm:flex-row">
          <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center justify-center bg-forest px-6 text-sm font-bold uppercase tracking-wider text-white hover:bg-ink disabled:opacity-60">{saving ? "Saving..." : mode === "edit" ? "Save profile" : "Open dashboard"}</button>
          {onCancel && <button type="button" onClick={onCancel} className="inline-flex min-h-12 items-center justify-center border border-ink/20 px-6 text-sm font-bold uppercase tracking-wider text-ink/60 hover:border-forest hover:text-forest">Cancel</button>}
        </div>
      </form>
    </section>
  </main>;
}

function TextField({ id, label, value, setValue, required = false }: { id: string; label: string; value: string; setValue: (value: string) => void; required?: boolean }) {
  return <label htmlFor={id} className="block"><span className="mb-2 block text-sm font-bold">{label}{required ? " *" : ""}</span><input id={id} value={value} onChange={(event) => setValue(event.target.value)} className="min-h-12 w-full border border-ink/20 bg-white px-4 outline-none focus:border-forest"/></label>;
}

function TokenField({ id, label, value, setValue, suggestions, onAdd, placeholder }: { id: string; label: string; value: string; setValue: (value: string) => void; suggestions: string[]; onAdd: (value: string, current: string, update: (next: string) => void) => void; placeholder: string }) {
  return <div><label htmlFor={id} className="mb-2 block text-sm font-bold">{label}</label><input id={id} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} className="min-h-12 w-full border border-ink/20 bg-white px-4 outline-none placeholder:text-ink/30 focus:border-forest"/><div className="mt-3 flex flex-wrap gap-2">{suggestions.map((item) => <button key={item} type="button" onClick={() => onAdd(item, value, setValue)} className="border border-ink/15 px-3 py-1.5 text-xs font-bold text-ink/55 hover:border-forest hover:text-forest">{item}</button>)}</div></div>;
}

function StudentDashboard({ profile, session, syncError }: { profile: StudentProfile; session: AccountSession | null; syncError: string }) {
  const [activity, setActivity] = useState<StudentActivity>({ viewed: [], saved: [], claimed: [], tracked: {} });
  const [progress, setProgress] = useState<StudentProgress>({ milestones: {}, applications: {} });
  const [advisorBrain, setAdvisorBrain] = useState<AdvisorOutput | null>(null);
  const [advisorBrainStatus, setAdvisorBrainStatus] = useState("Loading advisor.");
  const [advisorFeedbackStatus, setAdvisorFeedbackStatus] = useState("");
  useEffect(() => {
    const update = () => setActivity(readStudentActivity());
    update();
    window.addEventListener(studentActivityEvent, update);
    return () => window.removeEventListener(studentActivityEvent, update);
  }, []);
  useEffect(() => {
    const update = () => setProgress(readStudentProgress());
    update();
    window.addEventListener(studentProgressEvent, update);
    return () => window.removeEventListener(studentProgressEvent, update);
  }, []);
  useEffect(() => {
    let active = true;
    const loadAdvisor = async () => {
      setAdvisorBrainStatus("Loading advisor.");
      try {
        const response = await fetch("/api/advisor/recommend", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
        if (!active) return;
        if (!response.ok) {
          setAdvisorBrainStatus("Advisor is unavailable right now.");
          return;
        }
        const parsed = await response.json() as { recommendation?: AdvisorOutput };
        setAdvisorBrain(parsed.recommendation ?? null);
        setAdvisorBrainStatus(parsed.recommendation ? "" : "Advisor is still learning from your profile.");
      } catch {
        if (active) setAdvisorBrainStatus("Advisor is unavailable right now.");
      }
    };
    void loadAdvisor();
    return () => { active = false; };
  }, []);

  async function sendAdvisorFeedback(actionId: string, feedbackType: FeedbackType, signal?: string) {
    if (!advisorBrain) return;
    setAdvisorFeedbackStatus("Saving feedback.");
    try {
      const response = await fetch("/api/advisor/feedback", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId: advisorBrain.recommendationId, actionId, signal, feedbackType }),
      });
      setAdvisorFeedbackStatus(response.ok ? "Feedback saved." : "Feedback could not be saved.");
      if (response.ok) {
        const refresh = await fetch("/api/advisor/recommend", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
        if (refresh.ok) {
          const parsed = await refresh.json() as { recommendation?: AdvisorOutput };
          setAdvisorBrain(parsed.recommendation ?? advisorBrain);
        }
      }
    } catch {
      setAdvisorFeedbackStatus("Feedback could not be saved.");
    }
  }

  const school = schools.find((item) => item.slug === profile.schoolSlug);
  if (!school) return null;
  const input = recommendationProfile(profile, school, activity);
  const recommended = recommendedForYou(input, 4);
  const best = recommended[0];
  const nextRecommended = recommended.slice(1, 4);
  const deadlines = expiringSoonOpportunities(input, 4, 90);
  const saved = Object.keys(activity.tracked ?? {}).map((id) => opportunities.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 3);
  const recent = activity.viewed.map((id) => opportunities.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(-4).reverse();
  const firstName = displayName(profile, session);
  const inferredProgress = inferApplicationsFromActivity(activity, opportunities, progress);
  const advisorProfile = createAdvisorProfile({ profile, school, activity, progress: inferredProgress });
  const advisorInsight = runAdvisorEngine(advisorProfile);
  const roadmap = getRoadmap(advisorProfile, inferredProgress);
  const nextMilestone = getMilestoneForAdvisor(advisorProfile, roadmap.recommendedMilestone, inferredProgress);
  const advisorTimeline = buildAdvisorTimeline({ advisorProfile, opportunities, progress: inferredProgress });
  const todayFocus = advisorTimeline.items.find((item) => item.period === "Today's Focus");
  const nextAction = advisorProfile.progress.applicationsNeedingAttention[0]?.nextAction ?? `Finish ${nextMilestone.title.toLowerCase()} before ${nextMilestone.requiredBefore[0] ?? "your next application window"}.`;

  return <main className="bg-white px-5 py-12 sm:px-8 sm:py-16">
    <div className="mx-auto max-w-6xl">
      <section className="pb-14">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="rule-label text-forest">Dashboard</p>
            <h1 className="mt-4 font-editorial text-5xl font-bold tracking-[-.055em] sm:text-7xl">{greeting()}, {firstName}.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/50">{school.name} · {profile.major}{profile.graduationYear ? ` · Class of ${profile.graduationYear}` : ""}</p>
            {syncError && <p className="mt-3 text-sm font-bold text-red-700">{syncError}</p>}
          </div>
          <Link href="/profile" className="rounded-full border border-ink/10 px-4 py-2 text-sm font-bold text-ink/50 hover:border-forest/30 hover:text-forest">Edit profile</Link>
        </div>
      </section>

      <section className="rounded-[2rem] bg-paper px-5 py-7 sm:px-8 sm:py-9">
        <p className="rule-label text-forest">Today’s best opportunity</p>
        {best ? <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink/35">{best.opportunity.organization}</p>
            <h2 className="mt-3 max-w-4xl font-editorial text-4xl font-bold leading-tight tracking-[-.035em] sm:text-5xl">{best.opportunity.title}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/55">{best.reasons[0] ?? "A strong match for your profile."}</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link href={`/opportunities/${best.opportunity.id}`} className="inline-flex min-h-12 items-center justify-center rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-ink">View opportunity</Link>
            <SaveOpportunityButton opportunityId={best.opportunity.id} className="rounded-full border border-ink/15 px-5 text-ink/60 hover:border-forest hover:text-forest"/>
          </div>
        </div> : <EmptyState title="No recommendation yet" text="Your profile is saved. Check back after the catalog refreshes, or browse the full directory." actionHref="/opportunities" actionLabel="Browse opportunities" />}
      </section>

      <AdvisorBrainSection advisor={advisorBrain} status={advisorBrainStatus} feedbackStatus={advisorFeedbackStatus} onFeedback={sendAdvisorFeedback} />

      <AdvisorInsightSection insight={advisorInsight} />

      <RoadmapSection milestone={nextMilestone} nextAction={nextAction} todayFocus={todayFocus?.title} />

      <Section title="Recommended for you" href="/opportunities">
        {nextRecommended.length ? <div className="divide-y divide-ink/10">{nextRecommended.map(({ opportunity, reasons }) => <OpportunityRow key={opportunity.id} opportunity={opportunity} detail={reasons[0] ?? opportunity.organization} />)}</div> : <EmptyState title="No extra recommendations yet" text="Your best match is shown above. More matches will appear as the catalog grows." />}
      </Section>

      <div className="grid gap-12 border-t border-ink/10 pt-10 lg:grid-cols-2">
        <Section title="Saved opportunities" href="/my-opportunities">
          {saved.length ? <div className="divide-y divide-ink/10">{saved.map((item) => <OpportunityRow key={item.id} opportunity={item} detail={deadlineLabel(item)} />)}</div> : <EmptyState title="Nothing saved yet" text="Save an opportunity when you want to come back to it." />}
        </Section>
        <Section title="Upcoming deadlines">
          {deadlines.length ? <div className="divide-y divide-ink/10">{deadlines.map(({ opportunity }) => <OpportunityRow key={opportunity.id} opportunity={opportunity} detail={deadlineLabel(opportunity)} />)}</div> : <EmptyState title="No deadlines soon" text="You have no matched deadlines in the next 90 days." />}
        </Section>
      </div>

      <Section title="Recent activity">
        {recent.length ? <div className="divide-y divide-ink/10">{recent.map((item) => <OpportunityRow key={item.id} opportunity={item} detail={item.organization} />)}</div> : <EmptyState title={`Nice work, ${firstName}.`} text="Open an opportunity and it will appear here." />}
      </Section>
    </div>
  </main>;
}

function AdvisorBrainSection({ advisor, status, feedbackStatus, onFeedback }: { advisor: AdvisorOutput | null; status: string; feedbackStatus: string; onFeedback: (actionId: string, feedbackType: FeedbackType, signal?: string) => void | Promise<void> }) {
  const primary = advisor?.highestRoiActions[0];
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const stage = advisor ? readinessStage(advisor) : null;
  return <section className="border-b border-ink/10 py-10">
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
      <div>
        <p className="rule-label text-forest">Advisor Brain</p>
        {primary ? <AdvisorActionCard action={primary} label="Your current focus" activePanel={activePanel} setActivePanel={setActivePanel} onFeedback={onFeedback} /> : <p className="mt-4 text-sm leading-7 text-ink/50">{status}</p>}
        {feedbackStatus && <p className="mt-3 text-xs font-bold text-ink/40">{feedbackStatus}</p>}
      </div>
      {advisor && <div className="rounded-[1.5rem] bg-paper px-5 py-5">
        <p className="rule-label text-ink/35">Current stage</p>
        <p className="mt-3 font-editorial text-3xl font-bold tracking-[-.03em]">{stage?.label}</p>
        <p className="mt-3 text-sm leading-6 text-ink/55">{stage?.description}</p>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-ink/35">Planning estimate: {advisor.overallReadiness}/100. Not a prediction of hiring, admission, funding, or selection.</p>
        <div className="mt-5 space-y-3">{Object.entries(advisor.dimensionScores).slice(0, 3).map(([dimension, score]) => <div key={dimension} className="flex items-center justify-between gap-3 text-sm"><span className="capitalize text-ink/50">{dimension.replaceAll("_", " ")}</span><span className="font-bold text-ink/70">{stageLabel(score)}</span></div>)}</div>
      </div>}
    </div>
    {advisor && <div className="mt-8 grid gap-8 lg:grid-cols-2">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-ink/35">This semester</p>
        <div className="mt-3 space-y-3">{advisor.semesterPlan.slice(0, 5).map((item) => {
          const action = advisor.highestRoiActions.find((candidate) => candidate.actionId === item.actionId);
          return action ? <AdvisorActionCard key={item.actionId} action={action} label={`${item.sequence}. ${item.weeklyHours} hr/week`} compact activePanel={activePanel} setActivePanel={setActivePanel} onFeedback={onFeedback} /> : null;
        })}</div>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-ink/35">Recommended opportunities</p>
        <div className="mt-3 space-y-3">{advisor.matchedOpportunities.slice(0, 3).map((item) => <AdvisorOpportunityCard key={item.opportunityId} opportunity={item} activePanel={activePanel} setActivePanel={setActivePanel} />)}</div>
      </div>
    </div>}
  </section>;
}

function AdvisorActionCard({ action, label, compact = false, activePanel, setActivePanel, onFeedback }: { action: AdvisorAction; label: string; compact?: boolean; activePanel: string | null; setActivePanel: (value: string | null) => void; onFeedback: (actionId: string, feedbackType: FeedbackType, signal?: string) => void | Promise<void> }) {
  return <RecommendationCardShell id={action.actionId} label={label} title={action.coaching.recommendation} meta={`${action.coaching.estimatedTime} · ${action.coaching.impactLabel}`} coaching={action.coaching} activePanel={activePanel} setActivePanel={setActivePanel} compact={compact} primaryAction={<button type="button" onClick={() => setActivePanel(`${action.actionId}:start`)} className="rounded-full bg-forest px-4 py-2 text-xs font-bold text-white hover:bg-ink">Start</button>} feedback={<FeedbackControls onSelect={(type) => void onFeedback(action.actionId, type, action.signal)} />} completionAction={<button type="button" onClick={() => void onFeedback(action.actionId, "completed", action.signal)} className="text-xs font-bold text-forest hover:text-ink">Mark completed</button>} />;
}

function AdvisorOpportunityCard({ opportunity, activePanel, setActivePanel }: { opportunity: RankedAdvisorOpportunity; activePanel: string | null; setActivePanel: (value: string | null) => void }) {
  return <RecommendationCardShell id={`opportunity-${opportunity.opportunityId}`} label={`${opportunity.classification} opportunity`} title={opportunity.coaching.recommendation} meta={`${opportunity.deadlineUrgency.label} urgency · ${opportunity.sourceConfidence} source confidence`} coaching={opportunity.coaching} activePanel={activePanel} setActivePanel={setActivePanel} compact primaryAction={<Link href={`/opportunities/${opportunity.opportunityId}`} className="rounded-full bg-forest px-4 py-2 text-xs font-bold text-white hover:bg-ink">View</Link>} feedback={null} completionAction={null} />;
}

function RecommendationCardShell({ id, label, title, meta, coaching, activePanel, setActivePanel, compact = false, primaryAction, feedback, completionAction }: { id: string; label: string; title: string; meta: string; coaching: RecommendationCoaching; activePanel: string | null; setActivePanel: (value: string | null) => void; compact?: boolean; primaryAction: React.ReactNode; feedback: React.ReactNode; completionAction: React.ReactNode }) {
  type PanelValue = RecommendationCoaching["informationDrawer"] | RecommendationCoaching["alternatives"] | string[] | string;
  const panels: { key: string; text: string; value: PanelValue }[] = [
    { key: "info", text: "ⓘ", value: coaching.informationDrawer },
    { key: "why", text: "Why This?", value: [coaching.whyThis, coaching.whyNow, coaching.whyBeforeOthers, coaching.notRankedFirst] },
    { key: "alternatives", text: "Alternative Paths", value: coaching.alternatives },
    { key: "next", text: "What Happens Next", value: coaching.whatHappensNext },
    { key: "start", text: "How Do I Start?", value: coaching.howDoIStart },
    { key: "unlocks", text: "What This Unlocks", value: coaching.unlockChain },
  ];
  const current = panels.find((panel) => activePanel === `${id}:${panel.key}`);
  return <article className={`${compact ? "rounded-2xl bg-paper/70 px-4 py-4" : "rounded-[1.5rem] bg-paper px-5 py-5"} transition-colors`}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="rule-label text-forest">{label}</p>
        <h3 className={`${compact ? "mt-1 text-base" : "mt-2 font-editorial text-2xl tracking-[-.02em]"} font-bold leading-tight`}>{title}</h3>
        <p className="mt-2 text-xs font-bold uppercase tracking-wider text-ink/35">{meta}</p>
      </div>
      <div className="shrink-0">{primaryAction}</div>
    </div>
    <p className="mt-3 text-sm leading-6 text-ink/55"><span className="font-bold text-ink/70">Why this applies:</span> {coaching.whyThisApplies}</p>
    <div className="mt-3 flex flex-wrap gap-2">{coaching.trustBasis.map((item) => <span key={item} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-ink/40">{item}</span>)}</div>
    <div className="mt-4 flex flex-wrap gap-2">{panels.map(({ key, text }) => {
      const panelId = `${id}:${key}`;
      const selected = activePanel === panelId;
      return <button key={key} type="button" aria-label={key === "info" ? "Learn more" : String(text)} onClick={() => setActivePanel(selected ? null : panelId)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${selected ? "border-forest bg-white text-forest" : "border-ink/15 text-ink/55 hover:border-forest hover:text-forest"}`}>{text}</button>;
    })}</div>
    {current && <div className="mt-4 border-t border-ink/10 pt-4 text-sm leading-6 text-ink/55">
      <RecommendationPanel value={current.value} />
    </div>}
    <div className="mt-4 border-t border-ink/10 pt-4">
      <p className="text-xs font-bold uppercase tracking-wider text-ink/35">Completion checklist</p>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-ink/50">{coaching.completionChecklist.map((item) => <li key={item}>{item}</li>)}</ul>
      <p className="mt-2 text-xs leading-5 text-ink/45"><span className="font-bold">First step:</span> {coaching.firstStep}</p>
      <p className="mt-1 text-xs leading-5 text-ink/45"><span className="font-bold">Evidence:</span> {coaching.evidenceProduced}</p>
      {completionAction && <div className="mt-2">{completionAction}</div>}
    </div>
    {feedback && <div className="mt-4 border-t border-ink/10 pt-4">{feedback}</div>}
  </article>;
}

function FeedbackControls({ onSelect }: { onSelect: (type: FeedbackType) => void }) {
  return <div className="flex flex-wrap gap-2">
    {(["already-completed", "dont-enjoy-this", "prefer-research", "prefer-industry", "too-time-consuming", "too-expensive", "not-interested"] as FeedbackType[]).map((type) => <button key={type} type="button" onClick={() => onSelect(type)} className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-bold text-ink/55 hover:border-forest hover:text-forest">{type.replaceAll("-", " ")}</button>)}
  </div>;
}

function RecommendationPanel({ value }: { value: RecommendationCoaching["informationDrawer"] | RecommendationCoaching["alternatives"] | string[] | string }) {
  if (typeof value === "string") return <p>{value}</p>;
  if (Array.isArray(value) && value.length && typeof value[0] === "object") return <div className="grid gap-3">{(value as RecommendationCoaching["alternatives"]).map((item, index) => <div key={item.title} className="rounded-2xl bg-white px-4 py-3">
    <p className="text-xs font-bold uppercase tracking-wider text-forest">Alternative {index + 1}</p>
    <p className="mt-1 font-bold text-ink/75">{item.title}</p>
    <p className="mt-2 text-xs leading-5"><span className="font-bold">Why choose it:</span> {item.whyChoose}</p>
    <p className="mt-1 text-xs leading-5"><span className="font-bold">Advantages:</span> {item.advantages}</p>
    <p className="mt-1 text-xs leading-5"><span className="font-bold">Tradeoffs:</span> {item.tradeoffs}</p>
    <p className="mt-1 text-xs leading-5"><span className="font-bold">Best fit:</span> {item.bestFit}</p>
    <p className="mt-1 text-xs leading-5"><span className="font-bold">Time:</span> {item.timeCommitment}</p>
    <p className="mt-1 text-xs leading-5"><span className="font-bold">Unlocks:</span> {item.unlocks}</p>
  </div>)}</div>;
  if (Array.isArray(value)) return <div className="flex flex-wrap items-center gap-2">{(value as string[]).map((item, index) => <span key={`${item}-${index}`} className="inline-flex items-center gap-2 text-xs font-bold text-ink/50">{index > 0 && <span className="text-forest">→</span>}{item}</span>)}</div>;
  return <div className="grid gap-4 md:grid-cols-2">
    <InfoItem label="What is this?" value={value.whatIsThis} />
    <InfoItem label="Why does it matter?" value={value.whyItMatters} />
    <InfoItem label="Who benefits most?" value={value.whoBenefitsMost} />
    <InfoItem label="Time commitment" value={value.typicalTimeCommitment} />
    <InfoItem label="Difficulty" value={value.difficulty} />
    <InfoItem label="Skills developed" value={value.skillsDeveloped.join(", ")} />
    <InfoItem label="Common misconceptions" value={value.commonMisconceptions.join(" ")} />
    <InfoItem label="Examples" value={value.examples.join(", ")} />
    <InfoItem label="Related careers" value={value.relatedCareers.join(", ")} />
    <InfoItem label="Related opportunities" value={value.relatedOpportunities.join(", ")} />
  </div>;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-wider text-ink/35">{label}</p><p className="mt-1 text-xs leading-5 text-ink/55">{value}</p></div>;
}

function readinessStage(advisor: AdvisorOutput) {
  const score = advisor.overallReadiness;
  if (score >= 82) return { label: "Application Season", description: "Your profile has enough evidence to focus on verified applications and interview preparation." };
  if (score >= 68) return { label: "Interview Preparation", description: "Your next work should turn existing evidence into stronger applications and interview stories." };
  if (score >= 54) return { label: "Internship Preparation", description: "You are building the proof needed for internships, research, or selective campus roles." };
  if (score >= 38) return { label: "Skill Development", description: "Your advisor is prioritizing concrete skills and visible artifacts before heavier applications." };
  return { label: "Foundation Building", description: "Your current recommendations focus on prerequisites and early evidence." };
}

function stageLabel(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Developing";
  if (score >= 40) return "Early";
  return "Needs evidence";
}

function AdvisorInsightSection({ insight }: { insight: AdvisorEngineResult }) {
  const topRecommendation = insight.recommendations[0];
  return <section className="border-b border-ink/10 py-10">
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div>
        <p className="rule-label text-forest">Advisor Insight</p>
        <h2 className="mt-3 max-w-3xl font-editorial text-3xl font-bold leading-tight tracking-[-.025em]">Your top priority right now is to {insight.focus}.</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/55"><span className="font-bold text-ink/70">Why this matters:</span> {topRecommendation.reasons.slice(0, 2).join(" ")}</p>
      </div>
      <div className="rounded-[1.5rem] bg-paper px-5 py-5">
        <p className="rule-label text-ink/35">Best next searches</p>
        <div className="mt-3 flex flex-wrap gap-2">{insight.categoriesThatMatterNow.slice(0, 3).map((category) => <span key={category} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink/55">{category}</span>)}</div>
        <p className="mt-5 text-xs font-bold uppercase tracking-wider text-ink/35">Skills to build</p>
        <p className="mt-2 text-sm leading-6 text-ink/55">{insight.profile.pathway.keySkillsToBuild.slice(0, 3).join(", ")}</p>
      </div>
    </div>
  </section>;
}

function RoadmapSection({ milestone, nextAction, todayFocus }: { milestone: Milestone; nextAction: string; todayFocus?: string }) {
  return <section className="border-b border-ink/10 py-10">
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
      <div>
        <p className="rule-label text-forest">Your Roadmap</p>
        {todayFocus && <>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink/35">Today&apos;s focus</p>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/55">{todayFocus}</p>
        </>}
        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink/35">Next action</p>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/55">{nextAction}</p>
        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink/35">Next milestone</p>
        <h2 className="mt-2 max-w-3xl font-editorial text-3xl font-bold leading-tight tracking-[-.025em]">{milestone.title}.</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/55"><span className="font-bold text-ink/70">Why?</span> {milestone.description} Most students in your stage complete this before {milestone.requiredBefore[0] ?? "the next major application window"}.</p>
      </div>
      <Link href="/opportunities" className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-bold text-ink/60 hover:border-forest hover:text-forest">Learn More</Link>
    </div>
  </section>;
}

function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return <section className="py-10"><div className="mb-5 flex items-end justify-between gap-4"><h2 className="font-editorial text-3xl font-bold tracking-[-.025em]">{title}</h2>{href && <Link href={href} className="text-sm font-bold text-ink/45 hover:text-forest">View all</Link>}</div>{children}</section>;
}

function OpportunityRow({ opportunity, detail }: { opportunity: Opportunity; detail: string }) {
  return <Link href={`/opportunities/${opportunity.id}`} className="group grid gap-2 rounded-2xl px-1 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
    <div className="min-w-0">
      <p className="rule-label text-forest">{opportunity.type}</p>
      <h3 className="mt-1 font-editorial text-xl font-bold group-hover:text-forest">{opportunity.title}</h3>
      <p className="mt-1 text-xs text-ink/45">{detail}</p>
    </div>
    <ArrowIcon className="h-4 w-4 text-ink/30 group-hover:text-forest"/>
  </Link>;
}

function EmptyState({ title, text, actionHref, actionLabel }: { title: string; text: string; actionHref?: string; actionLabel?: string }) {
  return <div className="py-6"><p className="font-editorial text-2xl font-bold">{title}</p><p className="mt-2 max-w-md text-sm leading-6 text-ink/45">{text}</p>{actionHref && actionLabel && <Link href={actionHref} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-bold text-white hover:bg-forest">{actionLabel}</Link>}</div>;
}
