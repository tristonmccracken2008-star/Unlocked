import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const opportunities = JSON.parse(read("data/db/opportunities.json"));
const intelligence = read("data/opportunity-intelligence.ts");
const engine = read("data/recommendation-engine.ts");
const snapshot = read("lib/for-you-snapshot.ts");
const card = read("components/opportunity-card.tsx");

function schoolEligibility(item) {
  const schoolIds = [...new Set((item.schools ?? []).filter(Boolean))].sort();
  if (item.school_scope === "National") return { type: "all_colleges" };
  if (item.school_scope === "School Specific" && schoolIds.length) return { type: "specific_schools", schoolIds };
  if (item.school_scope === "School Specific") return { type: "unknown" };
  return { type: "unknown" };
}

function isEligible(schoolSlug, item) {
  const eligibility = schoolEligibility(item);
  if (eligibility.type === "all_colleges") return true;
  if (eligibility.type === "specific_schools") return Boolean(schoolSlug && eligibility.schoolIds.includes(schoolSlug));
  return item.school_scope !== "School Specific";
}

const uchicago = "university-of-chicago";
const purdue = "purdue-university-main-campus";
const caltech = "california-institute-of-technology";
const unknown = "unknown-unlisted-school";

const uchicagoOnly = opportunities.filter((item) => item.school_scope === "School Specific" && item.schools?.includes(uchicago));
const purdueOnly = opportunities.filter((item) => item.school_scope === "School Specific" && item.schools?.includes(purdue) && !item.schools.includes(uchicago));
const caltechOnly = opportunities.filter((item) => item.school_scope === "School Specific" && item.schools?.includes(caltech) && !item.schools.includes(uchicago));
const national = opportunities.filter((item) => item.school_scope === "National");
const remoteNational = national.filter((item) => item.remote === true);
const campusSpecific = opportunities.filter((item) => item.school_scope === "School Specific" && ["Campus", "Campus Jobs", "University Research", "University Scholarships"].includes(item.category));

assert.ok(uchicagoOnly.length > 0, "Catalog must contain UChicago-specific records for positive validation.");
assert.ok(purdueOnly.length > 0, "Catalog must contain Purdue-specific records for wrong-school validation.");
assert.ok(national.length > 0, "Catalog must contain national records.");
assert.ok(remoteNational.length > 0, "Catalog must contain remote national records.");
assert.ok(campusSpecific.length > 0, "Catalog must contain campus-specific records.");

for (const item of uchicagoOnly) assert.equal(isEligible(uchicago, item), true, `UChicago should be eligible for ${item.id}.`);
for (const item of purdueOnly) assert.equal(isEligible(uchicago, item), false, `UChicago must not be eligible for Purdue-only ${item.id}.`);
for (const item of caltechOnly) assert.equal(isEligible(uchicago, item), false, `UChicago must not be eligible for Caltech-only ${item.id}.`);
for (const item of national.slice(0, 100)) assert.equal(isEligible(uchicago, item), true, `National opportunity should be eligible: ${item.id}.`);
for (const item of remoteNational.slice(0, 50)) assert.equal(isEligible(uchicago, item), true, `Remote national opportunity should be eligible: ${item.id}.`);
for (const item of campusSpecific.filter((item) => !item.schools?.includes(uchicago)).slice(0, 100)) assert.equal(isEligible(uchicago, item), false, `Wrong-campus opportunity must be excluded: ${item.id}.`);
for (const item of campusSpecific.slice(0, 100)) assert.equal(isEligible(unknown, item), false, `Unknown school must not receive campus-specific ${item.id}.`);

const multiSchool = { school_scope: "School Specific", schools: [uchicago, purdue] };
const syntheticCaltechOnly = { school_scope: "School Specific", schools: [caltech] };
assert.equal(isEligible(uchicago, multiSchool), true, "Multi-school opportunities should include UChicago only when listed.");
assert.equal(isEligible(caltech, multiSchool), false, "Multi-school opportunities should exclude unlisted schools.");
assert.equal(isEligible(purdue, multiSchool), true, "Multi-school opportunities should include Purdue when listed.");
assert.equal(isEligible(uchicago, syntheticCaltechOnly), false, "UChicago must not be eligible for synthetic Caltech-only opportunities.");
assert.equal(isEligible(caltech, syntheticCaltechOnly), true, "Caltech must be eligible for synthetic Caltech-only opportunities.");

assert.match(intelligence, /export type SchoolEligibility/, "Opportunity intelligence must expose canonical SchoolEligibility.");
assert.match(intelligence, /export function getSchoolEligibility/, "Opportunity intelligence must normalize school eligibility.");
assert.match(intelligence, /export function isSchoolEligible/, "Opportunity intelligence must expose hard school eligibility.");
assert.match(engine, /import \{ getOpportunityIntelligence, isSchoolEligible, scoreOpportunityIntelligence/, "Recommendation engine must import hard school eligibility.");
assert.match(engine, /if \(!isSchoolEligible\(opportunity, context\)\) return true;/, "Recommendation engine must exclude wrong-school records before ranking.");
assert.match(engine, /const prefiltered = source\.filter\(\(opportunity\) => !shouldExcludeOpportunity\(profile, opportunity, context\)\)/, "Recommendation engine must prefilter before rankOpportunity.");
assert.match(engine, /rankOpportunity\(profile, opportunity, context/, "Ranking must happen only after the hard prefilter.");
assert.match(intelligence, /schoolEligible \? item\.school_scope === "School Specific" \? "School-specific eligibility matches" : "Available nationally" : "Not eligible for this school"/, "School match signals must come from canonical eligibility.");
assert.match(intelligence, /if \(schoolEligible\) reasons\.push\(item\.school_scope === "National" \? "Available nationally\." : `Available at \$\{context\.schoolName \?\? "your school"\}\.`\);/, "School-match explanations must only appear after verified eligibility.");
assert.match(snapshot, /forYouSnapshotEngineVersion = "for-you-snapshot-v5-best-mix"/, "Snapshot engine version must invalidate snapshots generated before the Best Mix portfolio policy.");
assert.match(snapshot, /item\.school_scope,[\s\S]*\[\.\.\.item\.schools\]\.sort\(\),[\s\S]*item\.metadata\.eligibilityRules \?\? null,[\s\S]*item\.verification_status,[\s\S]*item\.last_verified/, "Snapshot source version must include school eligibility and verification metadata without normalizing the full catalog during a request cold start.");
assert.doesNotMatch(snapshot, /normalizeOpportunityEligibility\(item\)/, "For You route initialization must not normalize all opportunities before it can read an existing snapshot or free state.");
assert.match(card, /enrollment required/, "Discover cards must clearly label school-specific eligibility.");

const grouped = new Map();
for (const item of opportunities.filter((opportunity) => opportunity.school_scope === "School Specific")) {
  for (const school of item.schools ?? ["unknown"]) grouped.set(school, (grouped.get(school) ?? 0) + 1);
}
const topInstitutions = [...grouped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([school, count]) => `${school}:${count}`).join(", ");

console.log(`School eligibility checks passed. School-specific records: ${campusSpecific.length} campus/internal sampled; Caltech-specific catalog records: ${caltechOnly.length}; top institutions: ${topInstitutions}.`);
