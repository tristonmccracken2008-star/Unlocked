import assert from "node:assert/strict";
import { createAdvisorProfile } from "../data/advisor-engine";
import { isCanonicalCatalogOpportunity } from "../data/opportunity-catalog-canonical";
import { normalizeOpportunityEligibility } from "../data/opportunity-eligibility-model";
import { evaluateOpportunityEligibility } from "../data/opportunity-eligibility";
import { resolveOpportunityLifecycle } from "../data/opportunity-lifecycle";
import { recommendationOpportunityClass } from "../data/recommendation-portfolio-policy";
import { buildOpportunityStudentContext, rankOpportunityRecommendations } from "../data/recommendation-engine";
import { validateOpportunityData } from "../data/recommendation-professional-pipeline";
import { allOpportunityAcquisitionCandidates, allOpportunityAcquisitionRecords } from "../data/opportunity-acquisition-batches";
import { opportunityAcquisitionBatch4 } from "../data/opportunity-acquisition-batch-4";
import { opportunityAcquisitionBatch5 } from "../data/opportunity-acquisition-batch-5";
import { opportunityAcquisitionBatch6 } from "../data/opportunity-acquisition-batch-6";
import { opportunityAcquisitionBatch7 } from "../data/opportunity-acquisition-batch-7";
import { opportunityAcquisitionBatch8 } from "../data/opportunity-acquisition-batch-8";
import { opportunities } from "../data/opportunities";
import { schools } from "../data/seed";
import type { StudentProfile } from "../data/student-profile";

const auditDate = new Date("2026-08-31T12:00:00.000Z");
const newIds = [
  "career--comap-mcm-icm-2027",
  "career--forte-career-ready-certificate",
  "career--girls-who-invest-scholars-2027",
  "career--seo-career-program",
  "research--daad-rise-germany-2027",
  "research--jpl-year-round-internship",
  "research--naval-research-enterprise-internship-program",
] as const;
const enrichedIds = [
  "national-curated-2026--jack-kent-cooke-foundation--jack-kent-cooke-undergraduate-transfer-scholarship",
  "national-curated-2026--nasa--nasa-ostem-internships",
  "research--doe-suli",
  "scholarship--dod-smart-scholarship",
  "scholarship--gilman-scholarship",
] as const;
const archivedDuplicates = new Map([
  ["national-curated-2026--u-s-department-of-defense--smart-scholarship-for-service-program", "scholarship--dod-smart-scholarship"],
  ["national-curated-2026--u-s-department-of-state--gilman-international-scholarship", "scholarship--gilman-scholarship"],
]);
const recertifiedStaleIds = new Set(["career--nsf-bridge-to-cyber-2026"]);

for (const id of [...newIds, ...enrichedIds, ...allOpportunityAcquisitionRecords.map((item) => item.id)]) {
  const item = opportunities.find((opportunity) => opportunity.id === id);
  assert.ok(item, `${id} must exist.`);
  assert.equal(item.verification_status, "verified", `${id} must be source-verified.`);
  assert.equal(item.metadata.verification?.eligibilityVerified, true, `${id} must have verified eligibility.`);
  assert.ok(item.metadata.verification?.officialSourceUrl?.startsWith("https://"), `${id} must retain an official HTTPS source.`);
  assert.equal(normalizeOpportunityEligibility(item).recommendationEligibilityStatus, "eligible_for_ranking", `${id} must have structured ranking eligibility.`);
  assert.equal(normalizeOpportunityEligibility(item).criticalUnknowns.length, 0, `${id} must not contain critical eligibility unknowns.`);
  assert.ok(item.metadata.lifecycle, `${id} must have structured lifecycle metadata.`);
}

