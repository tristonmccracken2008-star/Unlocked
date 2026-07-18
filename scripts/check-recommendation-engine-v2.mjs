import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const engine = read("data/recommendation-engine.ts");
const intelligence = read("data/opportunity-intelligence.ts");
const service = read("data/recommendation-service.ts");
const config = read("data/recommendation-config.ts");
const roadmaps = read("data/career-roadmaps.ts");
const relationships = read("data/opportunity-relationships.ts");
const weekly = read("data/recommendation-weekly-strategy.ts");
const advisor = read("components/advisor-page.tsx");
const forYouApi = read("app/api/advisor/for-you/route.ts");
const forYouSnapshot = read("lib/for-you-snapshot.ts");
const feedbackApi = read("app/api/advisor/feedback/route.ts");
const adminDiagnostics = read("app/admin/recommendations/page.tsx");
const analytics = read("lib/analytics-types.ts");
const docs = read("docs/RECOMMENDATION_ENGINE.md");

for (const career of ["quantitative-finance", "software-engineering", "medicine", "investment-banking", "data-science"]) {
  assert.ok(roadmaps.includes(career), `Career roadmap ${career} must be configured.`);
}

for (const signal of [
  "careerRoadmapCategory",
  "careerRoadmapSignal",
  "careerRoadmapOrganization",
  "skillAlignmentPerSignal",
  "categoryGapBoost",
  "ignoredSimilarPenalty",
  "dismissedOpportunityPenalty",
  "freshnessRecent",
  "weakDeadlineConfidencePenalty",
  "expectedRoiHigh",
]) {
  assert.ok(config.includes(signal), `Recommendation config must expose ${signal}.`);
}

for (const field of [
  "careerRoadmapCategories?: string[]",
  "careerRoadmapSignals?: string[]",
  "careerTargetOrganizations?: string[]",
  "skillPriorities?: string[]",
  "underusedCategories?: string[]",
  "dismissedOpportunityIds?: string[]",
]) {
  assert.ok(intelligence.includes(field), `Opportunity context must include ${field}.`);
}

assert.ok(engine.includes("scoreCareerRoadmapFit"), "Recommendation engine must score career roadmap fit.");
assert.ok(engine.includes("getOpportunityRelationship"), "Recommendation engine must use opportunity relationships.");
assert.ok(engine.includes("confidenceLevel"), "Recommendations must include internal confidence levels.");
assert.ok(engine.includes("buildRecommendationWeeklyStrategy"), "Engine must produce weekly strategy output.");
assert.ok(engine.includes("recommendationFeedback"), "Engine must consume advisor feedback.");
assert.ok(service.includes("feedbackRecords") && service.includes("hiddenOpportunityIds") && service.includes("referralActivity"), "Recommendation service must pass holistic student context.");
assert.ok(forYouApi.includes("resolveForYouState"), "For You API must use the snapshot-backed resolver.");
assert.ok(forYouSnapshot.includes("data.advisor?.feedbackRecords"), "For You snapshot generation must pass feedback records.");
assert.ok(forYouSnapshot.includes("data.referrals"), "For You snapshot generation must be referral future-ready.");

for (const relationship of ["prerequisites", "followUps", "alternatives", "easierVersion", "harderVersion", "careerProgression"]) {
  assert.ok(relationships.includes(relationship), `Opportunity relationships must include ${relationship}.`);
}

assert.ok(weekly.includes("deadlineCount") && weekly.includes("bestNextStep"), "Weekly strategy must summarize deadlines and next step.");

for (const label of ["Interested", "Not interested", "Hide", "Already applied", "Already completed"]) {
  assert.ok(advisor.includes(label), `For You feedback UI must include ${label}.`);
}
assert.ok(advisor.includes('type: "dismissed"'), "The concise Hide action must persist the canonical dismissed signal.");
assert.ok(feedbackApi.includes("already-applied"), "Feedback API must accept already-applied.");
assert.ok(adminDiagnostics.includes("getAdminSession"), "Recommendation diagnostics must be admin protected.");
assert.ok(adminDiagnostics.includes("buildRecommendationDiagnosticReport"), "Recommendation diagnostics must use canonical report generation.");

for (const event of ["recommendation_dismissed", "recommendation_applied", "recommendation_completed"]) {
  assert.ok(analytics.includes(`"${event}"`), `Analytics must include ${event}.`);
}

for (const phrase of ["Career Roadmaps", "Opportunity Relationships", "Adaptive Learning", "Confidence Model", "Premium Behavior", "Remaining Future Improvements"]) {
  assert.ok(docs.includes(phrase), `Recommendation docs must describe ${phrase}.`);
}

console.log("Recommendation Engine 2.0 checks passed.");
