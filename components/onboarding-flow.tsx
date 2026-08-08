"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { schoolDirectory as schools, type School } from "@/data/school-directory";
import { findExactSchoolMatches, findSchoolMatches, normalizeSchoolQuery } from "@/data/school-search";
import { academicYearFromGraduationYear, canonicalMajors, graduationYears } from "@/data/profile-options";
import { careerPathOptions, compensationOptions, currentGoalOptions, fieldInterestOptions, isExplorationChoice, locationFormatOptions, onboardingSchemaVersion, onboardingSelectionLimits, opportunityTypeOptions, timeCommitmentOptions, type CompensationPreference, type LocationFormatPreference, type TimeCommitmentPreference } from "@/data/onboarding-options";
import { applyOnboardingPersonalization, personalizationFromLegacyProfile } from "@/data/onboarding-personalization";
import { writeStudentProfile, type GpaStatus, type MinorStatus, type StudentProfile } from "@/data/student-profile";
import { trackProductEvent } from "@/data/product-analytics";
import { accountSessionEvent } from "@/data/account-sync";
import type { AccountSession } from "@/lib/account-types";
import { SearchIcon } from "./icons";

type OnboardingDraft = {
  firstName: string;
  lastName: string;
  schoolQuery: string;
  schoolSlug: string;
  schoolName: string;
  graduationYear: string;
  major: string;
  secondaryMajor: string;
  minorStatus: MinorStatus | "";
  minor: string;
  gpaStatus: GpaStatus | "";
  gpa: string;
  opportunityTypeInterests: string[];
  fieldInterests: string[];
  otherFieldInterest: string;
  goals: string[];
  locationFormats: LocationFormatPreference[];
  compensationPreference: CompensationPreference;
  timeCommitments: TimeCommitmentPreference[];
  specificCareerInterests: string[];
  otherCareerInterest: string;
  lastStep: number;
  started: boolean;
};

const draftStorageKey = (userId?: string) => `unlocked-onboarding-draft-v2:${userId ?? "anonymous"}`;
const totalSteps = 10;
const stepIds = ["school", "graduation-year", "academic-focus", "opportunity-types", "fields", "current-goals", "location-format", "compensation", "time-commitment", "career-paths"] as const;

