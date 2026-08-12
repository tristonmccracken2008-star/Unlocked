import crypto from "node:crypto";
import type { Opportunity } from "@/data/opportunities";
import type { RecommendationViewModel } from "@/data/recommendation-service";
import { resolveOpportunityLifecycle } from "@/data/opportunity-lifecycle";
import {
  detectMeaningfulOpportunityChanges,
  opportunityChangeLabel,
  opportunityChangeSummary,
} from "@/data/opportunity-changelog";
import type { TrackedOpportunity } from "@/data/student-activity";
import type { JourneyCalendarEventRecord } from "./account-types";
import {
  defaultNotificationPreferences,
  type NotificationPreferences,
  type NotificationPriority,
  type NotificationRecord,
  type NotificationSchedule,
  type NotificationType,
  type OpportunityMaterialChange,
} from "./notification-types";

const activeDeadlineStatuses = new Set(["Saved", "Interested", "Applying"]);
const terminalStatuses = new Set(["Accepted", "Completed", "Rejected", "Paused"]);
const trustworthyDeadlineStatuses = new Set(["verified"]);
const safeTimezoneFallback = "America/New_York";

export function validTimezone(value: string | null | undefined) {
  if (!value || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeNotificationPreferences(value: Partial<NotificationPreferences> | null | undefined, now = new Date().toISOString()): NotificationPreferences {
  const fallback = defaultNotificationPreferences(now);
  const startHour = Number(value?.quietHours?.startHour);
  const endHour = Number(value?.quietHours?.endHour);
  return {
    inAppEnabled: value?.inAppEnabled !== false,
    emailEnabled: value?.emailEnabled !== false,
    deadlineReminders: value?.deadlineReminders !== false,
    journeyReminders: value?.journeyReminders !== false,
    opportunityChanges: value?.opportunityChanges !== false,
    personalizedOpportunities: typeof value?.personalizedOpportunities === "boolean"
      ? value.personalizedOpportunities
      : typeof value?.recommendationUpdates === "boolean"
        ? value.recommendationUpdates
        : fallback.personalizedOpportunities,
    milestoneUpdates: value?.milestoneUpdates !== false,
    accountUpdates: value?.accountUpdates !== false,
    productAnnouncements: value?.productAnnouncements === true,
    weeklyDigest: value?.weeklyDigest === true,
    recommendationUpdates: typeof value?.personalizedOpportunities === "boolean"
      ? value.personalizedOpportunities
      : value?.recommendationUpdates === true,
    frequency: value?.frequency === "balanced" ? "balanced" : "important_only",
    timezone: validTimezone(value?.timezone) ? value!.timezone! : fallback.timezone,
    quietHours: {
      enabled: value?.quietHours?.enabled !== false,
      startHour: Number.isInteger(startHour) && startHour >= 0 && startHour <= 23 ? startHour : fallback.quietHours.startHour,
      endHour: Number.isInteger(endHour) && endHour >= 0 && endHour <= 23 ? endHour : fallback.quietHours.endHour,
    },
    updatedAt: typeof value?.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : now,
  };
}

function stableHash(parts: readonly (string | number | undefined)[]) {
  return crypto.createHash("sha256").update(parts.map((part) => String(part ?? "")).join("|")).digest("hex").slice(0, 24);
}

export function notificationIdempotencyKey(parts: readonly (string | number | undefined)[]) {
  return `notification:${stableHash(parts)}`;
}

function localParts(date: Date, timezone: string) {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return values as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
}

export function localDateTimeToUtc(date: string, hour: number, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !validTimezone(timezone)) return null;
  const [year, month, day] = date.split("-").map(Number);
  let timestamp = Date.UTC(year, month - 1, day, hour, 0, 0);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shown = localParts(new Date(timestamp), timezone);
    const target = Date.UTC(year, month - 1, day, hour, 0, 0);
    const represented = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    const correction = target - represented;
    timestamp += correction;
    if (correction === 0) break;
  }
  return new Date(timestamp);
}

export function nextWeeklyDigestAt(now: Date, timezone: string) {
  const safeTimezone = validTimezone(timezone) ? timezone : safeTimezoneFallback;
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = new Date(now.getTime() + offset * 86_400_000);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: safeTimezone, weekday: "short" }).format(candidate);
    if (weekday !== "Mon") continue;
    const parts = localParts(candidate, safeTimezone);
    const date = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
    return localDateTimeToUtc(date, 9, safeTimezone);
  }
  return null;
}

function dateMinusDays(date: string, days: number) {
  const parsed = Date.parse(`${date}T12:00:00.000Z`);
  return Number.isFinite(parsed) ? new Date(parsed - days * 86_400_000).toISOString().slice(0, 10) : null;
}

