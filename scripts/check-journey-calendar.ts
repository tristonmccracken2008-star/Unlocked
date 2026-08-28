import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { Opportunity } from "../data/opportunities";
import type { AccountData, JourneyCalendarEventRecord } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";
import { buildJourneyCalendarModel, officialDeadlineIsCalendarReady } from "../lib/journey-calendar";
import { buildCalendarEventNotificationSchedule } from "../lib/notification-engine";

const now = new Date("2026-08-08T16:00:00.000Z");
const tracked = {
  id: "trusted-deadline",
  status: "Applying" as const,
  savedAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-05T12:00:00.000Z",
  version: 2,
  history: [],
};
const opportunity = {
  id: "trusted-deadline",
  title: "Trusted Internship",
  organization: "Official Organization",
  type: "Career",
  category: "Internship",
  description: "A verified opportunity.",
  school_scope: "National",
  schools: [],
  majors: ["All Majors"],
  academic_years: ["All Years"],
  eligibility: "Undergraduates",
  estimated_value: null,
  application_deadline: "2026-08-14",
  deadline: "2026-08-14",
  recurring: false,
  location: "United States",
  remote: null,
  paid: null,
  tags: ["Internship"],
  official_source: "Official Organization",
  official_source_url: "https://example.edu/apply",
  verification_status: "verified",
  last_verified: "2026-07-20",
  reviewer_notes: "",
  estimated_value_note: "Unknown",
  date_added: "2026-07-20",
  difficulty: null,
  prestige: null,
  icon: null,
  featured: false,
  hidden_gem: false,
  metadata: { deadlineType: "fixed", verification: { status: "verified", deadlineVerified: true, officialSourceUrl: "https://example.edu/apply", applicationUrlVerified: true, sourceReachable: true } },
} satisfies Opportunity;

const personal: JourneyCalendarEventRecord = {
  id: "calendar:event-12345678",
  type: "interview",
  title: "Practice interview",
  date: "2026-08-10",
  time: "10:00",
  opportunityId: opportunity.id,
  source: "user",
  reminderMinutesBefore: 1_440,
  completed: false,
  dismissed: false,
  createdAt: "2026-08-08T12:00:00.000Z",
  updatedAt: "2026-08-08T12:00:00.000Z",
  version: 0,
};

const account: AccountData = {
  profile: null,
  onboardingComplete: true,
  firstLaunchComplete: true,
  billing: defaultBillingRecord(),
  activity: { viewed: [], saved: [opportunity.id], claimed: [], tracked: { [opportunity.id]: tracked } },
  savedOpportunities: [{ opportunityId: opportunity.id, savedAt: tracked.savedAt }],
  tracker: { [opportunity.id]: tracked },
  preferences: null,
  journeyProgress: {},
  calendarEvents: { [personal.id]: personal },
  advisor: null,
  referrals: null,
  updatedAt: now.toISOString(),
};

assert.equal(officialDeadlineIsCalendarReady(opportunity, now), true, "Verified fixed deadlines should be calendar-ready");
assert.equal(officialDeadlineIsCalendarReady({ ...opportunity, verification_status: "needs_review" }, now), false, "Uncertain dates must not enter the calendar");

const model = buildJourneyCalendarModel({ account, opportunities: [opportunity], now });
assert.equal(model.items.length, 2, "One official and one personal date should project without duplication");
assert.equal(model.items[0]?.id, personal.id);
assert.equal(model.items[1]?.id, `official:${opportunity.id}:application_deadline`);
assert.equal(model.groups[0]?.id, "this_week");
assert.equal(model.trackedOptions[0]?.id, opportunity.id);

const passed = buildJourneyCalendarModel({ account: { ...account, tracker: { [opportunity.id]: { ...tracked, status: "Submitted" } } }, opportunities: [{ ...opportunity, application_deadline: "2026-08-07", deadline: "2026-08-07" }], now });
assert.equal(passed.items.find((item) => item.source === "official")?.statusAwarePassed, true, "Submitted opportunities must not imply that the student missed a passed deadline");

const monthBoundaryEvent = { ...personal, id: "calendar:month-boundary", date: "2026-09-01" };
const monthBoundary = buildJourneyCalendarModel({
  account: { ...account, calendarEvents: { [monthBoundaryEvent.id]: monthBoundaryEvent } },
  opportunities: [],
  now: new Date("2026-08-28T12:00:00.000Z"),
});
assert.equal(monthBoundary.groups.flatMap((group) => group.items).filter((item) => item.id === monthBoundaryEvent.id).length, 1, "A next-month date inside the current seven-day window must belong to exactly one group.");
assert.equal(monthBoundary.groups.find((group) => group.items.some((item) => item.id === monthBoundaryEvent.id))?.id, "this_week");

const reminder = buildCalendarEventNotificationSchedule({ userId: "user-1", event: personal, now, preferences: { timezone: "America/New_York" } });
assert.ok(reminder?.calendarEventId === personal.id);
assert.equal(reminder?.scheduledFor, "2026-08-09T14:00:00.000Z", "Interview reminder should respect the saved local time and timezone");
assert.equal(buildCalendarEventNotificationSchedule({ userId: "user-1", event: { ...personal, completed: true }, now }), null, "Completed dates must not schedule reminders");

const route = await readFile(new URL("../app/api/journey/calendar/route.ts", import.meta.url), "utf8");
assert.match(route, /assertSameOrigin\(request\)/);
assert.match(route, /Only opportunities in your Journey can be linked/);
assert.match(route, /expectedVersion/);
assert.match(route, /mutateJourneyCalendarEvent/);

console.log("Journey calendar checks passed.");
