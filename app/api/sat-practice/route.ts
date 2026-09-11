import crypto from "node:crypto";
import { mutateSatPractice } from "@/lib/auth-store";
import { normalizeSatPreparation, validSatDate, validSectionScore } from "@/data/sat-command-center";
import { satQuestionBank } from "@/data/sat-practice";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  normalizeSatPracticeStore,
  satTaxonomy,
  type SatDifficulty,
  type SatDomain,
  type SatSection,
} from "@/data/sat-practice";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import {
  answerSatQuestion,
  completeSatSession,
  reflectOnSatMistake,
  startSatSession,
} from "@/lib/sat-practice-service";
import {
  assertSameOrigin,
  enforceRateLimit,
  readBoundedJson,
  SecurityError,
  securityErrorResponse,
} from "@/lib/security";

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const safeId = (value: unknown) => {
  const result = clean(value, 180);
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/.test(result) ? result : "";
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession(
      (await cookies()).get(sessionCookieName)?.value,
    );
    if (!session)
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    if (session.data.educationalStage !== "high_school")
      return NextResponse.json(
        { error: "SAT Practice is available in High School UnlockED." },
        { status: 403 },
      );
    await enforceRateLimit(request, "sat-practice", 180, 60, session.user.id);
    const body = (await readBoundedJson(request, 20_000)) as Record<
      string,
      unknown
    >;
    const store = normalizeSatPracticeStore(session.data.satPractice);
    if (Number(body.expectedVersion) !== store.version)
      throw Object.assign(
        new Error(
          "Your SAT practice changed elsewhere. Refresh and try again.",
        ),
        { name: "SatPracticeConflictError" },
      );
    if (["save_preparation", "save_bluebook", "delete_bluebook", "reviewed"].includes(String(body.action))) {
      const preparation = normalizeSatPreparation(store.preparation);
      if (body.action === "save_preparation") {
        if (!["light", "regular", "focused"].includes(String(body.studyTime)) || (body.bluebookDate && !validSatDate(body.bluebookDate))) throw new SecurityError("Choose a valid study plan.",400,"invalid_plan");
        preparation.studyTime = body.studyTime as typeof preparation.studyTime;
        preparation.bluebookDate = validSatDate(body.bluebookDate) ? body.bluebookDate : undefined;
      }
      if (body.action === "save_bluebook") {
        const date = body.date;
        if (!validSatDate(date) || date > new Date().toISOString().slice(0,10) || !validSectionScore(body.readingWriting) || !validSectionScore(body.math) || !clean(body.test,80)) throw new SecurityError("Enter a completed test date and section scores from 200 to 800 in steps of 10.",400,"invalid_bluebook");
        const domains = body.domains && typeof body.domains === "object" && !Array.isArray(body.domains) ? body.domains as Record<string,unknown> : {};
        if (Object.entries(domains).some(([d,v])=>!Object.values(satTaxonomy).some(s=>d in s.domains) || typeof v !== "number" || !Number.isInteger(v) || v<1 || v>7)) throw new SecurityError("Domain bands must be whole numbers from 1 to 7.",400,"invalid_bands");
        const id = safeId(body.id) || `bluebook_${crypto.randomUUID()}`;
        preparation.bluebook = [...preparation.bluebook.filter(r=>r.id!==id), {id,test:clean(body.test,80),date,readingWriting:body.readingWriting,math:body.math,total:body.readingWriting+body.math,notes:clean(body.notes,2000),domains:domains as Record<SatDomain,number>}];
      }
      if (body.action === "delete_bluebook") preparation.bluebook = preparation.bluebook.filter(r=>r.id!==safeId(body.id));
      const next = await mutateSatPractice(session.user.id, {expectedVersion:store.version, mutate:current=>({...current,preparation,sessions:body.action === "reviewed" ? current.sessions.map(s=>s.id === body.sessionId ? {...s,attempts:s.attempts.map(a=>a.questionId===body.questionId && a.attemptedAt===body.attemptedAt ? {...a,reviewedAt:body.reviewed === false ? undefined : new Date().toISOString()} : a)} : s) : current.sessions})});
      return NextResponse.json({ok:true,store:next.store},{headers:{"Cache-Control":"no-store"}});
    }
    if (body.action === "review_question") {
      const attempt = store.sessions.find(s=>s.id===body.sessionId)?.attempts.find(a=>a.questionId===body.questionId && a.attemptedAt===body.attemptedAt);
      const question = satQuestionBank.find(q=>q.id===attempt?.questionId && q.version===attempt.questionVersion);
      if (!question) throw new SecurityError("This question version is unavailable.",404,"missing_question");
      return NextResponse.json({ok:true,question},{headers:{"Cache-Control":"no-store"}});
    }
    if (body.action === "start") {
      const mode = ["quick", "focused", "reattempt"].includes(String(body.mode))
        ? (body.mode as "quick" | "focused" | "reattempt")
        : "quick";
      const section =
        typeof body.section === "string" && body.section in satTaxonomy
          ? (body.section as SatSection)
          : undefined;
      const domains = Object.values(satTaxonomy).flatMap((value) =>
        Object.keys(value.domains),
      );
      const domain = domains.includes(String(body.domain))
        ? (body.domain as SatDomain)
        : undefined;
      const difficulty = ["easy", "medium", "hard"].includes(
        String(body.difficulty),
      )
        ? (body.difficulty as SatDifficulty)
        : undefined;
      const count = Math.max(1, Math.min(10, Number(body.count) || 10));
      const result = await startSatSession(session.user.id, store, {
        mode,
        section,
        domain,
        difficulty,
        skill: clean(body.skill,160) || undefined,
        count,
        timed: body.timed === true,
      });
      return NextResponse.json(
        { ok: true, ...result },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (body.action === "answer") {
      const sessionId = safeId(body.sessionId),
        questionId = safeId(body.questionId),
        answer = clean(body.answer, 80);
      if (!sessionId || !questionId || !answer)
        throw new SecurityError(
          "Choose an answer before continuing.",
          400,
          "invalid_answer",
        );
      const result = await answerSatQuestion(session.user.id, store, {
        sessionId,
        questionId,
        answer,
        elapsedSeconds: Number.isFinite(Number(body.elapsedSeconds))
          ? Math.max(0, Math.min(7200, Number(body.elapsedSeconds)))
          : undefined,
        markedForReview: body.markedForReview === true,
      });
      return NextResponse.json(
        { ok: true, ...result },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (body.action === "complete")
      return NextResponse.json(
        {
          ok: true,
          store: await completeSatSession(
            session.user.id,
            store,
            safeId(body.sessionId),
          ),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (body.action === "reflect") {
      const reflections = [
        "didnt_know",
        "misread",
        "calculation",
        "time",
        "changed_answer",
        "careless",
        "not_sure",
      ] as const;
      if (!reflections.includes(body.reflection as never))
        throw new SecurityError(
          "Choose a valid reflection.",
          400,
          "invalid_reflection",
        );
      const next = await reflectOnSatMistake(session.user.id, store, {
        sessionId: safeId(body.sessionId),
        questionId: safeId(body.questionId),
        attemptedAt: clean(body.attemptedAt, 40),
        reflection: body.reflection as (typeof reflections)[number],
      });
      return NextResponse.json(
        { ok: true, store: next },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    throw new SecurityError(
      "Invalid SAT practice update.",
      400,
      "invalid_request",
    );
  } catch (error) {
    if (error instanceof Error && error.name === "SatPracticeConflictError")
      return NextResponse.json(
        { error: error.message },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    return securityErrorResponse(
      error,
      error instanceof Error
        ? error.message
        : "SAT practice could not be updated.",
    );
  }
}
