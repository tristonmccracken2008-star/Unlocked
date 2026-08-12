import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const shared = source("components/action-feedback.tsx");
const styles = source("components/action-feedback.module.css");
const globalStyles = source("app/globals.css");
const application = source("components/application-workspace.tsx");
const calendar = source("components/journey-deadline-calendar.tsx");
const notifications = source("components/notification-center.tsx");
const notificationSettings = source("components/notification-settings.tsx");
const profile = source("components/profile-page.tsx");
const profileForm = source("components/personalized-home.tsx");
const guidance = source("components/contextual-guidance.tsx");
const journeyActions = source("components/journey-command-actions.tsx");
const transition = source("components/journey-transition-control.tsx");
const save = source("components/opportunity-activity.tsx");
const docs = source("docs/ACTION_FEEDBACK.md");

for (const token of ["ActionButtonLabel", "ActionFeedback", 'role={state === "error" ? "alert" : "status"}', 'aria-atomic="true"', "data-action-feedback", "action?: { label: string; onClick: () => void; pending?: boolean; pendingLabel?: string }"]) {
  assert.ok(shared.includes(token), `Shared feedback must preserve ${token}.`);
}
for (const token of ["min-height: 44px", "var(--unlocked-error-surface)", "prefers-reduced-motion", "@media (max-width: 520px)"]) assert.ok(styles.includes(token), `Feedback styles must preserve ${token}.`);
for (const state of ["loading", "success", "error"]) assert.ok(globalStyles.includes(`[data-action-state="${state}"]`), `Global action language must style ${state}.`);

assert.ok(application.indexOf("if (options.optimistic) setWorkspace") < application.indexOf('authenticatedFetch("/api/journey/application"'), "Reversible task completion must acknowledge input before awaiting the server.");
assert.ok((application.match(/setWorkspace\(previous\)/g) ?? []).length >= 2, "Optimistic task updates must roll back on response and network failure.");
for (const token of ["Task added.", "Task deleted.", "Task restored.", "Task completed:", "Your previous version is still intact.", "Try again"]) assert.ok(application.includes(token), `Application feedback must preserve ${token}.`);
for (const token of ["Date added.", "Date updated.", "Date completed.", "Reminder dismissed.", "Your previous calendar is still intact.", "ActionButtonLabel", "ActionFeedback"]) assert.ok(calendar.includes(token), `Calendar feedback must preserve ${token}.`);
for (const token of ["markingAll", "setItems(previous)", "ActionButtonLabel", "ActionFeedback", "authenticatedFetch"]) assert.ok(notifications.includes(token), `Notification feedback must preserve ${token}.`);
for (const token of ["Notification settings saved.", "Your choices are still here.", "ActionButtonLabel", "ActionFeedback", "authenticatedFetch"]) assert.ok(notificationSettings.includes(token), `Notification settings feedback must preserve ${token}.`);
assert.ok(profile.includes("<ActionFeedback"), "Profile confirmations must use shared feedback.");
assert.ok(profileForm.includes("<ActionFeedback"), "Profile validation must use shared feedback.");
for (const token of ["if (pending) return", "Nothing changed; try again.", "ActionButtonLabel", "ActionFeedback"]) assert.ok(guidance.includes(token), `Guidance feedback must preserve ${token}.`);
assert.ok(journeyActions.includes("ActionButtonLabel") && journeyActions.includes("ActionFeedback"), "Journey add and export flows must use the shared action language.");
assert.ok(transition.includes("transformationResult") && transition.includes('level="important"'), "Major Journey transitions must retain stronger, retryable feedback.");
for (const token of ["playJourneySaveMotion", "JourneyAddedState", "unlocked-save-confirmation"]) assert.ok(save.includes(token), `Save to Journey must retain its specialized ${token} behavior.`);
for (const token of ["Routine", "Confirmatory", "Important", "Specialized", "server remains authoritative", "failed optimistic update restores"]) assert.ok(docs.includes(token), `Feedback documentation must cover ${token}.`);

const combined = [application, calendar, notifications, notificationSettings, profile, profileForm, guidance, journeyActions, transition].join("\n");
assert.doesNotMatch(combined, /Something went wrong\.?/i, "Meaningful actions cannot collapse failures into generic copy.");
assert.doesNotMatch(combined, /className=["'{][^\n]*(?:spinner|animate-spin)/i, "Meaningful mutation controls cannot use generic spinners.");

console.log("Premium action feedback checks passed", {
  sharedPrimitives: 2,
  integratedSurfaces: 9,
  optimisticRollback: true,
  specializedSavePreserved: true,
  milestoneHierarchyPreserved: true,
});
