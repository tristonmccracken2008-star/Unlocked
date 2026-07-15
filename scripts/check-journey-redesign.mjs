import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/page.tsx", "utf8");
const editorial = readFileSync("components/journey-editorial.tsx", "utf8");
const legacyBridge = readFileSync("components/student-journey-dashboard.tsx", "utf8");

assert.ok(page.includes("JourneyEditorial"), "The Journey route must render the editorial experience.");
assert.ok(editorial.includes("OpenLineMotionRenderer"), "The Journey must render the existing Open Line motion system.");
assert.ok(editorial.includes("Your living story"), "Journey history must remain available below the opening composition.");
assert.ok(editorial.includes("Open Journey Board"), "Operational application management must remain accessible below the fold.");
assert.ok(!legacyBridge.includes("SummaryGrid"), "The retired dashboard must not remain in the client recovery bridge.");
assert.doesNotMatch(editorial, /\bXP\b|streak|loot|percentile/i, "Journey must not add fake gamification.");

console.log("Journey redesign compatibility checks passed.");
