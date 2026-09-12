import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { requirementStates, verificationStates, verifiedCollegeAid, verifiedCollegeAidCount } from "../data/college-financial-aid";

const scorecard = JSON.parse(readFileSync("data/db/college-scorecard.json", "utf8")) as { colleges: Array<{ id: string; ownership: string }> };
const collegeById = new Map(scorecard.colleges.map((college) => [college.id, college]));
const records = Object.values(verifiedCollegeAid);
const validDate = /^\d{4}-\d{2}-\d{2}$/;
const validUrl = (value: string) => { const url = new URL(value); return url.protocol === "https:"; };

assert.equal(records.length, verifiedCollegeAidCount);
assert.ok(records.length >= 40, "Coverage must include at least 40 carefully verified institutions.");
assert.equal(new Set(records.map((record) => record.collegeId)).size, records.length, "College IDs must be unique.");

for (const [key, record] of Object.entries(verifiedCollegeAid)) {
  assert.equal(key, record.collegeId, `Map key must match canonical college ID ${key}.`);
  assert.ok(collegeById.has(record.collegeId), `Unknown College Scorecard ID ${record.collegeId}.`);
  assert.ok(verificationStates.includes(record.verificationStatus));
  assert.ok(validDate.test(record.verifiedAt) && !Number.isNaN(Date.parse(record.verifiedAt)));
  assert.ok(requirementStates.includes(record.fafsa));
  assert.ok(requirementStates.includes(record.cssProfile));
  assert.ok(requirementStates.includes(record.idoc));
  assert.ok(requirementStates.includes(record.noncustodialParent));
  assert.ok(validUrl(record.sourceUrl));
  assert.ok(validUrl(record.netPriceCalculator.url));
  assert.ok(record.sources.some((source) => source.fields.includes("netPriceCalculator")));
  assert.ok(record.sources.some((source) => source.fields.includes("fafsa") && source.fields.includes("cssProfile")));
  for (const source of record.sources) {
    assert.ok(source.label && source.fields.length && validUrl(source.url));
    assert.ok(validDate.test(source.verifiedAt));
  }
  for (const deadline of record.deadlines) {
    assert.ok(validDate.test(deadline.date) && !Number.isNaN(Date.parse(deadline.date)));
    assert.equal(deadline.cycle, record.aidYear, `${record.collegeId} deadline cycle must match record cycle.`);
    assert.ok(validUrl(deadline.sourceUrl));
    assert.equal(record.verificationStatus, "verified_current_cycle");
  }
}

assert.ok(records.filter((record) => record.cssProfile === "required_for_institutional_aid").length >= 25);
assert.ok(records.filter((record) => collegeById.get(record.collegeId)?.ownership === "Public" && record.cssProfile === "not_required").length >= 8);
assert.ok(records.filter((record) => record.deadlines.length > 0).length >= 4);
assert.ok(records.some((record) => record.meritAid?.availability === "available"));
assert.ok(records.some((record) => record.needBasedPolicy?.noLoan));
assert.ok(records.some((record) => record.international?.needBasedAid === "available"));

console.log(`College financial aid checks passed for ${records.length} institutions.`);
