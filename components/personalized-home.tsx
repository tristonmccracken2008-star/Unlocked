"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { schoolDirectory as schools, type School } from "@/data/school-directory";
import { findExactSchoolMatches, findSchoolMatches, normalizeSchoolQuery } from "@/data/school-search";
import { SearchIcon } from "./icons";
import { readCompletedStudentProfile, writeStudentProfile, type StudentProfile } from "@/data/student-profile";
import { academicYearFromGraduationYear, canonicalMajors, graduationYears } from "@/data/profile-options";
import { careerPathOptions, compensationOptions, currentGoalOptions, fieldInterestOptions, isExplorationChoice, locationFormatOptions, onboardingSelectionLimits, opportunityTypeOptions, timeCommitmentOptions, type CompensationPreference, type LocationFormatPreference, type TimeCommitmentPreference } from "@/data/onboarding-options";
import { applyOnboardingPersonalization, personalizationFromLegacyProfile } from "@/data/onboarding-personalization";
import { accountSessionEvent, accountSyncErrorEvent, clearLocalDashboardState, hydrateAccountData } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";
import { trackProductEvent } from "@/data/product-analytics";

export function PersonalizedHome({ initialSession = null }: { initialSession?: AccountSession | null }) {
  const [ready, setReady] = useState(Boolean(initialSession));
  const [profile, setProfile] = useState<StudentProfile | null>(initialSession?.data?.profile ?? null);
  const [session, setSession] = useState<AccountSession | null>(initialSession);
  const [syncError, setSyncError] = useState("");
  const [authIssue, setAuthIssue] = useState("");
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
          setProfile(parsed && (schools.some((school) => school.slug === parsed.schoolSlug) || Boolean(parsed.schoolName)) ? parsed : null);
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
      setProfile(parsed && (schools.some((school) => school.slug === parsed.schoolSlug) || Boolean(parsed.schoolName)) ? parsed : null);
    };
    const onSyncError = (event: Event) => setSyncError((event as CustomEvent<string>).detail);
    window.addEventListener(accountSessionEvent, onSession);
    window.addEventListener(accountSyncErrorEvent, onSyncError);
    if (!initialSession) void load();
    return () => { active = false; window.removeEventListener(accountSessionEvent, onSession); window.removeEventListener(accountSyncErrorEvent, onSyncError); };
  }, [initialSession]);

  useEffect(() => {
    if (!ready || !session) return;
    const url = new URL(window.location.href);
    const auth = url.searchParams.get("auth");
    const account = url.searchParams.get("account");
    if (!auth && !account) return;
    if (!session.authenticated && auth === "failed") setAuthIssue("Sign-in could not be completed. Please try again.");
    else if (!session.authenticated && auth === "unavailable") setAuthIssue("Google sign-in is temporarily unavailable. Please try again in a moment.");
    else if (!session.authenticated && account === "deleted") setAuthIssue("Your UnlockED account and associated data were deleted.");
    url.searchParams.delete("auth");
    url.searchParams.delete("account");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [ready, session]);

  useEffect(() => {
    if (!ready) return;
    const view = profile ? "dashboard" : !session?.authenticated ? "homepage" : "onboarding";
    if (trackedView.current === view) return;
    trackedView.current = view;
    trackProductEvent(view === "dashboard" ? "journey_opened" : view === "homepage" ? "homepage_visit" : "page_visit");
  }, [profile, ready, session?.authenticated]);

  if (!ready) return <WorkspaceLoading />;
  if (!session?.authenticated) return <LoggedOutLanding authIssue={authIssue} />;
  if (!profile) return <OnboardingRedirect />;
  return <JourneyRedirect />;
}

function JourneyRedirect() {
  useEffect(() => {
    window.location.replace("/");
  }, []);
  return <main className="min-h-[64vh] px-5 py-20 sm:px-8"><div className="mx-auto max-w-5xl"><p className="rule-label text-forest">Journey</p><h1 className="mt-4 font-editorial text-5xl font-bold tracking-[-.04em]">Opening your Journey.</h1><p className="mt-4 text-sm text-ink/45">Your account and profile are ready.</p></div></main>;
}