for (const [id, canonicalId] of archivedDuplicates) {
  const item = opportunities.find((opportunity) => opportunity.id === id);
  assert.ok(item, `${id} must remain resolvable for compatibility.`);
  assert.equal(item.verification_status, "archived");
  assert.equal(item.metadata.lifecycle?.identity.supersededBy, canonicalId);
  assert.equal(resolveOpportunityLifecycle(item, auditDate).recommendationEligible, false);
}

const currentlyActionableIds = [
  "career--comap-mcm-icm-2027",
  "career--forte-career-ready-certificate",
  "career--seo-career-program",
  "national-curated-2026--nasa--nasa-ostem-internships",
  "research--doe-cci",
  "research--doe-suli",
  "research--jpl-year-round-internship",
  "research--naval-research-enterprise-internship-program",
  "scholarship--dod-smart-scholarship",
  "scholarship--gilman-scholarship",
  "national-curated-2026--jack-kent-cooke-foundation--jack-kent-cooke-undergraduate-transfer-scholarship",
  ...allOpportunityAcquisitionRecords.filter((item) => !recertifiedStaleIds.has(item.id)).map((item) => item.id),
] as const;
for (const id of currentlyActionableIds) {
  const item = opportunities.find((opportunity) => opportunity.id === id);
  assert.ok(item, `${id} must exist.`);
  assert.equal(resolveOpportunityLifecycle(item, auditDate).recommendationEligible, true, `${id} must be actionable on the audit date.`);
}

for (const id of ["career--girls-who-invest-scholars-2027", "research--daad-rise-germany-2027"] as const) {
  const item = opportunities.find((opportunity) => opportunity.id === id);
  assert.ok(item, `${id} must exist.`);
  assert.equal(resolveOpportunityLifecycle(item, auditDate).state, "upcoming", `${id} must remain suppressed until its verified window opens.`);
  assert.equal(resolveOpportunityLifecycle(item, auditDate).recommendationEligible, false);
}
for (const id of recertifiedStaleIds) {
  const item = opportunities.find((opportunity) => opportunity.id === id);
  assert.ok(item, `${id} must remain resolvable after recertification.`);
  assert.equal(resolveOpportunityLifecycle(item, auditDate).recommendationEligible, false, `${id} must stay suppressed without a current official cycle.`);
}

const school = schools.find((item) => item.slug === "university-of-chicago");
assert.ok(school, "Representative university must exist.");
const baseProfile: StudentProfile = {
  firstName: "Catalog",
  schoolSlug: school.slug,
  major: "Undecided",
  minor: "",
  graduationYear: "2029",
  year: "Second year",
  careerGoal: "Undecided",
  interests: "Explore careers",
  topics: ["Explore careers"],
  goals: ["Find internship"],
  currentPriority: "Finding an internship",
  gpaStatus: "reported",
  gpa: 3.7,
  institutionType: "university",
  enrollmentStatus: "enrolled",
  degreeLevel: "undergraduate",
  citizenshipStatus: "us_citizen",
  workAuthorization: "us_authorized",
  transferStatus: "not_transfer",
  financialNeedStatus: "demonstrated",
  meritStatus: "demonstrated",
  age: 19,
  eligibilityAttributes: ["pell_grant_recipient"],
};

const profiles: Record<string, Partial<StudentProfile>> = {
  "first-year-cs": { major: "Computer Science", year: "First year", graduationYear: "2030", careerGoal: "Software Engineering", interests: "Software, AI, Research", topics: ["Software", "AI", "Research"], age: 18 },
  "economics-finance": { major: "Economics", careerGoal: "Investment Banking", interests: "Finance, Consulting, Internships", topics: ["Finance", "Consulting"] },
  "pre-med": { major: "Biology", careerGoal: "Medicine", interests: "Healthcare, Research, Scholarships", topics: ["Healthcare", "Research", "Scholarships"] },
  engineering: { major: "Engineering", careerGoal: "Engineering", interests: "Engineering, Research, Robotics", topics: ["Engineering", "Research", "Robotics"] },
  humanities: { major: "English", careerGoal: "Publishing", interests: "Writing, Communications, Study Abroad", topics: ["Writing", "Communications", "Study Abroad"] },
  scholarships: { major: "Engineering", careerGoal: "Engineering", interests: "Scholarships, STEM, Research", topics: ["Scholarships", "STEM", "Research"] },
  research: { major: "Physics", careerGoal: "Research", interests: "Research, Graduate School, Space", topics: ["Research", "Graduate School", "Space"] },
  undecided: { major: "Undecided", careerGoal: "Undecided", interests: "Explore careers, Competitions, Career Development", topics: ["Explore careers", "Competitions", "Career Development"] },
};