function profileToDraft(session: AccountSession, profile: StudentProfile | null | undefined): OnboardingDraft {
  const nameParts = session.user?.name?.split(" ").filter(Boolean) ?? [];
  const emailName = session.user?.email?.split("@")[0]?.split(/[._-]/)[0] ?? "";
  const school = schools.find((item) => item.slug === profile?.schoolSlug);
  const personalization = personalizationFromLegacyProfile(profile);
  const customFields = personalization.fieldInterests.filter((value) => !fieldInterestOptions.includes(value as never));
  const customCareers = personalization.specificCareerInterests.filter((value) => !careerPathOptions.includes(value as never));
  return {
    firstName: profile?.firstName ?? nameParts[0] ?? emailName ?? "Student",
    lastName: profile?.lastName ?? nameParts.slice(1).join(" "),
    schoolQuery: school?.name ?? profile?.schoolName ?? "",
    schoolSlug: school?.slug ?? profile?.schoolSlug ?? "",
    schoolName: school ? "" : profile?.schoolName ?? "",
    graduationYear: profile?.graduationYear ?? "",
    major: profile?.major ?? "",
    secondaryMajor: profile?.secondaryMajor ?? "",
    minorStatus: profile?.minorStatus ?? (profile?.minor ? "declared" : ""),
    minor: profile?.minor ?? "",
    gpaStatus: profile?.gpaStatus ?? "",
    gpa: typeof profile?.gpa === "number" ? String(profile.gpa) : "",
    opportunityTypeInterests: personalization.opportunityTypeInterests,
    fieldInterests: customFields.length ? [...personalization.fieldInterests.filter((value) => fieldInterestOptions.includes(value as never)), "Other"] : personalization.fieldInterests,
    otherFieldInterest: customFields.join(", "),
    goals: personalization.goals,
    locationFormats: personalization.locationFormats,
    compensationPreference: personalization.compensationPreference,
    timeCommitments: personalization.timeCommitments,
    specificCareerInterests: customCareers.length ? [...personalization.specificCareerInterests.filter((value) => careerPathOptions.includes(value as never)), "Other"] : personalization.specificCareerInterests,
    otherCareerInterest: customCareers.join(", "),
    lastStep: 0,
    started: false,
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
  const [showSecondaryMajorSuggestions, setShowSecondaryMajorSuggestions] = useState(false);
  const [showMinorSuggestions, setShowMinorSuggestions] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [restoredDraftKey, setRestoredDraftKey] = useState("");
  const started = useRef(false);
  const viewed = useRef("");
  const completed = useRef(false);
  const savingRef = useRef(false);
  const activeUserId = useRef(session.user?.id);
  const screenRef = useRef(screen);
  const stepRef = useRef(step);
  const draftKey = draftStorageKey(session.user?.id);
  const draftRef = useRef(draft);
  const schoolMatches = useMemo(() => findSchoolMatches(schools, draft.schoolQuery, 6), [draft.schoolQuery]);
  const selectedSchool = schools.find((school) => school.slug === draft.schoolSlug) ?? null;
  const majorMatches = useMemo(() => majorMatchesFor(draft.major), [draft.major]);
  const secondaryMajorMatches = useMemo(() => majorMatchesFor(draft.secondaryMajor), [draft.secondaryMajor]);
  const minorMatches = useMemo(() => majorMatchesFor(draft.minor), [draft.minor]);
  useEffect(() => {
    screenRef.current = screen;
    stepRef.current = step;
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-onboarding-heading]")?.focus());
  }, [screen, step]);

  useEffect(() => {
    setDraft((fallback) => {
      const restored = readDraft(draftKey, fallback);
      draftRef.current = restored;
      if (restored.started) {
        setStep(Math.min(totalSteps - 1, restored.lastStep));
        setScreen("question");
      }
      return restored;
    });
    setRestoredDraftKey(draftKey);
  }, [draftKey]);

  useEffect(() => {
    const accountChanged = (event: Event) => {
      const next = (event as CustomEvent<AccountSession>).detail;
      if (next.user?.id === activeUserId.current) return;
      activeUserId.current = next.user?.id;
      window.location.assign(next.authenticated ? "/onboarding" : "/");
    };
    window.addEventListener(accountSessionEvent, accountChanged);
    return () => window.removeEventListener(accountSessionEvent, accountChanged);
  }, []);

  useEffect(() => {
    draftRef.current = draft;
    if (screen !== "complete" && restoredDraftKey === draftKey) localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draft, draftKey, restoredDraftKey, screen]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    trackProductEvent("onboarding_started", { stepCount: String(totalSteps) });
  }, []);

  useEffect(() => {
    const recordAbandonment = () => {
      if (completed.current || screenRef.current !== "question") return;
      trackProductEvent("onboarding_abandoned", {
        stepId: stepIds[stepRef.current],
        stepIndex: String(stepRef.current + 1),
        stepCount: String(totalSteps),
      }, { dedupeKey: `onboarding-abandoned:${session.user?.id ?? "anonymous"}`, dedupeWindowMs: 86_400_000 });
    };
    window.addEventListener("pagehide", recordAbandonment);
    return () => window.removeEventListener("pagehide", recordAbandonment);
  }, [session.user?.id]);

  useEffect(() => {
    const id = screen === "question" ? stepIds[step] : screen;
    if (viewed.current === id) return;
    viewed.current = id;
    if (screen === "question") trackProductEvent("onboarding_step_viewed", { stepId: id, stepIndex: String(step + 1), stepCount: String(totalSteps) });
  }, [screen, step]);

  function update(next: Partial<OnboardingDraft>) {
    const updated = { ...draftRef.current, ...next };
    draftRef.current = updated;
    localStorage.setItem(draftKey, JSON.stringify(updated));
    setDraft(updated);
    setError("");
  }

  function chooseSchool(school: School) {
    update({ schoolSlug: school.slug, schoolQuery: school.name, schoolName: "" });
    setShowSchoolSuggestions(false);
  }

  function chooseCustomSchool() {
    const name = draft.schoolQuery.trim();
    if (name.length < 2) return;
    update({ schoolSlug: `custom-${normalizeSchoolQuery(name).replaceAll(" ", "-").slice(0, 120)}`, schoolName: name });
    setShowSchoolSuggestions(false);
  }

  function validation(index = step) {
    if (index === 0) {
      const exact = findExactSchoolMatches(schools, draft.schoolQuery);
      if (!draft.schoolSlug && exact.length !== 1) return "Choose a school or use the name you entered.";
    }
    if (index === 1 && !graduationYears().includes(draft.graduationYear)) return "Choose your expected graduation year.";
    if (index === 2 && draft.major.trim().length < 2) return "Enter your primary major or choose Undeclared.";
    if (index === 3 && draft.opportunityTypeInterests.length < 1) return "Choose at least one opportunity type or select Still exploring.";
    if (index === 4 && (draft.fieldInterests.length < 1 || draft.fieldInterests.length > onboardingSelectionLimits.fieldInterests)) return "Choose between one and five fields.";
    if (index === 4 && draft.fieldInterests.includes("Other") && draft.otherFieldInterest.trim().length < 2) return "Tell us the other field you have in mind.";
    if (index === 5 && (draft.goals.length < 1 || draft.goals.length > onboardingSelectionLimits.currentGoals)) return "Choose between one and four current goals.";
    if (index === 6 && draft.locationFormats.length < 1) return "Choose at least one participation format.";
    if (index === 7 && !compensationOptions.some((option) => option.value === draft.compensationPreference)) return "Choose a compensation preference.";
    if (index === 8 && draft.timeCommitments.length < 1) return "Choose at least one time commitment.";
    if (index === 9 && draft.specificCareerInterests.length > onboardingSelectionLimits.specificCareerInterests) return "Choose no more than five career paths.";
    if (index === 9 && draft.specificCareerInterests.includes("Other") && draft.otherCareerInterest.trim().length < 2) return "Tell us the other career path you have in mind.";
    return "";
  }

  function toggleSelection(field: "opportunityTypeInterests" | "fieldInterests" | "goals" | "specificCareerInterests", value: string, limit?: number) {
    const current = draftRef.current[field];
    if (current.includes(value)) return update({ [field]: current.filter((item) => item !== value) });
    const next = isExplorationChoice(value) ? [value] : [...current.filter((item) => !isExplorationChoice(item)), value];
    if (limit && next.length > limit) {
      setError(`Choose no more than ${limit}.`);
      return;
    }
    update({ [field]: next });
  }

  function togglePractical(field: "locationFormats" | "timeCommitments", value: LocationFormatPreference | TimeCommitmentPreference) {
    const current = draftRef.current[field] as string[];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : value === "no_preference" ? [value] : [...current.filter((item) => item !== "no_preference"), value];
    update({ [field]: next } as Partial<OnboardingDraft>);
  }

  function currentSchool() {
    if (selectedSchool) return selectedSchool;
    const exact = findExactSchoolMatches(schools, draft.schoolQuery);
    return exact.length === 1 ? exact[0] : null;
  }

  async function finish() {
    if (savingRef.current) return;
    const issue = validation(totalSteps - 1);
    const school = currentSchool();
    if (issue || (!school && !draft.schoolName)) {
      const reason = issue || "Choose a school or use the name you entered.";
      setError(reason);
      trackProductEvent("onboarding_validation_failed", { stepId: stepIds[step], stepIndex: String(step + 1), reason });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setScreen("complete");
    const completionTime = new Date().toISOString();
    const minorStatus: MinorStatus = draft.minorStatus || (draft.minor ? "declared" : "none");
    const gpaStatus: GpaStatus = draft.gpaStatus || "none_yet";
    const baseProfile: StudentProfile = {
      ...initialProfile,
      firstName: draft.firstName.trim() || "Student",
      lastName: draft.lastName.trim() || undefined,
      schoolSlug: school?.slug ?? draft.schoolSlug,
      schoolName: school ? undefined : draft.schoolName,
      graduationYear: draft.graduationYear,
      year: academicYearFromGraduationYear(draft.graduationYear),
      major: draft.major,
      secondaryMajor: draft.secondaryMajor.trim() && draft.secondaryMajor.trim().toLowerCase() !== draft.major.trim().toLowerCase() ? draft.secondaryMajor.trim() : undefined,
      minorStatus,
      minor: minorStatus === "declared" ? draft.minor : undefined,
      gpaStatus,
      gpa: gpaStatus === "reported" ? Number(Number(draft.gpa).toFixed(2)) : undefined,
      gpaScale: gpaStatus === "reported" ? "4.0" : undefined,
      careerGoal: "Exploring possible careers",
      interests: "Still exploring",
      onboardingCompletedAt: completionTime,
    };
    const profile = applyOnboardingPersonalization(baseProfile, {
      opportunityTypeInterests: draft.opportunityTypeInterests as NonNullable<StudentProfile["opportunityTypeInterests"]>,
      fieldInterests: draft.fieldInterests.map((value) => value === "Other" ? draft.otherFieldInterest.trim() : value),
      goals: draft.goals,
      locationFormats: draft.locationFormats,
      compensationPreference: draft.compensationPreference,
      timeCommitments: draft.timeCommitments,
      specificCareerInterests: draft.specificCareerInterests.map((value) => value === "Other" ? draft.otherCareerInterest.trim() : value),
    });
    profile.advisorInterview = { ...(profile.advisorInterview ?? {}), completedAt: completionTime };
    profile.onboardingSchemaVersion = onboardingSchemaVersion;
    try {
      const result = await writeStudentProfile(profile);
      if (!result || activeUserId.current !== session.user?.id) throw new Error("session");
      completed.current = true;
      localStorage.removeItem(draftKey);
      trackProductEvent("onboarding_completed", { stepCount: String(totalSteps) });
      window.location.assign("/welcome");
    } catch {
      savingRef.current = false;
      setScreen("question");
      setSaving(false);
      setError("Your profile could not be saved. Please try again.");
      trackProductEvent("onboarding_save_failed", { stepId: stepIds[step], stepIndex: String(step + 1) });
    }
  }

  function continueStep() {
    if (savingRef.current) return;
    if (screen === "welcome") {
      update({ started: true, lastStep: 0 });
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
    else {
      const nextStep = step + 1;
      update({ lastStep: nextStep });
      setStep(nextStep);
    }
  }

  function back() {
    if (screen !== "question") return;
    trackProductEvent("onboarding_back_clicked", { stepId: stepIds[step], stepIndex: String(step + 1) });
    if (step === 0) {
      update({ started: false, lastStep: 0 });
      setScreen("welcome");
    }
    else {
      const previousStep = step - 1;
      update({ lastStep: previousStep });
      setStep(previousStep);
    }
    setError("");
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && !(event.target instanceof HTMLTextAreaElement)) {
      if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLSelectElement) return;
      event.preventDefault();
      if (!saving) continueStep();
    }
    if (event.key === "Escape" && screen === "question") back();
  }

  if (screen === "complete") return <CompletionScreen saving={saving} />;
  const continueDisabled = saving || (screen === "question" && Boolean(validation()));

  return <main className="min-h-[calc(100vh-80px)] bg-paper px-4 py-6 sm:px-8 sm:py-10" onKeyDown={onKeyDown}>
    <section className="mx-auto flex min-h-[68vh] max-w-5xl flex-col rounded-[2rem] border border-ink/10 bg-white/72 px-5 py-6 shadow-soft sm:px-8 sm:py-8">
      <div className="flex items-center justify-between gap-4">
        {screen === "question" ? <button type="button" onClick={back} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-ink/50 hover:bg-paper hover:text-forest" aria-label="Go back">Back</button> : <span />}
        {screen === "question" ? <Progress step={step} /> : <p className="text-xs font-bold uppercase tracking-[.16em] text-ink/35">About two minutes</p>}
      </div>
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="w-full">{screen === "welcome" ? <Welcome /> : <Question step={step} draft={draft} update={update} toggleSelection={toggleSelection} togglePractical={togglePractical} schoolMatches={schoolMatches} showSchoolSuggestions={showSchoolSuggestions} setShowSchoolSuggestions={setShowSchoolSuggestions} chooseSchool={chooseSchool} chooseCustomSchool={chooseCustomSchool} selectedSchool={selectedSchool} majorMatches={majorMatches} showMajorSuggestions={showMajorSuggestions} setShowMajorSuggestions={setShowMajorSuggestions} secondaryMajorMatches={secondaryMajorMatches} showSecondaryMajorSuggestions={showSecondaryMajorSuggestions} setShowSecondaryMajorSuggestions={setShowSecondaryMajorSuggestions} minorMatches={minorMatches} showMinorSuggestions={showMinorSuggestions} setShowMinorSuggestions={setShowMinorSuggestions} />}
          {error && <p role="alert" aria-live="polite" className="mx-auto mt-4 max-w-xl rounded-xl bg-red-50 px-4 py-3 text-sm font-bold leading-5 text-red-700">{error}</p>}
        </div>
      </div>
      <div className="mx-auto w-full max-w-xl">
        <button type="button" onClick={continueStep} disabled={continueDisabled} className="min-h-12 w-full rounded-xl bg-forest px-5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(31,95,67,.18)] hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50">
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
  return <div className="w-full max-w-xs" role="progressbar" aria-label="Onboarding progress" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={step + 1} aria-valuetext={`Step ${step + 1} of ${totalSteps}`}>
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }} aria-hidden="true">{Array.from({ length: totalSteps }, (_, index) => <span key={index} className={`h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${index <= step ? "bg-forest" : "bg-ink/12"}`} />)}</div>
    <p className="mt-2 text-right text-xs font-bold text-ink/45">{step + 1} of {totalSteps}</p>
  </div>;
}

