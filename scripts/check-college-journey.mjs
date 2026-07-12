import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const journey = read("data/journey.ts");
const board = read("components/my-opportunities-page.tsx");
const analytics = read("lib/analytics-types.ts");
const pkg = read("package.json");

for (const token of [
  "journeyMilestoneCatalog",
  "buildCollegeJourneySummary",
  "JourneyMilestone",
  "completedAt",
  "shareable",
  "applicableCount",
  "progressPercent",
  "buildJourneyActivityHeatmap",
  "JourneyTimeRange",
]) {
  assert.ok(journey.includes(token), `College Journey data service must include ${token}.`);
}

for (const milestone of [
  "profile-complete",
  "first-journey-add",
  "first-saved",
  "five-saved",
  "ten-saved",
  "first-application-started",
  "first-submitted",
  "five-submitted",
  "first-interview",
  "three-interviews",
  "first-acceptance",
  "first-completed",
  "first-research",
  "first-scholarship",
  "first-internship",
  "first-benefit",
  "first-ai-software",
]) {
  assert.ok(journey.includes(`"${milestone}"`), `Milestone catalog must define ${milestone}.`);
}

for (const token of [
  "CollegeJourneySummaryPanel",
  "Generate Journey Card",
  "JourneyCardModal",
  "journeyCardSvg",
  "1080",
  "1920",
  "Privacy preview",
  "GPA, email, private notes, and rejected opportunities are never included",
  "navigator.share",
  "navigator.canShare",
  "clipboard",
  "Download PNG",
  "showSchool",
  "showMajor",
  "showMilestones",
  "showOpportunityNames",
  "All time",
  "This semester",
  "Academic year",
]) {
  assert.ok(board.includes(token), `Journey Board must include College Journey UI/export support: ${token}.`);
}

for (const token of ["Journey Board", "Move to...", "data-journey-board-scroll", "opportunityTrackerStatuses.map", "onDragStart", "onDrop"]) {
  assert.ok(board.includes(token), `Existing Journey Board workspace must remain intact: ${token}.`);
}

for (const forbidden of ["email", "gpa", "rejected"]) {
  assert.ok(!new RegExp(`\\b${forbidden}\\b`, "i").test(board.match(/function journeyCardSvg[\s\S]*?<\/svg>`;/)?.[0] ?? ""), `Journey Card SVG must not include ${forbidden}.`);
}

for (const event of [
  "college_journey_summary_viewed",
  "journey_card_generator_opened",
  "journey_card_format_changed",
  "journey_card_theme_changed",
  "journey_card_privacy_changed",
  "journey_card_generated",
  "journey_card_downloaded",
  "journey_card_share_started",
  "journey_card_share_completed",
  "journey_card_copy_link_clicked",
  "milestone_share_prompt_viewed",
  "milestone_share_prompt_clicked",
]) {
  assert.ok(analytics.includes(`"${event}"`), `Analytics must declare ${event}.`);
  assert.ok(board.includes(`"${event}"`), `Journey UI must track ${event}.`);
}

assert.ok(pkg.includes("check:college-journey"), "Package scripts must include check:college-journey.");
assert.doesNotMatch(board, /\bscore\b|ranking|percentile|streak/i, "College Journey must avoid fake scoring, rankings, and streak language.");
assert.ok(board.includes("https://unlockededu.com"), "Journey Card must use the correct unlockededu.com domain.");

console.log("College Journey checks passed.");
