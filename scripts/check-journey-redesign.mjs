import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/page.tsx", "utf8");
const timeline = readFileSync("components/journey-timeline.tsx", "utf8");
const model = readFileSync("lib/journey-timeline.ts", "utf8");
const legacyRoute = readFileSync("app/my-opportunities/page.tsx", "utf8");

assert.ok(page.includes("JourneyTimeline"), "The Journey route must render the unified chronological experience.");
assert.ok(timeline.includes("data-journey-timeline") && timeline.includes("JourneyTimelineControl"), "Journey must combine readable history and restrained status management.");
assert.ok(timeline.includes("JourneyCardEntry"), "Sharing must remain secondary to the timeline.");
assert.ok(model.includes("record.history") && model.includes("legacy-status"), "The presentation layer must normalize current and legacy records without data migration.");
assert.ok(legacyRoute.includes('redirect("/")'), "The former application board cannot remain a competing Journey surface.");
assert.doesNotMatch(timeline, /Your next step|What comes next|Horizon|recommendation|\bXP\b|streak|loot|percentile/i, "Journey must not become coaching, future planning, or gamification.");

console.log("Journey unification checks passed.");
