export const academicGradeLevels = [9, 10, 11, 12] as const;
export type AcademicGradeLevel = (typeof academicGradeLevels)[number];

export const courseLevels = [
  "standard",
  "honors",
  "ap",
  "ib",
  "dual_enrollment",
  "college_course",
  "advanced_school_specific",
  "other",
] as const;
export type CourseLevel = (typeof courseLevels)[number];
export const courseLevelLabels: Record<CourseLevel, string> = {
  standard: "Standard",
  honors: "Honors",
  ap: "AP",
  ib: "IB",
  dual_enrollment: "Dual Enrollment",
  college_course: "College Course",
  advanced_school_specific: "Advanced / School-specific",
  other: "Other",
};

export const gradeSystems = ["letter", "percentage", "numeric", "pass_fail", "other"] as const;
export type GradeSystem = (typeof gradeSystems)[number];
export const gradeSystemLabels: Record<GradeSystem, string> = {
  letter: "A–F / letter",
  percentage: "Percentage",
  numeric: "Numeric",
  pass_fail: "Pass / Fail",
  other: "School-specific",
};

export type AcademicCourse = {
  id: string;
  name: string;
  subject: string;
  gradeLevel: AcademicGradeLevel;
  level: CourseLevel;
  levelLabel?: string;
  gradeSystem: GradeSystem;
  grade?: string;
  credits?: string;
  inProgress: boolean;
  source: "student_reported" | "connected_school";
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type GpaRecord = {
  id: "unweighted" | "weighted" | "school_reported";
  value?: number;
  scale?: number;
  note?: string;
  source: "student_reported" | "school_reported";
  updatedAt: string;
};

export type AcademicClassRank =
  | { kind: "exact"; rank: number; classSize: number; source: "student_reported" | "school_reported"; updatedAt: string }
  | { kind: "percentile"; percentile: number; source: "student_reported" | "school_reported"; updatedAt: string }
  | { kind: "school_does_not_rank" | "unknown"; source: "student_reported" | "school_reported"; updatedAt: string };

export type SatAttempt = {
  id: string;
  testDate: string;
  total: number;
  readingWriting: number;
  math: number;
  source: "student_reported" | "official_score_report";
  notes?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ActAttempt = {
  id: string;
  testDate: string;
  composite: number;
  english: number;
  math: number;
  reading: number;
  science?: number;
  writing?: number;
  source: "student_reported" | "official_score_report";
  notes?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type TestPlan = {
  test: "sat" | "act";
  date: string;
  registrationStatus: "planning" | "registered" | "completed";
  preparationDate?: string;
  createdAt: string;
  updatedAt: string;
};

export type HighSchoolAcademicStore = {
  privacy: "private";
  school?: { name: string; source: "student_reported" | "connected_school"; updatedAt: string };
  graduationYear?: string;
  gradeLevel?: AcademicGradeLevel;
  gpaStatus: "reported" | "school_does_not_calculate" | "unknown";
  gpas: Partial<Record<GpaRecord["id"], GpaRecord>>;
  classRank?: AcademicClassRank;
  courses: Record<string, AcademicCourse>;
  testing: {
    sat: { officialAttempts: SatAttempt[]; practiceAttempts: []; goal?: number };
    act: { officialAttempts: ActAttempt[]; practiceAttempts: []; goal?: number };
    plans: TestPlan[];
  };
  version: number;
  updatedAt?: string;
};

export function emptyHighSchoolAcademicStore(): HighSchoolAcademicStore {
  return {
    privacy: "private",
    gpaStatus: "unknown",
    gpas: {},
    courses: {},
    testing: {
      sat: { officialAttempts: [], practiceAttempts: [] },
      act: { officialAttempts: [], practiceAttempts: [] },
      plans: [],
    },
    version: 0,
  };
}

const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const isoDate = (value: unknown) => {
  const result = clean(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(result) && Number.isFinite(Date.parse(`${result}T12:00:00Z`)) ? result : "";
};
const timestamp = (value: unknown) => {
  const result = clean(value, 30);
  return result && Number.isFinite(Date.parse(result)) ? new Date(result).toISOString() : new Date().toISOString();
};
const score = (value: unknown, minimum: number, maximum: number, step = 1) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum && Number.isInteger(number / step) ? number : undefined;
};

export function normalizeHighSchoolAcademicStore(value: unknown): HighSchoolAcademicStore {
  const empty = emptyHighSchoolAcademicStore();
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
  const input = value as Partial<HighSchoolAcademicStore>;
  const gpas: HighSchoolAcademicStore["gpas"] = {};
  for (const kind of ["unweighted", "weighted", "school_reported"] as const) {
    const record = input.gpas?.[kind];
    if (!record) continue;
    const valueNumber = Number(record.value);
    const scaleNumber = Number(record.scale);
    if (!Number.isFinite(valueNumber) || valueNumber < 0 || !Number.isFinite(scaleNumber) || scaleNumber <= 0 || valueNumber > scaleNumber * 1.5) continue;
    gpas[kind] = { id: kind, value: valueNumber, scale: scaleNumber, note: clean(record.note, 240) || undefined, source: record.source === "school_reported" ? "school_reported" : "student_reported", updatedAt: timestamp(record.updatedAt) };
  }
  const courses: Record<string, AcademicCourse> = {};
  for (const [id, raw] of Object.entries(input.courses ?? {}).slice(0, 400)) {
    if (!safeId.test(id) || !raw || !academicGradeLevels.includes(raw.gradeLevel) || !courseLevels.includes(raw.level) || !gradeSystems.includes(raw.gradeSystem)) continue;
    const name = clean(raw.name, 160);
    const subject = clean(raw.subject, 100);
    if (!name || !subject) continue;
    courses[id] = { id, name, subject, gradeLevel: raw.gradeLevel, level: raw.level, levelLabel: clean(raw.levelLabel, 80) || undefined, gradeSystem: raw.gradeSystem, grade: clean(raw.grade, 40) || undefined, credits: clean(raw.credits, 30) || undefined, inProgress: Boolean(raw.inProgress), source: raw.source === "connected_school" ? "connected_school" : "student_reported", createdAt: timestamp(raw.createdAt), updatedAt: timestamp(raw.updatedAt), version: Number.isInteger(raw.version) && raw.version >= 0 ? raw.version : 0 };
  }
  const satAttempts = (input.testing?.sat?.officialAttempts ?? []).slice(-30).flatMap((raw) => {
    const total = score(raw.total, 400, 1600, 10);
    const readingWriting = score(raw.readingWriting, 200, 800, 10);
    const math = score(raw.math, 200, 800, 10);
    const testDate = isoDate(raw.testDate);
    if (!safeId.test(raw.id) || !total || !readingWriting || !math || total !== readingWriting + math || !testDate) return [];
    return [{ ...raw, testDate, total, readingWriting, math, source: raw.source === "official_score_report" ? "official_score_report" as const : "student_reported" as const, notes: clean(raw.notes, 500) || undefined, createdAt: timestamp(raw.createdAt), updatedAt: timestamp(raw.updatedAt), version: Number.isInteger(raw.version) && raw.version >= 0 ? raw.version : 0 }];
  });
  const actAttempts = (input.testing?.act?.officialAttempts ?? []).slice(-30).flatMap((raw) => {
    const composite = score(raw.composite, 1, 36);
    const english = score(raw.english, 1, 36);
    const math = score(raw.math, 1, 36);
    const reading = score(raw.reading, 1, 36);
    const science = raw.science === undefined ? undefined : score(raw.science, 1, 36);
    const writing = raw.writing === undefined ? undefined : score(raw.writing, 2, 12);
    const testDate = isoDate(raw.testDate);
    if (!safeId.test(raw.id) || !composite || !english || !math || !reading || !testDate || (raw.science !== undefined && !science) || (raw.writing !== undefined && !writing)) return [];
    return [{ ...raw, testDate, composite, english, math, reading, science, writing, source: raw.source === "official_score_report" ? "official_score_report" as const : "student_reported" as const, notes: clean(raw.notes, 500) || undefined, createdAt: timestamp(raw.createdAt), updatedAt: timestamp(raw.updatedAt), version: Number.isInteger(raw.version) && raw.version >= 0 ? raw.version : 0 }];
  });
  const plans = (input.testing?.plans ?? []).slice(-20).flatMap((raw) => {
    const date = isoDate(raw.date);
    if (!date || !["sat", "act"].includes(raw.test) || !["planning", "registered", "completed"].includes(raw.registrationStatus)) return [];
    return [{ test: raw.test, date, registrationStatus: raw.registrationStatus, preparationDate: isoDate(raw.preparationDate) || undefined, createdAt: timestamp(raw.createdAt), updatedAt: timestamp(raw.updatedAt) } as TestPlan];
  });
  const rank = input.classRank;
  const classRank: AcademicClassRank | undefined = rank?.kind === "exact" && Number.isInteger(rank.rank) && Number.isInteger(rank.classSize) && rank.rank > 0 && rank.classSize >= rank.rank
    ? { kind: "exact", rank: rank.rank, classSize: rank.classSize, source: rank.source === "school_reported" ? "school_reported" : "student_reported", updatedAt: timestamp(rank.updatedAt) }
    : rank?.kind === "percentile" && Number.isFinite(rank.percentile) && rank.percentile > 0 && rank.percentile <= 100
      ? { kind: "percentile", percentile: rank.percentile, source: rank.source === "school_reported" ? "school_reported" : "student_reported", updatedAt: timestamp(rank.updatedAt) }
      : rank?.kind === "school_does_not_rank" || rank?.kind === "unknown"
        ? { kind: rank.kind, source: rank.source === "school_reported" ? "school_reported" : "student_reported", updatedAt: timestamp(rank.updatedAt) }
        : undefined;
  const schoolName = clean(input.school?.name, 200);
  const gradeLevel = academicGradeLevels.includes(input.gradeLevel as AcademicGradeLevel) ? input.gradeLevel as AcademicGradeLevel : undefined;
  return {
    privacy: "private",
    school: schoolName ? { name: schoolName, source: input.school?.source === "connected_school" ? "connected_school" : "student_reported", updatedAt: timestamp(input.school?.updatedAt) } : undefined,
    graduationYear: /^20\d{2}$/.test(input.graduationYear ?? "") ? input.graduationYear : undefined,
    gradeLevel,
    gpaStatus: input.gpaStatus === "reported" || input.gpaStatus === "school_does_not_calculate" ? input.gpaStatus : "unknown",
    gpas,
    classRank,
    courses,
    testing: {
      sat: { officialAttempts: satAttempts, practiceAttempts: [], goal: score(input.testing?.sat?.goal, 400, 1600, 10) },
      act: { officialAttempts: actAttempts, practiceAttempts: [], goal: score(input.testing?.act?.goal, 1, 36) },
      plans,
    },
    version: Number.isInteger(input.version) && Number(input.version) >= 0 ? Number(input.version) : 0,
    updatedAt: input.updatedAt ? timestamp(input.updatedAt) : undefined,
  };
}

export function bestSat(store: HighSchoolAcademicStore) {
  return [...store.testing.sat.officialAttempts].sort((a, b) => b.total - a.total || b.testDate.localeCompare(a.testDate))[0];
}

export function satSuperscore(store: HighSchoolAcademicStore) {
  if (store.testing.sat.officialAttempts.length < 2) return undefined;
  const readingWriting = Math.max(...store.testing.sat.officialAttempts.map((attempt) => attempt.readingWriting));
  const math = Math.max(...store.testing.sat.officialAttempts.map((attempt) => attempt.math));
  return { total: readingWriting + math, readingWriting, math };
}

export function bestAct(store: HighSchoolAcademicStore) {
  return [...store.testing.act.officialAttempts].sort((a, b) => b.composite - a.composite || b.testDate.localeCompare(a.testDate))[0];
}
