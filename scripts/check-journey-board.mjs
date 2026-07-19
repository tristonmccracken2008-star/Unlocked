import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const timeline = read("components/journey-timeline.tsx");
const timelineModel = read("lib/journey-timeline.ts");
const timelineControl = read("components/journey-timeline-control.tsx");
const compatibilityRoute = read("app/my-opportunities/page.tsx");
const activity = read("data/student-activity.ts");
const transitions = read("data/journey-transformations.ts");

for (const label of ["Journey", "A timeline of the opportunities and milestones that have shaped your progress.", "Your Journey starts here", "Browse Discover", "JourneyCardEntry"]) {
  assert.ok(timeline.includes(label), `Journey timeline must render ${label}.`);
}

for (const status of ["Saved", "Interested", "Applying", "Submitted", "Interview", "Accepted", "Paused", "Rejected", "Completed"]) {
  assert.ok(activity.includes(`"${status}"`), `Activity model must preserve ${status} status.`);
}

for (const eventType of ["saved", "application_started", "application_submitted", "interview", "accepted", "scholarship_awarded", "completed", "milestone"]) {
  assert.ok(timelineModel.includes(`"${eventType}"`), `Normalized Journey timeline must support ${eventType}.`);
}

assert.ok(timelineModel.includes("record.history"), "Journey timeline must preserve canonical transition history.");
assert.ok(timelineModel.includes("legacy-status"), "Legacy status-only records must remain visible.");
assert.ok(timelineModel.includes("journeyProgress"), "Existing milestone progress must be normalized into the timeline.");
assert.ok(timelineControl.includes("/api/journey/transition"), "Timeline status controls must use the authoritative transition route.");
assert.ok(timelineControl.includes("expectedStatus") && timelineControl.includes("expectedVersion"), "Timeline writes must retain stale-state protection.");
assert.ok(transitions.includes("getJourneyTransitionActions"), "Timeline status options must come from the canonical transition map.");
assert.ok(compatibilityRoute.includes('redirect("/")'), "The legacy application-board route must resolve to the unified Journey.");

for (const retired of ["Journey Board", "Move to...", "data-journey-lane", "draggable", "onDrop", "Your next step", "What comes next", "Horizon"]) {
  assert.ok(!timeline.includes(retired), `Unified Journey must not render retired competing UI: ${retired}.`);
}
assert.doesNotMatch(timeline, /\bXP\b|streak|loot|percentile/i, "Journey must not add fake gamification.");

console.log("Unified Journey timeline checks passed.");
