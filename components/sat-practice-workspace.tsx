"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { authenticatedFetch } from "@/data/authenticated-request";
import {
  satPerformance,
  satTaxonomy,
  type SatDifficulty,
  type SatDomain,
  type SatPracticeSession,
  type SatPracticeStore,
  type SatQuestion,
  type SatSection,
} from "@/data/sat-practice";
import type { PublicSatQuestion } from "@/lib/sat-practice-service";

type View = "overview" | "practice" | "tests" | "review";
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
  nextTest,
  initialSession,
  initialQuestions,
}: {
  initialStore: SatPracticeStore;
  recommendation: Recommendation;
  officialScore?: number;
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
  const liveRecommendation = useMemo(() => {
    const evidence = performance.domains
      .filter((item) => item.attempted >= 4)
      .sort((a, b) => a.correct / a.attempted - b.correct / b.attempted)[0];
    return evidence
      ? {
          ...evidence,
          reason: `You answered ${evidence.correct} of ${evidence.attempted} questions correctly here. A focused set will add useful evidence while balanced practice preserves broad coverage.`,
        }
      : recommendation;
  }, [performance, recommendation]);
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
            <p className="rule-label text-forest">Digital SAT practice</p>
            <h1 className="mt-3 font-editorial text-5xl font-semibold sm:text-6xl">
              Practice with purpose.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-ink/52">
              Build skill evidence, understand mistakes, and choose what to
              practice next. Practice results never become official SAT scores.
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
          </div>
        </header>
        <nav
          aria-label="SAT workspace"
          className="mt-6 flex gap-1 overflow-x-auto rounded-full border border-ink/8 bg-white/40 p-1 sm:w-fit dark:bg-white/[.03]"
        >
          {(["overview", "practice", "tests", "review"] as View[]).map(
            (item) => (
              <button
                key={item}
                type="button"
                aria-current={view === item ? "page" : undefined}
                onClick={() => setView(item)}
                className={`min-h-11 rounded-full px-5 text-sm font-bold capitalize ${view === item ? "bg-white text-forest shadow-sm dark:bg-white/10" : "text-ink/48 hover:text-forest"}`}
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
            recommendation={liveRecommendation}
            store={store}
            start={start}
            pending={pending}
          />
        ) : null}
        {view === "practice" ? (
          <PracticeChooser start={start} pending={pending} />
        ) : null}
        {view === "tests" ? (
          <TestsView store={store} start={start} pending={pending} />
        ) : null}
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
}: {
  performance: ReturnType<typeof satPerformance>;
  recommendation: Recommendation;
  store: SatPracticeStore;
  start: (input: {
    mode: "quick" | "focused" | "reattempt";
    section?: SatSection;
    domain?: SatDomain;
    timed?: boolean;
  }) => void;
  pending: boolean;
}) {
  const completed = store.sessions.filter((s) => s.status === "completed");
  return (
    <div className="mt-8 space-y-6">
      <section className="grid gap-px overflow-hidden rounded-[1.75rem] border border-ink/10 bg-ink/10 lg:grid-cols-[1.25fr_.75fr]">
        <div className="bg-ink p-7 text-white sm:p-9">
          <p className="rule-label text-mint">Practice next</p>
          <h2 className="mt-3 font-editorial text-4xl font-semibold">
            {recommendation.label}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
            {recommendation.reason}
          </p>
          <button
            disabled={pending}
            onClick={() =>
              void start({
                mode: "focused",
                section: recommendation.section,
                domain: recommendation.domain,
              })
            }
            className={`${button} mt-6 bg-white text-forest`}
          >
            Start focused practice →
          </button>
        </div>
        <div className="bg-[var(--unlocked-surface)] p-7">
          <p className="rule-label text-ink/40">Quick practice</p>
          <h2 className="mt-3 font-editorial text-2xl font-semibold">
            A balanced 10-question set
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink/48">
            Uses broad coverage until your history can support a more specific
            recommendation.
          </p>
          <button
            disabled={pending}
            onClick={() => void start({ mode: "quick" })}
            className={`${button} mt-5 bg-forest text-white`}
          >
            Begin quick practice
          </button>
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
          label="Recent mistakes"
          value={String(performance.mistakes.length)}
        />
        <Metric label="Completed sessions" value={String(completed.length)} />
      </section>
      <DomainPerformance store={store} />
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

function PracticeChooser({
  start,
  pending,
}: {
  start: (input: {
    mode: "quick" | "focused";
    section?: SatSection;
    domain?: SatDomain;
    difficulty?: SatDifficulty;
    timed?: boolean;
  }) => void;
  pending: boolean;
}) {
  const [section, setSection] = useState<SatSection | "mixed">("mixed");
  const [domain, setDomain] = useState<SatDomain | "">("");
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
                onClick={() => setDomain(id)}
                className={`min-h-12 rounded-xl border px-4 text-left text-sm font-semibold ${domain === id ? "border-forest bg-mint/40" : "border-ink/10"}`}
              >
                {meta.label}
              </button>
            ))}
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

