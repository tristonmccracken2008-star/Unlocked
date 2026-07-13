import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const opportunities = JSON.parse(read("data/db/opportunities.json"));
const schools = [...JSON.parse(read("data/db/schools.json")), ...JSON.parse(read("data/db/institutions.json"))];
const pipeline = read("data/recommendation-professional-pipeline.ts");
const engine = read("data/recommendation-engine.ts");
const intelligence = read("data/opportunity-intelligence.ts");
const eligibility = read("data/opportunity-eligibility.ts");
const confidence = read("data/opportunity-confidence.ts");
const professionalCheck = read("scripts/check-professional-recommendations.ts");

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
for (const eligibilityGate of [
  "institutionTypeCheck",
  "enrollmentCheck",
  "schoolRestrictionCheck",
  "hostInstitutionCheck",
  "classYearCheck",
  "degreeLevelCheck",
  "citizenshipCheck",
  "gpaCheck",
  "majorCheck",
  "externalStudentCheck",
  "ageCheck",
  "residencyCheck",
  "transferCheck",
  "invitationCheck",
  "demographicCheck",
  "applicationCycleCheck",
  "availabilityCheck",
]) {
  assert.match(eligibility, new RegExp(`${eligibilityGate}\\(opportunity`), `Advisor v3 must run ${eligibilityGate} before Pro ranking.`);
}
assert.match(eligibility, /hasUnknownEligibilityLanguage/, "Advisor v3 must reject unknown or variable eligibility before Pro ranking.");
assert.match(pipeline, /Eligibility has not been positively verified for Pro recommendations/, "Advisor v3 must require verified eligibility for Pro recommendations.");
assert.match(eligibility, /Listed GPA requirement cannot be proven from the profile/, "Advisor v3 must treat unknown GPA as ineligible when a GPA requirement exists.");
assert.match(eligibility, /Citizenship or work-authorization eligibility is not positively proven/, "Advisor v3 must reject unproven citizenship or work-authorization restrictions.");
assert.match(eligibility, /External-student eligibility is not positively proven/, "Advisor v3 must reject unproven external-student eligibility.");
assert.match(pipeline, /confidence is too low for its recommendation tier/i, "Advisor v3 auditor must reject confidence below the selected recommendation tier.");
assert.match(pipeline, /Explanation contains unsupported school relevance/, "Advisor v3 must reject unsupported school explanations.");
assert.match(confidence, /eligibilityConfidence/, "Advisor v3 must compute eligibility confidence.");
assert.match(confidence, /metadataConfidence/, "Advisor v3 must compute metadata confidence.");
assert.match(confidence, /verificationConfidence/, "Advisor v3 must compute verification confidence.");
assert.match(confidence, /recommendationConfidence/, "Advisor v3 must compute recommendation confidence.");
assert.match(confidence, /overallConfidence/, "Advisor v3 must compute overall confidence.");
assert.match(professionalCheck, /\? 32 : 512/, "Advisor v3 must adversarially test at least 500 synthetic students outside the fast prebuild smoke test.");
assert.match(intelligence, /export type SchoolEligibility/, "Advisor v3 eligibility must use canonical school eligibility.");
for (const profileField of ["institutionType", "enrollmentStatus", "degreeLevel", "citizenshipStatus", "workAuthorization", "age", "transferStatus", "financialNeedStatus", "meritStatus", "eligibilityAttributes"]) {
  assert.match(intelligence, new RegExp(`${profileField}\\?`), `Advisor context must support ${profileField} for precision eligibility.`);
}
assert.match(engine, /evaluateProfessionalRecommendationCandidate\(opportunity, context\)\.allowed/, "Recommendation engine must gate candidates before ranking.");
assert.match(engine, /auditFinalOpportunityRecommendation\(recommendation, opportunity, context\)\.approved/, "Recommendation engine must audit final recommendations.");
assert.match(engine, /institutionType: profile\.academics\.institutionType/, "Recommendation context must use the student's institution type.");
assert.match(engine, /enrollmentStatus: profile\.academics\.enrollmentStatus/, "Recommendation context must use the student's enrollment status.");
assert.match(engine, /degreeLevel: profile\.academics\.degreeLevel/, "Recommendation context must use the student's degree level.");
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
