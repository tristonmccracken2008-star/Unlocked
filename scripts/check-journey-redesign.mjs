import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/page.tsx", "utf8");
const commandCenter = readFileSync("components/journey-command-center.tsx", "utf8");
const commandModel = readFileSync("lib/journey-command-center.ts", "utf8");
const model = readFileSync("lib/journey-timeline.ts", "utf8");
const legacyRoute = readFileSync("app/my-opportunities/page.tsx", "utf8");

assert.ok(page.includes("JourneyCommandCenter"), "The Journey route must render the opportunity command center.");
assert.ok(commandCenter.includes("data-journey-command-center") && commandCenter.includes("JourneyTimelineControl"), "Journey must combine compact current records and authoritative status management.");
assert.ok(commandCenter.includes("JourneyCardEntry"), "Sharing must remain secondary to current activity and History.");
for (const section of ["See what you are pursuing and what needs attention next.", "Needs attention", "Active opportunities", "Professional history", "Journey Cards"]) assert.ok(commandCenter.includes(section), `Journey command center must include ${section}.`);
assert.ok(commandModel.includes("slice(0, 3)") && commandModel.includes("historyLimit"), "Needs attention and initial professional history must remain bounded.");
assert.ok(commandModel.includes("resolveOpportunityLifecycle") && commandModel.includes("status: record.status"), "Public lifecycle must remain separate from student progress.");
assert.ok(model.includes("record.history") && model.includes("legacy-status"), "The presentation layer must normalize current and legacy records without data migration.");
assert.ok(legacyRoute.includes('redirect("/")'), "The former application board cannot remain a competing Journey surface.");
assert.doesNotMatch(commandCenter, /Your next step|What comes next|Horizon|recommendation|\bXP\b|streak|loot|percentile/i, "Journey must not become coaching, future planning, or gamification.");

console.log("Journey command-center checks passed.");
