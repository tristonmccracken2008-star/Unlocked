import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import { getCollege, relatedColleges, searchColleges } from "../lib/colleges";
import { readAccountData, updateSavedCollege } from "../lib/auth-store";

const catalog = searchColleges({ limit: 1 });
assert.ok(catalog.total >= 2_500, `Expected a substantial national catalog; received ${catalog.total}`);

const cases = [
  ["UChicago", "University of Chicago"],
  ["computer science Chicago", "University of Chicago"],
  ["engineering", "Franklin W Olin College of Engineering"],
  ["California", "California Institute of Technology"],
] as const;
for (const [query, expected] of cases) {
  const result = searchColleges({ query, limit: 40 });
  assert.ok(result.colleges.some((college) => college.name === expected), `${query} should find ${expected}`);
}
assert.ok(searchColleges({ query: "public universities", limit: 40 }).colleges.every((college) => college.ownership === "Public"));
assert.ok(searchColleges({ query: "small colleges", limit: 40 }).colleges.every((college) => college.undergraduateEnrollment < 2_000));

for (const name of ["University of Chicago", "University of Michigan-Ann Arbor", "Williams College", "Massachusetts Institute of Technology", "Howard University", "California State University-Fresno", "DePaul University", "Pasadena City College"]) {
  const college = searchColleges({ query: name, limit: 10 }).colleges.find((item) => item.name === name);
  assert.ok(college, `Missing QA institution: ${name}`);
  assert.ok(college.undergraduateEnrollment > 0 && college.programs.length > 0, `${name} needs useful institution and academic context`);
}

const chicago = getCollege("144050");
assert.ok(chicago);
const related = relatedColleges(chicago);
assert.equal(related.length, 5);
assert.ok(related.every((item) => item.reasons.length > 0));

const userA = "college-check-user-a";
const userB = "college-check-user-b";
await updateSavedCollege(userA, chicago.id, true);
await updateSavedCollege(userA, chicago.id, true);
assert.deepEqual((await readAccountData(userA)).savedColleges?.map((item) => item.collegeId), [chicago.id], "Save should be idempotent");
assert.equal((await readAccountData(userB)).savedColleges?.length, 0, "Saves must remain account isolated");
await updateSavedCollege(userA, chicago.id, false);
assert.equal((await readAccountData(userA)).savedColleges?.length, 0, "Removing a save should persist");

const samples = Array.from({ length: 60 }, (_, index) => ["engineering", "public universities", "computer science Chicago", "California"][index % 4]);
const durations = samples.map((query) => { const start = performance.now(); searchColleges({ query, limit: 18 }); return performance.now() - start; }).sort((a, b) => a - b);
const p95 = durations[Math.floor(durations.length * .95)];
assert.ok(p95 < 80, `Warm college search must remain under 80ms p95 locally; received ${p95.toFixed(2)}ms`);

const interfaceSource = await Promise.all(["components/college-explorer.tsx", "components/college-detail.tsx", "app/colleges/compare/page.tsx"].map((path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")));
assert.doesNotMatch(interfaceSource.join("\n"), /UnlockED Rank|Prestige Score|College Grade|\bWINNER\b/);
console.log(`College Explorer check passed: ${catalog.total} institutions, search p95 ${p95.toFixed(2)}ms.`);
