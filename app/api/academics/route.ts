import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { academicGradeLevels, courseLevels, gradeSystems } from "@/data/high-school-academics";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { updateHighSchoolAcademics, type HighSchoolAcademicMutation } from "@/lib/high-school-academics-service";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";

const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const clean = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const id = (value: unknown) => { const result = clean(value, 160); return safeId.test(result) ? result : ""; };
const integer = (value: unknown, min: number, max: number, step = 1) => { const number = Number(value); return Number.isFinite(number) && number >= min && number <= max && Number.isInteger(number / step) ? number : undefined; };
const number = (value: unknown, min: number, max: number) => { const result = Number(value); return Number.isFinite(result) && result >= min && result <= max ? result : undefined; };
const date = (value: unknown, optional = false) => { const result = clean(value, 10); if (!result && optional) return undefined; if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(`${result}T12:00:00Z`))) throw new SecurityError("Choose a valid date.", 400, "invalid_date"); return result; };
const expected = (body: Record<string, unknown>) => { const result = integer(body.expectedVersion, 0, Number.MAX_SAFE_INTEGER); if (result === undefined) throw new SecurityError("Your academic record is out of date.", 400, "invalid_version"); return result; };

function parse(value: unknown): HighSchoolAcademicMutation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SecurityError("Invalid academic update.", 400, "invalid_request");
  const body = value as Record<string, unknown>;
  const expectedVersion = expected(body);
  if (body.action === "save_context") {
    const gradeLevel = integer(body.gradeLevel, 9, 12);
    const graduationYear = clean(body.graduationYear, 4);
    if (graduationYear && !/^20\d{2}$/.test(graduationYear)) throw new SecurityError("Choose a valid graduation year.", 400, "invalid_year");
    return { action: "save_context", expectedVersion, schoolName: clean(body.schoolName, 200) || undefined, graduationYear: graduationYear || undefined, gradeLevel: academicGradeLevels.includes(gradeLevel as never) ? gradeLevel as 9 | 10 | 11 | 12 : undefined };
  }
  if (body.action === "save_gpa") {
    const gpaStatus = ["reported", "school_does_not_calculate", "unknown"].includes(String(body.gpaStatus)) ? body.gpaStatus as "reported" | "school_does_not_calculate" | "unknown" : "unknown";
    const kind = ["unweighted", "weighted", "school_reported"].includes(String(body.kind)) ? body.kind as "unweighted" | "weighted" | "school_reported" : "school_reported";
    if (gpaStatus !== "reported") return { action: "save_gpa", expectedVersion, kind, source: "student_reported", gpaStatus };
    const valueNumber = number(body.value, 0, 200); const scale = number(body.scale, 0.1, 200);
    if (valueNumber === undefined || scale === undefined || valueNumber > scale * 1.5) throw new SecurityError("Enter the GPA exactly as your school reports it, with its scale.", 400, "invalid_gpa");
    return { action: "save_gpa", expectedVersion, kind, value: valueNumber, scale, note: clean(body.note, 240) || undefined, source: body.source === "school_reported" ? "school_reported" : "student_reported", gpaStatus };
  }
  if (body.action === "save_rank") {
    const source = body.source === "school_reported" ? "school_reported" as const : "student_reported" as const;
    if (body.kind === "exact") { const rank = integer(body.rank, 1, 100_000); const classSize = integer(body.classSize, 1, 100_000); if (!rank || !classSize || rank > classSize) throw new SecurityError("Enter a valid rank and class size.", 400, "invalid_rank"); return { action: "save_rank", expectedVersion, rank: { kind: "exact", rank, classSize, source } }; }
    if (body.kind === "percentile") { const percentile = number(body.percentile, 0.01, 100); if (!percentile) throw new SecurityError("Enter a percentile from 1 to 100.", 400, "invalid_rank"); return { action: "save_rank", expectedVersion, rank: { kind: "percentile", percentile, source } }; }
    if (body.kind === "school_does_not_rank" || body.kind === "unknown") return { action: "save_rank", expectedVersion, rank: { kind: body.kind, source } };
  }
  if (body.action === "save_course") {
    const name = clean(body.name, 160); const subject = clean(body.subject, 100); const gradeLevel = integer(body.gradeLevel, 9, 12); const level = courseLevels.includes(body.level as never) ? body.level as typeof courseLevels[number] : undefined; const gradeSystem = gradeSystems.includes(body.gradeSystem as never) ? body.gradeSystem as typeof gradeSystems[number] : undefined; const key = id(body.idempotencyKey); const courseId = id(body.courseId) || undefined;
    if (!name || !subject || !gradeLevel || !level || !gradeSystem || (!courseId && !key)) throw new SecurityError("Add the course name, subject, year, and grading format.", 400, "invalid_course");
    return { action: "save_course", expectedVersion, idempotencyKey: key, courseId, expectedRecordVersion: courseId ? integer(body.expectedRecordVersion, 0, Number.MAX_SAFE_INTEGER) : undefined, name, subject, gradeLevel: gradeLevel as 9 | 10 | 11 | 12, level, levelLabel: clean(body.levelLabel, 80) || undefined, gradeSystem, grade: clean(body.grade, 40) || undefined, credits: clean(body.credits, 30) || undefined, inProgress: body.inProgress === true };
  }
  if (body.action === "delete_course") return { action: "delete_course", expectedVersion, courseId: id(body.courseId), expectedRecordVersion: integer(body.expectedRecordVersion, 0, Number.MAX_SAFE_INTEGER) ?? -1 };
  if (body.action === "save_sat_attempt") {
    const total = integer(body.total, 400, 1600, 10); const readingWriting = integer(body.readingWriting, 200, 800, 10); const math = integer(body.math, 200, 800, 10); const key = id(body.idempotencyKey); const attemptId = id(body.attemptId) || undefined;
    if (!total || !readingWriting || !math || total !== readingWriting + math || (!attemptId && !key)) throw new SecurityError("SAT total must equal Reading and Writing plus Math, using official score increments.", 400, "invalid_sat_score");
    return { action: "save_sat_attempt", expectedVersion, idempotencyKey: key, attemptId, expectedRecordVersion: attemptId ? integer(body.expectedRecordVersion, 0, Number.MAX_SAFE_INTEGER) : undefined, testDate: date(body.testDate)!, total, readingWriting, math, source: body.source === "official_score_report" ? "official_score_report" : "student_reported", notes: clean(body.notes, 500) || undefined };
  }
  if (body.action === "delete_sat_attempt") return { action: "delete_sat_attempt", expectedVersion, attemptId: id(body.attemptId), expectedRecordVersion: integer(body.expectedRecordVersion, 0, Number.MAX_SAFE_INTEGER) ?? -1 };
  if (body.action === "save_act_attempt") {
    const composite = integer(body.composite, 1, 36); const english = integer(body.english, 1, 36); const math = integer(body.math, 1, 36); const reading = integer(body.reading, 1, 36); const science = body.science === "" || body.science === undefined ? undefined : integer(body.science, 1, 36); const writing = body.writing === "" || body.writing === undefined ? undefined : integer(body.writing, 2, 12); const key = id(body.idempotencyKey); const attemptId = id(body.attemptId) || undefined;
    if (!composite || !english || !math || !reading || (!attemptId && !key) || (body.science !== "" && body.science !== undefined && !science) || (body.writing !== "" && body.writing !== undefined && !writing)) throw new SecurityError("Enter valid scores from the official ACT report.", 400, "invalid_act_score");
    return { action: "save_act_attempt", expectedVersion, idempotencyKey: key, attemptId, expectedRecordVersion: attemptId ? integer(body.expectedRecordVersion, 0, Number.MAX_SAFE_INTEGER) : undefined, testDate: date(body.testDate)!, composite, english, math, reading, science, writing, source: body.source === "official_score_report" ? "official_score_report" : "student_reported", notes: clean(body.notes, 500) || undefined };
  }
  if (body.action === "delete_act_attempt") return { action: "delete_act_attempt", expectedVersion, attemptId: id(body.attemptId), expectedRecordVersion: integer(body.expectedRecordVersion, 0, Number.MAX_SAFE_INTEGER) ?? -1 };
  if (body.action === "save_test_plan" && (body.test === "sat" || body.test === "act") && ["planning", "registered", "completed"].includes(String(body.registrationStatus))) return { action: "save_test_plan", expectedVersion, test: body.test, date: date(body.date)!, registrationStatus: body.registrationStatus as "planning" | "registered" | "completed", preparationDate: date(body.preparationDate, true) };
  if (body.action === "save_test_goal" && (body.test === "sat" || body.test === "act")) { const goal = body.goal === "" || body.goal === undefined ? undefined : body.test === "sat" ? integer(body.goal, 400, 1600, 10) : integer(body.goal, 1, 36); if (body.goal !== "" && body.goal !== undefined && goal === undefined) throw new SecurityError("Enter a valid personal score goal.", 400, "invalid_goal"); return { action: "save_test_goal", expectedVersion, test: body.test, goal }; }
  throw new SecurityError("Invalid academic update.", 400, "invalid_request");
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (session.data.educationalStage !== "high_school") return NextResponse.json({ error: "Academics is available in High School UnlockED." }, { status: 403 });
    await enforceRateLimit(request, "high-school-academics", 120, 60, session.user.id);
    const result = await updateHighSchoolAcademics(session.user.id, parse(await readBoundedJson(request, 20_000)));
    return NextResponse.json({ ok: true, academics: result.store }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && (error.name === "HighSchoolAcademicsConflictError" || error.name === "HighSchoolAcademicsRecordConflictError")) return NextResponse.json({ error: error.message }, { status: 409, headers: { "Cache-Control": "no-store" } });
    return securityErrorResponse(error, error instanceof Error ? error.message : "Academic record could not be updated.");
  }
}
