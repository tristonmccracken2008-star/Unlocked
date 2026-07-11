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
  "Next to review",
  "Milestones",
  "Journey recap",
  "Preview recap",
  "Download image",
]) {
  assert.ok(dashboard.includes(label), `Journey redesign must render ${label}.`);
}

for (const symbol of [
  "buildJourneyMilestones",
  "buildJourneyRecap",
  "buildAdvisorBrain",
  "journeyActiveStatuses",
  "futureMilestones",
  "recapHeadline",
  "recommendationLabel",
]) {
  assert.ok(dashboard.includes(symbol) || journey.includes(symbol), `Journey redesign must use ${symbol}.`);
}

for (const event of [
  "journey_opened",
  "journey_profile_edit_clicked",
  "journey_summary_card_clicked",
  "journey_timeline_item_opened",
  "journey_active_opportunity_opened",
  "journey_recommendation_opened",
  "journey_recommendation_reason_expanded",
  "journey_recap_share_started",
  "journey_recap_downloaded",
]) {
  assert.ok(analytics.includes(`"${event}"`), `Analytics must include ${event}.`);
  assert.ok(dashboard.includes(`"${event}"`) || event === "journey_opened", `Journey dashboard must track ${event}.`);
}

assert.ok(journey.includes("journeyAppliedStatuses"), "Journey counts must use canonical applied status definitions.");
assert.ok(journey.includes("journeyActiveStatuses"), "Journey active lists must use canonical active status definitions.");
assert.ok(dashboard.includes("No opportunity names included by default"), "Recap sharing must default to private, count-only content.");
assert.ok(!dashboard.includes("% confidence"), "Journey recommendations must not expose numeric confidence labels.");
assert.doesNotMatch(dashboard, /\bXP\b|streak|loot|percentile/i, "Journey must not add fake gamification.");
assert.doesNotMatch(dashboard, /View all[^<]*(<\/button>|href="#")/, "Journey must not render fake View all controls.");
assert.ok(pkg.includes("check:journey-redesign"), "Package scripts must include the Journey redesign check.");

console.log("Journey redesign checks passed.");
