import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const advisor = read("components/advisor-page.tsx");
const forYouApi = read("app/api/advisor/for-you/route.ts");
const forYouSnapshot = read("lib/for-you-snapshot.ts");
const advisorTypes = read("lib/advisor/types.ts");
const advisorRoute = read("app/advisor/page.tsx");
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
  assert.ok(service.includes(symbol) || advisor.includes(symbol) || forYouApi.includes(symbol) || forYouSnapshot.includes(symbol), `Canonical recommendation service must include ${symbol}.`);
}

assert.ok(forYouApi.includes("resolveForYouState"), "For You API must consume the snapshot-backed recommendation resolver.");
assert.ok(forYouSnapshot.includes("buildRecommendationService"), "For You snapshot generation must consume the canonical recommendation service.");
assert.ok(advisorTypes.includes("ForYouRecommendationSnapshot"), "Advisor account data must include persisted For You snapshots.");
assert.ok(advisorRoute.includes("await requireCompletedOnboarding()") && advisorRoute.includes("<AdvisorPage serverAuthenticated />"), "For You must authenticate server-side and render before recommendation generation.");
assert.ok(!advisorRoute.includes("resolveForYouState"), "For You route documents must not block on recommendation generation.");
assert.ok(forYouApi.includes('pageState: "pro_ready"') || forYouApi.includes('"pro_ready"'), "For You API must return an explicit pro_ready state.");
assert.ok(forYouApi.includes('"free_preview"'), "For You API must return an explicit free_preview state.");
assert.ok(forYouApi.includes('"profile_incomplete"'), "For You API must return an explicit profile_incomplete state.");
assert.ok(forYouApi.includes('"empty"'), "For You API must return an explicit empty state.");
assert.ok(forYouApi.includes('"preparing"'), "For You API must return an explicit preparing state while first snapshots are generated.");
assert.ok(forYouApi.includes('"error"'), "For You API must return an explicit error state.");
for (const checkpoint of [
  "auth complete",
  "billing record lookup complete",
  "entitlements complete",
  "saved/journey/feedback data complete",
  "opportunity index complete",
  "recommendation context complete",
  "ranking complete",
  "diversity processing complete",
  "explanation generation complete",
  "response serialization complete",
  "response complete",
]) {
  assert.ok(forYouApi.includes(checkpoint), `For You API must log ${checkpoint}.`);
}
assert.ok(forYouApi.includes("withTimeout(getSession") && forYouApi.includes("sessionTimeoutMs"), "For You API must bound session lookup.");
assert.ok(advisor.includes("/api/advisor/for-you"), "For You client must consume the server-gated recommendation API.");
assert.ok(!advisor.includes("buildRecommendationService"), "For You client must not build the full recommendation feed.");
assert.ok(advisor.includes("normalizeForYouPayload"), "For You client must normalize the API response contract.");
assert.ok(forYouApi.includes("logResponseShape"), "For You API must log response field names only.");
assert.ok(advisor.includes('type ForYouPageState = "loading" | "pro_ready" | "free_preview" | "profile_incomplete" | "empty" | "preparing" | "error"'), "For You client must use an explicit finite state machine.");
assert.ok(advisor.includes("AbortController") && advisor.includes("setTimeout") && advisor.includes("12000"), "For You client must bound loading with a request timeout.");
assert.ok(advisor.includes("ForYouErrorState") && advisor.includes("Retry"), "For You client must render a retryable error state.");
assert.ok(advisor.includes("ForYouPreparingState"), "For You client must show a preparing state instead of normal retry during first snapshot generation.");
assert.ok(advisor.includes("ForYouFreePreviewOnly"), "Free users with no previews must still see the Pro conversion page.");
assert.ok(!journey.includes("buildRecommendationService"), "Journey must not build recommendations or bypass For You Pro gating.");
assert.ok(advisor.includes("Unlock your full personalized feed"), "Free For You should render a clear Pro preview instead of an empty state.");
assert.ok(advisor.includes("Free") && advisor.includes("Pro"), "Free For You should explain the Free vs Pro difference.");
assert.doesNotMatch(advisor, /% confidence|Evidence and confidence|Alternatives/, "For You primary UI must not expose old confidence/debug framing.");
assert.doesNotMatch(advisor, /markMilestoneCompleted/, "For You should not use separate milestone completion logic for opportunity recommendations.");
assert.doesNotMatch(advisor, /Track this|Tracked as active interest|updateApplicationStatus/, "For You must use Add to Journey instead of Track/status terminology.");
assert.ok(pkg.includes("check:for-you"), "Package scripts must include the For You redesign check.");

console.log("For You redesign checks passed.");
