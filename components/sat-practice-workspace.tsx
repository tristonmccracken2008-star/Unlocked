"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { authenticatedFetch } from "@/data/authenticated-request";
import {
  normalizeSatPreparation,
  recentSatDomains,
  satNextAction,
  type BluebookResult,
} from "@/data/sat-command-center";
import {
  resourcesForSatSkill,
  satResources,
  satTestConfiguration,
  type SatResource,
} from "@/data/sat-resources";
import {
  satPerformance,
  satTaxonomy,
  validatedSatQuestions,
  type SatDifficulty,
  type SatDomain,
  type SatPracticeSession,
  type SatPracticeStore,
  type SatQuestion,
  type SatSection,
} from "@/data/sat-practice";
import type { PublicSatQuestion } from "@/lib/sat-practice-service";

type View = "overview" | "practice" | "review" | "tests" | "resources";
type Feedback = {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  distractorExplanation?: string;
  skill: string;
  domain: string;
};
type Recommendation = {
  section: SatSection;
  domain: SatDomain;
  label: string;
  attempted: number;
  correct: number;
  reason: string;
};
const button =
  "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-forest/30";
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));

export function SatPracticeWorkspace({
  initialStore,
  recommendation,
  officialScore,
  goal,
  nextTest,
  initialSession,
  initialQuestions,
}: {
  initialStore: SatPracticeStore;
  recommendation: Recommendation;
  officialScore?: number;
  goal?: number;
  nextTest?: string;
  initialSession?: SatPracticeSession;
  initialQuestions: PublicSatQuestion[];
}) {
  const [store, setStore] = useState(initialStore);
  const [view, setView] = useState<View>(initialSession ? "practice" : "overview");
  const [session, setSession] = useState<SatPracticeSession | undefined>(initialSession);
  const [questions, setQuestions] = useState<PublicSatQuestion[]>(initialQuestions);
  const [index, setIndex] = useState(initialSession ? Math.min(initialSession.attempts.length, Math.max(0, initialQuestions.length - 1)) : 0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback>();
  const [marked, setMarked] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const performance = useMemo(() => satPerformance(store), [store]);
  const current = questions[index];
  useEffect(() => {
    if (!session?.timed || session.status !== "active" || feedback) return;
    const timer = window.setInterval(
      () => setElapsed((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [session?.timed, session?.status, feedback, index]);
  useEffect(() => {
    document.body.classList.toggle("sat-practice-active", Boolean(session));
    return () => document.body.classList.remove("sat-practice-active");
  }, [session]);

  async function request(body: Record<string, unknown>) {
    setPending(true);
    setError("");
    try {
      const response = await authenticatedFetch("/api/sat-practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, expectedVersion: store.version }),
      });
      const result = (await response.json()) as Record<string, unknown>;
      if (!response.ok)
        throw new Error(
          String(result.error ?? "SAT practice could not be updated."),
        );
      return result;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "SAT practice could not be updated.",
      );
      return null;
    } finally {
      setPending(false);
    }
  }
  async function start(input: {
    mode: "quick" | "focused" | "reattempt";
    section?: SatSection;
    domain?: SatDomain;
    skill?: string;
    difficulty?: SatDifficulty;
    count?: number;
    timed?: boolean;
  }) {
    const result = await request({ action: "start", count: 10, ...input });
    if (!result) return;
    setStore(result.store as SatPracticeStore);
    setSession(result.session as SatPracticeSession);
    setQuestions(result.questions as PublicSatQuestion[]);
    setIndex(0);
    setAnswer("");
    setFeedback(undefined);
    setMarked(false);
    setElapsed(0);
    setView("practice");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function submit() {
    if (!session || !current) return;
    const result = await request({
      action: "answer",
      sessionId: session.id,
      questionId: current.id,
      answer,
      markedForReview: marked,
      elapsedSeconds: elapsed,
    });
    if (!result) return;
    setStore(result.store as SatPracticeStore);
    setFeedback(result.feedback as Feedback);
  }
  async function next() {
    if (index < questions.length - 1) {
      setIndex(index + 1);
      setAnswer("");
      setFeedback(undefined);
      setMarked(false);
      setElapsed(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!session) return;
    const result = await request({ action: "complete", sessionId: session.id });
    if (result) {
      setStore(result.store as SatPracticeStore);
      setSession(undefined);
      setQuestions([]);
      setView("overview");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  if (session && current)
    return (
      <QuestionScreen
        question={current}
        number={index + 1}
        total={questions.length}
        answer={answer}
        setAnswer={setAnswer}
        feedback={feedback}
        marked={marked}
        setMarked={setMarked}
        elapsed={elapsed}
        timed={session.timed}
        pending={pending}
        error={error}
        submit={submit}
        next={next}
        exit={() => {
          setSession(undefined);
          setQuestions([]);
          setView("overview");
        }}
      />
    );

  return (
    <main className="min-h-screen px-5 pb-28 pt-10 sm:px-8 sm:pt-14">
      <div className="mx-auto max-w-6xl">
        <nav className="text-xs font-bold text-ink/40">
          <Link href="/academics" className="hover:text-forest">
            Academics
          </Link>
          <span className="px-2">/</span>SAT
        </nav>
        <header className="mt-7 grid gap-7 border-b border-ink/10 pb-9 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="rule-label text-forest">SAT command center</p>
            <h1 className="mt-3 font-editorial text-5xl font-semibold sm:text-6xl">
              Know what to do next.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-ink/52">
              Plan, practice, review mistakes, and connect your results to the
              strongest official and trusted SAT resources.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Metric
              label="Official SAT"
              value={officialScore ? String(officialScore) : "Not recorded"}
            />
            <Metric
              label="Next SAT"
              value={nextTest ? dateLabel(nextTest) : "Not scheduled"}
            />
            <Metric label="Goal" value={goal ? String(goal) : "Not set"} />
            <Metric
              label="Latest Bluebook"
              value={String(normalizeSatPreparation(store.preparation).bluebook.slice().sort((a,b)=>b.date.localeCompare(a.date))[0]?.total ?? "Not recorded")}
            />
          </div>
        </header>
        <nav
          aria-label="SAT workspace"
          className="mt-6 grid grid-cols-5 gap-1 rounded-full border border-ink/8 bg-white/40 p-1 sm:flex sm:w-fit dark:bg-white/[.03]"
        >
          {(["overview", "practice", "review", "tests", "resources"] as View[]).map(
            (item) => (
              <button
                key={item}
                type="button"
                data-view={item}
                aria-current={view === item ? "page" : undefined}
                onClick={() => setView(item)}
                className={`min-h-11 min-w-0 rounded-full px-1 text-[11px] font-bold capitalize sm:px-5 sm:text-sm ${view === item ? "bg-white text-forest shadow-sm dark:bg-white/10" : "text-ink/48 hover:text-forest"}`}
              >
                {item}
              </button>
            ),
          )}
        </nav>
        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-700/15 bg-red-50 p-4 text-sm font-bold text-red-700"
          >
            {error}
          </p>
        ) : null}
        {view === "overview" ? (
          <Overview
            performance={performance}
            recommendation={recommendation}
            store={store}
            start={start}
            pending={pending}
            nextTest={nextTest}
            request={request}
            setStore={setStore}
          />
        ) : null}
        {view === "practice" ? (
          <PracticeChooser start={start} pending={pending} />
        ) : null}
        {view === "tests" ? (
          <TestsView store={store} start={start} pending={pending} request={request} setStore={setStore} officialScore={officialScore} />
        ) : null}
        {view === "resources" ? <ResourcesView store={store} start={start} /> : null}
        {view === "review" ? (
          <ReviewView
            store={store}
            start={start}
            pending={pending}
            request={request}
            setStore={setStore}
          />
        ) : null}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-36 rounded-xl border border-ink/10 bg-[var(--unlocked-surface)] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/38">
        {label}
      </p>
      <p className="mt-2 font-editorial text-xl font-semibold">{value}</p>
    </div>
  );
}

function Overview({
  performance,
  recommendation,
  store,
  start,
  pending,
  nextTest,
  request,
  setStore,
}: {
  performance: ReturnType<typeof satPerformance>;
  recommendation: Recommendation;
  store: SatPracticeStore;
  start: (input: {
    mode: "quick" | "focused" | "reattempt";
    section?: SatSection;
    domain?: SatDomain;
    skill?: string;
    timed?: boolean;
  }) => void;
  pending: boolean;
  nextTest?: string;
  request: (body: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  setStore: (store: SatPracticeStore) => void;
}) {
  const completed = store.sessions.filter((s) => s.status === "completed");
  const action = satNextAction(store, nextTest);
  const preparation = normalizeSatPreparation(store.preparation);
  const latest = [...preparation.bluebook].sort((a, b) => b.date.localeCompare(a.date))[0];
  const recommendationDomain = action.domain ?? recommendation.domain;
  const learning = resourcesForSatSkill(recommendationDomain)[0];
  const startAction = () => {
    if (action.kind === "review") {
      document.querySelector<HTMLButtonElement>('[data-view="review"]')?.click();
    } else if (action.kind === "bluebook") {
      window.open("https://bluebook.collegeboard.org/students/practice", "_blank", "noopener,noreferrer");
    } else if (action.kind === "learn" && learning) {
      window.open(learning.url, "_blank", "noopener,noreferrer");
    } else {
      void start({ mode: action.kind === "focused" ? "focused" : "quick", domain: action.kind === "focused" ? action.domain : undefined });
    }
  };
  return (
    <div className="mt-8 space-y-6">
      <section className="grid gap-px overflow-hidden rounded-[1.75rem] border border-ink/10 bg-ink/10 lg:grid-cols-[1.25fr_.75fr]">
        <div className="bg-ink p-7 text-white sm:p-9">
          <p className="rule-label text-mint">What should I do right now?</p>
          <h2 className="mt-3 font-editorial text-4xl font-semibold">
            {action.title}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
            {action.reason}
          </p>
          <button
            disabled={pending}
            onClick={startAction}
            className={`${button} mt-6 bg-white text-forest`}
          >
            {action.kind === "bluebook" ? "Open Bluebook" : action.kind === "review" ? "Review mistakes" : action.kind === "learn" ? "Open lesson" : "Start practice"} →
          </button>
        </div>
        <div className="bg-[var(--unlocked-surface)] p-7">
          <p className="rule-label text-ink/40">Your plan</p>
          <h2 className="mt-3 font-editorial text-2xl font-semibold">
            {nextTest ? `SAT on ${dateLabel(nextTest)}` : "Choose your next SAT date"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink/48">
            {latest ? `Latest Bluebook: ${latest.total} on ${dateLabel(latest.date)}.` : "Start with an official Bluebook diagnostic, then record the result here."}
          </p>
          <div className="mt-4 border-l border-forest/20 pl-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/38">This week</p><ol className="mt-2 space-y-1 text-xs leading-5 text-ink/52"><li>1 · {action.title}</li>{action.kind!=="quick"?<li>2 · Complete one balanced UnlockED practice set</li>:<li>2 · Review any mistakes before your next set</li>}{preparation.bluebookDate?<li>3 · Bluebook planned for {dateLabel(preparation.bluebookDate)}</li>:null}</ol></div>
          <StudyPlanForm store={store} pending={pending} request={request} setStore={setStore} />
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Questions practiced"
          value={String(performance.attempts.length)}
        />
        <Metric
          label="Correct"
          value={String(performance.attempts.filter((a) => a.correct).length)}
        />
        <Metric
          label="Mistakes to review"
          value={String(performance.mistakes.filter((a) => !a.reviewedAt).length)}
        />
        <Metric label="Completed sessions" value={String(completed.length)} />
      </section>
      <DomainPerformance store={store} start={start} />
      {performance.attempts.length === 0 && !latest ? <NewStudentStart /> : null}
      {learning ? (
        <section className="grid gap-5 rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div><p className="rule-label text-forest">Need to learn the concept?</p><h2 className="mt-2 font-editorial text-2xl font-semibold">{learning.provider} · {recommendation.label}</h2><p className="mt-2 text-sm leading-6 text-ink/50">{learning.description}</p></div>
          <a href={learning.url} target="_blank" rel="noreferrer" className={`${button} border border-forest/20 text-forest`}>Open resource →</a>
        </section>
      ) : null}
      <section className="rounded-2xl border border-ink/10 bg-mint/30 p-6">
        <p className="rule-label text-forest">Official full-length practice</p>
        <h2 className="mt-2 font-editorial text-2xl font-semibold">
          Use Bluebook for official adaptive tests.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/50">
          UnlockED focuses on targeted practice, review, and organization. It
          does not claim these short sets reproduce official adaptive scoring.
        </p>
        <a
          href="https://bluebook.collegeboard.org/students/practice"
          target="_blank"
          rel="noreferrer"
          className={`${button} mt-4 border border-forest/20 text-forest`}
        >
          Open official Bluebook practice →
        </a>
      </section>
    </div>
  );
}

function StudyPlanForm({ store, pending, request, setStore }: { store: SatPracticeStore; pending:boolean; request:(body:Record<string,unknown>)=>Promise<Record<string,unknown>|null>; setStore:(store:SatPracticeStore)=>void }) {
  const prep = normalizeSatPreparation(store.preparation);
  const [studyTime,setStudyTime] = useState(prep.studyTime);
  const [bluebookDate,setBluebookDate] = useState(prep.bluebookDate ?? "");
  return <form className="mt-5 grid gap-3" onSubmit={async e=>{e.preventDefault();const result=await request({action:"save_preparation",studyTime,bluebookDate});if(result?.store)setStore(result.store as SatPracticeStore)}}>
    <label className="text-xs font-bold text-ink/45">Weekly rhythm<select value={studyTime} onChange={e=>setStudyTime(e.target.value as typeof studyTime)} className="mt-2 min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 dark:bg-white/[.04]"><option value="light">Light · about 2 hours</option><option value="regular">Regular · about 4 hours</option><option value="focused">Focused · 6+ hours</option></select></label>
    <label className="text-xs font-bold text-ink/45">Next Bluebook practice<input type="date" value={bluebookDate} onChange={e=>setBluebookDate(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 dark:bg-white/[.04]" /></label>
    <button disabled={pending} className="min-h-11 text-left text-sm font-bold text-forest">Save plan →</button>
  </form>;
}

function NewStudentStart() {
  return <section className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6 sm:p-8"><p className="rule-label text-forest">Get started</p><h2 className="mt-2 font-editorial text-3xl font-semibold">Build a useful baseline.</h2><ol className="mt-5 grid gap-3 text-sm leading-6 text-ink/55 sm:grid-cols-2"><li><strong className="text-ink">1 · Learn the format.</strong><br/>Understand the two adaptive sections.</li><li><strong className="text-ink">2 · Take a diagnostic.</strong><br/>Use an official full-length Bluebook test.</li><li><strong className="text-ink">3 · Record the result.</strong><br/>Keep practice scores separate from official scores.</li><li><strong className="text-ink">4 · Follow the next action.</strong><br/>UnlockED will route you using available evidence.</li></ol></section>;
}

function PracticeChooser({
  start,
  pending,
}: {
  start: (input: {
    mode: "quick" | "focused";
    section?: SatSection;
    domain?: SatDomain;
    skill?: string;
    difficulty?: SatDifficulty;
    timed?: boolean;
  }) => void;
  pending: boolean;
}) {
  const [section, setSection] = useState<SatSection | "mixed">("mixed");
  const [domain, setDomain] = useState<SatDomain | "">("");
  const [skill, setSkill] = useState("");
  const [difficulty, setDifficulty] = useState<SatDifficulty | "">("");
  const [timed, setTimed] = useState(false);
  const domains =
    section === "mixed"
      ? []
      : (Object.entries(satTaxonomy[section].domains) as Array<
          [SatDomain, { label: string }]
        >);
  return (
    <section className="mt-8 grid gap-6 rounded-[1.75rem] border border-ink/10 bg-[var(--unlocked-surface)] p-6 sm:p-8 lg:grid-cols-[1fr_22rem]">
      <div>
        <p className="rule-label text-forest">Choose a focus</p>
        <h2 className="mt-3 font-editorial text-4xl font-semibold">
          Start with one decision.
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {(["mixed", "reading_writing", "math"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setSection(item);
                setDomain("");
                setSkill("");
              }}
              className={`min-h-20 rounded-xl border p-4 text-left text-sm font-bold ${section === item ? "border-forest bg-mint/50 text-forest" : "border-ink/10"}`}
            >
              {item === "mixed" ? "Mixed practice" : satTaxonomy[item].label}
            </button>
          ))}
        </div>
        {section !== "mixed" ? (
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {domains.map(([id, meta]) => (
              <button
                key={id}
                type="button"
                onClick={() => { setDomain(id); setSkill(""); }}
                className={`min-h-12 rounded-xl border px-4 text-left text-sm font-semibold ${domain === id ? "border-forest bg-mint/40" : "border-ink/10"}`}
              >
                {meta.label}
              </button>
            ))}
          </div>
        ) : null}
        {section !== "mixed" && domain ? (
          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[.12em] text-ink/38">Target a skill <span className="normal-case tracking-normal">· optional</span></p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(satTaxonomy[section].domains as Record<string,{skills:readonly string[]}>)[domain].skills.map(item=>{const available=validatedSatQuestions.some(q=>q.domain===domain&&q.skill===item);return <button key={item} type="button" disabled={!available} title={available?"Practice this skill":"Use the linked learning and official-question resources for this skill"} onClick={()=>setSkill(skill===item?"":item)} className={`min-h-11 rounded-full border px-4 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${skill===item?"border-forest bg-mint/40":"border-ink/10"}`}>{item}{available?'':' · resource only'}</button>})}
            </div>
          </div>
        ) : null}
      </div>
      <aside className="rounded-2xl bg-ink p-6 text-white">
        <label className="text-xs font-bold text-white/60">
          Difficulty
          <select
            value={difficulty}
            onChange={(e) =>
              setDifficulty(e.target.value as SatDifficulty | "")
            }
            className="mt-2 min-h-11 w-full rounded-xl bg-white px-3 text-sm text-ink"
          >
            <option value="">Balanced</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="mt-5 flex items-center gap-3 text-sm font-bold">
          <input
            type="checkbox"
            checked={timed}
            onChange={(e) => setTimed(e.target.checked)}
          />{" "}
          Calm timer
        </label>
        <p className="mt-2 text-xs leading-5 text-white/45">
          About 75 seconds per question. The interface will not change color as
          time passes.
        </p>
        <button
          disabled={pending}
          onClick={() =>
            void start({
              mode: section === "mixed" ? "quick" : "focused",
              section: section === "mixed" ? undefined : section,
              domain: domain || undefined,
              skill: skill || undefined,
              difficulty: difficulty || undefined,
              timed,
            })
          }
          className={`${button} mt-6 w-full bg-white text-forest`}
        >
          Start practice →
        </button>
      </aside>
    </section>
  );
}

function QuestionScreen({
  question,
  number,
  total,
  answer,
  setAnswer,
  feedback,
  marked,
  setMarked,
  elapsed,
  timed,
  pending,
  error,
  submit,
  next,
  exit,
}: {
  question: PublicSatQuestion;
  number: number;
  total: number;
  answer: string;
  setAnswer: (v: string) => void;
  feedback?: Feedback;
  marked: boolean;
  setMarked: (v: boolean) => void;
  elapsed: number;
  timed: boolean;
  pending: boolean;
  error: string;
  submit: () => void;
  next: () => void;
  exit: () => void;
}) {
  const [hint, setHint] = useState(0);
  return (
    <main className="fixed inset-0 z-[120] overflow-y-auto bg-[var(--unlocked-page)] px-5 py-5 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between border-b border-ink/10 pb-4">
          <button
            type="button"
            onClick={exit}
            className="min-h-11 text-sm font-bold text-ink/48"
          >
            Exit practice
          </button>
          <div className="text-center">
            <p className="text-xs font-bold">
              Question {number} of {total}
            </p>
            <div className="mt-2 h-1 w-32 rounded-full bg-ink/8">
              <div
                className="h-1 rounded-full bg-forest"
                style={{ width: `${(number / total) * 100}%` }}
              />
            </div>
          </div>
          <span className="min-w-20 text-right text-xs font-bold text-ink/45">
            {timed
              ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`
              : "Untimed"}
          </span>
        </header>
        <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_16rem]">
          <article>
            <p className="rule-label text-forest">
              {question.section === "math" ? "Math" : "Reading and Writing"} ·{" "}
              {
                (
                  satTaxonomy[question.section].domains as Record<
                    string,
                    { label: string }
                  >
                )[question.domain].label
              }
            </p>
            {question.passage ? (
              <blockquote className="mt-5 border-l-2 border-forest/25 pl-5 font-editorial text-lg leading-8">
                {question.passage}
              </blockquote>
            ) : null}
            <h1 className="mt-6 text-lg font-semibold leading-8">
              {question.prompt}
            </h1>
            {question.content?.map((item, i) => (
              <div
                key={i}
                className="mt-4 rounded-xl bg-ink/[.035] p-4 text-center font-editorial text-xl"
                aria-label={item.kind}
              >
                {item.value}
              </div>
            ))}
            <div className="mt-6 grid gap-3">
              {question.format === "multiple_choice" ? (
                question.choices?.map((choice) => (
                  <label
                    key={choice.id}
                    className={`flex min-h-14 cursor-pointer items-center gap-4 rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-forest/25 ${answer === choice.id ? "border-forest bg-mint/35" : "border-ink/10 hover:border-forest/25"}`}
                  >
                    <input
                      type="radio"
                      name="answer"
                      value={choice.id}
                      checked={answer === choice.id}
                      onChange={() => !feedback && setAnswer(choice.id)}
                      disabled={Boolean(feedback)}
                    />
                    <strong>{choice.id}</strong>
                    <span>{choice.text}</span>
                  </label>
                ))
              ) : (
                <label className="text-sm font-bold">
                  Your answer
                  <input
                    disabled={Boolean(feedback)}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    inputMode="decimal"
                    className="mt-2 min-h-14 w-full rounded-xl border border-ink/12 bg-white px-4 text-lg outline-none focus:border-forest focus:ring-2 focus:ring-forest/15 dark:bg-white/[.04]"
                  />
                </label>
              )}
            </div>
            {feedback ? (
              <div
                role="status"
                className={`mt-6 rounded-2xl border p-5 ${feedback.correct ? "border-forest/20 bg-mint/40" : "border-amber-700/20 bg-amber-50/70 dark:bg-amber-900/10"}`}
              >
                <p className="text-sm font-bold">
                  {feedback.correct ? "Correct" : "Not quite"}
                </p>
                {!feedback.correct ? (
                  <p className="mt-2 text-sm">
                    Correct answer: <strong>{feedback.correctAnswer}</strong>
                  </p>
                ) : null}
                <p className="mt-3 text-sm leading-7">{feedback.explanation}</p>
                {feedback.distractorExplanation ? (
                  <p className="mt-3 border-t border-ink/10 pt-3 text-xs leading-5 text-ink/55">
                    Why your choice missed: {feedback.distractorExplanation}
                  </p>
                ) : null}
                <p className="mt-3 text-xs font-bold text-forest">
                  Skill: {feedback.skill}
                </p>
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="mt-4 text-sm font-bold text-red-700">
                {error}
              </p>
            ) : null}
            <div className="mt-7 flex flex-wrap justify-between gap-3">
              <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={marked}
                  disabled={Boolean(feedback)}
                  onChange={(e) => setMarked(e.target.checked)}
                />{" "}
                Mark for review
              </label>
              {feedback ? (
                <button
                  type="button"
                  onClick={next}
                  className={`${button} bg-forest text-white disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  {number === total ? "Finish session" : "Next question"} →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending || !answer}
                  onClick={submit}
                  className={`${button} bg-forest text-white`}
                >
                  Check answer
                </button>
              )}
            </div>
          </article>
          <aside>
            <div className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-5">
              <p className="rule-label text-ink/38">Help</p>
              {!feedback && hint < question.hints.length ? (
                <button
                  type="button"
                  onClick={() => setHint(hint + 1)}
                  className="mt-3 min-h-11 text-sm font-bold text-forest"
                >
                  {hint ? "Another hint" : "Reveal a hint"} →
                </button>
              ) : null}
              {question.hints.slice(0, hint).map((text, i) => (
                <p key={i} className="mt-3 text-xs leading-5 text-ink/52">
                  {text}
                </p>
              ))}
              <p className="mt-5 border-t border-ink/10 pt-4 text-xs leading-5 text-ink/40">
                {question.source.label}. Not an official College Board question.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function DomainPerformance({ store, start }: { store: SatPracticeStore; start:(input:{mode:'focused';domain:SatDomain;skill?:string})=>void }) {
  const stats = satPerformance(store).domains;
  const allAttempts = store.sessions.flatMap(s=>s.attempts);
  return (
    <section className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6">
      <p className="rule-label text-ink/38">Performance by domain</p>
      <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
        {Object.entries(satTaxonomy).flatMap(([section, value]) =>
          Object.entries(value.domains).map(([domain, meta]) => {
            const item = stats.find((stat) => stat.domain === domain);
            return (
              <details
                key={domain}
                className="group border-t border-ink/10 py-4"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span>
                  <strong className="block text-sm">{meta.label}</strong>
                  <small className="text-xs text-ink/42">
                    {satTaxonomy[section as SatSection].label}
                  </small>
                  </span>
                  <span className="text-right text-sm font-bold">
                  {item?.attempted
                    ? `${item.correct}/${item.attempted}`
                    : "Not enough practice"}
                  {item && item.attempted >= 4 ? (
                    <small className="block text-xs font-normal text-ink/42">
                      {Math.round((item.correct / item.attempted) * 100)}%
                    </small>
                  ) : null}
                  </span>
                </summary>
                <div className="mt-4 grid gap-2 border-l border-ink/10 pl-4">{meta.skills.map((skill: string)=>{const ids=new Set(validatedSatQuestions.filter(q=>q.domain===domain&&q.skill===skill).map(q=>q.id));const attempts=allAttempts.filter(a=>ids.has(a.questionId));const recent=attempts.slice(-15);const available=ids.size>0;const resource=resourcesForSatSkill(domain as SatDomain,skill)[0];return <div key={skill} className="grid gap-2 py-2 text-xs sm:grid-cols-[1fr_auto] sm:items-center"><span><strong className="block">{skill}</strong><small className="text-ink/42">{recent.length?`${recent.filter(a=>a.correct).length}/${recent.length} recent · ${attempts.length} total`:'No practice yet'}</small></span><span className="flex gap-3">{available?<button onClick={()=>start({mode:'focused',domain:domain as SatDomain,skill})} className="font-bold text-forest">Practice</button>:null}{resource?<a href={resource.url} target="_blank" rel="noreferrer" className="font-bold text-forest">Learn</a>:null}</span></div>})}</div>
              </details>
            );
          }),
        )}
      </div>
    </section>
  );
}

function TestsView({
  store,
  start,
  pending,
  request,
  setStore,
  officialScore,
}: {
  store: SatPracticeStore;
  start: (input: { mode: "quick"; timed: boolean }) => void;
  pending: boolean;
  request: (body: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  setStore: (store: SatPracticeStore) => void;
  officialScore?: number;
}) {
  const completed = store.sessions.filter((s) => s.status === "completed");
  const results = normalizeSatPreparation(store.preparation).bluebook.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const [test,setTest]=useState("Bluebook Practice 1"), [date,setDate]=useState(""), [rw,setRw]=useState(""), [math,setMath]=useState(""), [notes,setNotes]=useState(""), [bands,setBands]=useState<Record<string,string>>({});
  async function save(e:FormEvent) { e.preventDefault(); const domains=Object.fromEntries(Object.entries(bands).filter(([,v])=>v).map(([k,v])=>[k,Number(v)])); const result=await request({action:"save_bluebook",test,date,readingWriting:Number(rw),math:Number(math),notes,domains}); if(result?.store){setStore(result.store as SatPracticeStore);setDate("");setRw("");setMath("");setNotes("");setBands({});} }
  return (
    <div className="mt-8 space-y-6">
      <section className="grid gap-px overflow-hidden rounded-[1.75rem] border border-ink/10 bg-ink/10 lg:grid-cols-[1fr_.8fr]">
        <div className="bg-ink p-7 text-white sm:p-8"><p className="rule-label text-mint">Official practice workflow</p><h2 className="mt-3 font-editorial text-3xl font-semibold">Take the test in Bluebook.</h2><p className="mt-3 text-sm leading-6 text-white/60">Bluebook provides the official adaptive experience. Afterward, record the practice result here so UnlockED can organize your progress.</p><a href="https://bluebook.collegeboard.org/students/practice" target="_blank" rel="noreferrer" className={`${button} mt-5 bg-white text-forest`}>Open Bluebook →</a></div>
        <form onSubmit={save} className="grid gap-3 bg-[var(--unlocked-surface)] p-7"><p className="rule-label text-forest">Record a Bluebook result</p><input required value={test} onChange={e=>setTest(e.target.value)} aria-label="Practice test name" placeholder="Practice test name" className="min-h-11 rounded-xl border border-ink/10 bg-white px-3 dark:bg-white/[.04]"/><input required type="date" max={new Date().toISOString().slice(0,10)} value={date} onChange={e=>setDate(e.target.value)} aria-label="Completed date" className="min-h-11 rounded-xl border border-ink/10 bg-white px-3 dark:bg-white/[.04]"/><div className="grid grid-cols-2 gap-2"><input required inputMode="numeric" value={rw} onChange={e=>setRw(e.target.value)} aria-label="Reading and Writing score" placeholder="R&W · 200–800" className="min-h-11 min-w-0 rounded-xl border border-ink/10 bg-white px-3 dark:bg-white/[.04]"/><input required inputMode="numeric" value={math} onChange={e=>setMath(e.target.value)} aria-label="Math score" placeholder="Math · 200–800" className="min-h-11 min-w-0 rounded-xl border border-ink/10 bg-white px-3 dark:bg-white/[.04]"/></div><details><summary className="min-h-11 cursor-pointer py-3 text-xs font-bold text-forest">Add optional domain bands</summary><p className="mb-3 text-[11px] leading-4 text-ink/40">Copy only the 1–7 performance bands shown in My Practice. These are not percentages.</p><div className="grid gap-2 sm:grid-cols-2">{Object.values(satTaxonomy).flatMap(section=>Object.entries(section.domains)).map(([domain,meta])=><label key={domain} className="text-[11px] font-semibold text-ink/50">{meta.label}<select value={bands[domain]??''} onChange={e=>setBands({...bands,[domain]:e.target.value})} className="mt-1 min-h-10 w-full rounded-lg border border-ink/10 bg-white px-2 dark:bg-white/[.04]"><option value="">Not recorded</option>{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n} of 7</option>)}</select></label>)}</div></details><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes · optional" className="min-h-20 rounded-xl border border-ink/10 bg-white p-3 dark:bg-white/[.04]"/><button disabled={pending} className="min-h-11 rounded-xl bg-forest text-sm font-bold text-white">Record practice score</button><p className="text-[11px] leading-4 text-ink/40">Saved as Bluebook practice. It will never be labeled an official SAT score.</p></form>
      </section>
      <section className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="rule-label text-ink/38">Score progress</p><h2 className="mt-2 font-editorial text-3xl font-semibold">Bluebook practice</h2></div>{officialScore ? <p className="text-sm"><span className="text-ink/45">Official best</span> <strong className="ml-2">{officialScore}</strong></p>:null}</div>
        {results.length ? <div className="mt-6 flex min-h-48 items-end gap-3 overflow-x-auto border-b border-ink/10 pb-4">{results.map(r=><div key={r.id} className="flex min-w-24 flex-1 flex-col justify-end"><strong className="mb-2 text-center text-sm">{r.total}</strong><div className="mx-auto w-10 rounded-t-lg bg-forest" style={{height:`${Math.max(24,(r.total-400)/7)}px`}}/><small className="mt-2 text-center text-[10px] leading-4 text-ink/45">{r.test}<br/>{dateLabel(r.date)}</small></div>)}</div>:<p className="mt-5 text-sm text-ink/45">No Bluebook practice scores recorded yet.</p>}
      </section>
      <section className="grid gap-6 lg:grid-cols-[1fr_20rem]"><div><p className="rule-label text-ink/38">UnlockED practice</p><h2 className="mt-2 font-editorial text-3xl font-semibold">Completed sets</h2><div className="mt-5 divide-y divide-ink/10 border-y border-ink/10">{completed.slice().reverse().map(s=><div key={s.id} className="flex justify-between gap-4 py-4"><span><strong className="block text-sm capitalize">{s.mode} practice</strong><small className="text-xs text-ink/42">{dateLabel(s.completedAt??s.createdAt)} · {s.timed?"Timed":"Untimed"}</small></span><span className="text-sm font-bold">{s.attempts.filter(a=>a.correct).length}/{s.attempts.length}</span></div>)}{!completed.length?<p className="py-5 text-sm text-ink/45">No completed practice sets yet.</p>:null}</div></div>
      <aside className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6"><p className="rule-label text-forest">UnlockED timed set</p><h2 className="mt-3 font-editorial text-2xl font-semibold">10 questions</h2><p className="mt-2 text-sm leading-6 text-ink/48">Useful for pacing. This is neither an official adaptive module nor a predicted score.</p><button disabled={pending} onClick={()=>void start({mode:"quick",timed:true})} className={`${button} mt-5 bg-forest text-white`}>Start timed set</button></aside></section>
    </div>
  );
}

function ResourcesView({ store, start }: { store:SatPracticeStore; start:(input:{mode:"focused";domain:SatDomain})=>void }) {
  const [filter,setFilter]=useState<'all'|'official'|'free'|'reading_writing'|'math'|'video'>('all');
  const domains=recentSatDomains(store);
  const resources=satResources.filter(r=>filter==='all'||filter==='official'&&r.provenance!=='Third-party'||filter==='free'&&r.cost==='Free'||filter==='video'&&r.formats.includes('Video')||filter==='reading_writing'&&r.section==='reading_writing'||filter==='math'&&r.section==='math');
  const groups=['Official practice','Learn a concept','Get human help','More practice','Watch'] as const;
  return <div className="mt-8 space-y-6">
    <section className="rounded-[1.75rem] bg-ink p-7 text-white sm:p-9"><p className="rule-label text-mint">Understand the SAT</p><h2 className="mt-3 font-editorial text-4xl font-semibold">98 questions. Two adaptive sections.</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">Reading and Writing has {satTestConfiguration.readingWriting.questions} questions in two {satTestConfiguration.readingWriting.minutes/2}-minute modules. Math has {satTestConfiguration.math.questions} questions in two {satTestConfiguration.math.minutes/2}-minute modules, with calculator access throughout. The second module in each section adapts based on your first-module performance. Total testing time is 2 hours 14 minutes, plus a {satTestConfiguration.breakMinutes}-minute break. Scores run from 400 to 1600.</p><a href={satTestConfiguration.source} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-mint">Verify current structure with College Board →</a></section>
    <section className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6"><p className="rule-label text-forest">Reading and Writing</p><h3 className="mt-2 font-editorial text-2xl font-semibold">Read, reason, revise.</h3><p className="mt-2 text-sm leading-6 text-ink/50">Information and Ideas · Craft and Structure · Expression of Ideas · Standard English Conventions</p></div><div className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6"><p className="rule-label text-forest">Math</p><h3 className="mt-2 font-editorial text-2xl font-semibold">Model, solve, interpret.</h3><p className="mt-2 text-sm leading-6 text-ink/50">Algebra · Advanced Math · Problem-Solving and Data Analysis · Geometry and Trigonometry</p></div></section>
    <section><p className="rule-label text-ink/38">Resource library</p><div className="mt-3 flex gap-2 overflow-x-auto">{(['all','official','free','reading_writing','math','video'] as const).map(item=><button key={item} onClick={()=>setFilter(item)} className={`min-h-11 whitespace-nowrap rounded-full border px-4 text-xs font-bold capitalize ${filter===item?'border-forest bg-mint/40 text-forest':'border-ink/10'}`}>{item.replace('_',' & ')}</button>)}</div>
      <div className="mt-7 space-y-8">{groups.map(group=>{const items=resources.filter(r=>r.purpose===group);return items.length?<div key={group}><h2 className="font-editorial text-2xl font-semibold">{group}</h2><div className="mt-3 divide-y divide-ink/10 border-y border-ink/10">{items.map(r=><ResourceRow key={r.id} resource={r}/>)}</div></div>:null})}</div>
    </section>
    {domains.some(d=>d.recent>=8&&d.unique>=4)?<section className="rounded-2xl border border-ink/10 bg-mint/25 p-6"><p className="rule-label text-forest">Connected to your practice</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{domains.filter(d=>d.recent>=8&&d.unique>=4).slice(0,2).map(d=><div key={d.domain}><h3 className="font-bold">{d.label}</h3><p className="mt-1 text-sm text-ink/50">{d.correct} of {d.recent} recent answers correct across {d.unique} different questions.</p><div className="mt-3 flex gap-4"><button onClick={()=>start({mode:'focused',domain:d.domain})} className="text-sm font-bold text-forest">Practice →</button><a href={resourcesForSatSkill(d.domain)[0]?.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-forest">Learn →</a></div></div>)}</div></section>:null}
  </div>;
}

function ResourceRow({resource}:{resource:SatResource}) { return <article className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{resource.provider} · {resource.title}</h3><span className="rounded-full bg-ink/[.05] px-2 py-1 text-[10px] font-bold uppercase tracking-wide">{resource.provenance}</span></div><p className="mt-2 text-sm leading-6 text-ink/52">{resource.description}</p><p className="mt-2 text-xs text-ink/40"><strong>Best for:</strong> {resource.bestFor} · {resource.cost} · {resource.formats.join(' / ')} · Verified {dateLabel(resource.lastVerified)}</p></div><a href={resource.url} target="_blank" rel="noreferrer" className={`${button} border border-forest/20 text-forest`}>Open →</a></article>; }

function ReviewView({
  store,
  start,
  pending,
  request,
  setStore,
}: {
  store: SatPracticeStore;
  start: (input: { mode: "reattempt" | "focused"; domain?:SatDomain; skill?:string }) => void;
  pending: boolean;
  request: (
    body: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
  setStore: (store: SatPracticeStore) => void;
}) {
  const mistakes = store.sessions
    .flatMap((session) =>
      session.attempts
        .filter((a) => !a.correct)
        .map((attempt) => ({ session, attempt })),
    )
    .reverse();
  const reflectionLabels: Record<string,string> = { didnt_know:"Concept",misread:"Misread",calculation:"Calculation",time:"Timing",changed_answer:"Changed answer",careless:"Careless",not_sure:"Not sure" };
  const patternCounts = mistakes.reduce<Record<string,number>>((acc,{attempt})=>{const key=attempt.reflection??"uncategorized";acc[key]=(acc[key]??0)+1;return acc},{});
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section>
        <p className="rule-label text-ink/38">Mistake journal</p>
        <h2 className="mt-2 font-editorial text-3xl font-semibold">
          Understand what happened.
        </h2>
        {mistakes.length >= 4 ? <div className="mt-5 flex flex-wrap gap-2">{Object.entries(patternCounts).sort((a,b)=>b[1]-a[1]).map(([key,count])=><span key={key} className="rounded-full bg-ink/[.05] px-3 py-2 text-xs"><strong>{count}</strong> {reflectionLabels[key]??"Uncategorized"}</span>)}</div>:null}
        <div className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
          {mistakes.map(({ session, attempt }, i) => (
            <ReviewQuestion
              key={`${attempt.questionId}:${attempt.attemptedAt}:${i}`}
              session={session} attempt={attempt} request={request} setStore={setStore} start={start}
            />
          ))}
          {!mistakes.length ? (
            <p className="py-5 text-sm text-ink/45">
              Mistakes will appear here automatically after practice.
            </p>
          ) : null}
        </div>
      </section>
      <aside className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6">
        <p className="rule-label text-forest">Reattempt</p>
        <h2 className="mt-3 font-editorial text-2xl font-semibold">
          Try missed questions again
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink/48">
          Answers stay hidden until you submit the new attempt.
        </p>
        <button
          disabled={pending || !mistakes.length}
          onClick={() => void start({ mode: "reattempt" })}
          className={`${button} mt-5 bg-forest text-white`}
        >
          Start reattempt →
        </button>
      </aside>
    </div>
  );
}

function ReviewQuestion({session,attempt,request,setStore,start}:{session:SatPracticeSession;attempt:SatPracticeSession['attempts'][number];request:(body:Record<string,unknown>)=>Promise<Record<string,unknown>|null>;setStore:(store:SatPracticeStore)=>void;start:(input:{mode:"focused";domain:SatDomain;skill?:string})=>void}) {
  const [question,setQuestion]=useState<SatQuestion>();
  const [open,setOpen]=useState(false);
  async function details(){if(!question){const result=await request({action:'review_question',sessionId:session.id,questionId:attempt.questionId,attemptedAt:attempt.attemptedAt});if(result?.question)setQuestion(result.question as SatQuestion);}setOpen(!open)}
  async function mutate(action:string,extra:Record<string,unknown>={}){const result=await request({action,sessionId:session.id,questionId:attempt.questionId,attemptedAt:attempt.attemptedAt,...extra});if(result?.store)setStore(result.store as SatPracticeStore)}
  const domain = question ? (satTaxonomy[question.section].domains as Record<string,{label:string}>)[question.domain].label : undefined;
  const learn = question ? resourcesForSatSkill(question.domain,question.skill)[0] : undefined;
  return <article className={`py-5 ${attempt.reviewedAt?'opacity-65':''}`}><div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center"><button type="button" onClick={()=>void details()} className="text-left"><strong className="block text-sm capitalize">{question?.skill??attempt.questionId.replaceAll('-',' ')}</strong><small className="mt-1 block text-xs text-ink/42">{dateLabel(attempt.attemptedAt)} · Your answer {attempt.answer}{attempt.elapsedSeconds!==undefined?` · ${attempt.elapsedSeconds}s`:''}{attempt.reviewedAt?' · Reviewed':''}</small></button><select aria-label="Why did I miss this?" value={attempt.reflection??''} onChange={e=>void mutate('reflect',{reflection:e.target.value})} className="min-h-11 rounded-xl border border-ink/10 bg-white px-3 text-xs dark:bg-white/[.04]"><option value="" disabled>Why did I miss this?</option><option value="didnt_know">Didn&apos;t know concept</option><option value="misread">Misread question</option><option value="calculation">Calculation error</option><option value="time">Timing</option><option value="changed_answer">Changed answer</option><option value="careless">Careless mistake</option><option value="not_sure">Not sure</option></select></div>
    {open&&question?<div className="mt-4 rounded-2xl bg-ink/[.035] p-5"><p className="text-xs font-bold text-forest">{domain} · {question.skill}</p>{question.passage?<p className="mt-3 font-editorial leading-7">{question.passage}</p>:null}<p className="mt-3 text-sm font-semibold leading-6">{question.prompt}</p>{question.choices?<div className="mt-3 grid gap-1 text-xs text-ink/50">{question.choices.map(c=><p key={c.id}>{c.id}. {c.text}</p>)}</div>:null}<p className="mt-4 text-sm">Your answer: <strong>{attempt.answer}</strong> · Correct answer: <strong>{question.correctAnswer}</strong></p><p className="mt-3 text-sm leading-6 text-ink/55">{question.explanation}</p><div className="mt-4 flex flex-wrap gap-4"><button onClick={()=>start({mode:'focused',domain:question.domain,skill:question.skill})} className="text-sm font-bold text-forest">Practice similar skill →</button>{learn?<a href={learn.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-forest">Learn this skill →</a>:null}<button onClick={()=>void mutate('reviewed',{reviewed:!attempt.reviewedAt})} className="text-sm font-bold text-forest">{attempt.reviewedAt?'Mark unreviewed':'Mark reviewed'} →</button></div></div>:null}
  </article>;
}
