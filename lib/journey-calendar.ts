import type { Opportunity } from "@/data/opportunities";
import type { TrackedOpportunity } from "@/data/student-activity";
import type { AccountData, JourneyCalendarEventRecord, JourneyCalendarEventType } from "./account-types";
import { applicationTaskCalendarEvents } from "./application-workspace";

export type JourneyCalendarSource = "official" | "user" | "application_task";
export type JourneyCalendarUrgency = "overdue" | "today" | "tomorrow" | "soon" | "later";

export type JourneyCalendarItem = {
  id: string;
  type: JourneyCalendarEventType | "application_deadline" | "application_open" | "program_start";
  title: string;
  date: string;
  time?: string;
  opportunityId?: string;
  opportunityTitle?: string;
  organization?: string;
  source: JourneyCalendarSource;
  reminderMinutesBefore?: number;
  completed: boolean;
  dismissed: boolean;
  version: number;
  urgency: JourneyCalendarUrgency;
  timingLabel: string;
  statusAwarePassed: boolean;
};

export type JourneyCalendarGroup = {
  id: "this_week" | "this_month" | "later" | "passed";
  label: string;
  items: JourneyCalendarItem[];
};

export type JourneyCalendarModel = {
  items: JourneyCalendarItem[];
  groups: JourneyCalendarGroup[];
  initialMonth: string;
  timezone: string;
  trackedOptions: Array<{ id: string; title: string; organization: string }>;
};

const terminalStatuses = new Set(["Rejected", "Completed"]);

function trackedRecord(account: AccountData, id: string): TrackedOpportunity | undefined {
  return account.tracker?.[id] ?? account.activity?.tracked?.[id];
}

