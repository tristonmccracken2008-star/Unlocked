import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.AUTH_SECRET ||= "application-command-center-test-secret-with-thirty-two-bytes";
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
Reflect.set(process.env, "NODE_ENV", "test");

assert.equal(process.env.KV_REST_API_URL, undefined, "Build checks must never write Application Command Center fixtures to configured production storage.");
assert.equal(process.env.UPSTASH_REDIS_REST_URL, undefined, "Build checks must remain isolated from configured Upstash storage.");
assert.equal(process.env.NODE_ENV, "test", "Application Command Center fixtures must use the process-local test store.");

const { opportunities } = await import("../data/opportunities");
const { defaultBillingRecord } = await import("../lib/billing");
const { applicationWorkspaceEligible, projectApplicationWorkspace, trustedApplicationRequirements } = await import("../lib/application-workspace");
const { buildJourneyCalendarModel } = await import("../lib/journey-calendar");
const { buildCalendarEventNotificationSchedule } = await import("../lib/notification-engine");
const { mergeAccountData, readAccountData, upsertUser } = await import("../lib/auth-store");
const { updateApplicationWorkspace } = await import("../lib/application-workspace-service");

const opportunity = opportunities.find((item) => applicationWorkspaceEligible(item) && item.verification_status === "verified" && trustedApplicationRequirements(item).length >= 2);
assert.ok(opportunity, "Application workspace checks require a verified opportunity with structured requirements.");
const benefit = opportunities.find((item) => item.type === "Benefit");
assert.ok(benefit && !applicationWorkspaceEligible(benefit), "Student benefits must remain outside the Application Command Center.");

const now = new Date("2026-08-09T12:00:00.000Z");
const tracked = {
  id: opportunity.id,
  status: "Applying" as const,
  savedAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-02T12:00:00.000Z",
  version: 1,
  history: [],
};
const user = await upsertUser({ googleSub: "application-command-owner", email: "application-owner@example.test", name: "Application Owner" });
await mergeAccountData(user.id, {
  onboardingComplete: true,
  firstLaunchComplete: true,
  billing: defaultBillingRecord(),
  activity: { viewed: [], saved: [opportunity.id], claimed: [], tracked: { [opportunity.id]: tracked } },
  savedOpportunities: [{ opportunityId: opportunity.id, savedAt: tracked.savedAt }],
  tracker: { [opportunity.id]: tracked },
});

const initial = projectApplicationWorkspace({ opportunity, record: tracked, now });
assert.equal(initial.requirementsVerified, true);
assert.equal(initial.tasks.length, trustedApplicationRequirements(opportunity).length);
assert.equal(initial.readyForSubmission, false);

const added = await updateApplicationWorkspace(user, {
  action: "add_task",
  opportunityId: opportunity.id,
  expectedVersion: 0,
  idempotencyKey: "application:test:add-task",
  title: "Ask professor for recommendation",
  dueDate: "2026-08-20",
});
assert.equal(added.workspace.workspaceVersion, 1);
const custom = added.workspace.tasks.find((task) => task.source === "user");
assert.ok(custom?.dueDate === "2026-08-20");

const duplicate = await updateApplicationWorkspace(user, {
  action: "add_task",
  opportunityId: opportunity.id,
  expectedVersion: 0,
  idempotencyKey: "application:test:add-task",
  title: "Ask professor for recommendation",
  dueDate: "2026-08-20",
});
assert.equal(duplicate.duplicate, true, "Repeated task requests must remain idempotent.");
assert.equal(duplicate.workspace.tasks.filter((task) => task.source === "user").length, 1);

const completed = await updateApplicationWorkspace(user, {
  action: "set_completion",
  opportunityId: opportunity.id,
  expectedVersion: 1,
  taskId: custom!.id,
  completed: true,
});
assert.equal(completed.workspace.workspaceVersion, 2);
assert.equal(completed.workspace.tasks.find((task) => task.id === custom!.id)?.completed, true);
const afterCompletion = await readAccountData(user.id);
assert.equal(afterCompletion.tracker[opportunity.id]?.status, "Applying", "Completing tasks must never imply application submission.");

await assert.rejects(() => updateApplicationWorkspace(user, {
  action: "add_task",
  opportunityId: opportunity.id,
  expectedVersion: 1,
  idempotencyKey: "application:test:stale-write",
  title: "Stale task",
}), (error: unknown) => error instanceof Error && error.name === "ApplicationWorkspaceConflictError");

