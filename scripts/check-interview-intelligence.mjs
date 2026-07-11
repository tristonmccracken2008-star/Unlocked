import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const interview = readFileSync("data/interview-intelligence.ts", "utf8");
const twin = readFileSync("data/student-digital-twin.ts", "utf8");
const evidence = readFileSync("data/evidence-inventory.ts", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

assert.match(interview, /runInterviewIntelligence/, "Interview Intelligence must expose a deterministic engine entry point.");
assert.match(interview, /buildStudentDigitalTwin/, "Interview Intelligence must integrate with the Student Digital Twin.");
assert.match(interview, /RecommendationV1/, "Interview Intelligence must consume existing recommendation outputs.");
assert.match(interview, /StudentProgress/, "Interview Intelligence must consume existing progress/application state.");
assert.match(interview, /evidenceBackedStoryIdeas/, "Interview Intelligence must generate evidence-backed story ideas.");
assert.match(interview, /competencyCoverage/, "Interview Intelligence must compute competency coverage.");
assert.match(interview, /starCompleteness/, "Interview Intelligence must evaluate STAR completeness structurally.");
assert.match(interview, /evidenceSupport/, "Interview Intelligence must require evidence support.");
assert.match(interview, /knowledgeReferences/, "Interview Intelligence must return reviewed knowledge references.");

assert.doesNotMatch(interview, /Develop a \$\{?m\}? story|Practice technical interview topics for|100-25\*len|txt=response\.lower|keyword/i, "Prototype interview scoring/recommendations must not be present.");

assert.match(twin, /StudentDigitalTwin/, "Student Digital Twin type must exist.");
assert.match(twin, /evidenceInventory/, "Student Digital Twin must include the evidence inventory.");
assert.match(twin, /stateFlags/, "Student Digital Twin must expose planning state flags.");
assert.match(twin, /interview/, "Student Digital Twin must include an interview dimension.");

for (const source of ["profile", "activity", "milestone", "application", "recommendation"]) {
  assert.match(evidence, new RegExp(`"${source}"`), `Evidence inventory must support ${source} evidence.`);
}
for (const dimension of ["technical-depth", "external-validation", "communication", "professional-reliability", "career-fit-evidence", "interview-story-quality"]) {
  assert.match(evidence, new RegExp(`"${dimension}"`), `Evidence inventory must include ${dimension}.`);
}

assert.ok(pkg.scripts["check:interview"]?.includes("check-interview-intelligence.mjs"), "Interview Intelligence check must be wired into npm scripts.");
assert.match(pkg.scripts.prebuild, /check:interview/, "Production prebuild must run Interview Intelligence checks.");

console.log("Interview Intelligence checks passed.");
