import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const opportunities = JSON.parse(read("data/db/opportunities.json"));
const schools = [...JSON.parse(read("data/db/schools.json")), ...JSON.parse(read("data/db/institutions.json"))];
const pipeline = read("data/recommendation-professional-pipeline.ts");
const engine = read("data/recommendation-engine.ts");
const intelligence = read("data/opportunity-intelligence.ts");

const schoolSlugs = [...new Set(schools.map((school) => school.slug).filter(Boolean))].slice(0, 120);
const goldenProfiles = schoolSlugs.map((schoolSlug, index) => ({
  id: `golden-${schoolSlug}`,
  schoolSlug,
  major: index % 3 === 0 ? "Mathematics" : index % 3 === 1 ? "Computer Science" : "Biology",
  year: index % 4 === 0 ? "First year" : index % 4 === 1 ? "Second year" : index % 4 === 2 ? "Third year" : "Fourth year",
}));

function isSchoolEligible(profile, opportunity) {
  if (opportunity.school_scope === "National") return true;
  if (opportunity.school_scope === "School Specific") return Boolean(profile.schoolSlug && opportunity.schools?.includes(profile.schoolSlug));
  return opportunity.school_scope !== "School Specific";
}

assert.ok(goldenProfiles.length >= 100, `Expected at least 100 golden profiles, got ${goldenProfiles.length}.`);
assert.match(pipeline, /RecommendationPipelineStage/, "Advisor v3 must define explicit pipeline stages.");
for (const stage of ["data_validation", "eligibility_engine", "recommendation_engine", "career_advisor", "explanation_engine", "quality_auditor"]) {
  assert.match(pipeline, new RegExp(stage), `Advisor v3 pipeline must include ${stage}.`);
}
assert.match(pipeline, /validateOpportunityData/, "Advisor v3 must validate opportunity data before ranking.");
assert.match(pipeline, /evaluateEligibility/, "Advisor v3 must include a ruthless eligibility engine.");
assert.match(pipeline, /evaluateProfessionalRecommendationCandidate/, "Advisor v3 must expose candidate gating.");
assert.match(pipeline, /auditFinalOpportunityRecommendation/, "Advisor v3 must audit final recommendations.");
assert.match(pipeline, /buildRecommendationHealthMonitor/, "Advisor v3 must expose recommendation health monitoring.");
assert.match(pipeline, /careerAdvisorFit/, "Advisor v3 must ask what the student should do next.");
assert.match(pipeline, /confidence is too low for Pro/i, "Advisor v3 auditor must reject low confidence Pro recommendations.");
assert.match(pipeline, /Explanation contains unsupported school relevance/, "Advisor v3 must reject unsupported school explanations.");
assert.match(intelligence, /export type SchoolEligibility/, "Advisor v3 eligibility must use canonical school eligibility.");
assert.match(engine, /evaluateProfessionalRecommendationCandidate\(opportunity, context\)\.allowed/, "Recommendation engine must gate candidates before ranking.");
assert.match(engine, /auditFinalOpportunityRecommendation\(recommendation, opportunity, context\)\.approved/, "Recommendation engine must audit final recommendations.");
assert.match(engine, /buildRecommendationHealthMonitor/, "Recommendation diagnostics must include health monitoring.");
assert.match(engine, /diversityAdjustedOpportunityRecommendations/, "Advisor v3 must keep recommendation diversity.");
assert.match(engine, /getOpportunityRelationship/, "Advisor v3 must keep opportunity relationships.");
assert.match(engine, /buildRecommendationWeeklyStrategy/, "Advisor v3 must keep weekly advisor strategy.");

const schoolSpecific = opportunities.filter((opportunity) => opportunity.school_scope === "School Specific" && opportunity.schools?.length);
assert.ok(schoolSpecific.length > 500, "Catalog should include enough school-specific records to validate wrong-school protection.");

for (const profile of goldenProfiles) {
  const forbidden = schoolSpecific.filter((opportunity) => !isSchoolEligible(profile, opportunity));
  assert.ok(forbidden.length > 0, `Golden profile ${profile.id} should have forbidden school-specific records.`);
  for (const opportunity of forbidden.slice(0, 50)) {
    assert.equal(isSchoolEligible(profile, opportunity), false, `${profile.id} must forbid ${opportunity.id}.`);
  }
  const allowedNational = opportunities.find((opportunity) => opportunity.school_scope === "National");
  assert.ok(allowedNational && isSchoolEligible(profile, allowedNational), `${profile.id} should allow national opportunities.`);
}

const uchicago = goldenProfiles.find((profile) => profile.schoolSlug === "university-of-chicago");
assert.ok(uchicago, "Golden profiles must include UChicago.");
for (const opportunity of schoolSpecific.filter((item) => item.schools.includes("purdue-university-main-campus")).slice(0, 20)) {
  assert.equal(isSchoolEligible(uchicago, opportunity), false, `UChicago must reject Purdue record ${opportunity.id}.`);
}
const syntheticCaltech = { id: "synthetic-caltech-only", school_scope: "School Specific", schools: ["california-institute-of-technology"] };
assert.equal(isSchoolEligible(uchicago, syntheticCaltech), false, "UChicago must reject Caltech-only recommendations.");

console.log(`Advisor Engine v3 checks passed with ${goldenProfiles.length} golden profiles and ${schoolSpecific.length} school-specific records.`);