function Welcome() {
  return <div className="mx-auto max-w-xl text-center">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-forest/10 text-2xl font-bold text-forest">U</div>
    <p className="mt-8 rule-label text-forest">Welcome</p>
    <h1 tabIndex={-1} data-onboarding-heading style={{ outline: "none" }} className="mt-3 font-editorial text-4xl font-bold leading-tight text-ink sm:text-5xl">Welcome to UnlockED</h1>
    <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-ink/58">A few focused questions help UnlockED check eligibility and prioritize opportunities that fit. You can change these details later.</p>
  </div>;
}

function Question(props: {
  step: number;
  draft: OnboardingDraft;
  update: (next: Partial<OnboardingDraft>) => void;
  toggleSelection: (field: "opportunityTypeInterests" | "fieldInterests" | "goals" | "specificCareerInterests", value: string, limit?: number) => void;
  togglePractical: (field: "locationFormats" | "timeCommitments", value: LocationFormatPreference | TimeCommitmentPreference) => void;
  schoolMatches: School[];
  showSchoolSuggestions: boolean;
  setShowSchoolSuggestions: (value: boolean) => void;
  chooseSchool: (school: School) => void;
  chooseCustomSchool: () => void;
  selectedSchool: School | null;
  majorMatches: readonly string[];
  showMajorSuggestions: boolean;
  setShowMajorSuggestions: (value: boolean) => void;
  secondaryMajorMatches: readonly string[];
  showSecondaryMajorSuggestions: boolean;
  setShowSecondaryMajorSuggestions: (value: boolean) => void;
  minorMatches: readonly string[];
  showMinorSuggestions: boolean;
  setShowMinorSuggestions: (value: boolean) => void;
}) {
  const { step, draft, update } = props;
  if (step === 0) return <QuestionShell eyebrow="School" title="What school do you attend?" helper="This helps us find opportunities specific to your school."><Combobox id="onboarding-school" value={draft.schoolQuery} placeholder="Search for your school" selected={props.selectedSchool?.name ?? draft.schoolName} matches={props.schoolMatches.map((school) => ({ id: school.slug, label: school.name, meta: `${school.location} · ${school.domain}`, value: school.name, source: school }))} show={props.showSchoolSuggestions && Boolean(normalizeSchoolQuery(draft.schoolQuery))} setShow={props.setShowSchoolSuggestions} onChange={(value) => update({ schoolQuery: value, schoolSlug: "", schoolName: "" })} onChoose={(item) => props.chooseSchool(item.source as School)} emptyAction={draft.schoolQuery.trim().length >= 2 ? { label: `Use “${draft.schoolQuery.trim()}”`, onChoose: props.chooseCustomSchool } : undefined} /></QuestionShell>;
  if (step === 1) return <QuestionShell eyebrow="Graduation Year" title="When do you expect to graduate?" helper="Helps us show programs you are currently eligible for."><select aria-label="Select year" value={draft.graduationYear} onChange={(event) => update({ graduationYear: event.target.value })} className="min-h-12 w-full rounded-xl border border-ink/15 bg-white px-4 text-sm font-bold outline-none focus:border-forest"><option value="">Select year</option>{graduationYears().map((year) => <option key={year} value={year}>{year}</option>)}</select></QuestionShell>;
  if (step === 2) return <QuestionShell eyebrow="Academic Focus" title="What are you studying?" helper="Your primary major checks eligibility. A second major and minor are optional.">
    <div className="space-y-4">
      <LabeledCombobox label="Primary major" id="onboarding-major" value={draft.major} placeholder="Search for your major" matches={props.majorMatches} show={props.showMajorSuggestions} setShow={props.setShowMajorSuggestions} onChange={(major) => update({ major })} />
      <LabeledCombobox label="Second major (optional)" id="onboarding-secondary-major" value={draft.secondaryMajor} placeholder="Add a second major" matches={props.secondaryMajorMatches} show={props.showSecondaryMajorSuggestions} setShow={props.setShowSecondaryMajorSuggestions} onChange={(secondaryMajor) => update({ secondaryMajor })} />
      <LabeledCombobox label="Minor (optional)" id="onboarding-minor" value={draft.minor} placeholder="Add a minor" matches={props.minorMatches} show={props.showMinorSuggestions} setShow={props.setShowMinorSuggestions} onChange={(minor) => update({ minor, minorStatus: minor.trim() ? "declared" : "none" })} />
    </div>
  </QuestionShell>;
  if (step === 3) return <QuestionShell eyebrow="Opportunity Types" title="What kinds of opportunities are you looking for?" helper="Used to prioritize the kinds of opportunities you want to see."><ChoiceGrid options={opportunityTypeOptions} values={draft.opportunityTypeInterests} onToggle={(value) => props.toggleSelection("opportunityTypeInterests", value)} /></QuestionShell>;
  if (step === 4) return <QuestionShell eyebrow="Fields" title="What fields are you interested in?" helper="Choose up to five. This helps For You find work related to what you study and care about.">
    <ChoiceGrid options={fieldInterestOptions} values={draft.fieldInterests} onToggle={(value) => props.toggleSelection("fieldInterests", value, onboardingSelectionLimits.fieldInterests)} />
    {draft.fieldInterests.includes("Other") ? <InlineTextField id="onboarding-other-field" label="Other field" value={draft.otherFieldInterest} onChange={(otherFieldInterest) => update({ otherFieldInterest })} placeholder="Example: Urban planning" /> : null}
  </QuestionShell>;
  if (step === 5) return <QuestionShell eyebrow="Current Goals" title="What are you working toward right now?" helper="Choose up to four current priorities. These are not permanent career labels."><ChoiceGrid options={currentGoalOptions} values={draft.goals} onToggle={(value) => props.toggleSelection("goals", value, onboardingSelectionLimits.currentGoals)} /></QuestionShell>;
  if (step === 6) return <QuestionShell eyebrow="Location" title="How would you like to participate?" helper="Used to prioritize opportunities that fit where and how you want to take part."><OptionChoiceGrid options={locationFormatOptions} values={draft.locationFormats} onToggle={(value) => props.togglePractical("locationFormats", value)} /></QuestionShell>;
  if (step === 7) return <QuestionShell eyebrow="Compensation" title="How important is paid work?" helper="This preference affects ranking. It never changes eligibility."><SingleOptionChoiceGrid options={compensationOptions} value={draft.compensationPreference} onChoose={(compensationPreference) => update({ compensationPreference })} /></QuestionShell>;
  if (step === 8) return <QuestionShell eyebrow="Time Commitment" title="What time commitment fits you?" helper="Choose any formats that realistically fit your schedule."><OptionChoiceGrid options={timeCommitmentOptions} values={draft.timeCommitments} onToggle={(value) => props.togglePractical("timeCommitments", value)} /></QuestionShell>;
  return <QuestionShell eyebrow="Optional Refinement" title="Any specific career paths you are interested in?" helper="Optional. Choose up to five, or finish without selecting one.">
    <ChoiceGrid options={careerPathOptions} values={draft.specificCareerInterests} onToggle={(value) => props.toggleSelection("specificCareerInterests", value, onboardingSelectionLimits.specificCareerInterests)} />
    {draft.specificCareerInterests.includes("Other") ? <InlineTextField id="onboarding-other-career" label="Other career path" value={draft.otherCareerInterest} onChange={(otherCareerInterest) => update({ otherCareerInterest })} placeholder="Example: Museum curation" /> : null}
  </QuestionShell>;
}