function OnboardingRedirect() {
  useEffect(() => {
    window.location.replace("/onboarding");
  }, []);
  return <main className="min-h-[64vh] px-5 py-20 sm:px-8"><div className="mx-auto max-w-5xl"><p className="rule-label text-forest">UnlockED</p><h1 className="mt-4 font-editorial text-5xl font-bold tracking-[-.04em]">Opening onboarding.</h1><p className="mt-4 text-sm text-ink/45">Your session is ready. Finish your profile to continue.</p></div></main>;
}

function WorkspaceLoading() {
  return <main className="min-h-[64vh] px-5 py-20 sm:px-8"><div className="mx-auto max-w-5xl"><p className="rule-label text-forest">UnlockED</p><h1 className="mt-4 font-editorial text-5xl font-bold tracking-[-.04em]">Preparing your workspace.</h1><p className="mt-4 text-sm text-ink/45">Checking your account and saved profile.</p></div></main>;
}

function LoggedOutLanding({ authIssue }: { authIssue: string }) {
  return <main className="bg-paper">
    <section className="px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
        <div className="max-w-5xl">
          <p className="rule-label text-forest">College opportunities, finally in one place</p>
          <h1 className="mt-6 max-w-5xl font-editorial text-6xl font-bold leading-[.96] tracking-[-.055em] text-ink sm:text-8xl">Find what college forgot to tell you about.</h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-ink/60">UnlockED brings scattered scholarships, research, internships, AI tools, student benefits, and career resources into one calm place built around you.</p>
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
        <section><p className="rule-label text-forest">Simple</p><p className="mt-3 text-sm leading-7 text-ink/55">One clear place to discover, compare, and keep opportunities.</p></section>
        <section><p className="rule-label text-forest">Personal</p><p className="mt-3 text-sm leading-7 text-ink/55">Recommendations follow your school, major, graduation year, and goals.</p></section>
        <section><p className="rule-label text-forest">Sourced</p><p className="mt-3 text-sm leading-7 text-ink/55">Listings point to official sources with verification context.</p></section>
      </div>
    </section>
  </main>;
}

