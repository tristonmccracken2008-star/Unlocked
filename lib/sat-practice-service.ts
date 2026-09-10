import "server-only";
import crypto from "node:crypto";
import { mutateSatPractice } from "./auth-store";
import {
  satPerformance,
  satQuestionBank,
  satTaxonomy,
  validatedSatQuestions,
  type SatDifficulty,
  type SatDomain,
  type SatPracticeSession,
  type SatPracticeStore,
  type SatQuestion,
  type SatSection,
} from "@/data/sat-practice";

export type PublicSatQuestion = Omit<
  SatQuestion,
  | "correctAnswer"
  | "explanation"
  | "distractorExplanations"
  | "validationStatus"
>;
const publicQuestion = ({
  correctAnswer: _answer,
  explanation: _explanation,
  distractorExplanations: _distractors,
  validationStatus: _status,
  ...question
}: SatQuestion): PublicSatQuestion => question;
const questionMap = new Map(
  satQuestionBank.map((question) => [question.id, question]),
);
export const publicSatQuestions = (questionIds: string[]) =>
  questionIds
    .map((id) => questionMap.get(id))
    .filter(
      (question): question is SatQuestion =>
        Boolean(question) && question!.validationStatus === "validated",
    )
    .map(publicQuestion);

export function recommendSatDomain(store: SatPracticeStore) {
  const stats = satPerformance(store).domains;
  const allDomains = Object.entries(satTaxonomy).flatMap(([section, value]) =>
    Object.entries(value.domains).map(([domain, meta]) => ({
      section: section as SatSection,
      domain: domain as SatDomain,
      label: meta.label,
    })),
  );
  const evidence = stats
    .filter((item) => item.attempted >= 4)
    .sort(
      (a, b) =>
        a.correct / a.attempted - b.correct / b.attempted ||
        (a.lastAttempt ?? "").localeCompare(b.lastAttempt ?? ""),
    );
  if (evidence[0])
    return {
      ...evidence[0],
      reason: `You answered ${evidence[0].correct} of ${evidence[0].attempted} questions correctly here. A focused set will add useful evidence without narrowing all practice to one area.`,
    };
  const uncovered = allDomains.find(
    (item) => !stats.some((stat) => stat.domain === item.domain),
  );
  return uncovered
    ? {
        ...uncovered,
        attempted: 0,
        correct: 0,
        reason:
          "You do not have enough practice in this domain yet. This will broaden your diagnostic coverage.",
      }
    : {
        ...allDomains[0],
        attempted: 0,
        correct: 0,
        reason:
          "A balanced set is the best next step until more practice history is available.",
      };
}

function selectQuestions(
  store: SatPracticeStore,
  input: {
    mode: "quick" | "focused" | "reattempt";
    section?: SatSection;
    domain?: SatDomain;
    difficulty?: SatDifficulty;
    count: number;
  },
) {
  if (input.mode === "reattempt") {
    const missed = [...satPerformance(store).mistakes]
      .reverse()
      .map((attempt) => questionMap.get(attempt.questionId))
      .filter((question): question is SatQuestion => Boolean(question));
    return [
      ...new Map(missed.map((question) => [question.id, question])).values(),
    ].slice(0, input.count);
  }
  let candidates = validatedSatQuestions.filter(
    (question) =>
      (!input.section || question.section === input.section) &&
      (!input.domain || question.domain === input.domain) &&
      (!input.difficulty || question.difficulty === input.difficulty),
  );
  if (input.mode === "quick" && !input.section && !input.domain) {
    const recommendation = recommendSatDomain(store);
    candidates = [
      ...candidates.filter((q) => q.domain === recommendation.domain),
      ...candidates.filter((q) => q.domain !== recommendation.domain),
    ];
  }
  return candidates.slice(0, input.count);
}

