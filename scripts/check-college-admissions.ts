import assert from "node:assert/strict";
import crypto from "node:crypto";
import { opportunities } from "../data/opportunities";
import { verifiedCollegeAdmissions } from "../data/college-admissions";
import { buildAdmissionsJourney } from "../lib/admissions-journey";
import { updateCollegeAdmissions } from "../lib/college-admissions-service";
import { readAccountData, updateEducationalStage, updateSavedCollege } from "../lib/auth-store";
import { buildUniversalSearch } from "../lib/universal-search";

const userId = `college-admissions-check:${crypto.randomUUID()}`;
const otherUserId = `college-admissions-check:${crypto.randomUUID()}`;
await updateEducationalStage(userId, "high_school");
await updateEducationalStage(otherUserId, "high_school");

await updateSavedCollege(userId, "144050", true);
await updateSavedCollege(userId, "144050", true);
let account = await readAccountData(userId);
assert.equal(account.savedColleges?.length, 1, "Saving a college should be idempotent.");
assert.equal(account.savedColleges?.[0].interestState, "exploring", "A new save should begin in Exploring.");
assert.equal((await readAccountData(otherUserId)).savedColleges?.length, 0, "College records must remain account isolated.");

await updateCollegeAdmissions(userId, { action: "update_college", collegeId: "144050", interestState: "planning_to_apply", favorite: true, plan: "early_action", priorities: ["Cost", "Academic programs"], notes: "Visit when possible." });
account = await readAccountData(userId);
const chicago = account.savedColleges?.[0];
assert.ok(chicago);
assert.equal(chicago.favorite, true);
assert.equal(chicago.application?.plan, "early_action");
assert.ok(chicago.application?.requirements.some((item) => item.provenance === "official_verified" && item.cycle === "2026–27"), "Verified requirements should preserve source provenance.");
assert.equal(verifiedCollegeAdmissions["144050"].deadlines.find((item) => item.plan === "early_action")?.date, "2026-11-02");

await assert.rejects(
  updateCollegeAdmissions(userId, { action: "update_college", collegeId: "144050", plan: "rolling" }),
  /not listed for the verified cycle/,
  "A plan absent from the official current cycle should not be accepted as verified.",
);

await updateCollegeAdmissions(userId, { action: "add_task", collegeId: "144050", title: "Review supplement", dueDate: "2026-10-10" });
await updateCollegeAdmissions(userId, { action: "add_task", title: "Ask counselor for transcript", dueDate: "2026-09-25" });
account = await readAccountData(userId);
assert.equal(account.savedColleges?.[0].application?.tasks.length, 1);
assert.equal(account.collegeAdmissionsJourney?.tasks.length, 1);
const journey = buildAdmissionsJourney(account.savedColleges ?? [], account.collegeAdmissionsJourney?.tasks ?? [], new Date("2026-09-08T12:00:00Z"));
assert.equal(journey.nextAction.title, "Ask counselor for transcript", "Journey should choose the nearest student-created open task.");
assert.ok(!journey.nextAction.href.includes("undefined"));

await updateCollegeAdmissions(userId, { action: "mark_applied", collegeId: "144050", submittedAt: "2026-11-01" });
await updateCollegeAdmissions(userId, { action: "record_decision", collegeId: "144050", outcome: "accepted", receivedAt: "2026-12-15" });
await updateCollegeAdmissions(userId, { action: "commit", collegeId: "144050" });
account = await readAccountData(userId);
assert.equal(account.savedColleges?.[0].application?.status, "committed");
assert.equal(account.educationalStage, "high_school", "Committing must not switch the student's product stage automatically.");

const search = buildUniversalSearch({ user: { id: userId, name: "Student" }, account, opportunities, query: "University of Chicago" });
const savedResult = search.results.find((item) => item.kind === "college_application");
assert.equal(savedResult?.group, "My College List");
assert.match(savedResult?.href ?? "", /\/application$/);

console.log("College admissions check passed: state, verified facts, tasks, decisions, continuity, isolation, and private search.");
