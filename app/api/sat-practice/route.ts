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
