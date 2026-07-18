"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { schoolDirectory as schools, type School } from "@/data/school-directory";
import { findExactSchoolMatches, findSchoolMatches, normalizeSchoolQuery } from "@/data/school-search";
import { academicYearFromGraduationYear, canonicalMajors, careerGoalOptions, currentPriorityOptions, graduationYears, normalizedOpportunityInterests, opportunityInterestOptions, priorityToOpportunityType } from "@/data/profile-options";
import { writeStudentProfile, type GpaStatus, type MinorStatus, type StudentProfile } from "@/data/student-profile";
import { trackProductEvent } from "@/data/product-analytics";
import type { AccountSession } from "@/lib/account-types";
import { SearchIcon } from "./icons";

type OnboardingDraft = {
  firstName: string;
  lastName: string;
  schoolQuery: string;
  schoolSlug: string;
  graduationYear: string;
  major: string;
  minorStatus: MinorStatus | "";
  minor: string;
  gpaStatus: GpaStatus | "";
  gpa: string;
  careerGoal: string;
  interests: string[];
  currentPriority: string;
};

const draftStorageKey = (userId?: string) => `unlocked-onboarding-draft-v1:${userId ?? "anonymous"}`;
const totalSteps = 8;
const stepIds = ["school", "graduation-year", "major", "minor", "gpa", "career-goal", "opportunity-interests", "current-priority"] as const;
const gpaChoices: { id: GpaStatus; label: string; helper: string }[] = [
  { id: "reported", label: "Enter my GPA", helper: "Use a U.S. 4.0 scale." },
  { id: "none_yet", label: "I do not have a college GPA yet", helper: "Common for first-year students." },
  { id: "nonstandard", label: "My school does not use a standard GPA", helper: "We will avoid GPA-based assumptions." },
];

function profileToDraft(session: AccountSession, profile: StudentProfile | null | undefined): OnboardingDraft {
  const nameParts = session.user?.name?.split(" ").filter(Boolean) ?? [];
  const emailName = session.user?.email?.split("@")[0]?.split(/[._-]/)[0] ?? "";
  const school = schools.find((item) => item.slug === profile?.schoolSlug);
  return {
    firstName: profile?.firstName ?? nameParts[0] ?? emailName ?? "Student",
    lastName: profile?.lastName ?? nameParts.slice(1).join(" "),
    schoolQuery: school?.name ?? "",
    schoolSlug: school?.slug ?? "",
    graduationYear: profile?.graduationYear ?? "",
    major: profile?.major ?? "",
    minorStatus: profile?.minorStatus ?? (profile?.minor ? "declared" : ""),
    minor: profile?.minor ?? "",
    gpaStatus: profile?.gpaStatus ?? "",
    gpa: typeof profile?.gpa === "number" ? String(profile.gpa) : "",
    careerGoal: profile?.careerGoal ?? "",
    interests: profile?.topics ?? profile?.preferredOpportunityTypes ?? profile?.interests?.split(",").map((item) => item.trim()).filter(Boolean) ?? [],
    currentPriority: profile?.currentPriority ?? "",
  };
}

function readDraft(key: string, fallback: OnboardingDraft) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null") as Partial<OnboardingDraft> | null;
    return parsed ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
}