const evaluationFor = (id: string, overrides: Partial<StudentProfile> = {}) => {
  const opportunity = opportunities.find((item) => item.id === id);
  assert.ok(opportunity, `${id} must exist for eligibility regression coverage.`);
  const profile = { ...baseProfile, ...overrides };
  const advisorProfile = createAdvisorProfile({ profile, school });
  return evaluateOpportunityEligibility(opportunity, buildOpportunityStudentContext(advisorProfile));
};

assert.equal(evaluationFor("career--nsf-elean-nanomanufacturing-2026", { age: 17 }).eligible, false, "ELEAN must enforce its minimum age.");
assert.equal(evaluationFor("career--nsf-bridge-to-cyber-2026", { major: "Computer Science" }).eligible, false, "Bridge To Cyber must not rank for computing majors.");
assert.equal(evaluationFor("career--nsf-bridge-to-cyber-2026", { major: "Economics" }).eligible, true, "Bridge To Cyber must remain available to a proven non-computing major.");
assert.equal(evaluationFor("career--tfas-spring-washington-fellowship-2027", { citizenshipStatus: "international", workAuthorization: "unknown" }).eligible, false, "The Spring Fellowship's conservative domestic rule must fail closed.");
assert.equal(evaluationFor("career--tfas-summer-academic-internship-2027", { major: "Political Science", citizenshipStatus: "international", workAuthorization: "unknown" }).eligible, true, "The official international summer route must remain eligible for a matched academic track.");
assert.equal(evaluationFor("fellowship--fulbright-us-student-2027-28", { year: "First year", graduationYear: "2030" }).eligible, false, "Fulbright must not rank before the final undergraduate year.");
assert.equal(evaluationFor("fellowship--fulbright-us-student-2027-28", { year: "Fourth year", graduationYear: "2027", citizenshipStatus: "international", workAuthorization: "unknown" }).eligible, false, "Fulbright must enforce U.S. citizenship.");
assert.equal(evaluationFor("career--americorps-fema-corps-2027", { age: 25 }).eligible, false, "FEMA Corps must enforce its maximum member age.");

const rankingCatalog = opportunities.filter((item) => validateOpportunityData(item, auditDate).allowed);
const profileCoverage: Record<string, { count: number; ids: string[] }> = {};
for (const [name, override] of Object.entries(profiles)) {
  const profile = { ...baseProfile, ...override };
  const advisorProfile = createAdvisorProfile({ profile, school });
  const recommendations = rankOpportunityRecommendations({ advisorProfile, opportunities: rankingCatalog, limit: 8 });
  const ids = recommendations.flatMap((item) => item.relatedOpportunityId ? [item.relatedOpportunityId] : []);
  profileCoverage[name] = { count: ids.length, ids };
  assert.ok(ids.length >= 4, `${name} must receive at least four positively eligible recommendations.`);
}
assert.ok(profileCoverage["first-year-cs"].ids.some((id) => id.includes("nasa") || id.includes("jpl")), "First-year CS needs a verified experience opportunity.");
assert.ok(profileCoverage["economics-finance"].ids.includes("career--seo-career-program"), "Economics/finance needs verified career development.");
assert.ok(profileCoverage["pre-med"].ids.some((id) => id.startsWith("research--")), "Pre-med needs verified research coverage.");
assert.ok(profileCoverage.scholarships.ids.includes("scholarship--dod-smart-scholarship"), "Scholarship seekers need a verified funding option.");
assert.ok(profileCoverage.research.ids.some((id) => id.startsWith("research--")), "Research seekers need a verified research option.");

