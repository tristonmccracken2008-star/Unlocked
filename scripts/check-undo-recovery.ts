import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { applyJourneyTransition, applyJourneyUndo, JourneyTransitionError } from "../data/journey-transformations";
import type { TrackedOpportunity } from "../data/student-activity";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const initial: TrackedOpportunity = { id: "opportunity-1", status: "Applying", savedAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z", version: 4, history: [] };
const submitted = applyJourneyTransition(initial, { transition: "submit", expectedStatus: "Applying", expectedVersion: 4, idempotencyKey: "journey:event:submit-1", occurredAt: "2026-08-11T12:00:00.000Z" }).record;
const undone = applyJourneyUndo(submitted, { eventId: "journey:event:submit-1", expectedStatus: "Submitted", expectedVersion: 5, idempotencyKey: "journey:undo:submit-1", occurredAt: "2026-08-11T12:00:01.000Z" });
assert.equal(undone.duplicate, false);
assert.equal(undone.record.status, "Applying");
assert.equal(undone.record.history?.length, 0);
assert.equal(undone.record.version, 6, "Undo must advance versioning rather than reopen stale writes");
const repeated = applyJourneyUndo(undone.record, { eventId: "journey:event:submit-1", expectedStatus: "Applying", expectedVersion: 6, idempotencyKey: "journey:undo:submit-1", occurredAt: "2026-08-11T12:00:02.000Z" });
assert.equal(repeated.duplicate, true, "Repeated Undo requests must be idempotent");
assert.throws(() => applyJourneyUndo(submitted, { eventId: "journey:event:not-latest", expectedStatus: "Submitted", expectedVersion: 5, idempotencyKey: "journey:undo:stale-1", occurredAt: "2026-08-11T12:00:03.000Z" }), (error) => error instanceof JourneyTransitionError && error.code === "stale_state");

const provider = read("components/undo-recovery.tsx");
assert.match(provider, /slice\(-4\)/);
assert.match(provider, /accountSessionEvent/);
assert.match(provider, /onFocusCapture=\{pause\}/);
assert.match(provider, /undoWindowMs = 8_000/);
const applicationService = read("lib/application-workspace-service.ts");
assert.match(applicationService, /deletedTasks\[task\.id\] = \{ \.\.\.task, updatedAt: now \}/);
assert.match(applicationService, /action: "restore_task"/);
assert.match(read("lib/application-workspace.ts"), /applicationTaskCalendarEvents/);
const calendarStore = read("lib/auth-store.ts");
assert.match(calendarStore, /action: "create" \| "update" \| "complete" \| "dismiss" \| "restore"/);
assert.match(calendarStore, /completed: false, dismissed: false/);
const notifications = read("lib/notification-store.ts");
assert.match(notifications, /item\.readAt !== operationAt/);
assert.match(notifications, /current\.dismissedAt !== dismissedAt/);
assert.match(read("components/advisor-page.tsx"), /sendFeedback\(view, "undo"/);

console.log("Premium Undo and recovery checks passed", { journeyLatestOnly: true, journeyIdempotent: true, applicationTombstones: true, calendarRestore: true, notificationReceipts: true, boundedQueue: true });