export function OnboardingFlow({ session, initialProfile }: { session: AccountSession; initialProfile: StudentProfile | null }) {
  const [screen, setScreen] = useState<"welcome" | "question" | "complete">("welcome");
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(() => profileToDraft(session, initialProfile));
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const [showMajorSuggestions, setShowMajorSuggestions] = useState(false);
  const [showMinorSuggestions, setShowMinorSuggestions] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const started = useRef(false);
  const viewed = useRef("");
  const draftKey = draftStorageKey(session.user?.id);
  const schoolMatches = useMemo(() => findSchoolMatches(schools, draft.schoolQuery, 6), [draft.schoolQuery]);
  const selectedSchool = schools.find((school) => school.slug === draft.schoolSlug) ?? null;
  const majorMatches = useMemo(() => majorMatchesFor(draft.major), [draft.major]);
  const minorMatches = useMemo(() => majorMatchesFor(draft.minor), [draft.minor]);

  useEffect(() => {
    setDraft((fallback) => readDraft(draftKey, fallback));
  }, [draftKey]);

  useEffect(() => {
    if (screen !== "complete") localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draft, draftKey, screen]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    trackProductEvent("onboarding_started", { stepCount: String(totalSteps) });
  }, []);

  useEffect(() => {
    const id = screen === "question" ? stepIds[step] : screen;
    if (viewed.current === id) return;
    viewed.current = id;
    if (screen === "question") trackProductEvent("onboarding_step_viewed", { stepId: id, stepIndex: String(step + 1), stepCount: String(totalSteps) });
  }, [screen, step]);

  function update(next: Partial<OnboardingDraft>) {
    setDraft((current) => ({ ...current, ...next }));
    setError("");
  }

  function chooseSchool(school: School) {
    update({ schoolSlug: school.slug, schoolQuery: school.name });
    setShowSchoolSuggestions(false);
  }

  function validation(index = step) {
    if (index === 0) {
      const exact = findExactSchoolMatches(schools, draft.schoolQuery);
      if (!draft.schoolSlug && exact.length !== 1) return "Choose your school from the suggestions.";
    }
    if (index === 1 && !graduationYears().includes(draft.graduationYear)) return "Choose your expected graduation year.";
    if (index === 2 && !canonicalMajors.includes(draft.major as (typeof canonicalMajors)[number])) return "Choose your major from the suggestions.";
    if (index === 3) {
      if (!draft.minorStatus) return "Choose no minor or select your minor.";
      if (draft.minorStatus === "declared" && !canonicalMajors.includes(draft.minor as (typeof canonicalMajors)[number])) return "Choose your minor from the suggestions.";
    }
    if (index === 4) {
      if (!draft.gpaStatus) return "Choose the GPA option that fits you.";
      if (draft.gpaStatus === "reported") {
        const value = Number(draft.gpa);
        if (!Number.isFinite(value) || value < 0 || value > 4) return "Enter a GPA from 0.00 to 4.00.";
      }
    }
    if (index === 5 && !careerGoalOptions.includes(draft.careerGoal as (typeof careerGoalOptions)[number])) return "Choose the career direction closest to you.";
    if (index === 6 && draft.interests.length < 1) return "Choose at least one opportunity type.";
    if (index === 7 && !currentPriorityOptions.includes(draft.currentPriority as (typeof currentPriorityOptions)[number])) return "Choose what matters most right now.";
    return "";
  }

  function currentSchool() {
    if (selectedSchool) return selectedSchool;
    const exact = findExactSchoolMatches(schools, draft.schoolQuery);
    return exact.length === 1 ? exact[0] : null;
  }

  async function finish() {
    const issue = validation(7);
    const school = currentSchool();
    if (issue || !school) {
      const reason = issue || "Choose your school from the suggestions.";
      setError(reason);
      trackProductEvent("onboarding_validation_failed", { stepId: stepIds[step], stepIndex: String(step + 1), reason });
      return;
    }
    setSaving(true);
    setScreen("complete");
    const completionTime = new Date().toISOString();
    const preferredOpportunityTypes = normalizedOpportunityInterests([...draft.interests, priorityToOpportunityType(draft.currentPriority)].filter(Boolean));
    const gpaStatus = draft.gpaStatus as GpaStatus;
    const profile: StudentProfile = {
      ...initialProfile,
      firstName: draft.firstName.trim() || "Student",
      lastName: draft.lastName.trim() || undefined,
      schoolSlug: school.slug,
      graduationYear: draft.graduationYear,
      year: academicYearFromGraduationYear(draft.graduationYear),
      major: draft.major,
      minorStatus: draft.minorStatus as MinorStatus,
      minor: draft.minorStatus === "declared" ? draft.minor : undefined,
      gpaStatus,
      gpa: gpaStatus === "reported" ? Number(Number(draft.gpa).toFixed(2)) : undefined,
      gpaScale: gpaStatus === "reported" ? "4.0" : undefined,
      careerGoal: draft.careerGoal,
      interests: draft.interests.join(", "),
      preferredOpportunityTypes,
      currentPriority: draft.currentPriority,
      goals: [draft.careerGoal, draft.currentPriority],
      topics: draft.interests,
      advisorInterview: {
        ...(initialProfile?.advisorInterview ?? {}),
        careerGoal: draft.careerGoal,
        interests: draft.interests,
        primaryGoals: [draft.currentPriority],
        preferredOpportunityTypes,
        completedAt: completionTime,
      },
      onboardingCompletedAt: completionTime,
    };
    try {
      await writeStudentProfile(profile);
      localStorage.removeItem(draftKey);
      trackProductEvent("onboarding_completed", { stepCount: String(totalSteps) });
      window.location.assign("/advisor");
    } catch {
      setScreen("question");
      setSaving(false);
      setError("Your profile could not be saved. Please try again.");
      trackProductEvent("onboarding_save_failed", { stepId: stepIds[step], stepIndex: String(step + 1) });
    }
  }

  function continueStep() {
    if (screen === "welcome") {
      setScreen("question");
      return;
    }
    const issue = validation();
    if (issue) {
      setError(issue);
      trackProductEvent("onboarding_validation_failed", { stepId: stepIds[step], stepIndex: String(step + 1), reason: issue });
      return;
    }
    trackProductEvent("onboarding_step_completed", { stepId: stepIds[step], stepIndex: String(step + 1), stepCount: String(totalSteps) });
    if (step === totalSteps - 1) void finish();
    else setStep((value) => value + 1);
  }

  function back() {
    if (screen !== "question") return;
    trackProductEvent("onboarding_back_clicked", { stepId: stepIds[step], stepIndex: String(step + 1) });
    if (step === 0) setScreen("welcome");
    else setStep((value) => value - 1);
    setError("");
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && !(event.target instanceof HTMLTextAreaElement)) {
      event.preventDefault();
      if (!saving) continueStep();
    }
    if (event.key === "Escape" && screen === "question") back();
  }

  if (screen === "complete") return <CompletionScreen saving={saving} />;

  return <main className="min-h-[calc(100vh-80px)] bg-paper px-4 py-6 sm:px-8 sm:py-10" onKeyDown={onKeyDown}>
    <section className="mx-auto flex min-h-[68vh] max-w-5xl flex-col rounded-[2rem] border border-ink/10 bg-white/72 px-5 py-6 shadow-soft sm:px-8 sm:py-8">
      <div className="flex items-center justify-between gap-4">
        {screen === "question" ? <button type="button" onClick={back} className="rounded-full px-3 py-2 text-sm font-bold text-ink/50 hover:bg-paper hover:text-forest" aria-label="Go back">Back</button> : <span />}
        {screen === "question" ? <Progress step={step} /> : <p className="text-xs font-bold uppercase tracking-[.16em] text-ink/35">About one minute</p>}
      </div>
      <div className="flex flex-1 items-center justify-center py-10">
        {screen === "welcome" ? <Welcome /> : <Question step={step} draft={draft} update={update} schoolMatches={schoolMatches} showSchoolSuggestions={showSchoolSuggestions} setShowSchoolSuggestions={setShowSchoolSuggestions} chooseSchool={chooseSchool} selectedSchool={selectedSchool} majorMatches={majorMatches} showMajorSuggestions={showMajorSuggestions} setShowMajorSuggestions={setShowMajorSuggestions} minorMatches={minorMatches} showMinorSuggestions={showMinorSuggestions} setShowMinorSuggestions={setShowMinorSuggestions} />}
      </div>
      <div className="mx-auto w-full max-w-xl">
        {error && <p role="alert" aria-live="polite" className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold leading-5 text-red-700">{error}</p>}
        <button type="button" onClick={continueStep} disabled={saving} className="min-h-12 w-full rounded-xl bg-forest px-5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(31,95,67,.18)] hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50">
          {screen === "welcome" ? "Get started" : step === totalSteps - 1 ? "Finish setup" : "Continue"}
        </button>
      </div>
    </section>
  </main>;
}

