import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dateAfterOfficialDeadline, dateShortcutOptions, explicitDateFromShortcut } from "../data/form-experience";

assert.deepEqual(dateShortcutOptions.map((item) => item.label), ["Today", "Tomorrow", "Next week"]);
assert.equal(explicitDateFromShortcut(0, new Date("2026-08-12T18:00:00.000Z")), "2026-08-12");
assert.equal(explicitDateFromShortcut(1, new Date("2026-08-12T18:00:00.000Z")), "2026-08-13");
assert.equal(explicitDateFromShortcut(7, new Date("2026-08-12T18:00:00.000Z")), "2026-08-19");
assert.equal(dateAfterOfficialDeadline("2026-09-22", "2026-09-21"), true);
assert.equal(dateAfterOfficialDeadline("2026-09-15", "2026-09-21"), false);
assert.equal(dateAfterOfficialDeadline("2026-09-22", "2026-09-21T23:59:59.000Z"), true);

const application = readFileSync("components/application-workspace.tsx", "utf8");
const calendar = readFileSync("components/journey-deadline-calendar.tsx", "utf8");
const journey = readFileSync("components/journey-timeline-control.tsx", "utf8");
const profile = readFileSync("components/personalized-home.tsx", "utf8");
const notifications = readFileSync("components/notification-settings.tsx", "utf8");

for (const token of ["<form onSubmit", "taskTitleRef", "Your task name and due date are still here", "Add another or close this form", "officialDeadline: workspace.deadline"]) assert.ok(application.includes(token), `Application task UX must retain ${token}.`);
for (const token of ["Date shortcuts", "Selected date:", "Official date · Verified", "Your date · Editable", "Discard this unsaved date?", "You can still save it"]) assert.ok(calendar.includes(token), `Calendar form UX must retain ${token}.`);
for (const token of ["I submitted my application", "I got an interview", "canonicalStage"]) assert.ok(journey.includes(token), `Journey update UX must retain ${token}.`);
assert.match(profile, /disabled=\{saving \|\| !changed\}/);
assert.match(notifications, /disabled=\{saving \|\| !changed\}/);

console.log("Form, editing, and data-entry checks passed", {
  shortcuts: dateShortcutOptions.length,
  taskContextBound: true,
  failureStatePreserved: true,
  noOpSavesBlocked: true,
});