export function StudentProfileForm({ mode, session, initialProfile, onSave, onCancel, showHeader = true }: { mode: "onboarding" | "edit"; session: AccountSession | null; initialProfile?: StudentProfile | null; onSave: (profile: StudentProfile) => void | Promise<void>; onCancel?: () => void; showHeader?: boolean }) {
  const initialSchool = schools.find((item) => item.slug === initialProfile?.schoolSlug) ?? null;
  const nameParts = session?.user?.name?.split(" ").filter(Boolean) ?? [];
  const [firstName, setFirstName] = useState(initialProfile?.firstName ?? nameParts[0] ?? "");
  const [lastName, setLastName] = useState(initialProfile?.lastName ?? nameParts.slice(1).join(" "));
  const [schoolQuery, setSchoolQuery] = useState(initialSchool?.name ?? initialProfile?.schoolName ?? "");
  const [selectedSchool, setSelectedSchool] = useState<School | null>(initialSchool);
  const [useCustomSchool, setUseCustomSchool] = useState(Boolean(initialProfile?.schoolName && !initialSchool));
  const [major, setMajor] = useState(initialProfile?.major ?? "");
  const [secondaryMajor, setSecondaryMajor] = useState(initialProfile?.secondaryMajor ?? "");
  const [graduationYear, setGraduationYear] = useState(initialProfile?.graduationYear ?? "");
  const initialPersonalization = personalizationFromLegacyProfile(initialProfile);
  const initialUnknownFields = initialPersonalization.fieldInterests.filter((value) => !fieldInterestOptions.includes(value as never));
  const initialUnknownCareers = initialPersonalization.specificCareerInterests.filter((value) => !careerPathOptions.includes(value as never));
  const [opportunityTypeInterests, setOpportunityTypeInterests] = useState<string[]>(initialPersonalization.opportunityTypeInterests);
  const [fieldInterests, setFieldInterests] = useState<string[]>(initialUnknownFields.length ? [...initialPersonalization.fieldInterests.filter((value) => fieldInterestOptions.includes(value as never)), "Other"] : initialPersonalization.fieldInterests);
  const [otherFieldInterest, setOtherFieldInterest] = useState(initialUnknownFields.join(", "));
  const [goals, setGoals] = useState<string[]>(initialPersonalization.goals);
  const [specificCareerInterests, setSpecificCareerInterests] = useState<string[]>(initialUnknownCareers.length ? [...initialPersonalization.specificCareerInterests.filter((value) => careerPathOptions.includes(value as never)), "Other"] : initialPersonalization.specificCareerInterests);
  const [otherCareerInterest, setOtherCareerInterest] = useState(initialUnknownCareers.join(", "));
  const [locationFormats, setLocationFormats] = useState<LocationFormatPreference[]>(initialPersonalization.locationFormats);
  const [compensationPreference, setCompensationPreference] = useState<CompensationPreference>(initialPersonalization.compensationPreference);
  const [timeCommitments, setTimeCommitments] = useState<TimeCommitmentPreference[]>(initialPersonalization.timeCommitments);
  const [minorStatus, setMinorStatus] = useState<"declared" | "none">(initialProfile?.minorStatus ?? (initialProfile?.minor ? "declared" : "none"));
  const [minor, setMinor] = useState(initialProfile?.minor ?? "");
  const [gpaStatus, setGpaStatus] = useState<"reported" | "none_yet" | "nonstandard">(initialProfile?.gpaStatus ?? "none_yet");
  const [gpa, setGpa] = useState(typeof initialProfile?.gpa === "number" ? String(initialProfile.gpa) : "");
  const [gpaScale, setGpaScale] = useState<"4.0" | "5.0" | "100">(initialProfile?.gpaScale ?? "4.0");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMajorSuggestions, setShowMajorSuggestions] = useState(false);
  const [showMinorSuggestions, setShowMinorSuggestions] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const normalized = normalizeSchoolQuery(schoolQuery);
  const matches = useMemo(() => findSchoolMatches(schools, schoolQuery, 6), [schoolQuery]);
  const majorMatches = useMemo(() => canonicalMajors.filter((item) => item.toLowerCase().includes(major.trim().toLowerCase())).slice(0, 6), [major]);
  const minorMatches = useMemo(() => canonicalMajors.filter((item) => item.toLowerCase().includes(minor.trim().toLowerCase())).slice(0, 6), [minor]);

  function chooseSchool(school: School) {
    setSelectedSchool(school);
    setSchoolQuery(school.name);
    setShowSuggestions(false);
    setUseCustomSchool(false);
  }

  function toggleSelection(current: string[], value: string, update: (next: string[]) => void, limit?: number) {
    if (current.includes(value)) return update(current.filter((item) => item !== value));
    const next = isExplorationChoice(value) ? [value] : [...current.filter((item) => !isExplorationChoice(item)), value];
    if (limit && next.length > limit) return setError(`Choose no more than ${limit}.`);
    update(next);
    setError("");
  }

  function togglePractical<T extends string>(current: T[], value: T, update: (next: T[]) => void) {
    const next = current.includes(value) ? current.filter((item) => item !== value) : value === "no_preference" ? [value] : [...current.filter((item) => item !== "no_preference"), value];
    update(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const exact = findExactSchoolMatches(schools, schoolQuery);
    const school = selectedSchool ?? (exact.length === 1 ? exact[0] : undefined);
    if (!firstName.trim()) { setError("Add your first name so UnlockED can personalize your workspace."); return; }
    if (!school && (!useCustomSchool || schoolQuery.trim().length < 2)) { setError("Choose a school or use the name you entered."); setShowSuggestions(true); return; }
    if (!major.trim()) { setError("Add your major."); return; }
    if (!graduationYear) { setError("Choose your graduation year."); return; }
    if (minorStatus === "declared" && !minor.trim()) { setError("Choose your minor or select no minor."); return; }
    if (gpaStatus === "reported") {
      const numericGpa = Number(gpa);
      const maximum = gpaScale === "100" ? 100 : Number(gpaScale);
      if (!Number.isFinite(numericGpa) || numericGpa < 0 || numericGpa > maximum) { setError(`Enter a GPA from 0 to ${gpaScale}.`); return; }
    }
    if (!opportunityTypeInterests.length) { setError("Choose at least one opportunity type."); return; }
    if (!fieldInterests.length || fieldInterests.length > onboardingSelectionLimits.fieldInterests) { setError("Choose between one and five fields."); return; }
    if (fieldInterests.includes("Other") && otherFieldInterest.trim().length < 2) { setError("Add your other field of interest."); return; }
    if (!goals.length || goals.length > onboardingSelectionLimits.currentGoals) { setError("Choose between one and four current goals."); return; }
    if (specificCareerInterests.includes("Other") && otherCareerInterest.trim().length < 2) { setError("Add your other career interest."); return; }
    setError("");
    setSaving(true);
    try {
      const baseProfile: StudentProfile = {
      ...initialProfile,
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      schoolSlug: school?.slug ?? `custom-${normalizeSchoolQuery(schoolQuery).replaceAll(" ", "-").slice(0, 120)}`,
      schoolName: school ? undefined : schoolQuery.trim(),
      major: major.trim(),
      secondaryMajor: secondaryMajor.trim() && secondaryMajor.trim().toLowerCase() !== major.trim().toLowerCase() ? secondaryMajor.trim() : undefined,
      graduationYear,
      year: academicYearFromGraduationYear(graduationYear),
      minorStatus,
      minor: minorStatus === "declared" ? minor.trim() : undefined,
      gpaStatus,
      gpa: gpaStatus === "reported" ? Number(Number(gpa).toFixed(2)) : undefined,
      gpaScale: gpaStatus === "reported" ? gpaScale : undefined,
      careerGoal: initialProfile?.careerGoal ?? "Exploring possible careers",
      interests: initialProfile?.interests ?? "Still exploring",
      };
      const nextProfile = applyOnboardingPersonalization(baseProfile, {
        opportunityTypeInterests: opportunityTypeInterests as NonNullable<StudentProfile["opportunityTypeInterests"]>,
        fieldInterests: fieldInterests.map((value) => value === "Other" ? otherFieldInterest.trim() : value),
        goals,
        specificCareerInterests: specificCareerInterests.map((value) => value === "Other" ? otherCareerInterest.trim() : value),
        locationFormats,
        compensationPreference,
        timeCommitments,
      });
      nextProfile.advisorInterview = { ...(nextProfile.advisorInterview ?? {}), completedAt: initialProfile?.advisorInterview?.completedAt ?? initialProfile?.onboardingCompletedAt };
      await onSave(nextProfile);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your profile could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return <section className={mode === "edit" ? showHeader ? "py-8" : "pb-8 pt-6" : "px-5 py-10 sm:px-8 sm:py-14"}>
    <section className="mx-auto max-w-3xl">
      {showHeader ? <><p className="rule-label text-forest">{mode === "edit" ? "Edit profile" : "First things first"}</p>
      <h1 className="mt-3 font-editorial text-4xl font-bold tracking-[-.03em] sm:text-5xl">{mode === "edit" ? "Update your profile." : "Tell UnlockED what fits you."}</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/55">{mode === "edit" ? "Change anything here. UnlockED updates after you save." : "You only do this once. UnlockED uses these details to personalize your account."}</p></> : null}
      <form onSubmit={submit} className={`${showHeader ? "mt-8" : ""} space-y-7 border-t border-ink/15 pt-8`}>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <TextField id="first-name" label="First name" value={firstName} setValue={setFirstName} required />
          <TextField id="last-name" label="Last name" value={lastName} setValue={setLastName} />
        </div>
        <div className="relative">
          <label htmlFor="profile-school" className="mb-2 block text-sm font-bold">School</label>
          <div className={`flex min-h-12 items-center gap-3 border bg-white px-4 focus-within:border-forest ${selectedSchool ? "border-forest" : "border-ink/20"}`}>
            <SearchIcon className="h-4 w-4 shrink-0 text-ink/35"/>
            <input id="profile-school" value={schoolQuery} onFocus={() => setShowSuggestions(true)} onChange={(event) => { setSchoolQuery(event.target.value); setSelectedSchool(null); setShowSuggestions(true); }} placeholder="Search your university" autoComplete="off" role="combobox" aria-autocomplete="list" aria-controls="profile-school-suggestions" aria-expanded={showSuggestions && Boolean(normalized)} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink/30"/>
          </div>
          {showSuggestions && normalized && matches.length > 0 && <div id="profile-school-suggestions" role="listbox" aria-label="Matching schools" className="absolute z-20 mt-1 w-full border border-ink/20 bg-white shadow-soft">{matches.map((school) => <button key={school.slug} type="button" role="option" aria-selected={school.slug === selectedSchool?.slug} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseSchool(school)} className="block w-full border-b border-ink/10 px-4 py-3 text-left last:border-b-0 hover:bg-paper"><span className="block text-sm font-bold">{school.name}</span><span className="block text-xs text-ink/45">{school.domain} · {school.location}</span></button>)}</div>}
          {showSuggestions && normalized && matches.length === 0 && <div id="profile-school-suggestions" className="absolute z-20 mt-1 w-full border border-ink/20 bg-white p-4 shadow-soft"><p className="font-bold">School not listed</p><button type="button" onClick={() => { setUseCustomSchool(true); setShowSuggestions(false); }} className="mt-3 min-h-11 border border-forest px-4 text-sm font-bold text-forest">Use “{schoolQuery.trim()}”</button><p className="mt-2 text-xs leading-5 text-ink/45">You can continue now. School-specific matches may be limited until it joins the catalog.</p></div>}
          {useCustomSchool ? <p className="mt-2 text-xs font-bold text-forest">Using the school name you entered.</p> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          <div className="relative">
            <label htmlFor="profile-major" className="mb-2 block text-sm font-bold">Major</label>
            <input id="profile-major" value={major} onFocus={() => setShowMajorSuggestions(true)} onChange={(event) => { setMajor(event.target.value); setShowMajorSuggestions(true); }} placeholder="Computer Science, Finance, Biology..." autoComplete="off" role="combobox" aria-autocomplete="list" aria-controls="profile-major-suggestions" aria-expanded={showMajorSuggestions && majorMatches.length > 0} className="min-h-12 w-full border border-ink/20 bg-white px-4 outline-none focus:border-forest"/>
            {showMajorSuggestions && majorMatches.length > 0 && <div id="profile-major-suggestions" role="listbox" aria-label="Matching majors" className="absolute z-20 mt-1 w-full border border-ink/20 bg-white shadow-soft">{majorMatches.map((item) => <button key={item} type="button" role="option" aria-selected={major === item} onMouseDown={(event) => event.preventDefault()} onClick={() => { setMajor(item); setShowMajorSuggestions(false); }} className="block min-h-11 w-full border-b border-ink/10 px-4 py-3 text-left text-sm font-bold last:border-b-0 hover:bg-paper">{item}</button>)}</div>}
          </div>
          <label className="block"><span className="mb-2 block text-sm font-bold">Graduation year</span><select value={graduationYear} onChange={(event) => setGraduationYear(event.target.value)} className="min-h-12 w-full border border-ink/20 bg-white px-4 outline-none focus:border-forest"><option value="">Choose year</option>{graduationYears().map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        </div>
        <div className="relative">
          <label htmlFor="profile-secondary-major" className="mb-2 block text-sm font-bold">Second major <span className="font-normal text-ink/40">(optional)</span></label>
          <input id="profile-secondary-major" value={secondaryMajor} onChange={(event) => setSecondaryMajor(event.target.value)} placeholder="Add another major" className="min-h-12 w-full border border-ink/20 bg-white px-4 outline-none focus:border-forest"/>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <fieldset>
            <legend className="mb-2 block text-sm font-bold">Minor</legend>
            <div className="grid gap-2">
              <button type="button" aria-pressed={minorStatus === "none"} onClick={() => { setMinorStatus("none"); setMinor(""); }} className={`min-h-11 border px-4 text-left text-sm font-bold ${minorStatus === "none" ? "border-forest bg-forest text-white" : "border-ink/20 bg-white text-ink/60 hover:border-forest hover:text-forest"}`}>No minor</button>
              <button type="button" aria-pressed={minorStatus === "declared"} onClick={() => setMinorStatus("declared")} className={`min-h-11 border px-4 text-left text-sm font-bold ${minorStatus === "declared" ? "border-forest bg-forest text-white" : "border-ink/20 bg-white text-ink/60 hover:border-forest hover:text-forest"}`}>I have a minor</button>
            </div>
            {minorStatus === "declared" && <div className="relative mt-3"><label htmlFor="profile-minor" className="sr-only">Minor</label><input id="profile-minor" value={minor} onFocus={() => setShowMinorSuggestions(true)} onChange={(event) => { setMinor(event.target.value); setShowMinorSuggestions(true); }} placeholder="Search for your minor" autoComplete="off" role="combobox" aria-autocomplete="list" aria-controls="profile-minor-suggestions" aria-expanded={showMinorSuggestions && minorMatches.length > 0} className="min-h-12 w-full border border-ink/20 bg-white px-4 outline-none focus:border-forest"/>{showMinorSuggestions && minorMatches.length > 0 && <div id="profile-minor-suggestions" role="listbox" aria-label="Matching minors" className="absolute z-20 mt-1 w-full border border-ink/20 bg-white shadow-soft">{minorMatches.map((item) => <button key={item} type="button" role="option" aria-selected={minor === item} onMouseDown={(event) => event.preventDefault()} onClick={() => { setMinor(item); setShowMinorSuggestions(false); }} className="block min-h-11 w-full border-b border-ink/10 px-4 py-3 text-left text-sm font-bold last:border-b-0 hover:bg-paper">{item}</button>)}</div>}</div>}
          </fieldset>
          <fieldset>
            <legend className="mb-2 block text-sm font-bold">GPA</legend>
            <label htmlFor="profile-gpa-status" className="sr-only">GPA reporting option</label>
            <select id="profile-gpa-status" value={gpaStatus} onChange={(event) => setGpaStatus(event.target.value as "reported" | "none_yet" | "nonstandard")} className="min-h-12 w-full border border-ink/20 bg-white px-4 outline-none focus:border-forest">
              <option value="none_yet">I do not have a college GPA yet</option>
              <option value="reported">Enter my GPA</option>
              <option value="nonstandard">My school does not use a standard GPA</option>
            </select>
            {gpaStatus === "reported" && <div className="mt-3 grid grid-cols-[1fr_7rem] gap-2"><label htmlFor="profile-gpa" className="sr-only">GPA</label><input id="profile-gpa" inputMode="decimal" value={gpa} onChange={(event) => setGpa(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="Example: 3.75" className="min-h-12 w-full border border-ink/20 bg-white px-4 outline-none focus:border-forest"/><label className="sr-only" htmlFor="profile-gpa-scale">GPA scale</label><select id="profile-gpa-scale" value={gpaScale} onChange={(event) => setGpaScale(event.target.value as "4.0" | "5.0" | "100")} className="min-h-12 border border-ink/20 bg-white px-3"><option value="4.0">4.0 scale</option><option value="5.0">5.0 scale</option><option value="100">100 scale</option></select></div>}
          </fieldset>
        </div>
        <div className="border-t border-ink/15 pt-7">
          <p className="rule-label text-forest">Recommendation preferences</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/50">These details shape For You. Discover still shows the complete catalog.</p>
          <div className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
            <PreferenceDetails title="Opportunity types" summary={opportunityTypeInterests.join(", ") || "Choose what you want to find"}>
              <ProfileChoiceGrid options={opportunityTypeOptions} values={opportunityTypeInterests} onToggle={(value) => toggleSelection(opportunityTypeInterests, value, setOpportunityTypeInterests)} />
            </PreferenceDetails>
            <PreferenceDetails title="Fields and current goals" summary={[...fieldInterests, ...goals].slice(0, 3).join(", ") || "Add your current interests"}>
              <ProfileChoiceGrid options={fieldInterestOptions} values={fieldInterests} onToggle={(value) => toggleSelection(fieldInterests, value, setFieldInterests, onboardingSelectionLimits.fieldInterests)} />
              {fieldInterests.includes("Other") ? <CompactTextField id="profile-other-field" label="Other field" value={otherFieldInterest} onChange={setOtherFieldInterest} /> : null}
              <p className="mb-3 mt-6 text-sm font-bold">What you are working toward now</p>
              <ProfileChoiceGrid options={currentGoalOptions} values={goals} onToggle={(value) => toggleSelection(goals, value, setGoals, onboardingSelectionLimits.currentGoals)} />
            </PreferenceDetails>
            <PreferenceDetails title="Practical preferences" summary="Location, compensation, and time commitment">
              <p className="mb-3 text-sm font-bold">Participation format</p>
              <ProfileOptionGrid options={locationFormatOptions} values={locationFormats} onToggle={(value) => togglePractical(locationFormats, value, setLocationFormats)} />
              <label className="mt-6 block"><span className="mb-2 block text-sm font-bold">Compensation</span><select value={compensationPreference} onChange={(event) => setCompensationPreference(event.target.value as CompensationPreference)} className="min-h-12 w-full border border-ink/20 bg-white px-4 outline-none focus:border-forest">{compensationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <p className="mb-3 mt-6 text-sm font-bold">Time commitment</p>
              <ProfileOptionGrid options={timeCommitmentOptions} values={timeCommitments} onToggle={(value) => togglePractical(timeCommitments, value, setTimeCommitments)} />
            </PreferenceDetails>
            <PreferenceDetails title="Specific career paths" summary={specificCareerInterests.join(", ") || "Optional"}>
              <ProfileChoiceGrid options={careerPathOptions} values={specificCareerInterests} onToggle={(value) => toggleSelection(specificCareerInterests, value, setSpecificCareerInterests, onboardingSelectionLimits.specificCareerInterests)} />
              {specificCareerInterests.includes("Other") ? <CompactTextField id="profile-other-career" label="Other career path" value={otherCareerInterest} onChange={setOtherCareerInterest} /> : null}
            </PreferenceDetails>
          </div>
        </div>
        {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
        <div className="flex flex-col gap-3 border-t border-ink/15 pt-6 sm:flex-row">
          <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center justify-center bg-forest px-6 text-sm font-bold uppercase tracking-wider text-white hover:bg-ink disabled:opacity-60">{saving ? "Saving…" : mode === "edit" ? "Save profile" : "Open UnlockED"}</button>
          {onCancel && <button type="button" onClick={onCancel} className="inline-flex min-h-12 items-center justify-center border border-ink/20 px-6 text-sm font-bold uppercase tracking-wider text-ink/60 hover:border-forest hover:text-forest">Cancel</button>}
        </div>
      </form>
    </section>
  </section>;
}

function TextField({ id, label, value, setValue, required = false }: { id: string; label: string; value: string; setValue: (value: string) => void; required?: boolean }) {
  return <label htmlFor={id} className="block"><span className="mb-2 block text-sm font-bold">{label}{required ? " *" : ""}</span><input id={id} value={value} onChange={(event) => setValue(event.target.value)} className="min-h-12 w-full border border-ink/20 bg-white px-4 outline-none focus:border-forest"/></label>;
}

function PreferenceDetails({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  return <details className="group py-4"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 text-sm font-bold"><span>{title}</span><span className="max-w-[60%] truncate text-xs font-semibold text-ink/40 group-open:hidden">{summary}</span><span aria-hidden="true" className="text-forest">+</span></summary><div className="pb-2 pt-4">{children}</div></details>;
}

function ProfileChoiceGrid({ options, values, onToggle }: { options: readonly string[]; values: string[]; onToggle: (value: string) => void }) {
  return <div className="grid gap-2 sm:grid-cols-2">{options.map((option) => <button key={option} type="button" aria-pressed={values.includes(option)} onClick={() => onToggle(option)} className={`flex min-h-11 items-center justify-between gap-3 border px-3 py-2 text-left text-xs font-bold ${values.includes(option) ? "border-forest bg-forest text-white" : "border-ink/15 bg-white text-ink/60 hover:border-forest hover:text-forest"}`}><span>{option}</span><span aria-hidden="true" className={values.includes(option) ? "opacity-100" : "opacity-0"}>✓</span></button>)}</div>;
}

function ProfileOptionGrid<T extends string>({ options, values, onToggle }: { options: readonly { value: T; label: string }[]; values: readonly T[]; onToggle: (value: T) => void }) {
  return <div className="grid gap-2 sm:grid-cols-2">{options.map((option) => <button key={option.value} type="button" aria-pressed={values.includes(option.value)} onClick={() => onToggle(option.value)} className={`flex min-h-11 items-center justify-between gap-3 border px-3 py-2 text-left text-xs font-bold ${values.includes(option.value) ? "border-forest bg-forest text-white" : "border-ink/15 bg-white text-ink/60 hover:border-forest hover:text-forest"}`}><span>{option.label}</span><span aria-hidden="true" className={values.includes(option.value) ? "opacity-100" : "opacity-0"}>✓</span></button>)}</div>;
}

function CompactTextField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <label htmlFor={id} className="mt-4 block"><span className="mb-2 block text-sm font-bold">{label}</span><input id={id} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-12 w-full border border-ink/20 bg-white px-4 outline-none focus:border-forest" /></label>;
}