function majorMatchesFor(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return canonicalMajors.slice(0, 7);
  return canonicalMajors.filter((item) => item.toLowerCase().includes(normalized)).slice(0, 7);
}

function Progress({ step }: { step: number }) {
  return <div className="w-full max-w-xs" aria-label={`Step ${step + 1} of ${totalSteps}`}>
    <div className="grid grid-cols-8 gap-1.5" aria-hidden="true">{Array.from({ length: totalSteps }, (_, index) => <span key={index} className={`h-1.5 rounded-full transition-all duration-300 ${index <= step ? "bg-forest" : "bg-ink/12"}`} />)}</div>
    <p className="mt-2 text-right text-xs font-bold text-ink/45">{step + 1} of {totalSteps}</p>
  </div>;
}

function Welcome() {
  return <div className="mx-auto max-w-xl text-center">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-forest/10 text-2xl font-bold text-forest">U</div>
    <p className="mt-8 rule-label text-forest">Welcome</p>
    <h1 className="mt-3 font-editorial text-4xl font-bold leading-tight tracking-[-.035em] text-ink sm:text-5xl">Welcome to UnlockED</h1>
    <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-ink/58">Let&apos;s personalize your experience. This takes about a minute and helps tune recommendations, eligibility matching, and opportunity relevance.</p>
  </div>;
}

