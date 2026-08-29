import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const advisor = read("components/advisor-page.tsx");
const advisorStyles = read("components/advisor-page.module.css");
const briefing = read("lib/for-you-briefing.ts");
const decision = read("lib/for-you-decision-intelligence.ts");
const forYouApi = read("app/api/advisor/for-you/route.ts");
const forYouSnapshot = read("lib/for-you-snapshot.ts");
const advisorTypes = read("lib/advisor/types.ts");
const advisorRoute = read("app/advisor/page.tsx");
const service = read("data/recommendation-service.ts");

for (const label of ["OpportunityBriefingHeader", "Top picks", "Worth exploring", "Also selected", "What changed", "Watching", "Open Opportunity", "AddToJourneyButton", "Compare shortlist", "Differences", "Edit preferences"]) {
  assert.ok(advisor.includes(label), `For You must render ${label}.`);
}
for (const removed of ["Opportunity Radar", "Your Journey", "Try something different", "More for you", "Why this match", "Similar opportunities", "Application effort", "Your activity at a glance", "Your profile at a glance"]) {
  assert.ok(!advisor.includes(removed), `For You must not restore the removed ${removed} surface.`);
}

assert.ok(advisor.includes('data-for-you-page="opportunity-briefing-v3"'), "For You must expose the flagship briefing for browser QA.");
assert.ok(advisor.includes("insight?.explanations") && decision.includes(".slice(0, 2)"), "Recommendation presentation must consume at most two server-projected explanations.");
assert.ok(advisor.includes("comparisonMode") && advisor.includes("new Set(values).size > 1"), "Comparison must enter deliberately and show differences rather than permanent checkbox clutter.");
assert.ok(!advisor.includes("Opportunity Score:") && !advisor.includes("#1 PICK"), "For You must not expose internal scores or rank theater.");
assert.ok(briefing.includes("maximumTopPicks = 3") && briefing.includes("maximumAdditionalMatches = 4") && briefing.includes("maximumExplorationMatches = 1"), "The briefing must remain selective and bounded.");
assert.ok(!briefing.includes("opportunityById.values()"), "Dynamic briefing decoration must not scan the full catalog.");
assert.ok(decision.includes('kind: "eligibility"') && decision.includes('kind: "strategy"') && decision.includes('kind: "exploration"'), "Explanation precedence must be deterministic and factual.");
assert.ok(advisorStyles.includes("border-radius: 8px") && advisorStyles.includes("content-visibility: auto"), "For You styling must keep restrained geometry and defer below-fold rendering.");
assert.ok(advisorStyles.includes("prefers-reduced-motion: reduce") && advisorStyles.includes("@media (max-width: 640px)"), "For You must support reduced motion and mobile layouts.");
assert.ok(!advisor.includes("radial-gradient") && !advisorStyles.includes("gradient"), "For You must not use generic decorative gradients.");

for (const symbol of ["buildRecommendationService", "recommendationMatchLabel", "buildAdvisorBrain", "inferApplicationsFromActivity", "completed.has"]) {
  assert.ok(service.includes(symbol) || forYouApi.includes(symbol) || forYouSnapshot.includes(symbol), `Canonical recommendation service must include ${symbol}.`);
}
assert.ok(forYouApi.includes("resolveForYouState") && forYouSnapshot.includes("buildRecommendationService"), "For You must preserve the snapshot-backed canonical ranking service.");
assert.ok(advisorTypes.includes("ForYouRecommendationSnapshot") && advisorTypes.includes('version: "for-you-briefing-v2"'), "Advisor types must expose the persisted briefing contract.");
assert.ok(advisorRoute.includes("await requireCompletedOnboarding()") && advisorRoute.includes("allowGeneration: false"), "For You must authenticate and remain server-first.");
assert.ok(advisorRoute.includes('await import("@/lib/for-you-snapshot")'), "The full recommendation stack should load only when required.");
for (const state of ["pro_ready", "free_preview", "profile_incomplete", "empty", "preparing", "error"]) assert.ok(forYouApi.includes(`"${state}"`), `For You API must return ${state}.`);
for (const checkpoint of ["auth complete", "billing record lookup complete", "entitlements complete", "saved/journey/feedback data complete", "opportunity index complete", "recommendation context complete", "ranking complete", "diversity processing complete", "explanation generation complete", "response serialization complete", "response complete"]) assert.ok(forYouApi.includes(checkpoint), `For You API must log ${checkpoint}.`);
assert.ok(forYouApi.includes("withTimeout(getSession") && advisor.includes("AbortController") && advisor.includes("12000"), "Server and client requests must remain bounded.");
assert.ok(advisor.includes("normalizeForYouPayload") && forYouApi.includes("logResponseShape"), "The client/server contract must remain explicit and privacy-safe.");
assert.ok(!advisor.includes("buildRecommendationService"), "For You client must not build recommendation intelligence.");
assert.doesNotMatch(advisor, /deserve(?:s)? your attention|strategically aligned|continuously monitors|% confidence|Evidence and confidence|acceptance chance/i, "Primary copy must remain calm and factual.");
assert.doesNotMatch(advisor, /Track this|updateApplicationStatus|markMilestoneCompleted/, "For You must preserve the Watch/Journey handoff boundary.");

console.log("For You briefing redesign checks passed.");
