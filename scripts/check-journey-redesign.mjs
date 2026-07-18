import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/page.tsx", "utf8");
const editorial = readFileSync("components/journey-editorial.tsx", "utf8");
const legacyBridge = readFileSync("components/student-journey-dashboard.tsx", "utf8");

assert.ok(page.includes("JourneyEditorial"), "The Journey route must render the editorial experience.");
assert.ok(editorial.includes("data-journey-living-path") && editorial.includes("Behind you") && editorial.includes("Where you are") && editorial.includes("What comes next"), "Journey must answer its three core questions without an abstract visualization.");
assert.ok(editorial.includes("What you have made real"), "Journey history must remain available below the focused opening.");
assert.ok(editorial.includes("Your next step") && (editorial.match(/data-journey-next-action/g) ?? []).length === 2, "Every Journey state must expose one canonical next-action region.");
assert.ok(editorial.includes("Manage applications"), "Operational application management must remain accessible below the fold.");
assert.ok(!legacyBridge.includes("SummaryGrid"), "The retired dashboard must not remain in the client recovery bridge.");
assert.doesNotMatch(editorial, /\bXP\b|streak|loot|percentile/i, "Journey must not add fake gamification.");

console.log("Journey redesign compatibility checks passed.");
