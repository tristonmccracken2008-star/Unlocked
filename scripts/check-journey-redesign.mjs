import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const dashboard = read("components/student-journey-dashboard.tsx");
const journey = read("data/journey.ts");
const analytics = read("lib/analytics-types.ts");
const pkg = read("package.json");

for (const label of [
  "college journey",
  "Journey progress",
  "Journey timeline",
  "Active opportunities",
  "Milestones",
  "Small steps today lead to bigger opportunities tomorrow.",
]) {
  assert.ok(dashboard.includes(label), `Journey redesign must render ${label}.`);
}

for (const symbol of [
  "buildJourneyMilestones",
  "buildJourneyRecap",
  "journeyActiveStatuses",
  "futureMilestones",
]) {
  assert.ok(dashboard.includes(symbol) || journey.includes(symbol), `Journey redesign must use ${symbol}.`);
}

for (const retired of ["NextToReview", "JourneyRecapCard", "Preview recap", "Download image", "journey_recommendation_opened", "journey_recap_share_started"]) {
  assert.ok(!dashboard.includes(retired), `Journey dashboard must not include retired ${retired} UI.`);
}

assert.doesNotMatch(dashboard, /import \{[^}]*opportunities,/, "Journey dashboard must not import the full opportunity catalog.");
assert.doesNotMatch(dashboard, /buildRecommendationService/, "Journey dashboard must not build client-side recommendations.");
assert.match(dashboard, /\/api\/opportunities\?ids=/, "Journey dashboard should fetch only tracked opportunities.");

for (const event of [
  "journey_opened",
  "journey_profile_edit_clicked",
  "journey_summary_card_clicked",
  "journey_timeline_item_opened",
  "journey_active_opportunity_opened",
]) {
  assert.ok(analytics.includes(`"${event}"`), `Analytics must include ${event}.`);
  assert.ok(dashboard.includes(`"${event}"`) || event === "journey_opened", `Journey dashboard must track ${event}.`);
}

assert.ok(journey.includes("journeyAppliedStatuses"), "Journey counts must use canonical applied status definitions.");
assert.ok(journey.includes("journeyActiveStatuses"), "Journey active lists must use canonical active status definitions.");
assert.ok(!dashboard.includes("% confidence"), "Journey recommendations must not expose numeric confidence labels.");
assert.doesNotMatch(dashboard, /\bXP\b|streak|loot|percentile/i, "Journey must not add fake gamification.");
assert.doesNotMatch(dashboard, /View all[^<]*(<\/button>|href="#")/, "Journey must not render fake View all controls.");
assert.ok(pkg.includes("check:journey-redesign"), "Package scripts must include the Journey redesign check.");

console.log("Journey redesign checks passed.");
