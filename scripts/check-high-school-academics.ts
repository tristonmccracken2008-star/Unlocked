import assert from "node:assert/strict";
import {
  bestAct,
  bestSat,
  normalizeHighSchoolAcademicStore,
  satSuperscore,
} from "../data/high-school-academics";

const now = "2026-09-10T12:00:00.000Z";
const store = normalizeHighSchoolAcademicStore({
  privacy: "public",
  gpaStatus: "reported",
  gpas: {
    unweighted: { id: "unweighted", value: 3.82, scale: 4, source: "student_reported", updatedAt: now },
    weighted: { id: "weighted", value: 4.31, scale: 5, source: "school_reported", updatedAt: now },
  },
  courses: {
    calculus: { id: "calculus", name: "AP Calculus BC", subject: "Math", gradeLevel: 11, level: "ap", gradeSystem: "letter", grade: "A-", inProgress: false, source: "student_reported", createdAt: now, updatedAt: now, version: 0 },
  },
  testing: {
    sat: { officialAttempts: [
      { id: "march", testDate: "2027-03-01", total: 1370, readingWriting: 700, math: 670, source: "student_reported", createdAt: now, updatedAt: now, version: 0 },
      { id: "may", testDate: "2027-05-01", total: 1420, readingWriting: 680, math: 740, source: "official_score_report", createdAt: now, updatedAt: now, version: 0 },
      { id: "invalid", testDate: "2027-06-01", total: 1600, readingWriting: 700, math: 700, source: "student_reported", createdAt: now, updatedAt: now, version: 0 },
    ], practiceAttempts: [{ score: 1600 }] },
    act: { officialAttempts: [
      { id: "act", testDate: "2027-04-01", composite: 32, english: 33, math: 31, reading: 32, science: 30, source: "student_reported", createdAt: now, updatedAt: now, version: 0 },
    ], practiceAttempts: [{ score: 36 }] },
    plans: [],
  },
});

assert.equal(store.privacy, "private", "Academic records must remain private by default.");
assert.equal(store.gpas.unweighted?.value, 3.82);
assert.equal(store.gpas.weighted?.value, 4.31);
assert.equal(store.gpas.weighted?.scale, 5, "Weighted GPA must not be normalized to 4.0.");
assert.equal(Object.keys(store.courses).length, 1);
assert.equal(store.testing.sat.officialAttempts.length, 2, "Invalid SAT totals must be rejected.");
assert.deepEqual(store.testing.sat.practiceAttempts, [], "Practice scores must not enter official history.");
assert.equal(bestSat(store)?.total, 1420);
assert.equal(satSuperscore(store)?.total, 1440);
assert.equal(bestAct(store)?.composite, 32);
assert.equal(store.testing.act.officialAttempts[0]?.science, 30);

console.log("High School Academics checks passed.");
