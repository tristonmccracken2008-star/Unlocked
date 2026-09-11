import assert from "node:assert/strict";
import type { AccountData } from "../lib/account-types";
import type { CollegeListRecord } from "../data/college-admissions";
import { buildAdmissionsIntelligence } from "../lib/admissions-intelligence";

const now = "2026-09-10T12:00:00.000Z";
const saved: CollegeListRecord = {
  collegeId: "170976",
  savedAt: now,
  updatedAt: now,
  version: 1,
  interestState: "planning_to_apply",
  favorite: false,
  notes: "",
  priorities: [],
  application: {
    plan: "early_action",
    status: "preparing",
    requirements: [{ id: "teacher", type: "other", title: "One teacher evaluation", status: "in_progress", provenance: "official_verified", sourceUrl: "https://admissions.umich.edu/", cycle: "2026–27", verifiedAt: "2026-09-08", createdAt: now, updatedAt: now }],
    tasks: [],
    version: 1,
    updatedAt: now,
  },
};
const account = {
  highSchoolAcademics: {
    privacy: "private",
    gpaStatus: "reported",
    gpas: {
      unweighted: { id: "unweighted", value: 3.82, scale: 4, source: "student_reported", updatedAt: now },
      weighted: { id: "weighted", value: 4.31, scale: 5, source: "school_reported", updatedAt: now },
    },
    classRank: { kind: "school_does_not_rank", source: "student_reported", updatedAt: now },
    courses: {
      ap: { id: "ap", name: "AP Calculus BC", subject: "Math", gradeLevel: 11, level: "ap", gradeSystem: "letter", inProgress: false, source: "student_reported", createdAt: now, updatedAt: now, version: 0 },
      honors: { id: "honors", name: "Physics Honors", subject: "Science", gradeLevel: 11, level: "honors", gradeSystem: "letter", inProgress: false, source: "student_reported", createdAt: now, updatedAt: now, version: 0 },
    },
    testing: {
      sat: { officialAttempts: [{ id: "sat", testDate: "2026-05-02", total: 1420, readingWriting: 700, math: 720, source: "official_score_report", createdAt: now, updatedAt: now, version: 0 }], practiceAttempts: [] },
      act: { officialAttempts: [], practiceAttempts: [] },
      plans: [],
    },
    version: 1,
    updatedAt: now,
  },
  resumeLab: {
    experiences: {
      newspaper: { id: "newspaper", source: "manual", kind: "activity", title: "Student Newspaper", organization: "Lincoln High School", current: true, skills: [], facts: [], bullets: [], createdAt: now, updatedAt: now, version: 0 },
      service: { id: "service", source: "manual", kind: "volunteer", title: "Library volunteer", organization: "City Library", current: true, skills: [], facts: [], bullets: [], createdAt: now, updatedAt: now, version: 0 },
    },
    resumes: {},
    version: 1,
    updatedAt: now,
  },
  accomplishments: {},
} as unknown as AccountData;

const model = buildAdmissionsIntelligence({ id: "170976", name: "University of Michigan-Ann Arbor", slug: "university-of-michigan-ann-arbor" }, saved, account);
assert.equal(model.privacy, "private");
assert.deepEqual(model.academics.gpas, ["3.82 / 4.00 unweighted", "4.31 / 5.00 weighted"], "GPA scales must remain distinct.");
assert.equal(model.academics.bestSat, 1420, "Only recorded official-test history should provide the displayed score.");
assert.match(model.academics.courseDetail.join(" "), /1 AP/);
assert.equal(model.academics.classRank, "School does not rank");
assert.deepEqual(model.reports.academicFactors.slice(0, 2), [{ label: "Rigor of secondary school record", importance: "Very Important" }, { label: "Academic GPA", importance: "Very Important" }]);
assert.deepEqual(model.factors.find((item) => item.factor === "extracurriculars")?.recordItems, ["Student Newspaper"]);
assert.deepEqual(model.factors.find((item) => item.factor === "volunteer_work")?.recordItems, ["Library volunteer"]);
assert.equal(model.reports.testingPolicy?.label, "Test optional", "Current policy must come from verified current guidance, not a historical CDS.");
assert.equal(model.application.deadline?.date, "2026-11-01");
assert.equal(model.application.requirements[0]?.status, "In progress");
assert.match(model.reports.sourceUrl ?? "", /^https:\/\//, "Institution claims must retain source provenance.");
assert.match(model.application.sourceUrl ?? "", /^https:\/\//, "Current requirements must retain their separate source.");
for (const phrase of ["admission chance", "profile strength", "academic match", "well positioned", "improve your odds"]) {
  assert.ok(!JSON.stringify(model).toLowerCase().includes(phrase), `Projection must not emit predictive language: ${phrase}`);
}

const unknown = buildAdmissionsIntelligence({ id: "999999", name: "Unverified College", slug: "unverified-college" }, { ...saved, collegeId: "999999", application: undefined }, account);
assert.ok(unknown.unknowns.some((item) => item.includes("Common Data Set")));
assert.ok(unknown.unknowns.some((item) => item.includes("testing policy")));
assert.equal(unknown.application.requirements.length, 0, "Missing current evidence must not create production sample requirements.");

console.log("Admissions Intelligence checks passed: privacy, provenance, factual mappings, policy precedence, and explicit uncertainty.");
