import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const advisor = readFileSync("components/advisor-page.tsx", "utf8");
const api = readFileSync("app/api/advisor/for-you/route.ts", "utf8");

for (const state of ["pro_ready", "free_preview", "profile_incomplete", "empty", "preparing", "error"]) {
  assert.ok(advisor.includes(`"${state}"`), `Client must understand ${state}.`);
  assert.ok(api.includes(`"${state}"`), `API must be able to return ${state}.`);
}

assert.ok(advisor.includes("normalizeForYouPayload"), "Client must normalize the API payload before rendering.");
assert.ok(advisor.includes("validForYouPageStates"), "Client must validate pageState values.");
assert.ok(advisor.includes('pageState === "pro_ready" && recommendations.length === 0'), "Client must convert impossible pro_ready-without-recommendations into empty.");
assert.ok(advisor.includes('pageState === "free_preview" && !top'), "Free preview with zero recommendations must still render the Pro conversion page.");
assert.ok(advisor.includes("<ProIntelligenceExperience") && advisor.includes("briefing.topPickIds"), "pro_ready must render the server-selected briefing and recommendation rows.");
assert.ok(advisor.includes("state.briefing"), "Client must consume the typed server briefing instead of rebuilding premium intelligence locally.");
assert.ok(advisor.includes('<TopRecommendation view={top}') && advisor.includes('<ForYouUpgradeGate totalMatches={state.totalMatches}'), "free_preview with recommendations must render one useful preview plus the Pro intelligence boundary.");
assert.ok(advisor.includes("<ForYouSetupState"), "profile_incomplete must render profile guidance.");
assert.ok(advisor.includes("<ForYouEmptyState"), "empty must render an honest empty state.");
assert.ok(advisor.includes("<ForYouPreparingState"), "preparing must render an intentional non-error loading state.");
assert.ok(advisor.includes("<ForYouErrorState"), "error must render a retryable error state.");

assert.ok(api.includes("logResponseShape"), "API must log response field names only.");
assert.ok(api.includes("topLevel: Object.keys(body).sort()"), "API response-shape logging must avoid user data.");
assert.ok(api.includes("briefing"), "API response must expose the server-authoritative opportunity briefing.");
assert.ok(advisor.includes('pageState === "pro_ready" && state.briefing'), "Client may render premium intelligence only for the server-authorized Pro state.");
assert.ok(api.includes("session: null"), "API response must include the session key expected by the client.");

for (const stale of ["payload.items", "payload.results", "payload.opportunities", "state.items", "state.results"]) {
  assert.ok(!advisor.includes(stale), `Client must not use stale response field ${stale}.`);
}

console.log("For You client/server contract checks passed.");
