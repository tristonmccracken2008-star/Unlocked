import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { buildRecommendationService, opportunityScoreLabel } from "../data/recommendation-service";
import { opportunities } from "../data/opportunities";
import { schoolDirectory } from "../data/school-directory";
import type { StudentActivity } from "../data/student-activity";
import type { StudentProfile } from "../data/student-profile";

const school = schoolDirectory.find((item) => item.slug === "university-of-chicago");
assert.ok(school, "For You intelligence fixture school must exist.");

const profile: StudentProfile = {
  firstName: "Avery",
  schoolSlug: school.slug,
  major: "Mathematics",
  graduationYear: "2030",
  year: "First year",
  careerGoal: "Quantitative Finance",
  interests: "Finance, Software, Research",
  goals: ["Find internship"],
  topics: ["Finance", "Software", "Research"],
  currentPriority: "Finding an internship",
  preferredOpportunityTypes: [],
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
const input = { profile, school, activity, progress: { milestones: {}, applications: {} }, source: opportunities };
const baseline = buildRecommendationService(input);
const shortlist = baseline.recommendations.slice(0, 8);

assert.equal(shortlist.length, 8, "Pro intelligence should provide a focused eight-item portfolio when enough eligible matches exist.");
assert.ok(shortlist.every((view) => view.opportunityScore.value >= 72 && view.opportunityScore.value <= 99), "Opportunity Scores must remain bounded and must not masquerade as percentages.");
assert.ok(shortlist.every((view) => view.opportunityScore.label === opportunityScoreLabel(view.opportunityScore.value)), "Opportunity Score labels must follow the canonical scale.");
assert.ok(shortlist.every((view) => view.whyThisOpportunity.length >= 2 && view.whyThisOpportunity.length <= 4), "Every recommendation must provide a concise factual explanation set.");
assert.ok(shortlist.every((view) => view.whyApplyNow.detail.length > 0), "Every recommendation must explain timing without inventing urgency.");
assert.ok(shortlist.every((view) => view.similarOpportunities.length <= 2), "Related paths must remain bounded.");

const eligibleIds = new Set(baseline.recommendations.map((view) => view.opportunity?.id).filter(Boolean));
for (const view of shortlist) {
  for (const similar of view.similarOpportunities) {
    assert.notEqual(similar.opportunityId, view.opportunity?.id, "A recommendation cannot relate to itself.");
    assert.ok(eligibleIds.has(similar.opportunityId), "Related paths must come from the already-approved recommendation portfolio.");
  }
  const copy = [
    ...view.whyThisOpportunity.map((reason) => reason.detail),
    view.whyApplyNow.detail,
    ...view.trustSignals.map((signal) => signal.detail),
  ].join(" ");
  assert.doesNotMatch(copy, /historically fills early|limited seats|students with similar profiles|students interested in this also viewed/i, "Recommendation intelligence cannot fabricate demand or aggregate behavior.");
  if (view.trustSignals.some((signal) => signal.label === "Deadline verified")) {
    assert.equal(view.opportunity?.metadata.verification?.deadlineVerified, true, "Deadline trust must originate from verification metadata.");
  }
  if (view.trustSignals.some((signal) => signal.label === "Application link confirmed")) {
    assert.equal(view.opportunity?.metadata.verification?.applicationUrlVerified, true, "Application trust must originate from verification metadata.");
  }
}

const firstId = shortlist[0]?.opportunity?.id;
assert.ok(firstId);
const historyService = buildRecommendationService({
  ...input,
  activity: { ...activity, viewed: [firstId] },
  recommendationExposureCounts: { [firstId]: 1 },
});
const historicalView = historyService.recommendations.find((view) => view.opportunity?.id === firstId);
assert.equal(historicalView?.historyLabel, "Viewed before", "Recommendation history must truthfully reflect an existing view.");

const categories = new Set(shortlist.map((view) => view.recommendation.portfolio?.canonicalCategory));
const organizations = new Set(shortlist.map((view) => view.opportunity?.organization));
assert.ok(categories.size >= 4, "The premium portfolio must remain diverse across opportunity categories.");
assert.equal(organizations.size, shortlist.length, "The premium portfolio must prevent organization clustering.");

buildRecommendationService(input);
const timings = Array.from({ length: 3 }, () => {
  const startedAt = performance.now();
  buildRecommendationService(input);
  return performance.now() - startedAt;
});
const averageMs = timings.reduce((sum, value) => sum + value, 0) / timings.length;
assert.ok(averageMs < 1_000, `Premium intelligence generation must remain below the production budget; received ${averageMs.toFixed(2)}ms.`);

console.log("For You intelligence checks passed", {
  recommendations: shortlist.length,
  scoreRange: [Math.min(...shortlist.map((view) => view.opportunityScore.value)), Math.max(...shortlist.map((view) => view.opportunityScore.value))],
  categories: categories.size,
  averageMs: Number(averageMs.toFixed(2)),
});
