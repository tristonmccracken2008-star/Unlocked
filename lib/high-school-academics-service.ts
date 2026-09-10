import "server-only";
import crypto from "node:crypto";
import type {
  AcademicClassRank,
  AcademicCourse,
  AcademicGradeLevel,
  ActAttempt,
  CourseLevel,
  GpaRecord,
  GradeSystem,
  SatAttempt,
  TestPlan,
} from "@/data/high-school-academics";
import { mutateHighSchoolAcademics } from "./auth-store";

type Source = "student_reported" | "official_score_report";
type RankInput =
  | { kind: "exact"; rank: number; classSize: number; source: "student_reported" | "school_reported" }
  | { kind: "percentile"; percentile: number; source: "student_reported" | "school_reported" }
  | { kind: "school_does_not_rank" | "unknown"; source: "student_reported" | "school_reported" };
export type HighSchoolAcademicMutation =
  | { action: "save_context"; expectedVersion: number; schoolName?: string; graduationYear?: string; gradeLevel?: AcademicGradeLevel }
  | { action: "save_gpa"; expectedVersion: number; kind: GpaRecord["id"]; value?: number; scale?: number; note?: string; source: "student_reported" | "school_reported"; gpaStatus: "reported" | "school_does_not_calculate" | "unknown" }
  | { action: "save_rank"; expectedVersion: number; rank: RankInput }
  | { action: "save_course"; expectedVersion: number; idempotencyKey: string; courseId?: string; expectedRecordVersion?: number; name: string; subject: string; gradeLevel: AcademicGradeLevel; level: CourseLevel; levelLabel?: string; gradeSystem: GradeSystem; grade?: string; credits?: string; inProgress: boolean }
  | { action: "delete_course"; expectedVersion: number; courseId: string; expectedRecordVersion: number }
  | { action: "save_sat_attempt"; expectedVersion: number; idempotencyKey: string; attemptId?: string; expectedRecordVersion?: number; testDate: string; total: number; readingWriting: number; math: number; source: Source; notes?: string }
  | { action: "delete_sat_attempt"; expectedVersion: number; attemptId: string; expectedRecordVersion: number }
  | { action: "save_act_attempt"; expectedVersion: number; idempotencyKey: string; attemptId?: string; expectedRecordVersion?: number; testDate: string; composite: number; english: number; math: number; reading: number; science?: number; writing?: number; source: Source; notes?: string }
  | { action: "delete_act_attempt"; expectedVersion: number; attemptId: string; expectedRecordVersion: number }
  | { action: "save_test_plan"; expectedVersion: number; test: "sat" | "act"; date: string; registrationStatus: TestPlan["registrationStatus"]; preparationDate?: string }
  | { action: "save_test_goal"; expectedVersion: number; test: "sat" | "act"; goal?: number };

function stableId(prefix: string, userId: string, key: string) {
  return `${prefix}:${crypto.createHash("sha256").update(`${userId}:${key}`).digest("hex").slice(0, 24)}`;
}
function conflict(message: string) {
  const error = new Error(message);
  error.name = "HighSchoolAcademicsRecordConflictError";
  throw error;
}

