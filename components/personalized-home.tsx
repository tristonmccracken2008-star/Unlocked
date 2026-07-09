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

function recommendationProfile(profile: StudentProfile, school: School): RecommendationProfile {
  return { schoolSlug: school.slug, schoolName: school.name, schoolLocation: school.location, major: profile.major, minor: profile.minor, academicYear: profile.year, interests: profile.interests, careerGoals: profile.careerGoal, clubs: profile.clubs };
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
  if (!profile) return <StudentProfileForm mode="onboarding" session={session} onSave={save} />;
  return <StudentDashboard profile={profile} session={session} syncError={syncError} />;
}

function WorkspaceLoading() {
  return <main className="min-h-[64vh] px-5 py-16 sm:px-8"><div className="mx-auto max-w-5xl"><p className="rule-label text-forest">UnlockED</p><h1 className="mt-3 font-editorial text-4xl font-bold">Preparing your workspace.</h1><p className="mt-3 text-sm text-ink/45">Checking your account and saved profile.</p></div></main>;
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
    <section className="px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-4xl">
          <p className="rule-label text-forest">Student opportunities, organized</p>
          <h1 className="mt-5 font-editorial text-5xl font-bold leading-[1.03] text-ink sm:text-7xl">Find the opportunities college usually leaves scattered.</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-ink/60">UnlockED helps students discover scholarships, research, internships, tools, benefits, competitions, and career resources they would otherwise miss.</p>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/50">Sign in once. Tell us what you study. Start with the opportunities that fit.</p>
          {authIssue && <div role="alert" className="mt-6 max-w-2xl border border-red-700/20 bg-white px-4 py-3 text-sm font-bold leading-6 text-red-700">{authIssue}</div>}
        </div>
        <div className="mt-16 grid gap-8 border-y border-ink/15 py-8 md:grid-cols-3">
          <section><p className="rule-label text-forest">Less searching</p><p className="mt-3 text-sm leading-7 text-ink/55">Scholarships, research, benefits, internships, and tools in one quiet place.</p></section>
          <section><p className="rule-label text-forest">Better matches</p><p className="mt-3 text-sm leading-7 text-ink/55">Recommendations are ranked around your school, major, graduation year, and goals.</p></section>
          <section><p className="rule-label text-forest">Clear next step</p><p className="mt-3 text-sm leading-7 text-ink/55">Every listing points back to the official source, deadline, and application path.</p></section>
        </div>
      </div>
    </section>
  </main>;
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
  useEffect(() => {
    const update = () => setActivity(readStudentActivity());
    update();
    window.addEventListener(studentActivityEvent, update);
    return () => window.removeEventListener(studentActivityEvent, update);
  }, []);

  const school = schools.find((item) => item.slug === profile.schoolSlug);
  if (!school) return null;
  const input = recommendationProfile(profile, school);
  const recommended = recommendedForYou(input, 4);
  const best = recommended[0];
  const nextRecommended = recommended.slice(1, 4);
  const deadlines = expiringSoonOpportunities(input, 4, 90);
  const saved = Object.keys(activity.tracked ?? {}).map((id) => opportunities.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 3);
  const recent = activity.viewed.map((id) => opportunities.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(-4).reverse();
  const firstName = displayName(profile, session);

  return <main className="bg-white px-5 py-10 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-6xl">
      <section className="pb-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="rule-label text-forest">Dashboard</p>
            <h1 className="mt-3 font-editorial text-4xl font-bold tracking-[-.035em] sm:text-6xl">{greeting()}, {firstName}.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/50">{school.name} · {profile.major}{profile.graduationYear ? ` · Class of ${profile.graduationYear}` : ""}</p>
            {syncError && <p className="mt-3 text-sm font-bold text-red-700">{syncError}</p>}
          </div>
          <Link href="/profile" className="text-xs font-bold uppercase tracking-wider text-ink/45 hover:text-forest">Edit profile</Link>
        </div>
      </section>

      <section className="border-y border-ink/15 py-8">
        <p className="rule-label text-forest">Today’s best opportunity</p>
        {best ? <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink/35">{best.opportunity.organization}</p>
            <h2 className="mt-2 max-w-4xl font-editorial text-4xl font-bold leading-tight sm:text-5xl">{best.opportunity.title}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/55">{best.reasons[0] ?? "A strong match for your profile."}</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link href={`/opportunities/${best.opportunity.id}`} className="inline-flex min-h-12 items-center justify-center bg-forest px-5 text-xs font-bold uppercase tracking-wider text-white hover:bg-ink">View opportunity</Link>
            <SaveOpportunityButton opportunityId={best.opportunity.id} className="border border-ink/20 px-5 text-ink/60 hover:border-forest hover:text-forest"/>
          </div>
        </div> : <EmptyState title="No recommendation yet" text="Your profile is saved. Check back after the catalog refreshes, or browse the full directory." actionHref="/opportunities" actionLabel="Browse opportunities" />}
      </section>

      <Section title="Recommended for you" href="/opportunities">
        {nextRecommended.length ? <div className="divide-y divide-ink/10">{nextRecommended.map(({ opportunity, reasons }) => <OpportunityRow key={opportunity.id} opportunity={opportunity} detail={reasons[0] ?? opportunity.organization} />)}</div> : <EmptyState title="No extra recommendations yet" text="Your best match is shown above. More matches will appear as the catalog grows." />}
      </Section>

      <div className="grid gap-12 border-t border-ink/15 pt-10 lg:grid-cols-2">
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

function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return <section className="py-10"><div className="mb-5 flex items-end justify-between gap-4"><h2 className="font-editorial text-3xl font-bold">{title}</h2>{href && <Link href={href} className="text-xs font-bold uppercase tracking-wider text-ink/45 hover:text-forest">View all</Link>}</div>{children}</section>;
}

function OpportunityRow({ opportunity, detail }: { opportunity: Opportunity; detail: string }) {
  return <Link href={`/opportunities/${opportunity.id}`} className="group grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
    <div className="min-w-0">
      <p className="rule-label text-forest">{opportunity.type}</p>
      <h3 className="mt-1 font-editorial text-xl font-bold group-hover:text-forest">{opportunity.title}</h3>
      <p className="mt-1 text-xs text-ink/45">{detail}</p>
    </div>
    <ArrowIcon className="h-4 w-4 text-ink/30 group-hover:text-forest"/>
  </Link>;
}

function EmptyState({ title, text, actionHref, actionLabel }: { title: string; text: string; actionHref?: string; actionLabel?: string }) {
  return <div className="py-6"><p className="font-editorial text-2xl font-bold">{title}</p><p className="mt-2 max-w-md text-sm leading-6 text-ink/45">{text}</p>{actionHref && actionLabel && <Link href={actionHref} className="mt-5 inline-flex min-h-11 items-center justify-center bg-ink px-5 text-xs font-bold uppercase tracking-wider text-white hover:bg-forest">{actionLabel}</Link>}</div>;
}