function Question(props: {
  step: number;
  draft: OnboardingDraft;
  update: (next: Partial<OnboardingDraft>) => void;
  schoolMatches: School[];
  showSchoolSuggestions: boolean;
  setShowSchoolSuggestions: (value: boolean) => void;
  chooseSchool: (school: School) => void;
  selectedSchool: School | null;
  majorMatches: readonly string[];
  showMajorSuggestions: boolean;
  setShowMajorSuggestions: (value: boolean) => void;
  minorMatches: readonly string[];
  showMinorSuggestions: boolean;
  setShowMinorSuggestions: (value: boolean) => void;
}) {
  const { step, draft, update } = props;
  if (step === 0) return <QuestionShell eyebrow="School" title="What school do you attend?" helper="This helps us find opportunities specific to your school."><Combobox id="onboarding-school" value={draft.schoolQuery} placeholder="Search for your school" selected={props.selectedSchool?.name} matches={props.schoolMatches.map((school) => ({ id: school.slug, label: school.name, meta: `${school.location} · ${school.domain}`, value: school.name, source: school }))} show={props.showSchoolSuggestions && Boolean(normalizeSchoolQuery(draft.schoolQuery))} setShow={props.setShowSchoolSuggestions} onChange={(value) => update({ schoolQuery: value, schoolSlug: "" })} onChoose={(item) => props.chooseSchool(item.source as School)} /></QuestionShell>;
  if (step === 1) return <QuestionShell eyebrow="Graduation Year" title="When do you expect to graduate?" helper="We use this to match opportunities with the right eligibility window."><select value={draft.graduationYear} onChange={(event) => update({ graduationYear: event.target.value })} className="min-h-12 w-full rounded-xl border border-ink/15 bg-white px-4 text-sm font-bold outline-none focus:border-forest"><option value="">Select year</option>{graduationYears().map((year) => <option key={year} value={year}>{year}</option>)}</select></QuestionShell>;
  if (step === 2) return <QuestionShell eyebrow="Major" title="What is your major?" helper="This helps personalize your recommendations."><Combobox id="onboarding-major" value={draft.major} placeholder="Search for your major" matches={props.majorMatches.map((major) => ({ id: major, label: major, value: major }))} show={props.showMajorSuggestions} setShow={props.setShowMajorSuggestions} onChange={(value) => update({ major: value })} onChoose={(item) => { update({ major: item.value }); props.setShowMajorSuggestions(false); }} /></QuestionShell>;
  if (step === 3) return <QuestionShell eyebrow="Minor" title="Do you have a minor?" helper="No minor is a complete answer. You can update this later."><div className="space-y-3"><Choice selected={draft.minorStatus === "none"} onClick={() => update({ minorStatus: "none", minor: "" })}>No minor</Choice><Choice selected={draft.minorStatus === "declared"} onClick={() => update({ minorStatus: "declared" })}>I have a minor</Choice>{draft.minorStatus === "declared" && <Combobox id="onboarding-minor" value={draft.minor} placeholder="Search for your minor" matches={props.minorMatches.map((minor) => ({ id: minor, label: minor, value: minor }))} show={props.showMinorSuggestions} setShow={props.setShowMinorSuggestions} onChange={(value) => update({ minor: value })} onChoose={(item) => { update({ minor: item.value }); props.setShowMinorSuggestions(false); }} />}</div></QuestionShell>;
  if (step === 4) return <QuestionShell eyebrow="GPA" title="What is your current GPA?" helper="GPA can help us identify opportunities with academic eligibility requirements."><div className="space-y-3">{gpaChoices.map((choice) => <Choice key={choice.id} selected={draft.gpaStatus === choice.id} onClick={() => update({ gpaStatus: choice.id, gpa: choice.id === "reported" ? draft.gpa : "" })}><span className="block">{choice.label}</span><span className="mt-1 block text-xs font-medium text-ink/45">{choice.helper}</span></Choice>)}{draft.gpaStatus === "reported" && <label className="block"><span className="sr-only">GPA on a 4.0 scale</span><input inputMode="decimal" value={draft.gpa} onChange={(event) => update({ gpa: event.target.value.replace(/[^0-9.]/g, "") })} placeholder="Example: 3.75" className="min-h-12 w-full rounded-xl border border-ink/15 bg-white px-4 text-sm font-bold outline-none focus:border-forest" /></label>}</div></QuestionShell>;
  if (step === 5) return <QuestionShell eyebrow="Career Goals" title="What are you interested in working toward?"><ChoiceGrid options={careerGoalOptions} values={[draft.careerGoal]} onToggle={(value) => update({ careerGoal: value })} /></QuestionShell>;
  if (step === 6) return <QuestionShell eyebrow="Interests" title="What kinds of opportunities matter most to you?" helper="Choose every type you want UnlockED to pay attention to."><ChoiceGrid options={opportunityInterestOptions} values={draft.interests} onToggle={(value) => update({ interests: draft.interests.includes(value) ? draft.interests.filter((item) => item !== value) : [...draft.interests, value] })} /></QuestionShell>;
  return <QuestionShell eyebrow="Priority" title="What matters most to you right now?" helper="This is a strong ranking signal, not a permanent filter."><ChoiceGrid options={currentPriorityOptions} values={[draft.currentPriority]} onToggle={(value) => update({ currentPriority: value })} /></QuestionShell>;
}

