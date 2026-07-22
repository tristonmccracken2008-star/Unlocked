import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { buildOpportunityStudentContext } from "../data/recommendation-engine";
import { buildRecommendationService } from "../data/recommendation-service";
import { getDeadlineDays, getOpportunityIntelligence } from "../data/opportunity-intelligence";
import { evaluateOpportunityEligibility } from "../data/opportunity-eligibility";
import { evaluateProfessionalRecommendationCandidate, validateOpportunityData } from "../data/recommendation-professional-pipeline";
import { opportunities } from "../data/opportunities";
import { schools } from "../data/seed";
import type { StudentActivity } from "../data/student-activity";
import type { StudentProfile } from "../data/student-profile";

const fixtureSchool = schools.find((candidate) => candidate.slug === "university-of-chicago");
if (!fixtureSchool) throw new Error("World-class recommendation fixtures require the University of Chicago school record.");
const school = fixtureSchool as NonNullable<typeof fixtureSchool>;

const activity: StudentActivity = { viewed: [], saved: [], claimed: [], tracked: {} };
const progress = { milestones: {}, applications: {} };
const cacheFixture = opportunities.find((opportunity) => validateOpportunityData(opportunity).allowed);
assert.ok(cacheFixture, "The catalog must contain a professionally valid cache fixture.");
assert.equal(getOpportunityIntelligence(cacheFixture), getOpportunityIntelligence(cacheFixture), "Catalog intelligence must be memoized by immutable opportunity record.");
assert.equal(validateOpportunityData(cacheFixture), validateOpportunityData(cacheFixture), "Static professional validation must be memoized by immutable opportunity record.");