const verified = opportunities.filter((item) => item.verification_status === "verified");
const canonical = opportunities.filter((item) => isCanonicalCatalogOpportunity(item.id) && !["archived", "broken_source"].includes(item.verification_status));
const recommendationSafe = opportunities.filter((item) => validateOpportunityData(item, auditDate).allowed);
const highValueRecommendationSafe = recommendationSafe.filter((item) => recommendationOpportunityClass(item) !== "resource");
const categoryCounts = verified.reduce<Record<string, number>>((counts, item) => {
  const category = recommendationOpportunityClass(item);
  counts[category] = (counts[category] ?? 0) + 1;
  return counts;
}, {});
const unresolved = opportunities.filter((item) => ["needs_review", "temporarily_closed", "incomplete", "broken_source"].includes(item.verification_status)).length;

const preTargetedCatalog = 6015;
const preTargetedCanonical = 6004;
const preTargetedVerified = 222;
const preTargetedHighValueSafe = 31;
const targetedAdditions = opportunityAcquisitionBatch4.records.length + opportunityAcquisitionBatch5.records.length + opportunityAcquisitionBatch6.records.length + opportunityAcquisitionBatch7.records.length + opportunityAcquisitionBatch8.records.length;
assert.equal(opportunities.length, preTargetedCatalog + targetedAdditions, "Catalog size must equal the approved pre-targeted baseline plus every distinct targeted addition.");
assert.equal(canonical.length, preTargetedCanonical + targetedAdditions, "Canonical public inventory must include targeted additions while excluding archived and secondary duplicate records.");
assert.equal(verified.length, preTargetedVerified + targetedAdditions, "Every targeted addition must contribute exactly one verified canonical identity.");
assert.equal(highValueRecommendationSafe.length, preTargetedHighValueSafe + targetedAdditions - recertifiedStaleIds.size, "Every targeted addition except explicitly recertified stale records must remain safely actionable and non-resource on the audit date.");

console.log(JSON.stringify({
  auditDate: auditDate.toISOString().slice(0, 10),
  inventory: {
    totalCatalog: opportunities.length,
    canonical: canonical.length,
    verified: verified.length,
    recommendationSafe: recommendationSafe.length,
    highValueRecommendationSafe: highValueRecommendationSafe.length,
    unresolved,
    archivedDuplicates: archivedDuplicates.size,
  },
  verifiedCategoryCounts: categoryCounts,
  expansion: {
    newRecords: newIds.length,
    enrichedRecords: enrichedIds.length,
    newlyVerifiedRecords: 8,
    existingRecordsSafelyUpgraded: 1,
    structuredEligibilityCandidatesBefore: 1,
    structuredEligibilityCandidatesAfter: [...newIds, ...enrichedIds, "research--doe-cci"].length,
    highValueRecommendationSafeBefore: 1,
    highValueRecommendationSafeAfter: highValueRecommendationSafe.length,
  },
  acquisitionWave: {
    researched: allOpportunityAcquisitionCandidates.length,
    accepted: allOpportunityAcquisitionRecords.length,
    canonicalRecordsAdded: 17 + targetedAdditions,
    canonicalRecordsEnriched: 5,
    rejected: allOpportunityAcquisitionCandidates.filter((item) => item.status === "rejected").length,
    recommendationSafeBefore: 68,
    recommendationSafeAfter: recommendationSafe.length,
    highValueRecommendationSafeBefore: 10,
    highValueRecommendationSafeAfter: highValueRecommendationSafe.length,
  },
  profileCoverage,
}, null, 2));