const calendar = buildJourneyCalendarModel({ account: afterCompletion, opportunities: [opportunity], now });
assert.equal(calendar.items.some((item) => item.source === "application_task"), false, "Completed application tasks must leave the active calendar.");
const reopened = await updateApplicationWorkspace(user, {
  action: "set_completion",
  opportunityId: opportunity.id,
  expectedVersion: 2,
  taskId: custom!.id,
  completed: false,
});
const activeAccount = await readAccountData(user.id);
const activeCalendar = buildJourneyCalendarModel({ account: activeAccount, opportunities: [opportunity], now });
const taskDate = activeCalendar.items.find((item) => item.source === "application_task");
assert.ok(taskDate && taskDate.title === "Ask professor for recommendation");
const taskEvent = Object.values(activeAccount.applicationWorkspaces![opportunity.id]!.tasks).find((task) => task.id === custom!.id)!;
const syntheticEvent = {
  id: taskDate!.id,
  type: "personal_target" as const,
  title: taskEvent.title,
  date: taskEvent.dueDate!,
  opportunityId: opportunity.id,
  source: "application_task" as const,
  reminderMinutesBefore: 1_440,
  completed: false,
  dismissed: false,
  createdAt: taskEvent.createdAt,
  updatedAt: taskEvent.updatedAt,
  version: taskEvent.version,
};
assert.ok(buildCalendarEventNotificationSchedule({ userId: user.id, event: syntheticEvent, now }), "Dated application tasks must use the existing notification schedule.");

const verifiedTask = reopened.workspace.tasks.find((task) => task.source === "verified_requirement")!;
await assert.rejects(() => updateApplicationWorkspace(user, {
  action: "delete_task",
  opportunityId: opportunity.id,
  expectedVersion: 3,
  taskId: verifiedTask.id,
}), (error: unknown) => error instanceof Error && error.name === "ApplicationTaskProtectedError");

const other = await upsertUser({ googleSub: "application-command-other", email: "application-other@example.test", name: "Other Student" });
await assert.rejects(() => updateApplicationWorkspace(other, {
  action: "add_task",
  opportunityId: opportunity.id,
  expectedVersion: 0,
  idempotencyKey: "application:test:cross-account",
  title: "Unauthorized task",
}), (error: unknown) => error instanceof Error && error.name === "ApplicationWorkspaceOwnershipError");

const ineligible = await upsertUser({ googleSub: "application-command-ineligible", email: "application-ineligible@example.test", name: "Benefit Student" });
const benefitRecord = { ...tracked, id: benefit!.id };
await mergeAccountData(ineligible.id, {
  onboardingComplete: true,
  firstLaunchComplete: true,
  activity: { viewed: [], saved: [benefit!.id], claimed: [], tracked: { [benefit!.id]: benefitRecord } },
  savedOpportunities: [{ opportunityId: benefit!.id, savedAt: benefitRecord.savedAt }],
  tracker: { [benefit!.id]: benefitRecord },
});
await assert.rejects(() => updateApplicationWorkspace(ineligible, {
  action: "add_task",
  opportunityId: benefit!.id,
  expectedVersion: 0,
  idempotencyKey: "application:test:ineligible-resource",
  title: "Should not exist",
}), (error: unknown) => error instanceof Error && error.name === "ApplicationWorkspaceIneligibleError");

const uncertain = projectApplicationWorkspace({ opportunity: { ...opportunity, verification_status: "needs_review" }, record: tracked, now });
assert.equal(uncertain.requirementsVerified, false);
assert.equal(uncertain.tasks.length, 0, "Unverified catalog requirements must never become checklist claims.");

const route = readFileSync("app/api/journey/application/route.ts", "utf8");
const component = readFileSync("components/application-workspace.tsx", "utf8");
const exportRoute = readFileSync("app/api/account/export/route.ts", "utf8");
for (const token of ["assertSameOrigin(request)", "enforceRateLimit", "expectedVersion", "updateApplicationWorkspace", "syncUserNotificationSchedules"]) assert.match(route, new RegExp(token.replace(/[()]/g, "\\$&")));
assert.match(component, /Application requirements haven’t been verified|hasn’t verified the application materials/);
assert.match(component, /Mark as Applied/);
assert.match(component, /accountSessionEvent/);
assert.match(exportRoute, /applicationWorkspaces/);

console.log("Application Command Center checks passed", {
  opportunity: opportunity.id,
  verifiedRequirements: initial.tasks.length,
  calendarIntegrated: true,
  notificationsIntegrated: true,
  accountIsolation: true,
});