function QuestionShell({ eyebrow, title, helper, children }: { eyebrow: string; title: string; helper?: string; children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-xl text-center">
    <p className="rule-label text-forest">{eyebrow}</p>
    <h1 className="mt-3 font-editorial text-4xl font-bold leading-tight tracking-[-.035em] text-ink sm:text-5xl">{title}</h1>
    {helper && <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/52">{helper}</p>}
    <div className="mt-8 text-left">{children}</div>
  </div>;
}

type ComboItem = { id: string; label: string; value: string; meta?: string; source?: unknown };
function Combobox({ id, value, selected, placeholder, matches, show, setShow, onChange, onChoose }: { id: string; value: string; selected?: string; placeholder: string; matches: ComboItem[]; show: boolean; setShow: (value: boolean) => void; onChange: (value: string) => void; onChoose: (item: ComboItem) => void }) {
  return <div className="relative">
    <label htmlFor={id} className="sr-only">{placeholder}</label>
    <div className={`flex min-h-12 items-center gap-3 rounded-xl border bg-white px-4 ${selected ? "border-forest" : "border-ink/15"} focus-within:border-forest`}>
      <SearchIcon className="h-4 w-4 shrink-0 text-ink/35" />
      <input id={id} value={value} onFocus={() => setShow(true)} onChange={(event) => { onChange(event.target.value); setShow(true); }} placeholder={placeholder} autoComplete="off" aria-expanded={show} aria-controls={`${id}-listbox`} className="min-w-0 flex-1 bg-transparent py-3 text-sm font-bold outline-none placeholder:text-ink/30" />
    </div>
    {show && <div id={`${id}-listbox`} role="listbox" className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-ink/10 bg-white py-2 shadow-soft">
      {matches.length ? matches.map((item) => <button key={item.id} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => onChoose(item)} className="block w-full px-4 py-3 text-left hover:bg-paper"><span className="block text-sm font-bold">{item.label}</span>{item.meta && <span className="mt-1 block text-xs text-ink/40">{item.meta}</span>}</button>) : <p className="px-4 py-3 text-sm font-bold text-ink/45">No match found.</p>}
    </div>}
  </div>;
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`min-h-12 w-full rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${selected ? "border-forest bg-forest text-white shadow-[0_12px_24px_rgba(31,95,67,.16)]" : "border-ink/12 bg-white text-ink/72 hover:border-forest hover:text-forest"}`}>{children}</button>;
}

function ChoiceGrid({ options, values, onToggle }: { options: readonly string[]; values: string[]; onToggle: (value: string) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2">{options.map((option) => <Choice key={option} selected={values.includes(option)} onClick={() => onToggle(option)}>{option}</Choice>)}</div>;
}

function CompletionScreen({ saving }: { saving: boolean }) {
  return <main className="min-h-[calc(100vh-80px)] bg-paper px-4 py-10 sm:px-8">
    <section className="mx-auto flex min-h-[62vh] max-w-3xl flex-col items-center justify-center rounded-[2rem] border border-ink/10 bg-white/72 px-6 py-12 text-center shadow-soft">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-forest text-3xl font-bold text-white">✓</div>
      <p className="mt-8 rule-label text-forest">Complete</p>
      <h1 className="mt-3 font-editorial text-4xl font-bold leading-tight tracking-[-.035em] text-ink sm:text-5xl">You&apos;re all set.</h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-ink/58">We&apos;re preparing opportunities around your profile.</p>
      {saving && <div className="mt-8 h-1.5 w-40 overflow-hidden rounded-full bg-ink/10"><div className="h-full w-1/2 animate-pulse rounded-full bg-forest" /></div>}
    </section>
  </main>;
}