function QuestionShell({ eyebrow, title, helper, children }: { eyebrow: string; title: string; helper?: string; children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-xl text-center">
    <p className="rule-label text-forest">{eyebrow}</p>
    <h1 tabIndex={-1} data-onboarding-heading style={{ outline: "none" }} className="mt-3 font-editorial text-4xl font-bold leading-tight text-ink sm:text-5xl">{title}</h1>
    {helper && <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/52">{helper}</p>}
    <div className="mt-8 text-left">{children}</div>
  </div>;
}

type ComboItem = { id: string; label: string; value: string; meta?: string; source?: unknown };
function Combobox({ id, value, selected, placeholder, matches, show, setShow, onChange, onChoose, emptyAction }: { id: string; value: string; selected?: string; placeholder: string; matches: ComboItem[]; show: boolean; setShow: (value: boolean) => void; onChange: (value: string) => void; onChoose: (item: ComboItem) => void; emptyAction?: { label: string; onChoose: () => void } }) {
  return <div className="relative" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setShow(false);
  }}>
    <label htmlFor={id} className="sr-only">{placeholder}</label>
    <div className={`flex min-h-12 items-center gap-3 rounded-xl border bg-white px-4 ${selected ? "border-forest" : "border-ink/15"} focus-within:border-forest`}>
      <SearchIcon className="h-4 w-4 shrink-0 text-ink/35" />
      <input id={id} value={value} onFocus={() => setShow(true)} onKeyDown={(event) => {
        if (event.key === "Escape" && show) {
          event.stopPropagation();
          setShow(false);
        }
      }} onChange={(event) => { onChange(event.target.value); setShow(true); }} placeholder={placeholder} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={show} aria-controls={`${id}-listbox`} className="min-w-0 flex-1 bg-transparent py-3 text-sm font-bold outline-none placeholder:text-ink/30" />
    </div>
    {show && <div id={`${id}-listbox`} role="listbox" className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-ink/10 bg-white py-2 shadow-soft">
      {matches.length ? matches.map((item) => <button key={item.id} type="button" role="option" aria-selected={item.value === value} onMouseDown={(event) => event.preventDefault()} onClick={() => onChoose(item)} className="block min-h-11 w-full px-4 py-3 text-left hover:bg-paper"><span className="block text-sm font-bold">{item.label}</span>{item.meta && <span className="mt-1 block text-xs text-ink/40">{item.meta}</span>}</button>) : emptyAction ? <button type="button" role="option" aria-selected="false" onMouseDown={(event) => event.preventDefault()} onClick={emptyAction.onChoose} className="block min-h-11 w-full px-4 py-3 text-left text-sm font-bold text-forest hover:bg-paper">{emptyAction.label}<span className="mt-1 block text-xs font-normal leading-5 text-ink/45">School-specific matches may be limited until it joins the catalog.</span></button> : <p className="px-4 py-3 text-sm font-bold text-ink/45">No match found.</p>}
    </div>}
  </div>;
}