function DomainPerformance({ store }: { store: SatPracticeStore }) {
  const stats = satPerformance(store).domains;
  return (
    <section className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6">
      <p className="rule-label text-ink/38">Performance by domain</p>
      <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
        {Object.entries(satTaxonomy).flatMap(([section, value]) =>
          Object.entries(value.domains).map(([domain, meta]) => {
            const item = stats.find((stat) => stat.domain === domain);
            return (
              <div
                key={domain}
                className="flex items-center justify-between gap-4 border-t border-ink/10 py-4"
              >
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
              </div>
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
}: {
  store: SatPracticeStore;
  start: (input: { mode: "quick"; timed: boolean }) => void;
  pending: boolean;
}) {
  const completed = store.sessions.filter((s) => s.status === "completed");
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section>
        <p className="rule-label text-ink/38">Practice history</p>
        <h2 className="mt-2 font-editorial text-3xl font-semibold">
          Completed sets
        </h2>
        <div className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
          {completed
            .slice()
            .reverse()
            .map((s) => (
              <div key={s.id} className="flex justify-between gap-4 py-4">
                <span>
                  <strong className="block text-sm capitalize">
                    {s.mode} practice
                  </strong>
                  <small className="text-xs text-ink/42">
                    {dateLabel(s.completedAt ?? s.createdAt)} ·{" "}
                    {s.timed ? "Timed" : "Untimed"}
                  </small>
                </span>
                <span className="text-sm font-bold">
                  {s.attempts.filter((a) => a.correct).length}/
                  {s.attempts.length}
                </span>
              </div>
            ))}
          {!completed.length ? (
            <p className="py-5 text-sm text-ink/45">
              No completed practice sets yet.
            </p>
          ) : null}
        </div>
      </section>
      <aside className="rounded-2xl bg-ink p-6 text-white">
        <p className="rule-label text-mint">Timed set</p>
        <h2 className="mt-3 font-editorial text-2xl font-semibold">
          10 questions, calm timer
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/55">
          Useful for pacing practice. This is not an official adaptive module or
          predicted score.
        </p>
        <button
          disabled={pending}
          onClick={() => void start({ mode: "quick", timed: true })}
          className={`${button} mt-5 bg-white text-forest`}
        >
          Start timed set
        </button>
      </aside>
    </div>
  );
}

function ReviewView({
  store,
  start,
  pending,
  request,
  setStore,
}: {
  store: SatPracticeStore;
  start: (input: { mode: "reattempt" }) => void;
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
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section>
        <p className="rule-label text-ink/38">Mistake journal</p>
        <h2 className="mt-2 font-editorial text-3xl font-semibold">
          Understand what happened.
        </h2>
        <div className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
          {mistakes.map(({ session, attempt }, i) => (
            <div
              key={`${attempt.questionId}:${attempt.attemptedAt}:${i}`}
              className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <span>
                <strong className="block text-sm">
                  {attempt.questionId.replaceAll("-", " ")}
                </strong>
                <small className="mt-1 block text-xs text-ink/42">
                  {dateLabel(attempt.attemptedAt)} · Answered {attempt.answer}
                </small>
              </span>
              <select
                aria-label="Why did I miss this?"
                value={attempt.reflection ?? ""}
                onChange={async (e) => {
                  const result = await request({
                    action: "reflect",
                    sessionId: session.id,
                    questionId: attempt.questionId,
                    attemptedAt: attempt.attemptedAt,
                    reflection: e.target.value,
                  });
                  if (result?.store) setStore(result.store as SatPracticeStore);
                }}
                className="min-h-11 rounded-xl border border-ink/10 bg-white px-3 text-xs dark:bg-white/[.04]"
              >
                <option value="" disabled>
                  Why did I miss this?
                </option>
                <option value="didnt_know">Didn&apos;t know concept</option>
                <option value="misread">Misread question</option>
                <option value="calculation">Calculation error</option>
                <option value="time">Ran out of time</option>
                <option value="changed_answer">Changed correct answer</option>
                <option value="careless">Careless mistake</option>
                <option value="not_sure">Not sure</option>
              </select>
            </div>
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
