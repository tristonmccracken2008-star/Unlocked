import assert from "node:assert/strict";
import crypto from "node:crypto";
import { opportunities } from "../data/opportunities";
import { verifiedCollegeAdmissions } from "../data/college-admissions";
import { buildAdmissionsJourney } from "../lib/admissions-journey";
import { updateCollegeAdmissions } from "../lib/college-admissions-service";
import { readAccountData, updateEducationalStage, updateSavedCollege } from "../lib/auth-store";
import { buildUniversalSearch } from "../lib/universal-search";
import { publicAccountData } from "../lib/public-account";

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
await updateCollegeAdmissions(userId, { action: "record_decision", collegeId: "144050", outcome: "deferred", receivedAt: "2026-12-15", privateNote:"Keep the result private." });
await updateCollegeAdmissions(userId, { action: "record_decision", collegeId: "144050", outcome: "accepted", receivedAt: "2027-03-14", program:"Mathematics", aidOfferStatus:"received", entryTerm:"Fall 2027" });
await updateCollegeAdmissions(userId, { action:"set_consideration", collegeId:"144050", status:"top_choice" });
await updateCollegeAdmissions(userId, { action:"record_visit", collegeId:"144050", visitType:"admitted_student_event", date:"2027-04-10", event:"Admitted student event", privateNotes:"Liked the students I met." });
await updateCollegeAdmissions(userId, { action:"save_reflection", collegeId:"144050", mattersMost:"Affordability and mathematics", concerns:"Distance from home" });
await updateCollegeAdmissions(userId, { action:"save_enrollment_item", collegeId:"144050", item:"enrollmentDeposit", status:"planned", amount:500, deadline:"2027-05-01" });
await updateSavedCollege(userId,"147767",true);
await updateCollegeAdmissions(userId,{action:"record_decision",collegeId:"147767",outcome:"accepted",receivedAt:"2027-03-26"});
await updateSavedCollege(userId,"214777",true);
await updateCollegeAdmissions(userId,{action:"record_decision",collegeId:"214777",outcome:"waitlisted",receivedAt:"2027-03-28"});
await updateCollegeAdmissions(userId, { action: "commit", collegeId: "144050", expectedStart:"Fall 2027" });
account = await readAccountData(userId);
const finalChicago=account.savedColleges?.find(record=>record.collegeId==="144050");
assert.equal(finalChicago?.application?.status, "committed");
assert.deepEqual(finalChicago?.application?.decisionHistory?.map(item=>item.outcome),["deferred","accepted"],"Decision history must preserve later outcomes.");
assert.equal(finalChicago?.application?.visits?.[0].privateNotes,"Liked the students I met.");
assert.equal(finalChicago?.application?.enrollment?.expectedStart,"Fall 2027");
assert.equal(account.savedColleges?.find(record=>record.collegeId==="147767")?.application?.considerationStatus,"no_longer_considering","Other accepted colleges should remain in history as not attending.");
assert.equal(account.savedColleges?.find(record=>record.collegeId==="214777")?.application?.decision?.outcome,"waitlisted","Choosing a college must not close an active waitlist.");
assert.equal(account.educationalStage, "high_school", "Committing must not switch the student's product stage automatically.");
assert.equal(publicAccountData(account).savedColleges?.find(record=>record.collegeId==="144050")?.application,undefined,"Decision records must not enter the general client session.");

const search = buildUniversalSearch({ user: { id: userId, name: "Student" }, account, opportunities, query: "University of Chicago" });
const savedResult = search.results.find((item) => item.kind === "college_application");
assert.equal(savedResult?.group, "My College List");
assert.match(savedResult?.href ?? "", /\/application$/);

console.log("College admissions check passed: state, verified facts, tasks, decisions, continuity, isolation, and private search.");