export async function updateHighSchoolAcademics(userId: string, mutation: HighSchoolAcademicMutation) {
  return await mutateHighSchoolAcademics(userId, {
    expectedVersion: mutation.expectedVersion,
    mutate(store) {
      const now = new Date().toISOString();
      if (mutation.action === "save_context") {
        return { ...store, school: mutation.schoolName ? { name: mutation.schoolName, source: "student_reported", updatedAt: now } : store.school, graduationYear: mutation.graduationYear ?? store.graduationYear, gradeLevel: mutation.gradeLevel ?? store.gradeLevel };
      }
      if (mutation.action === "save_gpa") {
        if (mutation.gpaStatus !== "reported") return { ...store, gpaStatus: mutation.gpaStatus, gpas: {} };
        return { ...store, gpaStatus: "reported", gpas: { ...store.gpas, [mutation.kind]: { id: mutation.kind, value: mutation.value, scale: mutation.scale, note: mutation.note, source: mutation.source, updatedAt: now } } };
      }
      if (mutation.action === "save_rank") return { ...store, classRank: { ...mutation.rank, updatedAt: now } as AcademicClassRank };
      if (mutation.action === "save_course") {
        const existing = mutation.courseId ? store.courses[mutation.courseId] : undefined;
        if (existing && existing.version !== mutation.expectedRecordVersion) conflict("This course changed elsewhere. Refresh and try again.");
        const id = existing?.id ?? stableId("course", userId, mutation.idempotencyKey);
        const course: AcademicCourse = { id, name: mutation.name, subject: mutation.subject, gradeLevel: mutation.gradeLevel, level: mutation.level, levelLabel: mutation.levelLabel, gradeSystem: mutation.gradeSystem, grade: mutation.grade, credits: mutation.credits, inProgress: mutation.inProgress, source: "student_reported", createdAt: existing?.createdAt ?? now, updatedAt: now, version: existing ? existing.version + 1 : 0 };
        return { ...store, courses: { ...store.courses, [id]: course } };
      }
      if (mutation.action === "delete_course") {
        const existing = store.courses[mutation.courseId];
        if (!existing || existing.version !== mutation.expectedRecordVersion) conflict("This course changed elsewhere. Refresh and try again.");
        const courses = { ...store.courses }; delete courses[mutation.courseId]; return { ...store, courses };
      }
      if (mutation.action === "save_sat_attempt") {
        const existing = mutation.attemptId ? store.testing.sat.officialAttempts.find((item) => item.id === mutation.attemptId) : undefined;
        if (existing && existing.version !== mutation.expectedRecordVersion) conflict("This SAT attempt changed elsewhere. Refresh and try again.");
        const id = existing?.id ?? stableId("sat", userId, mutation.idempotencyKey);
        const attempt: SatAttempt = { id, testDate: mutation.testDate, total: mutation.total, readingWriting: mutation.readingWriting, math: mutation.math, source: mutation.source, notes: mutation.notes, createdAt: existing?.createdAt ?? now, updatedAt: now, version: existing ? existing.version + 1 : 0 };
        return { ...store, testing: { ...store.testing, sat: { ...store.testing.sat, officialAttempts: [...store.testing.sat.officialAttempts.filter((item) => item.id !== id), attempt] } } };
      }
      if (mutation.action === "delete_sat_attempt") {
        const existing = store.testing.sat.officialAttempts.find((item) => item.id === mutation.attemptId);
        if (!existing || existing.version !== mutation.expectedRecordVersion) conflict("This SAT attempt changed elsewhere. Refresh and try again.");
        return { ...store, testing: { ...store.testing, sat: { ...store.testing.sat, officialAttempts: store.testing.sat.officialAttempts.filter((item) => item.id !== mutation.attemptId) } } };
      }
      if (mutation.action === "save_act_attempt") {
        const existing = mutation.attemptId ? store.testing.act.officialAttempts.find((item) => item.id === mutation.attemptId) : undefined;
        if (existing && existing.version !== mutation.expectedRecordVersion) conflict("This ACT attempt changed elsewhere. Refresh and try again.");
        const id = existing?.id ?? stableId("act", userId, mutation.idempotencyKey);
        const attempt: ActAttempt = { id, testDate: mutation.testDate, composite: mutation.composite, english: mutation.english, math: mutation.math, reading: mutation.reading, science: mutation.science, writing: mutation.writing, source: mutation.source, notes: mutation.notes, createdAt: existing?.createdAt ?? now, updatedAt: now, version: existing ? existing.version + 1 : 0 };
        return { ...store, testing: { ...store.testing, act: { ...store.testing.act, officialAttempts: [...store.testing.act.officialAttempts.filter((item) => item.id !== id), attempt] } } };
      }
      if (mutation.action === "delete_act_attempt") {
        const existing = store.testing.act.officialAttempts.find((item) => item.id === mutation.attemptId);
        if (!existing || existing.version !== mutation.expectedRecordVersion) conflict("This ACT attempt changed elsewhere. Refresh and try again.");
        return { ...store, testing: { ...store.testing, act: { ...store.testing.act, officialAttempts: store.testing.act.officialAttempts.filter((item) => item.id !== mutation.attemptId) } } };
      }
      if (mutation.action === "save_test_plan") {
        const plan: TestPlan = { test: mutation.test, date: mutation.date, registrationStatus: mutation.registrationStatus, preparationDate: mutation.preparationDate, createdAt: store.testing.plans.find((item) => item.test === mutation.test && item.date === mutation.date)?.createdAt ?? now, updatedAt: now };
        return { ...store, testing: { ...store.testing, plans: [...store.testing.plans.filter((item) => !(item.test === plan.test && item.date === plan.date)), plan] } };
      }
      const side = store.testing[mutation.test];
      return { ...store, testing: { ...store.testing, [mutation.test]: { ...side, goal: mutation.goal } } };
    },
  });
}
