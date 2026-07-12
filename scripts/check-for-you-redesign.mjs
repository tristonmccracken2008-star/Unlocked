import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const advisor = read("components/advisor-page.tsx");
const forYouApi = read("app/api/advisor/for-you/route.ts");
const journey = read("components/student-journey-dashboard.tsx");
const service = read("data/recommendation-service.ts");
const pkg = read("package.json");

for (const label of [
  "Opportunities selected around you.",
  "Your profile at a glance",
  "Top recommendation",
  "Open Opportunity",
  "AddToJourneyButton",
  "Recommended for you",
  "Why these recommendations?",
  "Your activity at a glance",
]) {
  assert.ok(advisor.includes(label), `For You must render ${label}.`);
}

for (const label of ["Excellent Match", "Strong Match", "Good Match", "Worth Reviewing", "Limited Match"]) {
  assert.ok(service.includes(`"${label}"`), `Recommendation service must define ${label}.`);
}

for (const symbol of ["buildRecommendationService", "recommendationMatchLabel", "buildAdvisorBrain", "inferApplicationsFromActivity", "completed.has"]) {
  assert.ok(service.includes(symbol) || advisor.includes(symbol) || forYouApi.includes(symbol), `Canonical recommendation service must include ${symbol}.`);
}

assert.ok(forYouApi.includes("buildRecommendationService"), "For You API must consume the canonical recommendation service.");
assert.ok(advisor.includes("/api/advisor/for-you"), "For You client must consume the server-gated recommendation API.");
assert.ok(!advisor.includes("buildRecommendationService"), "For You client must not build the full recommendation feed.");
assert.ok(journey.includes("buildRecommendationService"), "Journey must consume the canonical recommendation service.");
assert.doesNotMatch(advisor, /% confidence|Evidence and confidence|Alternatives/, "For You primary UI must not expose old confidence/debug framing.");
assert.doesNotMatch(advisor, /markMilestoneCompleted/, "For You should not use separate milestone completion logic for opportunity recommendations.");
assert.doesNotMatch(advisor, /Track this|Tracked as active interest|updateApplicationStatus/, "For You must use Add to Journey instead of Track/status terminology.");
assert.ok(pkg.includes("check:for-you"), "Package scripts must include the For You redesign check.");

console.log("For You redesign checks passed.");