function profile(major: string, careerGoal: string, interests: string, currentPriority: string, minor?: string): StudentProfile {
  return {
    firstName: "Avery",
    schoolSlug: school.slug,
    major,
    minor,
    graduationYear: "2030",
    year: "First year",
    careerGoal,
    interests,
    goals: [currentPriority],
    topics: interests.split(",").map((value) => value.trim()),
    currentPriority,
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
}

const fixtures = [
  profile("Mathematics", "Quantitative Finance", "Finance, Software, Research", "Finding an internship", "Computer Science"),
  profile("Computer Science", "Software Engineering", "AI, Software, Startups", "Finding an internship"),
  profile("Biology", "Medicine", "Healthcare, Research, Leadership", "Finding research"),
  profile("Economics", "Investment Banking", "Finance, Leadership, Research", "Finding an internship"),
  profile("Data Science", "Data Science", "AI, Research, Software", "Building experience"),
  profile("Engineering", "Software Engineering", "Robotics, Climate, Software", "Finding an internship"),
  profile("Psychology", "Research", "Healthcare, Research, Education", "Finding research"),
  profile("Political Science", "Law", "Public Policy, Leadership, Research", "Building experience"),
  profile("Business", "Consulting", "Finance, Leadership, Startups", "Finding an internship"),
  profile("Finance", "Investment Banking", "Finance, Networking, Leadership", "Finding an internship"),
];

const durations: number[] = [];
for (const [fixtureIndex, studentProfile] of fixtures.entries()) {
  const started = performance.now();
  const service = buildRecommendationService({
    profile: studentProfile,
    school,
    activity,
    progress,
    source: opportunities,
    feedRotationKey: `fixture-${fixtureIndex}`,
  });
  durations.push(performance.now() - started);
  const shortlist = service.recommendations.slice(0, 8);
  assert.ok(shortlist.length >= 6, `${studentProfile.major} must receive a useful recommendation portfolio.`);
  const context = buildOpportunityStudentContext(service.advisorProfile);
  const organizations = new Map<string, number>();
  const categories = new Map<string, number>();
  const semanticClusters = new Map<string, number>();
  for (const view of shortlist) {
    const opportunity = view.opportunity;
    const portfolio = view.recommendation.portfolio;
    assert.ok(opportunity && portfolio, "Every visible opportunity recommendation needs portfolio intelligence.");
    assert.equal(evaluateProfessionalRecommendationCandidate(opportunity, context).allowed, true, `${opportunity.title} must pass the professional eligibility pipeline.`);
    assert.equal(evaluateOpportunityEligibility(opportunity, context).eligible, true, `${opportunity.title} must have positively proven eligibility.`);
    assert.ok(portfolio.impactScore >= 0 && portfolio.impactScore <= 100, "Impact scores must remain bounded.");
    assert.ok(portfolio.premiumSignals.length <= 2, "Premium signals must remain restrained.");
    const intelligence = getOpportunityIntelligence(opportunity);
    for (const signal of portfolio.premiumSignals) {
      if (signal === "New") assert.equal(intelligence.freshness, "New", "New must come from the catalog date.");
      else if (signal === "Editor's Pick") assert.equal(opportunity.featured, true, "Editor's Pick requires the curated featured flag.");
      else if (signal === "Deadline Soon") assert.ok((getDeadlineDays(opportunity) ?? 99) >= 0 && (getDeadlineDays(opportunity) ?? 99) <= 14, "Deadline Soon must use a real date.");
      else if (signal === "High Impact") assert.ok(intelligence.impactScore >= 45, "High Impact must use documented impact signals.");
      else if (signal === "Highly Selective") assert.equal(opportunity.difficulty, "Highly Competitive");
      else if (signal === "Competitive") assert.equal(opportunity.difficulty, "Competitive");
      else if (signal === "Worth Discovering") assert.equal(portfolio.role, "exploration");
      else assert.fail(`Unsupported premium signal: ${signal}`);
    }
    assert.doesNotMatch(`${view.summaryReason} ${view.recommendation.reasons.join(" ")} ${portfolio.premiumSignals.join(" ")}`, /popular at|students with similar profiles|trending|acceptance impact/i, "Explanations cannot invent aggregate behavior or outcomes.");
    organizations.set(opportunity.organization, (organizations.get(opportunity.organization) ?? 0) + 1);
    categories.set(portfolio.canonicalCategory, (categories.get(portfolio.canonicalCategory) ?? 0) + 1);
    semanticClusters.set(portfolio.semanticCluster, (semanticClusters.get(portfolio.semanticCluster) ?? 0) + 1);
  }
  assert.ok([...organizations.values()].every((count) => count === 1), `${studentProfile.major} cannot receive the same organization twice.`);
  assert.ok([...categories.values()].every((count) => count <= 2), `${studentProfile.major} cannot be dominated by one category.`);
  assert.ok(categories.size >= 4, `${studentProfile.major} must receive meaningful category variety.`);
  assert.ok([...semanticClusters.values()].every((count) => count <= 2), `${studentProfile.major} cannot receive a semantically repetitive feed.`);
}

const quantProfile = fixtures[0];
const initial = buildRecommendationService({ profile: quantProfile, school, activity, progress, source: opportunities, feedRotationKey: "rotation-a" }).recommendations.slice(0, 8);
assert.equal(initial.length, 8);
assert.ok(new Set(initial.map((view) => view.recommendation.portfolio?.canonicalCategory)).size >= 6, "Math + CS quantitative finance must receive an expert-curated mix.");
assert.ok(initial.some((view) => (view.recommendation.portfolio?.impactScore ?? 0) >= 25), "The portfolio must include at least one documented high-impact opportunity.");
const explorationCount = initial.filter((view) => view.recommendation.portfolio?.role === "exploration").length;
assert.ok(explorationCount >= 1 && explorationCount <= 2, "Exploration must remain within approximately 15–25% of an eight-item feed.");

const lowerExposureCounts = Object.fromEntries(initial.slice(2).flatMap((view) => view.opportunity ? [[view.opportunity.id, 3]] : []));
const rotated = buildRecommendationService({
  profile: quantProfile,
  school,
  activity,
  progress,
  source: opportunities,
  feedRotationKey: "rotation-b",
  previousTopOpportunityIds: initial.slice(0, 2).flatMap((view) => view.opportunity ? [view.opportunity.id] : []),
  recommendationExposureCounts: lowerExposureCounts,
}).recommendations.slice(0, 8);
assert.deepEqual(rotated.slice(0, 2).map((view) => view.opportunity?.id), initial.slice(0, 2).map((view) => view.opportunity?.id), "The two strongest recommendations must retain continuity.");
assert.notDeepEqual(rotated.slice(2).map((view) => view.opportunity?.id), initial.slice(2).map((view) => view.opportunity?.id), "Repeated lower slots must rotate deterministically.");
const repeatedInitial = buildRecommendationService({ profile: quantProfile, school, activity, progress, source: opportunities, feedRotationKey: "rotation-a" }).recommendations.slice(0, 8);
assert.deepEqual(
  repeatedInitial.map((view) => [view.recommendation.id, view.recommendation.score, view.recommendation.reasons, view.recommendation.portfolio]),
  initial.map((view) => [view.recommendation.id, view.recommendation.score, view.recommendation.reasons, view.recommendation.portfolio]),
  "Warm catalog caches must preserve ranking, explanations, scores, and portfolio metadata.",
);

const sortedDurations = [...durations].sort((left, right) => left - right);
const p95 = sortedDurations[Math.max(0, Math.ceil(sortedDurations.length * 0.95) - 1)];
assert.ok(p95 < 2_800, `Recommendation portfolio generation must remain below the server hard bound; received ${p95.toFixed(2)}ms.`);

console.log("World-class recommendation checks passed", {
  profiles: fixtures.length,
  quantCategories: new Set(initial.map((view) => view.recommendation.portfolio?.canonicalCategory)).size,
  explorationCount,
  stableTopSlots: 2,
  rotatedLowerSlots: initial.slice(2).filter((view, index) => view.opportunity?.id !== rotated[index + 2]?.opportunity?.id).length,
  p95Ms: Number(p95.toFixed(2)),
});