function latestCustomReminder(record: TrackedOpportunity) {
  const details = [...(record.history ?? [])].reverse().find((entry) => entry.details?.reminderAt)?.details;
  return details?.reminderAt ? {
    at: details.reminderAt,
    text: details.reminderText?.replace(/\s+/g, " ").trim().slice(0, 160),
  } : null;
}

function deadlineOffsets(record: TrackedOpportunity) {
  if (record.status === "Applying") return [7, 1];
  if (record.status === "Saved" || record.status === "Interested") return [7, 1];
  return [];
}

function savedCheckInAt(record: TrackedOpportunity, now: Date, timezone: string) {
  if (!["Saved", "Interested"].includes(record.status)) return null;
  const savedAt = Date.parse(record.savedAt);
  const updatedAt = Date.parse(record.updatedAt);
  if (!Number.isFinite(savedAt) || !Number.isFinite(updatedAt) || updatedAt > savedAt + 60_000) return null;
  const dueAt = savedAt + 14 * 86_400_000;
  const age = now.getTime() - dueAt;
  if (age > 7 * 86_400_000) return null;
  if (dueAt > now.getTime()) return new Date(dueAt);
  const parts = localParts(now, timezone);
  const date = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  return localDateTimeToUtc(date, Math.max(9, parts.hour), timezone) ?? now;
}

export function opportunityDeadlineIsTrustworthy(opportunity: Opportunity, now = new Date()) {
  const lifecycle = resolveOpportunityLifecycle(opportunity, now);
  if (!lifecycle.actionable || lifecycle.state === "rolling" || !["confirmed", "strong"].includes(lifecycle.confidence)) return false;
  if (!opportunity.application_deadline || opportunity.metadata.deadlineType !== "fixed") return false;
  if (!trustworthyDeadlineStatuses.has(opportunity.verification_status)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opportunity.application_deadline)) return false;
  const deadline = Date.parse(`${opportunity.application_deadline}T23:59:59.999Z`);
  if (!Number.isFinite(deadline) || deadline < now.getTime()) return false;
  const lastVerified = Date.parse(`${opportunity.last_verified}T00:00:00.000Z`);
  return Number.isFinite(lastVerified) && now.getTime() - lastVerified <= 366 * 86_400_000;
}