function LabeledCombobox({ label, id, value, placeholder, matches, show, setShow, onChange }: { label: string; id: string; value: string; placeholder: string; matches: readonly string[]; show: boolean; setShow: (value: boolean) => void; onChange: (value: string) => void }) {
  return <div>
    <p className="mb-2 text-sm font-bold text-ink/72">{label}</p>
    <Combobox id={id} value={value} placeholder={placeholder} matches={matches.map((item) => ({ id: item, label: item, value: item }))} show={show} setShow={setShow} onChange={onChange} onChoose={(item) => { onChange(item.value); setShow(false); }} />
  </div>;
}

function InlineTextField({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label htmlFor={id} className="mt-4 block rounded-xl border border-ink/10 bg-paper/70 p-4">
    <span className="mb-2 block text-sm font-bold">{label}</span>
    <input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-12 w-full rounded-lg border border-ink/15 bg-white px-4 text-sm font-bold outline-none placeholder:text-ink/30 focus:border-forest" />
  </label>;
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-bold transition motion-reduce:transition-none ${selected ? "border-forest bg-forest text-white shadow-[0_12px_24px_rgba(31,95,67,.16)]" : "border-ink/12 bg-white text-ink/72 hover:border-forest hover:text-forest"}`}><span>{children}</span><span aria-hidden="true" className={`text-base transition-opacity ${selected ? "opacity-100" : "opacity-0"}`}>✓</span></button>;
}

function ChoiceGrid({ options, values, onToggle }: { options: readonly string[]; values: string[]; onToggle: (value: string) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2">{options.map((option) => <Choice key={option} selected={values.includes(option)} onClick={() => onToggle(option)}>{option}</Choice>)}</div>;
}

function OptionChoiceGrid<T extends string>({ options, values, onToggle }: { options: readonly { value: T; label: string }[]; values: readonly T[]; onToggle: (value: T) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2">{options.map((option) => <Choice key={option.value} selected={values.includes(option.value)} onClick={() => onToggle(option.value)}>{option.label}</Choice>)}</div>;
}

function SingleOptionChoiceGrid<T extends string>({ options, value, onChoose }: { options: readonly { value: T; label: string }[]; value: T; onChoose: (value: T) => void }) {
  return <div className="grid gap-3">{options.map((option) => <Choice key={option.value} selected={value === option.value} onClick={() => onChoose(option.value)}>{option.label}</Choice>)}</div>;
}

function CompletionScreen({ saving }: { saving: boolean }) {
  return <main className="min-h-[calc(100vh-80px)] bg-paper px-4 py-10 sm:px-8">
    <section className="mx-auto flex min-h-[62vh] max-w-3xl flex-col items-center justify-center rounded-[2rem] border border-ink/10 bg-white/72 px-6 py-12 text-center shadow-soft">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-forest text-3xl font-bold text-white">✓</div>
      <p className="mt-8 rule-label text-forest">Complete</p>
      <h1 className="mt-3 font-editorial text-4xl font-bold leading-tight text-ink sm:text-5xl">You&apos;re all set.</h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-ink/58">We&apos;re preparing opportunities around your profile.</p>
      {saving && <div className="mt-8 h-1.5 w-40 overflow-hidden rounded-full bg-ink/10"><div className="h-full w-1/2 animate-pulse rounded-full bg-forest" /></div>}
    </section>
  </main>;
}