function dateValue(value: string) {
  const parsed = Date.parse(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function localDate(now: Date, timezone: string) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function calendarDaysAway(date: string, now: Date, timezone: string) {
  return Math.round((dateValue(date) - dateValue(localDate(now, timezone))) / 86_400_000);
}

export function calendarTiming(date: string, now: Date, timezone: string, statusAwarePassed = false) {
  const days = calendarDaysAway(date, now, timezone);
  if (days < 0) return { urgency: "overdue" as const, timingLabel: statusAwarePassed ? "Deadline passed · already submitted" : "Passed", days };
  if (days === 0) return { urgency: "today" as const, timingLabel: "Today", days };
  if (days === 1) return { urgency: "tomorrow" as const, timingLabel: "Tomorrow", days };
  if (days <= 7) return { urgency: "soon" as const, timingLabel: `${days} days left`, days };
  return { urgency: "later" as const, timingLabel: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00.000Z`)), days };
}

export function officialDeadlineIsCalendarReady(opportunity: Opportunity, now = new Date()) {
  if (opportunity.verification_status !== "verified" || opportunity.metadata.deadlineType !== "fixed") return false;
  if (opportunity.metadata.lifecycle?.confidence && !["confirmed", "strong"].includes(opportunity.metadata.lifecycle.confidence)) return false;
  if (!opportunity.application_deadline || !/^\d{4}-\d{2}-\d{2}$/.test(opportunity.application_deadline)) return false;
  const verifiedAt = Date.parse(`${opportunity.last_verified}T12:00:00.000Z`);
  return Number.isFinite(verifiedAt) && now.getTime() - verifiedAt <= 366 * 86_400_000;
}

function exactLifecycleDate(opportunity: Opportunity, kind: "openingDate" | "programStartDate", now: Date) {
  const lifecycle = opportunity.metadata.lifecycle;
  const date = lifecycle?.[kind];
  if (opportunity.verification_status !== "verified" || !lifecycle || !["confirmed", "strong"].includes(lifecycle.confidence ?? "")) return undefined;
  if (!date?.normalizedValue || date.estimated || date.precision !== "date" || !/^\d{4}-\d{2}-\d{2}$/.test(date.normalizedValue)) return undefined;
  const verifiedAt = Date.parse(`${opportunity.last_verified}T12:00:00.000Z`);
  return Number.isFinite(verifiedAt) && now.getTime() - verifiedAt <= 366 * 86_400_000 ? date.normalizedValue : undefined;
}

function projectUserEvent(record: JourneyCalendarEventRecord, opportunity: Opportunity | undefined, now: Date, timezone: string): JourneyCalendarItem {
  const timing = calendarTiming(record.date, now, timezone);
  return {
    ...record,
    opportunityTitle: opportunity?.title,
    organization: opportunity?.organization,
    urgency: timing.urgency,
    timingLabel: timing.timingLabel,
    statusAwarePassed: false,
  };
}

function eventSort(left: JourneyCalendarItem, right: JourneyCalendarItem) {
  return dateValue(left.date) - dateValue(right.date)
    || (left.time ?? "23:59").localeCompare(right.time ?? "23:59")
    || left.title.localeCompare(right.title);
}

export function buildJourneyCalendarModel(input: {
  account: AccountData;
  opportunities: readonly Opportunity[];
  now?: Date;
}): JourneyCalendarModel {
  const now = input.now ?? new Date();
  const timezone = input.account.preferences?.notifications?.timezone ?? "America/New_York";
  const byId = new Map(input.opportunities.map((item) => [item.id, item]));
  const today = localDate(now, timezone);
  const minDate = new Date(dateValue(today) - 31 * 86_400_000).toISOString().slice(0, 10);
  const maxDate = new Date(dateValue(today) + 400 * 86_400_000).toISOString().slice(0, 10);
  const trackedIds = [...new Set([
    ...Object.keys(input.account.tracker ?? {}),
    ...Object.keys(input.account.activity?.tracked ?? {}),
    ...(input.account.savedOpportunities ?? []).map((record) => record.opportunityId),
  ])];

  const official = trackedIds.flatMap((id): JourneyCalendarItem[] => {
    const opportunity = byId.get(id);
    const record = trackedRecord(input.account, id);
    if (!opportunity || !record || terminalStatuses.has(record.status)) return [];
    const statusAwarePassed = ["Submitted", "Interview", "Accepted"].includes(record.status);
    const candidates = [
      officialDeadlineIsCalendarReady(opportunity, now) ? { type: "application_deadline" as const, title: "Application deadline", date: opportunity.application_deadline! } : null,
      exactLifecycleDate(opportunity, "openingDate", now) ? { type: "application_open" as const, title: "Applications open", date: exactLifecycleDate(opportunity, "openingDate", now)! } : null,
      exactLifecycleDate(opportunity, "programStartDate", now) ? { type: "program_start" as const, title: "Program starts", date: exactLifecycleDate(opportunity, "programStartDate", now)! } : null,
    ].filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
    return candidates.flatMap((candidate) => {
      if (candidate.date < minDate || candidate.date > maxDate) return [];
      const timing = calendarTiming(candidate.date, now, timezone, candidate.type === "application_deadline" && statusAwarePassed);
      return [{
        id: `official:${id}:${candidate.type}`,
        type: candidate.type,
        title: candidate.title,
        date: candidate.date,
        opportunityId: id,
        opportunityTitle: opportunity.title,
        organization: opportunity.organization,
        source: "official" as const,
        completed: false,
        dismissed: false,
        version: 0,
        urgency: timing.urgency,
        timingLabel: timing.timingLabel,
        statusAwarePassed: candidate.type === "application_deadline" && statusAwarePassed,
      }];
    });
  });

  const personal = Object.values(input.account.calendarEvents ?? {}).flatMap((record): JourneyCalendarItem[] => {
    if (record.dismissed || record.completed || record.date < minDate || record.date > maxDate) return [];
    return [projectUserEvent(record, record.opportunityId ? byId.get(record.opportunityId) : undefined, now, timezone)];
  });
  const applicationTasks = applicationTaskCalendarEvents(input.account).flatMap((record): JourneyCalendarItem[] => {
    if (record.completed || record.date < minDate || record.date > maxDate) return [];
    return [projectUserEvent(record, record.opportunityId ? byId.get(record.opportunityId) : undefined, now, timezone)];
  });
  const items = [...official, ...personal, ...applicationTasks].sort(eventSort);
  const endOfWeek = new Date(dateValue(today) + 7 * 86_400_000).toISOString().slice(0, 10);
  const endOfMonth = `${today.slice(0, 8)}${String(new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`;
  const groups: JourneyCalendarGroup[] = [
    { id: "this_week", label: "This week", items: items.filter((item) => item.date >= today && item.date <= endOfWeek) },
    { id: "this_month", label: "This month", items: items.filter((item) => item.date > endOfWeek && item.date <= endOfMonth) },
    { id: "later", label: "Later", items: items.filter((item) => item.date > endOfMonth) },
    { id: "passed", label: "Passed", items: items.filter((item) => item.date < today) },
  ].filter((group) => group.items.length) as JourneyCalendarGroup[];
  const trackedOptions = trackedIds.flatMap((id) => {
    const opportunity = byId.get(id);
    return opportunity ? [{ id, title: opportunity.title, organization: opportunity.organization }] : [];
  }).sort((left, right) => left.title.localeCompare(right.title));
  return { items, groups, initialMonth: today.slice(0, 7), timezone, trackedOptions };
}

export const calendarEventTypeLabels: Record<JourneyCalendarEventType, string> = {
  interview: "Interview",
  personal_target: "Application target",
  follow_up: "Follow-up",
  essay_deadline: "Essay deadline",
  reminder: "Reminder",
};
