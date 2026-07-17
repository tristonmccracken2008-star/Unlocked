import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const journey = read("data/journey.ts");
const board = read("components/my-opportunities-page.tsx");
const moments = read("lib/path-moments.ts");
const creator = read("components/path-moment-creator.tsx");
const artwork = read("components/path-moment-artwork.tsx");
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

for (const token of ["first_application", "first_submission", "first_interview", "first_acceptance", "first_completed_experience", "semester_recap", "suppressedSavedCount", "createPathGeometry"]) assert.ok(moments.includes(token), `Path Moments must include ${token}.`);
for (const token of ["Download PNG", "navigator.share", "navigator.clipboard", "ClipboardItem", "XMLSerializer", "canvas.toBlob", "Private by default"]) assert.ok(creator.includes(token), `Path Moment creator must include ${token}.`);
for (const token of ["1080", "1920", "1200", "627"]) assert.ok(moments.includes(token), `Path Moment layout definitions must include ${token}.`);
for (const token of ["OpenLineRenderer", "Built with UnlockED"]) assert.ok(artwork.includes(token), `Path Moment artwork must include ${token}.`);

for (const token of ["Journey Board", "Move to...", "data-journey-board-scroll", "opportunityTrackerStatuses.map", "onDragStart", "onDrop"]) {
  assert.ok(board.includes(token), `Existing Journey Board workspace must remain intact: ${token}.`);
}

for (const [event, emitter] of [["path_moment_preview_rendered_v1", "pathMomentPreviewRendered"], ["path_moment_downloaded_v1", "pathMomentDownloaded"], ["path_moment_copied_v1", "pathMomentCopied"], ["path_moment_shared_v1", "pathMomentShared"]]) {
  assert.ok(analytics.includes(`"${event}"`), `Analytics must declare ${event}.`);
  assert.ok(creator.includes(`productIntelligenceEvents.${emitter}`), `Path Moment UI must track ${event}.`);
}

assert.ok(pkg.includes("check:college-journey"), "Package scripts must include check:college-journey.");
assert.doesNotMatch(board, /\bscore\b|ranking|percentile|streak/i, "College Journey must avoid fake scoring, rankings, and streak language.");
assert.doesNotMatch(board, /Journey Card|journeyCardSvg|progressPercent/, "The Journey Board cannot retain a dashboard export.");

console.log("College Journey checks passed.");