export function buildNotificationSchedules(input: {
  userId: string;
  record: TrackedOpportunity;
  opportunity: Opportunity;
  preferences?: Partial<NotificationPreferences> | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const preferences = normalizeNotificationPreferences(input.preferences, now.toISOString());
  const schedules: NotificationSchedule[] = [];
  if (terminalStatuses.has(input.record.status)) return schedules;

  const customReminder = latestCustomReminder(input.record);
  if (customReminder && preferences.journeyReminders) {
    const scheduled = Date.parse(customReminder.at);
    if (Number.isFinite(scheduled) && scheduled > now.getTime() - 86_400_000) {
      const contentVersion = stableHash([input.record.id, input.record.version, customReminder.at, customReminder.text]);
      schedules.push({
        id: notificationIdempotencyKey([input.userId, "journey_reminder", input.record.id, customReminder.at, contentVersion]),
        userId: input.userId,
        type: "journey_reminder",
        opportunityId: input.record.id,
        scheduledFor: new Date(scheduled).toISOString(),
        contentVersion,
        customReminderText: customReminder.text,
      });
    }
  }

  if (preferences.journeyReminders) {
    const checkInAt = savedCheckInAt(input.record, now, preferences.timezone);
    if (checkInAt) {
      const contentVersion = stableHash([input.record.id, input.record.savedAt, input.record.status, "saved_check_in"]);
      schedules.push({
        id: notificationIdempotencyKey([input.userId, "follow_up", input.record.id, "saved_check_in", contentVersion]),
        userId: input.userId,
        type: "follow_up",
        opportunityId: input.record.id,
        scheduledFor: checkInAt.toISOString(),
        contentVersion,
        followUpKind: "saved_check_in",
      });
    }
  }

  if (!preferences.deadlineReminders || !activeDeadlineStatuses.has(input.record.status) || !opportunityDeadlineIsTrustworthy(input.opportunity, now)) return schedules;
  const deadline = input.opportunity.application_deadline!;
  for (const offsetDays of deadlineOffsets(input.record)) {
    const localDate = dateMinusDays(deadline, offsetDays);
    const due = localDate ? localDateTimeToUtc(localDate, 9, preferences.timezone) : null;
    if (!due || due.getTime() <= now.getTime()) continue;
    if (customReminder && Math.abs(Date.parse(customReminder.at) - due.getTime()) < 12 * 60 * 60 * 1_000) continue;
    const contentVersion = stableHash([input.opportunity.id, deadline, input.opportunity.last_verified, input.record.status, offsetDays]);
    schedules.push({
      id: notificationIdempotencyKey([input.userId, "deadline", input.opportunity.id, deadline, offsetDays, contentVersion]),
      userId: input.userId,
      type: "deadline",
      opportunityId: input.opportunity.id,
      scheduledFor: due.toISOString(),
      contentVersion,
      offsetDays,
    });
  }
  if (preferences.journeyReminders) {
    const followUpDate = new Date(Date.parse(`${deadline}T12:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10);
    const followUpAt = localDateTimeToUtc(followUpDate, 9, preferences.timezone);
    if (followUpAt && followUpAt.getTime() > now.getTime()) {
      const contentVersion = stableHash([input.opportunity.id, deadline, input.record.status, "follow_up"]);
      schedules.push({
        id: notificationIdempotencyKey([input.userId, "follow_up", input.opportunity.id, deadline, input.record.status, contentVersion]),
        userId: input.userId,
        type: "follow_up",
        opportunityId: input.opportunity.id,
        scheduledFor: followUpAt.toISOString(),
        contentVersion,
        followUpKind: "deadline_passed",
      });
    }
  }
  return schedules;
}

export function buildCalendarEventNotificationSchedule(input: {
  userId: string;
  event: JourneyCalendarEventRecord;
  preferences?: Partial<NotificationPreferences> | null;
  now?: Date;
}): NotificationSchedule | null {
  const now = input.now ?? new Date();
  const preferences = normalizeNotificationPreferences(input.preferences, now.toISOString());
  if (!preferences.journeyReminders || input.event.completed || input.event.dismissed || input.event.reminderMinutesBefore === undefined) return null;
  const local = localDateTimeToUtc(input.event.date, Number(input.event.time?.slice(0, 2) ?? 9), preferences.timezone);
  if (!local) return null;
  if (input.event.time) local.setUTCMinutes(local.getUTCMinutes() + Number(input.event.time.slice(3, 5)));
  const scheduledFor = new Date(local.getTime() - input.event.reminderMinutesBefore * 60_000);
  if (scheduledFor.getTime() <= now.getTime() - 60_000) return null;
  const contentVersion = stableHash([input.event.id, input.event.version, input.event.date, input.event.time, input.event.reminderMinutesBefore, input.event.updatedAt]);
  return {
    id: notificationIdempotencyKey([input.userId, "calendar", input.event.id, scheduledFor.toISOString(), contentVersion]),
    userId: input.userId,
    type: "journey_reminder" as const,
    calendarEventId: input.event.id,
    opportunityId: input.event.opportunityId,
    scheduledFor: scheduledFor.toISOString(),
    contentVersion,
    customReminderText: `${input.event.title}${input.event.opportunityId ? "" : " is coming up"}.`,
  };
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/[.,;:!?'"()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function detectMaterialOpportunityChanges(before: Opportunity, after: Opportunity, now = new Date()): OpportunityMaterialChange[] {
  return detectMeaningfulOpportunityChanges(before, after, now)
    .filter((event) => event.notificationEligible)
    .map((event) => ({
      field: event.field,
      before: event.previousValue ?? "Not listed",
      after: event.newValue ?? "Not listed",
      label: opportunityChangeLabel(event),
      message: opportunityChangeSummary(event),
      eventId: event.id,
      importance: event.importance,
      contentVersion: event.id,
    }));
}

export function notificationCategoryEnabled(type: NotificationType, preferences: NotificationPreferences) {
  if (type === "deadline_reminder") return preferences.deadlineReminders;
  if (type === "journey_reminder") return preferences.journeyReminders;
  if (type === "opportunity_change") return preferences.opportunityChanges;
  if (type === "journey_follow_up") return preferences.journeyReminders;
  if (type === "milestone") return preferences.milestoneUpdates;
  if (type === "weekly_digest") return preferences.weeklyDigest;
  if (type === "recommendation_update") return preferences.personalizedOpportunities;
  if (type === "account") return preferences.accountUpdates;
  if (type === "product_announcement") return preferences.productAnnouncements;
  return preferences.inAppEnabled;
}

export function emailEligible(type: NotificationType, priority: NotificationPriority, preferences: NotificationPreferences) {
  if (!preferences.emailEnabled || !notificationCategoryEnabled(type, preferences)) return false;
  if (type === "journey_reminder") return true;
  if (type === "deadline_reminder") return priority === "high" || preferences.frequency === "balanced";
  if (type === "opportunity_change") return false;
  if (type === "weekly_digest") return preferences.weeklyDigest;
  if (type === "recommendation_update") return false;
  if (type === "milestone" || type === "account" || type === "product_announcement") return false;
  return false;
}

export type NotificationQualityInput = {
  relevance: number;
  usefulness: number;
  urgency: number;
  uniqueness: number;
  outdated?: boolean;
  acknowledged?: boolean;
};

export function evaluateNotificationQuality(input: NotificationQualityInput) {
  if (input.outdated) return { allowed: false, score: 0, reason: "outdated" as const };
  if (input.acknowledged) return { allowed: false, score: 0, reason: "acknowledged" as const };
  const values = [input.relevance, input.usefulness, input.urgency, input.uniqueness]
    .map((value) => Math.max(0, Math.min(100, Math.round(value))));
  const score = Math.round(values[0] * 0.35 + values[1] * 0.35 + values[2] * 0.15 + values[3] * 0.15);
  const allowed = values[0] >= 70 && values[1] >= 70 && values[3] >= 55 && score >= 72;
  return { allowed, score, reason: allowed ? "useful" as const : "low_value" as const };
}

export function selectPersonalizedNotificationCandidate(
  recommendations: readonly RecommendationViewModel[],
  excludedOpportunityIds: ReadonlySet<string>,
  now = new Date(),
) {
  return recommendations.find((view) => {
    const opportunity = view.opportunity;
    if (!opportunity || excludedOpportunityIds.has(opportunity.id)) return false;
    const addedAt = Date.parse(`${opportunity.date_added}T00:00:00.000Z`);
    const newlyAdded = Number.isFinite(addedAt)
      && now.getTime() - addedAt <= 7 * 86_400_000
      && addedAt <= now.getTime() + 86_400_000;
    return newlyAdded
      && !view.historyLabel
      && opportunity.verification_status === "verified"
      && resolveOpportunityLifecycle(opportunity, now).actionable
      && view.opportunityScore.value >= 90
      && view.recommendation.confidence >= 85
      && ["excellent", "strong"].includes(view.recommendation.tier);
  });
}

export function inQuietHours(now: Date, preferences: NotificationPreferences) {
  if (!preferences.quietHours.enabled) return false;
  const hour = localParts(now, validTimezone(preferences.timezone) ? preferences.timezone : safeTimezoneFallback).hour;
  const { startHour, endHour } = preferences.quietHours;
  return startHour > endHour ? hour >= startHour || hour < endHour : hour >= startHour && hour < endHour;
}

export function nextAllowedEmailAt(now: Date, preferences: NotificationPreferences) {
  if (!inQuietHours(now, preferences)) return now;
  for (let minutes = 15; minutes <= 36 * 60; minutes += 15) {
    const candidate = new Date(now.getTime() + minutes * 60_000);
    if (!inQuietHours(candidate, preferences)) return candidate;
  }
  return new Date(now.getTime() + 36 * 60 * 60_000);
}

export function buildNotificationRecord(input: {
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
  contentVersion: string;
  idempotencyKey: string;
  organization?: string;
  opportunityId?: string;
  journeyStatus?: TrackedOpportunity["status"];
  relevantAt?: string;
  expiresAt?: string;
  bundledCount?: number;
  now?: Date;
  preferences: NotificationPreferences;
}) {
  const now = input.now ?? new Date();
  const email = emailEligible(input.type, input.priority, input.preferences);
  const actionHref = input.actionHref.startsWith("/")
    && !input.actionHref.startsWith("//")
    && !/[\r\n]/.test(input.actionHref)
    ? input.actionHref
    : "/notifications";
  const record: NotificationRecord = {
    id: crypto.randomUUID(),
    type: input.type,
    priority: input.priority,
    state: input.preferences.inAppEnabled ? "delivered" : email ? "generated" : "suppressed",
    title: input.title.slice(0, 120),
    body: input.body.replace(/\s+/g, " ").trim().slice(0, 300),
    organization: input.organization?.slice(0, 120),
    opportunityId: input.opportunityId,
    journeyStatus: input.journeyStatus,
    actionLabel: input.actionLabel.slice(0, 60),
    actionHref,
    createdAt: now.toISOString(),
    relevantAt: input.relevantAt,
    expiresAt: input.expiresAt && Number.isFinite(Date.parse(input.expiresAt)) && Date.parse(input.expiresAt) > now.getTime()
      ? input.expiresAt
      : new Date(now.getTime() + 90 * 86_400_000).toISOString(),
    idempotencyKey: input.idempotencyKey,
    contentVersion: input.contentVersion,
    bundledCount: input.bundledCount,
    channels: {
      inApp: { state: input.preferences.inAppEnabled ? "delivered" : "suppressed" },
      email: { state: email ? "scheduled" : "suppressed" },
    },
  };
  return record;
}
