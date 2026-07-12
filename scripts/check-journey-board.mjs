import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const board = read("components/my-opportunities-page.tsx");
const activity = read("data/student-activity.ts");
const analytics = read("lib/analytics-types.ts");

for (const label of ["Journey Board", "Move to...", "No opportunities here yet.", "Milestone unlocked", "All changes save automatically"]) {
  assert.ok(board.includes(label), `Journey Board must render ${label}.`);
}

for (const status of ["Saved", "Interested", "Applying", "Submitted", "Interview", "Accepted", "Rejected", "Completed"]) {
  assert.ok(board.includes(status), `Journey Board must preserve ${status} status.`);
  assert.ok(activity.includes(`"${status}"`), `Activity model must preserve ${status} status.`);
}

for (const symbol of ["persistStudentActivity", "replaceStudentActivity", "moveOpportunity", "milestoneFor", "role=\"menu\"", "aria-live=\"polite\"", "draggable", "onDrop"]) {
  assert.ok(board.includes(symbol) || activity.includes(symbol), `Journey Board must include ${symbol}.`);
}

for (const token of [
  "data-journey-board-scroll",
  "overflow-x-auto",
  "grid-flow-col",
  "auto-cols-[minmax(16rem,17.5rem)]",
  "data-journey-lane",
  "data-journey-card",
  "grid-cols-[2.25rem_minmax(0,1fr)_auto]",
  "line-clamp-2",
  "line-clamp-1",
  "min-w-0",
]) {
  assert.ok(board.includes(token), `Journey Board layout must prevent compact card overlap: ${token}.`);
}

assert.doesNotMatch(board, /grid-cols-8/, "Journey Board must not crush all eight lanes into one viewport grid.");
assert.doesNotMatch(board, /<dt className="text-ink\/46">Value<\/dt>/, "Journey Board cards must not render dense value metadata.");
assert.doesNotMatch(board, /See official source/, "Journey Board cards must not show verbose source/value placeholder text.");

for (const event of ["journey_board_opened", "opportunity_status_menu_opened", "opportunity_status_changed", "opportunity_drag_started", "opportunity_drag_completed", "opportunity_drag_failed", "milestone_unlocked", "journey_filter_changed"]) {
  assert.ok(analytics.includes(`"${event}"`), `Analytics must include ${event}.`);
  assert.ok(board.includes(`"${event}"`) || event === "opportunity_drag_failed", `Journey Board must track ${event}.`);
}

assert.doesNotMatch(board, /\bXP\b|streak|loot|percentile/i, "Journey Board must not add fake gamification.");
assert.doesNotMatch(board, /nextStatuses\.map[\s\S]*updateOpportunityStatus\(opportunity\.id, item\)[\s\S]*<\/button>\)\}/, "Cards must not show all status buttons inline.");
assert.ok(board.includes("fetch(`/api/opportunities?ids="), "Journey Board should fetch only tracked opportunity records.");

console.log("Journey Board checks passed.");
