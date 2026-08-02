import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");
const commandCenter = source("components/journey-command-center.tsx");
const commandStyles = source("components/journey-command-center.module.css");
const commandActions = source("components/journey-command-actions.tsx");
const timelineControl = source("components/journey-timeline-control.tsx");
const browserChecks = source("scripts/test-journey-command-center-browser.ts");

assert.match(commandCenter, /popoverTarget=\{panelId\}/, "Record details need a native top-layer trigger.");
assert.match(commandCenter, /popover="auto"/, "Record details need light-dismiss behavior.");
assert.match(commandCenter, /role="dialog" aria-labelledby=\{titleId\}/, "Record details need an accessible purpose.");
assert.match(commandCenter, /Close details for/, "Record details need an explicit close action.");
assert.doesNotMatch(commandCenter, /More actions and details/, "The ambiguous three-dot expansion label must be removed.");
assert.match(commandStyles, /\.detailGrid\s*\{[\s\S]*?position:\s*fixed/, "Record details must escape row containment.");
assert.match(commandStyles, /\.detailGrid::backdrop/);
assert.match(commandStyles, /scrollbar-gutter:\s*stable/);
assert.match(commandStyles, /overscroll-behavior:\s*contain/);
assert.match(commandStyles, /scroll-margin-top:/);
assert.match(commandStyles, /overflow-wrap:\s*anywhere/);
assert.match(commandStyles, /focus-visible/);
assert.match(commandStyles, /@media\s*\(max-width:\s*700px\)/);
assert.match(commandStyles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
assert.match(commandStyles, /@media\s*\(forced-colors:\s*active\)/);

assert.match(commandActions, /function resetDraft/);
assert.match(commandActions, /requestRef\.current\?\.abort\("dialog-closed"\)/);
assert.match(commandActions, /exportRequestRef\.current\?\.abort\("account-changed"\)/);
assert.match(commandActions, /Preparing the export took too long/);
assert.match(timelineControl, /Close without saving these Journey changes\?/);
assert.match(timelineControl, /triggerRef\.current\?\.focus\(\)/);
assert.match(timelineControl, /milestoneDetailsRef\.current\.open = false/);
assert.match(timelineControl, /setDocuments\(control\.details\?\.documents \?\? \[\]\)/);
assert.match(timelineControl, /controllerRef\.current\?\.abort\("account-changed"\)/);

assert.match(commandCenter, /No Journey records match/);
assert.match(commandCenter, /No history yet/);
assert.match(commandCenter, /No opportunities in/);
assert.doesNotMatch(commandCenter, /No active records match/);

assert.match(browserChecks, /firstLaunchComplete:\s*true/, "Journey browser fixtures must reach the product under test.");
assert.match(browserChecks, /Record details must remain fully visible in the desktop viewport/);
assert.match(browserChecks, /Mobile record details must render as a visible, unclipped sheet/);
assert.match(browserChecks, /A discarded private draft must not reappear/);
assert.match(browserChecks, /No opportunities in Paused right now/);

console.log("Journey reliability and interaction-quality checks passed.");
