import assert from "node:assert/strict";
import { createAdvisorProfile } from "../data/advisor-engine";
import { evaluateOpportunityEligibility } from "../data/opportunity-eligibility";
import { eligibilitySchemaVersion, normalizeOpportunityEligibility } from "../data/opportunity-eligibility-model";
import { buildOpportunityStudentContext } from "../data/recommendation-engine";
import { recommendationRulesVersion } from "../data/recommendation-config";
import { buildRecommendationService } from "../data/recommendation-service";
import { opportunities, type Opportunity } from "../data/opportunities";
import { schools } from "../data/seed";
import type { StudentActivity } from "../data/student-activity";
import type { StudentProfile } from "../data/student-profile";
import { isForYouSnapshotCompatible, forYouCatalogVersion, forYouProfileVersion, forYouSnapshotEngineVersion } from "../lib/for-you-snapshot";
import type { AccountData } from "../lib/account-types";
import type { ForYouRecommendationSnapshot } from "../lib/advisor/types";

const school = schools.find((item) => item.slug === "university-of-chicago");
assert.ok(school, "University of Chicago must remain a supported school.");

const profile: StudentProfile = {
  firstName: "Avery",
  schoolSlug: school.slug,
  major: "Mathematics",
  minor: "Computer Science",
  graduationYear: "2030",
  year: "First year",
  careerGoal: "Quantitative Finance",
  interests: "Finance, Software, Research",
  topics: ["Finance", "Software", "Research"],
  goals: ["Find internship"],
  currentPriority: "Finding an internship",
  gpaStatus: "none_yet",
  institutionType: "university",
  enrollmentStatus: "enrolled",
  degreeLevel: "undergraduate",
  citizenshipStatus: "us_citizen",
  workAuthorization: "us_authorized",
  transferStatus: "not_transfer",
  financialNeedStatus: "unknown",
  meritStatus: "unknown",
};
const activity: StudentActivity = { viewed: [], saved: [], claimed: [], tracked: {} };
const progress = { milestones: {}, applications: {} };
const advisorProfile = createAdvisorProfile({ profile, school, activity, progress });
const context = buildOpportunityStudentContext(advisorProfile);

const cci = opportunities.find((item) => item.id === "research--doe-cci");
const amazon = opportunities.find((item) => item.id === "scholarship--amazon-future-engineer");
const microsoft = opportunities.find((item) => item.id === "scholarship--microsoft-disability-scholarship");
const brooke = opportunities.find((item) => item.id === "career--brooke-owens-fellowship");
const caltech = opportunities.find((item) => item.id === "research--caltech-surf");
assert.ok(cci && amazon && microsoft && brooke && caltech, "Mandatory production regression records must exist.");

const cciEvaluation = evaluateOpportunityEligibility(cci, context);
assert.equal(cciEvaluation.eligible, false, "A UChicago four-year undergraduate must never pass CCI eligibility.");
assert.equal(cciEvaluation.checks.find((check) => check.key === "institution_type")?.proven, false, "CCI must fail the canonical community-college institution check.");
assert.equal(cciEvaluation.checks.find((check) => check.key === "age")?.proven, false, "CCI's canonical minimum age must fail closed when age is unknown.");
assert.equal(normalizeOpportunityEligibility(cci).institutionTypes.includes("community_college"), true, "CCI must retain its canonical community-college restriction.");
for (const scholarship of [amazon, microsoft]) {
  const evaluation = evaluateOpportunityEligibility(scholarship, context);
  assert.equal(evaluation.eligible, false, `${scholarship.id} must reject an enrolled undergraduate.`);
  assert.equal(evaluation.canonical.highSchoolSeniorOnly, true, `${scholarship.id} must retain its high-school-senior restriction.`);
  assert.equal(evaluation.checks.find((check) => check.key === "financial_need")?.proven, false, `${scholarship.id} must enforce its canonical financial-need requirement.`);
}

const canonicalOnlyFixture: Opportunity = {
  ...cci,
  id: "canonical-only-eligibility-fixture",
  title: "Canonical eligibility fixture",
  organization: "National Student Foundation",
  school_scope: "National",
  schools: [],
  academic_years: ["Any Year"],
  majors: ["Any Major"],
  eligibility: "Students who satisfy every verified structured eligibility requirement may apply.",
  application_deadline: null,
  deadline: null,
  metadata: {
    ...cci.metadata,
    deadlineType: "no_deadline",
    eligibilityRules: {
      educationLevels: ["undergraduate"],
      canonicalInstitutionTypes: ["community_college"],
      canonicalEnrollmentStatuses: ["currently_enrolled"],
      specificSchoolIds: ["purdue-university-main-campus"],
      classYears: ["Any Year"],
      majors: ["Any Major"],
      citizenshipStatuses: ["us_citizen"],
      ageRange: { minimum: 21 },
      financialNeedRequired: true,
      availability: "open",
      recommendationEligibilityStatus: "eligible_for_ranking",
      evidence: ["Structured fixture fields are intentionally the only source of hard restrictions."],
    },
  },
};
const canonicalOnlyEvaluation = evaluateOpportunityEligibility(canonicalOnlyFixture, context);
for (const key of ["institution_type", "school_restrictions", "age", "financial_need"] as const) {
  assert.equal(canonicalOnlyEvaluation.checks.find((check) => check.key === key)?.proven, false, `Canonical ${key} must be enforced without eligibility-text inference.`);
}
const internationalContext = { ...context, citizenshipStatus: "international" as const, workAuthorization: "unknown" as const };
assert.equal(evaluateOpportunityEligibility(canonicalOnlyFixture, internationalContext).checks.find((check) => check.key === "citizenship")?.proven, false, "Canonical citizenship statuses must be enforced without eligibility-text inference.");

