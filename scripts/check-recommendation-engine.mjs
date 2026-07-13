import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const engine = read("data/recommendation-engine.ts");
const intelligence = read("data/opportunity-intelligence.ts");
const service = read("data/recommendation-service.ts");
const config = read("data/recommendation-config.ts");
const advisor = read("components/advisor-page.tsx");
const forYouApi = read("app/api/advisor/for-you/route.ts");
const journey = read("components/student-journey-dashboard.tsx");
const discover = read("components/opportunity-filter.tsx");
const analytics = read("lib/analytics-types.ts");
const docs = read("docs/RECOMMENDATION_ENGINE.md");

for (const signal of [
  "schoolEligibleSpecific",
  "majorExact",
  "minorExact",
  "classYearExact",
  "careerGoalPerSignal",
  "interestPerSignal",
  "currentPriority",
  "gpaMeetsRequirement",
  "deadlineCritical",
  "verified",
  "savedSimilarCategory",
  "completedSimilarCategory",
  "activeTrackedPenalty",
]) {
  assert.ok(config.includes(signal), `Recommendation config must expose ${signal}.`);
}

for (const field of [
  "minor?: string",
  "currentPriority?: string",
  "gpaStatus?:",
  "activeOpportunityIds?: string[]",
  "completedOpportunityIds?: string[]",
  "rejectedOpportunityIds?: string[]",
]) {
  assert.ok(intelligence.includes(field), `Opportunity intelligence context must support ${field}.`);
}

for (const helper of [
  "getMatchingMinor",
  "getMatchingInterests",
  "currentPriorityMatches",
  "gpaRequirement",
  "gpaEligible",
]) {
  assert.ok(intelligence.includes(`function ${helper}`) || intelligence.includes(`export function ${helper}`), `Opportunity intelligence must include ${helper}.`);
}

for (const exclusion of [
  "excludedStatuses.includes",
  "wrongSchoolPenalty",
  "wrongClassYearPenalty",
  "deadlinePassedPenalty",
  "activeTrackedPenalty",
]) {
  assert.ok(intelligence.includes(exclusion) || engine.includes(exclusion), `Engine must handle ${exclusion}.`);
}

assert.ok(engine.includes("diversityAdjustedOpportunityRecommendations"), "Recommendation engine must apply deterministic diversity.");
assert.ok(engine.includes("organizationPenalty") && engine.includes("categoryPenalty") && engine.includes("typePenalty"), "Diversity must balance organization, category, and type.");
assert.ok(engine.includes("shouldExcludeOpportunity") && engine.includes("trackerRecord"), "Engine must suppress opportunities already in Journey.");
assert.ok(engine.includes("contextWithLearning"), "Engine must learn category signals from saved/completed activity.");
assert.ok(engine.includes("qualityGateFailures") && engine.includes("minimumPositiveSignals"), "Engine must filter weak recommendations with quality gates.");
assert.ok(engine.includes("buildRecommendationDiagnosticReport"), "Engine must expose internal recommendation diagnostics.");
assert.ok(engine.includes("RecommendationReviewRecord"), "Engine diagnostics must produce review records.");
assert.ok(engine.includes("performance") && engine.includes("elapsedMs"), "Recommendation diagnostics must include performance timing.");
assert.ok(intelligence.includes("signals: OpportunityRankingSignal[]"), "Opportunity scores must include ranking signals.");
assert.ok(intelligence.includes("positiveSignalCount"), "Opportunity scores must count meaningful positive signals.");
assert.ok(service.includes("labelForRecommendationScore(recommendation.score)"), "Recommendation labels must use score thresholds, not confidence percentages.");

for (const surface of [
  [forYouApi, "buildRecommendationService", "For You API"],
  [journey, "buildRecommendationService", "Journey"],
  [discover, "buildRecommendationService", "Discover"],
]) {
  assert.ok(surface[0].includes(surface[1]), `${surface[2]} must consume the canonical recommendation service.`);
}

for (const event of [
  "recommendation_viewed",
  "recommendation_clicked",
  "recommendation_saved",
  "recommendation_ignored",
  "recommendation_added_to_journey",
  "recommendation_explanation_expanded",
  "recommendation_refresh",
]) {
  assert.ok(analytics.includes(`"${event}"`), `Analytics must include ${event}.`);
}

for (const phrase of [
  "School eligibility",
  "Major alignment",
  "Minor alignment",
  "GPA handling",
  "Recommendation Labels",
  "Diversity",
  "Cache and Refresh",
  "Internal Diagnostics",
  "Quality Gates",
  "Performance",
]) {
  assert.ok(docs.includes(phrase), `Recommendation documentation must explain ${phrase}.`);
}

console.log("Recommendation Engine 1.0 checks passed.");
