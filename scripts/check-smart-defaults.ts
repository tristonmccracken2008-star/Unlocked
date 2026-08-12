import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Opportunity } from "../data/opportunities";
import type { AccountData } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";
import { journeySmartDefaults } from "../lib/journey-add-service";
import { buildJourneyCalendarModel } from "../lib/journey-calendar";
import { buildNotificationSchedules } from "../lib/notification-engine";
import { defaultNotificationPreferences } from "../lib/notification-types";

const now = new Date("2026-08-12T12:00:00.000Z");
const opportunity = {
  id: "smart-default-internship",
  title: "Verified Internship",
  organization: "Official Organization",
  type: "Career",
  category: "Internship",
  description: "A verified application-based opportunity.",
  school_scope: "National",
  schools: [],
  majors: ["All Majors"],
  academic_years: ["All Years"],
  eligibility: "Undergraduates",
  estimated_value: null,
  application_deadline: "2026-09-21",
  deadline: "2026-09-21",
  recurring: false,
  location: "United States",
  remote: null,
  paid: null,
  tags: ["Internship"],
  official_source: "Official Organization",
  official_source_url: "https://example.edu/apply",
  verification_status: "verified",
  last_verified: "2026-08-01",
  reviewer_notes: "",
  estimated_value_note: "Unknown",
  date_added: "2026-08-01",
  difficulty: null,
  prestige: null,
  icon: null,
  featured: false,
  hidden_gem: false,
  metadata: { deadlineType: "fixed", applicationRequirements: ["Application", "Résumé", "Transcript"] },
} satisfies Opportunity;
const record = { id: opportunity.id, status: "Saved" as const, savedAt: now.toISOString(), updatedAt: now.toISOString(), version: 0, history: [] };
const account = (deadlineReminders = true): AccountData => ({
  profile: null,
  onboardingComplete: true,
  firstLaunchComplete: true,
  billing: defaultBillingRecord(),
  activity: { viewed: [], saved: [opportunity.id], claimed: [], tracked: { [opportunity.id]: record } },
  savedOpportunities: [{ opportunityId: opportunity.id, savedAt: record.savedAt }],
  tracker: { [opportunity.id]: record },
  preferences: { notifications: { ...defaultNotificationPreferences(now.toISOString()), deadlineReminders }, updatedAt: now.toISOString() },
  journeyProgress: {},
  advisor: null,
  referrals: null,
  updatedAt: now.toISOString(),
});

const enabled = account();
const defaults = journeySmartDefaults(opportunity, enabled, now);
assert.equal(defaults.initialStatus, "Saved", "Smart setup must never infer a consequential status.");
assert.equal(defaults.officialDeadline, "2026-09-21");
assert.equal(defaults.verifiedRequirementCount, 3);
assert.deepEqual(defaults.deadlineReminderOffsets, [7, 1]);

const disabled = account(false);
assert.deepEqual(journeySmartDefaults(opportunity, disabled, now).deadlineReminderOffsets, [], "Disabled deadline reminders must stay disabled.");
const uncertain = { ...opportunity, verification_status: "needs_review" as const };
assert.equal(journeySmartDefaults(uncertain, enabled, now).officialDeadline, undefined, "Unverified dates cannot become authoritative defaults.");
assert.equal(journeySmartDefaults(uncertain, enabled, now).verifiedRequirementCount, 0, "Unverified requirements cannot become application tasks.");

const calendar = buildJourneyCalendarModel({ account: enabled, opportunities: [opportunity], now });
assert.equal(calendar.items.filter((item) => item.source === "official").length, 1, "An official deadline must project once without creating a user event.");
assert.equal(Object.keys(enabled.calendarEvents ?? {}).length, 0, "Authoritative dates must not duplicate personal calendar state.");
assert.deepEqual(buildNotificationSchedules({ userId: "smart-default-user", record, opportunity, preferences: { deadlineReminders: true }, now }).filter((item) => item.type === "deadline").map((item) => item.offsetDays), [7, 1]);
assert.equal(buildNotificationSchedules({ userId: "smart-default-user", record, opportunity, preferences: { deadlineReminders: false }, now }).some((item) => item.type === "deadline"), false);

const calendarUi = readFileSync("components/journey-deadline-calendar.tsx", "utf8");
const workspaceUi = readFileSync("components/application-workspace.tsx", "utf8");
const journeyUi = readFileSync("components/journey-command-center.tsx", "utf8");
const saveUi = readFileSync("components/opportunity-activity.tsx", "utf8");
for (const token of ["More options", "Linked opportunity", "journeyCalendarAddEvent", "viewStorageKey", "Verified official dates appear automatically"]) assert.ok(calendarUi.includes(token), `Calendar smart setup must retain ${token}.`);
assert.match(workspaceUi, /Verified requirements were added automatically/);
assert.match(workspaceUi, /Add personal date/);
assert.match(journeyUi, /Add interview date/);
assert.match(saveUi, /Official deadline added/);
assert.match(saveUi, /verified.*ready/i);

console.log("Smart default and zero-configuration checks passed", {
  initialStatus: defaults.initialStatus,
  verifiedRequirements: defaults.verifiedRequirementCount,
  reminderOffsets: defaults.deadlineReminderOffsets,
  officialCalendarItems: calendar.items.filter((item) => item.source === "official").length,
});