const wrongSchool = opportunities.find((item) => item.school_scope === "School Specific" && !item.schools.includes(school.slug));
assert.ok(wrongSchool, "A wrong-school fixture must exist in the real catalog.");
assert.equal(evaluateOpportunityEligibility(wrongSchool, context).eligible, false, "Another institution's internal opportunity must fail closed.");

const caltechEligibility = normalizeOpportunityEligibility(caltech);
assert.equal(caltechEligibility.acceptsExternalStudents, true, "Caltech SURF must record visiting-student eligibility from its official source.");
assert.equal(caltechEligibility.recommendationEligibilityStatus, "discover_only", "Closed Caltech SURF cycles must stay out of Pro ranking.");
const brookeEligibility = normalizeOpportunityEligibility(brooke);
assert.equal(brookeEligibility.acceptsExternalStudents, true, "Brooke Owens must retain national external-student eligibility.");
assert.equal(brookeEligibility.recommendationEligibilityStatus, "discover_only", "Closed Brooke Owens cycles must stay out of Pro ranking.");

const service = buildRecommendationService({ profile, school, activity, progress, source: opportunities });
assert.ok(service.recommendations.length > 0, "A valid UChicago undergraduate must receive a useful feed.");
const serviceIds = new Set(service.recommendations.map((item) => item.opportunity?.id));
for (const forbidden of [cci.id, amazon.id, microsoft.id, wrongSchool.id]) assert.equal(serviceIds.has(forbidden), false, `${forbidden} leaked through the final service response.`);
for (const view of service.recommendations) {
  assert.ok(view.opportunity, "Every displayed recommendation must resolve to one opportunity.");
  assert.equal(evaluateOpportunityEligibility(view.opportunity, context).eligible, true, `${view.opportunity.id} lacks proven final eligibility.`);
}

const data: AccountData = {
  profile,
  onboardingComplete: true,
  billing: { tier: "pro", status: "active", billingInterval: "month", cancelAtPeriodEnd: false, updatedAt: "2026-07-13T00:00:00.000Z" },
  activity,
  savedOpportunities: [],
  tracker: {},
  preferences: null,
  journeyProgress: {},
  advisor: null,
  referrals: null,
  updatedAt: "2026-07-13T00:00:00.000Z",
};
const version = forYouProfileVersion(profile, data);
const snapshot: ForYouRecommendationSnapshot = {
  userId: "user-a",
  profileVersion: version,
  engineVersion: forYouSnapshotEngineVersion,
  eligibilitySchemaVersion,
  catalogVersion: forYouCatalogVersion,
  recommendationRulesVersion,
  generatedAt: "2026-07-13T00:00:00.000Z",
  expiresAt: "2099-07-13T06:00:00.000Z",
  recommendations: [],
  totalMatches: 0,
  sourceSignalsVersion: `opportunities:${opportunities.length}:${forYouCatalogVersion}`,
  pageState: "empty",
};
assert.equal(isForYouSnapshotCompatible(snapshot, version, "user-a"), true, "Current snapshot metadata must be compatible.");
assert.equal(isForYouSnapshotCompatible({ ...snapshot, userId: "user-b" }, version, "user-a"), false, "Cross-user snapshots must be rejected.");
assert.equal(isForYouSnapshotCompatible({ ...snapshot, engineVersion: "old" }, version, "user-a"), false, "Old engines must invalidate snapshots.");
assert.equal(isForYouSnapshotCompatible({ ...snapshot, eligibilitySchemaVersion: "old" }, version, "user-a"), false, "Old eligibility schemas must invalidate snapshots.");
assert.equal(isForYouSnapshotCompatible({ ...snapshot, catalogVersion: "old" }, version, "user-a"), false, "Catalog changes must invalidate snapshots.");
assert.equal(isForYouSnapshotCompatible({ ...snapshot, recommendationRulesVersion: "old" }, version, "user-a"), false, "Rule changes must invalidate snapshots.");
assert.equal(isForYouSnapshotCompatible({ ...snapshot, profileVersion: "old" }, version, "user-a"), false, "Profile changes must invalidate snapshots.");
const changedProfile = { ...profile, institutionType: "community_college" as const, degreeLevel: "associate" as const, schoolSlug: "miami-dade-college" };
assert.notEqual(forYouProfileVersion(changedProfile, { ...data, profile: changedProfile }), version, "Eligibility-relevant profile edits must change the snapshot key.");

console.log(JSON.stringify({
  uChicagoRecommendations: service.recommendations.length,
  tiers: service.recommendations.reduce<Record<string, number>>((counts, item) => {
    counts[item.recommendation.tier] = (counts[item.recommendation.tier] ?? 0) + 1;
    return counts;
  }, {}),
  rejectedRegressionRecords: [cci.id, amazon.id, microsoft.id, wrongSchool.id],
  snapshotVersions: { engine: forYouSnapshotEngineVersion, eligibility: eligibilitySchemaVersion, catalog: forYouCatalogVersion, rules: recommendationRulesVersion },
}, null, 2));
