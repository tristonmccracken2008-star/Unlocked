import assert from "node:assert/strict";
import crypto from "node:crypto";
import { commonAppActivitySetId } from "../data/high-school-activities";
import { normalizeResumeLabStore } from "../data/resume-lab";
import { readAccountData, updateEducationalStage } from "../lib/auth-store";
import { updateHighSchoolActivities } from "../lib/high-school-activities-service";
import { publicAccountData } from "../lib/public-account";

const userId = `high-school-activities-check:${crypto.randomUUID()}`;
await updateEducationalStage(userId, "high_school");

let account = await readAccountData(userId);
let store = normalizeResumeLabStore(account.resumeLab);
await updateHighSchoolActivities(userId, {
  action: "save_experience",
  expectedVersion: store.version,
  idempotencyKey: "newspaper",
  title: "School newspaper",
  organization: "Central High",
  role: "Editor",
  category: "Creative work",
  current: true,
  skills: ["Editing", "Interviewing"],
  facts: [
    {
      kind: "action",
      text: "Interviewed students and edited weekly stories",
      confirmed: true,
      source: "user",
    },
    {
      kind: "other",
      text: "Draft import says readership doubled",
      confirmed: false,
      source: "import",
    },
  ],
  highSchool: {
    category: "Creative work",
    grades: ["10th", "11th"],
    participationTiming: ["School year"],
    privateNotes: "Ask adviser about exact circulation.",
    collaborators: "Student editorial board",
    links: [],
    roleHistory: [
      { id: "", title: "Writer", grades: ["10th"], createdAt: "" },
      { id: "", title: "Editor", grades: ["11th"], createdAt: "" },
    ],
  },
});

account = await readAccountData(userId);
store = normalizeResumeLabStore(account.resumeLab);
const experience = Object.values(store.experiences)[0];
assert.ok(experience);
assert.equal(
  experience.highSchool?.hoursPerWeek,
  undefined,
  "Unknown time must remain unknown.",
);
assert.equal(
  experience.facts.find((fact) => fact.source === "import")?.confirmed,
  false,
  "Pasted facts must require review.",
);
assert.deepEqual(
  experience.highSchool?.roleHistory.map((role) => role.title),
  ["Writer", "Editor"],
);

await updateHighSchoolActivities(userId, {
  action: "toggle_application_activity",
  expectedVersion: store.version,
  experienceId: experience.id,
  selected: true,
});
store = normalizeResumeLabStore((await readAccountData(userId)).resumeLab);
await assert.rejects(
  updateHighSchoolActivities(userId, {
    action: "save_application_activity",
    expectedVersion: store.version,
    experienceId: experience.id,
    activityType: "Journalism",
    position: "Editor",
    organization: "Central High",
    description: "Doubled readership by 50%",
    grades: ["10th", "11th"],
    participationTiming: ["School year"],
  }),
  /unsupported claim/i,
  "Application wording must not introduce unsupported numbers.",
);
await updateHighSchoolActivities(userId, {
  action: "save_application_activity",
  expectedVersion: store.version,
  experienceId: experience.id,
  activityType: "Journalism",
  position: "Editor",
  organization: "Central High",
  description: "Interviewed students and edited weekly stories",
  grades: ["10th", "11th"],
  participationTiming: ["School year"],
  continueInCollege: true,
});
store = normalizeResumeLabStore((await readAccountData(userId)).resumeLab);
await updateHighSchoolActivities(userId, {
  action: "set_application_activities_status",
  expectedVersion: store.version,
  status: "ready",
});
store = normalizeResumeLabStore((await readAccountData(userId)).resumeLab);
assert.equal(
  store.applicationActivitySets?.[commonAppActivitySetId]?.status,
  "ready",
);

await updateEducationalStage(userId, "undergraduate");
account = await readAccountData(userId);
assert.equal(
  Object.keys(normalizeResumeLabStore(account.resumeLab).experiences).length,
  1,
  "Experience history must survive the stage transition.",
);
assert.equal(
  publicAccountData(account).resumeLab,
  undefined,
  "Private experience and application drafts must not enter the public account projection.",
);

console.log(
  "High School Activities check passed: canonical history, unknown time, import review, evidence locking, application readiness, privacy, and stage continuity.",
);