export async function startSatSession(
  userId: string,
  store: SatPracticeStore,
  input: {
    mode: "quick" | "focused" | "reattempt";
    section?: SatSection;
    domain?: SatDomain;
    difficulty?: SatDifficulty;
    count: number;
    timed: boolean;
  },
) {
  const selected = selectQuestions(store, input);
  if (!selected.length)
    throw new Error("No validated questions match those filters yet.");
  const now = new Date().toISOString();
  const session: SatPracticeSession = {
    id: `sat_${crypto.randomUUID()}`,
    mode: input.mode,
    section: input.section,
    domain: input.domain,
    difficulty: input.difficulty,
    timed: input.timed,
    durationSeconds: input.timed ? selected.length * 75 : undefined,
    questionIds: selected.map((q) => q.id),
    attempts: [],
    status: "active",
    createdAt: now,
  };
  const result = await mutateSatPractice(userId, {
    expectedVersion: store.version,
    mutate: (current) => ({
      ...current,
      sessions: [...current.sessions, session],
    }),
  });
  return {
    store: result.store,
    session,
    questions: selected.map(publicQuestion),
  };
}

export async function answerSatQuestion(
  userId: string,
  store: SatPracticeStore,
  input: {
    sessionId: string;
    questionId: string;
    answer: string;
    elapsedSeconds?: number;
    markedForReview: boolean;
  },
) {
  const question = questionMap.get(input.questionId);
  const session = store.sessions.find(
    (item) => item.id === input.sessionId && item.status === "active",
  );
  if (!question || !session?.questionIds.includes(question.id))
    throw new Error("This practice question is unavailable.");
  const answer = input.answer.trim();
  const correct =
    question.format === "multiple_choice"
      ? answer.toUpperCase() === question.correctAnswer
      : Number(answer) === Number(question.correctAnswer);
  const record = {
    questionId: question.id,
    questionVersion: question.version,
    answer: answer.slice(0, 80),
    correct,
    elapsedSeconds: input.elapsedSeconds,
    markedForReview: input.markedForReview,
    attemptedAt: new Date().toISOString(),
  };
  const result = await mutateSatPractice(userId, {
    expectedVersion: store.version,
    mutate: (current) => ({
      ...current,
      sessions: current.sessions.map((item) =>
        item.id === session.id
          ? { ...item, attempts: [...item.attempts, record] }
          : item,
      ),
    }),
  });
  return {
    store: result.store,
    feedback: {
      correct,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      distractorExplanation:
        question.format === "multiple_choice"
          ? question.distractorExplanations?.[
              answer.toUpperCase() as "A" | "B" | "C" | "D"
            ]
          : undefined,
      skill: question.skill,
      domain: (
        satTaxonomy[question.section].domains as Record<
          string,
          { label: string }
        >
      )[question.domain].label,
    },
  };
}

export async function completeSatSession(
  userId: string,
  store: SatPracticeStore,
  sessionId: string,
) {
  return (
    await mutateSatPractice(userId, {
      expectedVersion: store.version,
      mutate: (current) => ({
        ...current,
        sessions: current.sessions.map((item) =>
          item.id === sessionId
            ? {
                ...item,
                status: "completed",
                completedAt: new Date().toISOString(),
              }
            : item,
        ),
      }),
    })
  ).store;
}

export async function reflectOnSatMistake(
  userId: string,
  store: SatPracticeStore,
  input: {
    sessionId: string;
    questionId: string;
    attemptedAt: string;
    reflection: NonNullable<
      SatPracticeSession["attempts"][number]["reflection"]
    >;
  },
) {
  return (
    await mutateSatPractice(userId, {
      expectedVersion: store.version,
      mutate: (current) => ({
        ...current,
        sessions: current.sessions.map((session) =>
          session.id === input.sessionId
            ? {
                ...session,
                attempts: session.attempts.map((attempt) =>
                  attempt.questionId === input.questionId &&
                  attempt.attemptedAt === input.attemptedAt
                    ? { ...attempt, reflection: input.reflection }
                    : attempt,
                ),
              }
            : session,
        ),
      }),
    })
  ).store;
}
