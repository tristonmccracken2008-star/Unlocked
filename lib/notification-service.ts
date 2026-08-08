import "server-only";

import type { AccountData } from "./account-types";
import type { Opportunity } from "@/data/opportunities";
import type { RecommendationViewModel } from "@/data/recommendation-service";
import { recordAnalyticsEvent } from "./analytics-store";
import { productIntelligenceEvents } from "./analytics-types";
import {
  buildNotificationRecord,
  buildNotificationSchedules,
  buildCalendarEventNotificationSchedule,
  detectMaterialOpportunityChanges,
  evaluateNotificationQuality,
  inQuietHours,
  nextAllowedEmailAt,
  nextWeeklyDigestAt,
  normalizeNotificationPreferences,
  notificationCategoryEnabled,
  notificationIdempotencyKey,
  opportunityDeadlineIsTrustworthy,
  selectPersonalizedNotificationCandidate,
} from "./notification-engine";
import {
  claimEmailFrequency,
  claimNotificationSync,
  claimNotificationSchedule,
  completeNotificationSchedule,
  emailSuppressionReason,
  readDueNotificationSchedules,
  readNotificationById,
  readNotifications,
  registerProviderEmail,
  registerTrackedRecipient,
  releaseNotificationSchedule,
  scheduleNotification,
  storeNotification,
  trackedRecipients,
  updateNotificationEmailDelivery,
  archiveExpiredNotifications,
} from "./notification-store";
import { readAccountData, readAccountUser } from "./auth-store";
import { listPublishedOpportunitiesByIds } from "./content-store";
import { sendNotificationEmail } from "./notification-email";
import type { NotificationPriority, NotificationRecord, NotificationSchedule, OpportunityMaterialChange } from "./notification-types";
import { resolveOpportunityLifecycle } from "@/data/opportunity-lifecycle";

const activeStatuses = new Set(["Saved", "Interested", "Applying", "Submitted", "Interview"]);

async function notificationAnalytics(
  name: Parameters<typeof recordAnalyticsEvent>[0],
  userId: string,
  properties: Parameters<typeof recordAnalyticsEvent>[2],
) {
  await recordAnalyticsEvent(name, userId, properties).catch((error) => {
    console.warn("[UnlockED notifications] Analytics write failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
  });
}

function trackedRecord(account: AccountData, opportunityId: string) {
  return account.tracker?.[opportunityId] ?? account.activity?.tracked?.[opportunityId];
}

function trackedIds(account: AccountData) {
  return [...new Set([
    ...Object.keys(account.tracker ?? {}),
    ...Object.keys(account.activity?.tracked ?? {}),
    ...(account.savedOpportunities ?? []).map((item) => item.opportunityId),
  ])].slice(0, 1_000);
}

function latestReminderText(account: AccountData, opportunityId: string) {
  const record = trackedRecord(account, opportunityId);
  const entry = [...(record?.history ?? [])].reverse().find((item) => item.details?.reminderAt);
  return entry?.details?.reminderText?.replace(/\s+/g, " ").trim().slice(0, 160);
}

export async function syncUserNotificationSchedules(userId: string, accountInput?: AccountData, now = new Date()) {
  const account = accountInput ?? await readAccountData(userId);
  const syncVersion = notificationIdempotencyKey([
    account.updatedAt,
    account.preferences?.notifications?.updatedAt,
    Object.keys(account.tracker ?? {}).length,
    account.savedOpportunities?.length ?? 0,
    Object.values(account.calendarEvents ?? {}).map((event) => `${event.id}:${event.version}:${event.updatedAt}`).sort().join(","),
  ]);
  if (!await claimNotificationSync(userId, syncVersion)) return { tracked: trackedIds(account).length, scheduled: 0, skipped: true };
  await archiveExpiredNotifications(userId, now);
  const ids = trackedIds(account);
  const opportunities = await listPublishedOpportunitiesByIds(ids);
  const byId = new Map(opportunities.map((item) => [item.id, item]));
  let scheduled = 0;
  for (const id of ids) {
    const record = trackedRecord(account, id);
    const opportunity = byId.get(id);
    if (!record || !opportunity) continue;
    await registerTrackedRecipient(userId, id);
    const schedules = buildNotificationSchedules({
      userId,
      record,
      opportunity,
      preferences: account.preferences?.notifications,
      now,
    });
    for (const schedule of schedules) {
      if (schedule.type === "journey_reminder") schedule.customReminderText = latestReminderText(account, id);
      schedule.opportunityTitle = opportunity.title;
      schedule.organization = opportunity.organization;
      if (await scheduleNotification(schedule)) scheduled += 1;
    }
  }
  for (const event of Object.values(account.calendarEvents ?? {})) {
    const schedule = buildCalendarEventNotificationSchedule({ userId, event, preferences: account.preferences?.notifications, now });
    if (!schedule) continue;
    const opportunity = event.opportunityId ? byId.get(event.opportunityId) : undefined;
    schedule.opportunityTitle = opportunity?.title;
    schedule.organization = opportunity?.organization;
    if (await scheduleNotification(schedule)) scheduled += 1;
  }
  const preferences = normalizeNotificationPreferences(account.preferences?.notifications, now.toISOString());
  if (preferences.weeklyDigest) {
    const due = nextWeeklyDigestAt(now, preferences.timezone);
    if (due) {
      const week = due.toISOString().slice(0, 10);
      if (await scheduleNotification({
        id: notificationIdempotencyKey([userId, "weekly_digest", week]),
        userId,
        type: "weekly_digest",
        scheduledFor: due.toISOString(),
        contentVersion: week,
      })) scheduled += 1;
    }
  }
  return { tracked: ids.length, scheduled, skipped: false };
}

function changeBody(title: string, change: OpportunityMaterialChange) {
  return `${title}: ${change.before} → ${change.after}.`;
}

function deadlineRecord(schedule: NotificationSchedule, opportunity: Opportunity, account: AccountData, now: Date) {
  const record = trackedRecord(account, opportunity.id)!;
  const offset = schedule.offsetDays ?? 1;
  const priority: NotificationPriority = offset <= 1 ? "high" : "normal";
  const title = offset === 1 ? "Deadline tomorrow" : offset === 7 ? "Deadline this week" : `Deadline in ${offset} days`;
  return buildNotificationRecord({
    type: "deadline_reminder",
    priority,
    title,
    body: `${opportunity.title} is due ${offset === 1 ? "tomorrow" : `in ${offset} days`}. Confirm the exact requirements with the official source.`,
    organization: opportunity.organization,
    opportunityId: opportunity.id,
    journeyStatus: record.status,
    actionLabel: "View opportunity",
    actionHref: `/opportunities/${encodeURIComponent(opportunity.id)}`,
    relevantAt: schedule.scheduledFor,
    expiresAt: opportunity.application_deadline
      ? new Date(Date.parse(`${opportunity.application_deadline}T23:59:59.999Z`) + 86_400_000).toISOString()
      : undefined,
    contentVersion: schedule.contentVersion,
    idempotencyKey: schedule.id,
    now,
    preferences: normalizeNotificationPreferences(account.preferences?.notifications, now.toISOString()),
  });
}

function journeyReminderRecord(schedule: NotificationSchedule, opportunity: Opportunity | undefined, account: AccountData, now: Date) {
  const title = "Your reminder is due";
  const custom = schedule.customReminderText?.replace(/\s+/g, " ").trim().slice(0, 160);
  return buildNotificationRecord({
    type: "journey_reminder",
    priority: "high",
    title,
    body: custom || `Review your next step for ${opportunity?.title ?? schedule.opportunityTitle ?? "this Journey item"}.`,
    organization: opportunity?.organization ?? schedule.organization,
    opportunityId: schedule.opportunityId,
    journeyStatus: schedule.opportunityId ? trackedRecord(account, schedule.opportunityId)?.status : undefined,
    actionLabel: "Open Journey",
    actionHref: "/",
    relevantAt: schedule.scheduledFor,
    expiresAt: new Date(now.getTime() + 14 * 86_400_000).toISOString(),
    contentVersion: schedule.contentVersion,
    idempotencyKey: schedule.id,
    now,
    preferences: normalizeNotificationPreferences(account.preferences?.notifications, now.toISOString()),
  });
}

function followUpRecord(schedule: NotificationSchedule, opportunity: Opportunity | undefined, account: AccountData, now: Date) {
  const title = opportunity?.title ?? schedule.opportunityTitle ?? "This opportunity";
  const savedCheckIn = schedule.followUpKind === "saved_check_in";
  return buildNotificationRecord({
    type: "journey_follow_up",
    priority: "normal",
    title: savedCheckIn ? "Ready for a Journey update?" : "Has anything changed with this application?",
    body: savedCheckIn
      ? `${title} has been in your Journey for two weeks. Update it only if your progress has changed.`
      : `${title} is still marked as ${schedule.opportunityId ? trackedRecord(account, schedule.opportunityId)?.status ?? "active" : "active"}, and the listed deadline has passed.`,
    organization: opportunity?.organization ?? schedule.organization,
    opportunityId: schedule.opportunityId,
    journeyStatus: schedule.opportunityId ? trackedRecord(account, schedule.opportunityId)?.status : undefined,
    actionLabel: "Update Journey",
    actionHref: "/",
    relevantAt: schedule.scheduledFor,
    expiresAt: new Date(now.getTime() + 14 * 86_400_000).toISOString(),
    contentVersion: schedule.contentVersion,
    idempotencyKey: schedule.id,
    now,
    preferences: normalizeNotificationPreferences(account.preferences?.notifications, now.toISOString()),
  });
}

async function storeUsefulInAppNotification(input: {
  userId: string;
  account: AccountData;
  record: NotificationRecord;
  quality: Parameters<typeof evaluateNotificationQuality>[0];
}) {
  const preferences = normalizeNotificationPreferences(input.account.preferences?.notifications, input.record.createdAt);
  const quality = evaluateNotificationQuality(input.quality);
  if (!preferences.inAppEnabled || !notificationCategoryEnabled(input.record.type, preferences) || !quality.allowed) {
    await notificationAnalytics(productIntelligenceEvents.notificationSuppressed, input.userId, {
      category: input.record.type,
      channel: "in_app",
      suppressionReason: preferences.inAppEnabled ? quality.reason : "preference_or_account",
    });
    return { status: "suppressed" as const, reason: preferences.inAppEnabled ? quality.reason : "preference_or_account" as const };
  }
  const stored = await storeNotification(input.userId, input.record);
  if (!stored.duplicate) {
    await notificationAnalytics(productIntelligenceEvents.notificationGenerated, input.userId, {
      category: stored.record.type,
      channel: "in_app",
      priority: stored.record.priority,
      bundled: stored.record.bundledCount ? "yes" : "no",
    });
  }
  return { status: stored.duplicate ? "duplicate" as const : "generated" as const, record: stored.record };
}

export async function syncPersonalizedOpportunityNotification(input: {
  userId: string;
  account: AccountData;
  recommendations: readonly RecommendationViewModel[];
  catalogVersion: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const preferences = normalizeNotificationPreferences(input.account.preferences?.notifications, now.toISOString());
  if (!input.account.onboardingComplete || !preferences.inAppEnabled || !preferences.personalizedOpportunities) {
    return { status: "suppressed" as const, reason: "preference_or_account" };
  }
  const excluded = new Set([...trackedIds(input.account), ...(input.account.preferences?.hiddenDismissedIds ?? [])]);
  const candidate = selectPersonalizedNotificationCandidate(input.recommendations, excluded, now);
  if (!candidate?.opportunity) return { status: "suppressed" as const, reason: "no_strong_new_match" };
  const opportunity = candidate.opportunity;
  if (!await claimNotificationSync(input.userId, `personalized:${opportunity.id}`, 300)) {
    return { status: "duplicate" as const, reason: "recently_evaluated" };
  }
  const quality = {
    relevance: candidate.opportunityScore.value,
    usefulness: Math.max(85, candidate.recommendation.confidence),
    urgency: candidate.whyApplyNow?.urgency === "high" ? 95 : candidate.whyApplyNow?.urgency === "medium" ? 78 : 65,
    uniqueness: 100,
  };
  const idempotencyKey = notificationIdempotencyKey([input.userId, "new_personalized_opportunity", opportunity.id]);
  const record = buildNotificationRecord({
    type: "recommendation_update",
    priority: candidate.whyApplyNow?.urgency === "high" ? "high" : "normal",
    title: "A new opportunity fits your profile",
    body: `${opportunity.title} is a ${candidate.opportunityScore.label.toLowerCase()} based on your saved profile and eligibility.`,
    organization: opportunity.organization,
    opportunityId: opportunity.id,
    actionLabel: "Review match",
    actionHref: candidate.href,
    contentVersion: `${input.catalogVersion}:${opportunity.id}`,
    idempotencyKey,
    now,
    expiresAt: new Date(now.getTime() + 14 * 86_400_000).toISOString(),
    preferences,
  });
  return await storeUsefulInAppNotification({ userId: input.userId, account: input.account, record, quality });
}

function categoryLabel(opportunity: Opportunity) {
  const category = opportunity.category.toLowerCase();
  if (category.includes("intern")) return "internship";
  if (category.includes("scholar")) return "scholarship";
  if (category.includes("research")) return "research opportunity";
  return "opportunity";
}

function transitionCount(account: AccountData, transition: string) {
  return Object.values({ ...(account.activity?.tracked ?? {}), ...(account.tracker ?? {}) })
    .reduce((count, record) => count + (record.history ?? []).filter((entry) => entry.transition === transition).length, 0);
}

export async function queueJourneyMilestoneNotification(input: {
  userId: string;
  opportunityId: string;
  eventId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const account = await readAccountData(input.userId);
  const record = trackedRecord(account, input.opportunityId);
  if (!record) return { status: "suppressed" as const, reason: "missing_record" };
  const ids = trackedIds(account);
  const opportunities = await listPublishedOpportunitiesByIds(ids, { includeArchived: true });
  const opportunity = opportunities.find((item) => item.id === input.opportunityId);
  if (!opportunity) return { status: "suppressed" as const, reason: "missing_opportunity" };
  const event = (record.history ?? []).find((entry) => entry.id === input.eventId);
  const records = Object.values({ ...(account.activity?.tracked ?? {}), ...(account.tracker ?? {}) });
  const category = categoryLabel(opportunity);
  const opportunityById = new Map(opportunities.map((item) => [item.id, item]));
  const categoryRecords = records.filter((item) => {
    const itemOpportunity = opportunityById.get(item.id);
    return itemOpportunity ? categoryLabel(itemOpportunity) === category : false;
  });
  let title = "";
  let body = "";
  if (records.length === 1 && (record.version ?? 0) <= 1) {
    title = category === "opportunity" ? "Your Journey has begun" : `Your first ${category} is in your Journey`;
    body = `${opportunity.title} is now part of your private record of opportunities and progress.`;
  } else if (category !== "opportunity" && categoryRecords.length === 1 && (record.version ?? 0) <= 1) {
    title = `Your first ${category} is in your Journey`;
    body = `${opportunity.title} is now part of your private record of opportunities and progress.`;
  } else if (event?.transition === "interview" && transitionCount(account, "interview") === 1) {
    title = "Your first interview is recorded";
    body = `${opportunity.title} moved forward to an interview, a meaningful point in your Journey.`;
  } else if (event?.transition === "accept" && transitionCount(account, "accept") === 1) {
    title = "Your first acceptance is recorded";
    body = `${opportunity.title} is now recorded as an opportunity you received.`;
  } else if (event?.transition === "complete" && category === "research opportunity"
    && categoryRecords.filter((item) => item.status === "Completed").length === 1) {
    title = "Your first research experience is complete";
    body = `${opportunity.title} is now part of the experience you can draw on in future applications and interviews.`;
  } else if (event?.transition === "complete" && transitionCount(account, "complete") === 1) {
    title = "Your first completed experience is recorded";
    body = `${opportunity.title} is now part of your completed Journey.`;
  } else {
    return { status: "suppressed" as const, reason: "not_a_first_milestone" };
  }
  const preferences = normalizeNotificationPreferences(account.preferences?.notifications, now.toISOString());
  const notification = buildNotificationRecord({
    type: "milestone",
    priority: "normal",
    title,
    body,
    organization: opportunity.organization,
    opportunityId: opportunity.id,
    journeyStatus: record.status,
    actionLabel: "View Journey",
    actionHref: "/",
    contentVersion: input.eventId,
    idempotencyKey: notificationIdempotencyKey([input.userId, "milestone", input.eventId]),
    now,
    preferences,
  });
  return await storeUsefulInAppNotification({
    userId: input.userId,
    account,
    record: notification,
    quality: { relevance: 100, usefulness: 86, urgency: 55, uniqueness: 100 },
  });
}

export async function queueAccountNotification(input: {
  userId: string;
  eventId: string;
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
  priority?: NotificationPriority;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const account = await readAccountData(input.userId);
  const preferences = normalizeNotificationPreferences(account.preferences?.notifications, now.toISOString());
  const record = buildNotificationRecord({
    type: "account",
    priority: input.priority ?? "normal",
    title: input.title,
    body: input.body,
    actionLabel: input.actionLabel ?? "Open account",
    actionHref: input.actionHref ?? "/profile",
    contentVersion: input.eventId,
    idempotencyKey: notificationIdempotencyKey([input.userId, "account", input.eventId]),
    now,
    preferences,
  });
  return await storeUsefulInAppNotification({
    userId: input.userId,
    account,
    record,
    quality: { relevance: 100, usefulness: 100, urgency: input.priority === "high" ? 95 : 70, uniqueness: 100 },
  });
}

function changeRecord(schedule: NotificationSchedule, opportunity: Opportunity | undefined, account: AccountData, now: Date) {
  const change = schedule.change!;
  const changes = schedule.changes?.length ? schedule.changes : [change];
  const preferences = normalizeNotificationPreferences(account.preferences?.notifications, now.toISOString());
  const priority: NotificationPriority = changes.some((item) => item.field === "application_status" || item.field === "deadline") ? "high" : "normal";
  const title = opportunity?.title ?? schedule.opportunityTitle ?? "Saved opportunity";
  return buildNotificationRecord({
    type: "opportunity_change",
    priority,
    title: changes.length > 1 ? `${changes.length} important details changed` : change.label,
    body: changes.length > 1
      ? `${title} has updates to ${changes.map((item) => item.field.replaceAll("_", " ")).join(", ")}.`
      : changeBody(title, change),
    organization: opportunity?.organization ?? schedule.organization,
    opportunityId: schedule.opportunityId,
    journeyStatus: schedule.opportunityId ? trackedRecord(account, schedule.opportunityId)?.status : undefined,
    actionLabel: opportunity ? "View opportunity" : "Open Journey",
    actionHref: opportunity ? `/opportunities/${encodeURIComponent(opportunity.id)}` : "/",
    relevantAt: schedule.scheduledFor,
    expiresAt: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
    contentVersion: schedule.contentVersion,
    idempotencyKey: schedule.id,
    bundledCount: changes.length > 1 ? changes.length : undefined,
    now,
    preferences,
  });
}

async function queueEmailDelivery(userId: string, record: NotificationRecord, scheduledFor: Date, attempt: number) {
  return await scheduleNotification({
    id: notificationIdempotencyKey([userId, "email_delivery", record.id, attempt, scheduledFor.toISOString()]),
    userId,
    type: "email_delivery",
    notificationId: record.id,
    scheduledFor: scheduledFor.toISOString(),
    contentVersion: record.contentVersion,
    attempt,
  });
}

async function sendEmailIfEligible(userId: string, record: NotificationRecord, now: Date, attempt = 0) {
  if (record.channels.email.state !== "scheduled") return record;
  const suppression = await emailSuppressionReason(userId);
  if (suppression) {
    await notificationAnalytics(productIntelligenceEvents.notificationSuppressed, userId, {
      category: record.type,
      channel: "email",
      suppressionReason: suppression,
    });
    return await updateNotificationEmailDelivery(userId, record.id, { state: "suppressed", failureCode: suppression }) ?? record;
  }
  const account = await readAccountData(userId);
  const preferences = normalizeNotificationPreferences(account.preferences?.notifications, now.toISOString());
  if (inQuietHours(now, preferences) && record.type !== "journey_reminder") {
    await queueEmailDelivery(userId, record, nextAllowedEmailAt(now, preferences), attempt);
    return record;
  }
  const bucket = record.priority === "high" ? `${now.toISOString().slice(0, 13)}:urgent` : `${now.toISOString().slice(0, 10)}:standard`;
  if (attempt === 0 && !await claimEmailFrequency(userId, bucket, record.priority === "high" ? 3_600 : 86_400)) {
    await notificationAnalytics(productIntelligenceEvents.notificationSuppressed, userId, {
      category: record.type,
      channel: "email",
      suppressionReason: "frequency_cap",
    });
    return await updateNotificationEmailDelivery(userId, record.id, { state: "suppressed", failureCode: "frequency_cap" }) ?? record;
  }
  const user = await readAccountUser(userId);
  if (!user) return await updateNotificationEmailDelivery(userId, record.id, { state: "suppressed", failureCode: "account_missing" }) ?? record;
  const result = await sendNotificationEmail(record, user);
  if (result.status === "sent") {
    await registerProviderEmail(result.providerId, userId, record.id);
    return await updateNotificationEmailDelivery(userId, record.id, { state: "sent", attemptedAt: now.toISOString(), providerId: result.providerId }) ?? record;
  }
  if (result.status === "failed" && result.retryable && attempt < 2) {
    const retryAt = new Date(now.getTime() + 15 * 60_000 * 2 ** attempt);
    await queueEmailDelivery(userId, record, retryAt, attempt + 1);
    return await updateNotificationEmailDelivery(userId, record.id, {
      state: "scheduled",
      attemptedAt: now.toISOString(),
      failureCode: result.reason,
    }) ?? record;
  }
  return await updateNotificationEmailDelivery(userId, record.id, {
    state: result.status === "failed" ? "failed" : "suppressed",
    attemptedAt: now.toISOString(),
    failureCode: result.reason,
  }) ?? record;
}

function currentScheduleStillValid(schedule: NotificationSchedule, account: AccountData, opportunity: Opportunity | undefined, now: Date) {
  if (schedule.calendarEventId) {
    const event = account.calendarEvents?.[schedule.calendarEventId];
    if (!event) return false;
    return buildCalendarEventNotificationSchedule({
      userId: schedule.userId,
      event,
      preferences: account.preferences?.notifications,
      now: new Date(Math.min(now.getTime(), Date.parse(schedule.scheduledFor) - 1)),
    })?.id === schedule.id;
  }
  if (!opportunity) return false;
  const record = schedule.opportunityId ? trackedRecord(account, schedule.opportunityId) : undefined;
  if (!record || !activeStatuses.has(record.status)) return false;
  if (schedule.type === "follow_up" && schedule.followUpKind !== "saved_check_in") {
    return opportunity.metadata.deadlineType === "fixed"
      && opportunity.verification_status === "verified"
      && Boolean(opportunity.application_deadline)
      && Date.parse(`${opportunity.application_deadline}T23:59:59.999Z`) < now.getTime();
  }
  return buildNotificationSchedules({
    userId: schedule.userId,
    record,
    opportunity,
    preferences: account.preferences?.notifications,
    now: new Date(Math.min(now.getTime(), Date.parse(schedule.scheduledFor) - 1)),
  }).some((item) => item.id === schedule.id);
}

export async function processNotificationSchedule(schedule: NotificationSchedule, now = new Date()) {
  if (!await claimNotificationSchedule(schedule.id)) return { status: "duplicate" as const };
  try {
    const [account, opportunities] = await Promise.all([
      readAccountData(schedule.userId),
      schedule.opportunityId ? listPublishedOpportunitiesByIds([schedule.opportunityId]) : Promise.resolve([]),
    ]);
    if (schedule.type === "email_delivery") {
      const notification = schedule.notificationId ? await readNotificationById(schedule.userId, schedule.notificationId) : null;
      if (!notification || notification.channels.email.state !== "scheduled") {
        await completeNotificationSchedule(schedule.id);
        return { status: "suppressed" as const, reason: "stale_email" };
      }
      await sendEmailIfEligible(schedule.userId, notification, now, schedule.attempt ?? 0);
      await completeNotificationSchedule(schedule.id);
      return { status: "generated" as const, notificationId: notification.id };
    }
    const opportunity = opportunities[0];
    const preferences = normalizeNotificationPreferences(account.preferences?.notifications, now.toISOString());
    const mappedType = schedule.type === "deadline" ? "deadline_reminder"
      : schedule.type === "journey_reminder" ? "journey_reminder"
        : schedule.type === "follow_up" ? "journey_follow_up"
          : schedule.type === "opportunity_change" ? "opportunity_change"
            : "weekly_digest";
  if (!notificationCategoryEnabled(mappedType, preferences) || !account.onboardingComplete) {
      await completeNotificationSchedule(schedule.id);
      await notificationAnalytics(productIntelligenceEvents.notificationSuppressed, schedule.userId, {
        category: mappedType,
        channel: "in_app",
        suppressionReason: "preference_or_account",
      });
      return { status: "suppressed" as const, reason: "preference_or_account" };
    }
    if (schedule.type !== "opportunity_change" && schedule.type !== "weekly_digest") {
      if (!currentScheduleStillValid(schedule, account, opportunity, now)) {
        await completeNotificationSchedule(schedule.id);
        await notificationAnalytics(productIntelligenceEvents.notificationSuppressed, schedule.userId, {
          category: mappedType,
          channel: "in_app",
          suppressionReason: "stale",
        });
        return { status: "suppressed" as const, reason: "stale" };
      }
    }
    if (schedule.type === "opportunity_change") {
      const record = schedule.opportunityId ? trackedRecord(account, schedule.opportunityId) : undefined;
      if (!schedule.change || !record || !activeStatuses.has(record.status)) {
        await completeNotificationSchedule(schedule.id);
        await notificationAnalytics(productIntelligenceEvents.notificationSuppressed, schedule.userId, {
          category: mappedType,
          channel: "in_app",
          suppressionReason: "not_tracked",
        });
        return { status: "suppressed" as const, reason: "not_tracked" };
      }
    }
    let record = schedule.type === "deadline" && opportunity
      ? deadlineRecord(schedule, opportunity, account, now)
      : schedule.type === "journey_reminder"
        ? journeyReminderRecord(schedule, opportunity, account, now)
        : schedule.type === "follow_up"
          ? followUpRecord(schedule, opportunity, account, now)
          : schedule.type === "opportunity_change"
            ? changeRecord(schedule, opportunity, account, now)
            : null;
    if (schedule.type === "weekly_digest") {
      const recent = (await readNotifications(schedule.userId, 0, 20)).notifications
        .filter((item) => item.type !== "weekly_digest" && Date.parse(item.createdAt) >= now.getTime() - 7 * 86_400_000)
        .slice(0, 7);
      if (recent.length) {
        record = buildNotificationRecord({
          type: "weekly_digest",
          priority: "normal",
          title: "Your weekly UnlockED summary",
          body: recent.length === 1 ? "One useful update is ready to review." : `${recent.length} useful updates are ready to review.`,
          actionLabel: "Review updates",
          actionHref: "/notifications",
          contentVersion: schedule.contentVersion,
          idempotencyKey: schedule.id,
          now,
          preferences,
          bundledCount: recent.length,
        });
      }
    }
    if (!record) {
      await completeNotificationSchedule(schedule.id);
      await notificationAnalytics(
        schedule.type === "weekly_digest" ? productIntelligenceEvents.notificationDigestSkipped : productIntelligenceEvents.notificationSuppressed,
        schedule.userId,
        schedule.type === "weekly_digest"
          ? { suppressionReason: "no_meaningful_content" }
          : { category: mappedType, channel: "in_app", suppressionReason: "no_content" },
      );
      if (schedule.type === "weekly_digest") await syncUserNotificationSchedules(schedule.userId, account, new Date(now.getTime() + 60_000));
      return { status: "suppressed" as const, reason: "empty_digest" };
    }
    const quality = evaluateNotificationQuality(schedule.type === "deadline"
      ? { relevance: 100, usefulness: 96, urgency: (schedule.offsetDays ?? 1) <= 3 ? 100 : 82, uniqueness: 100 }
      : schedule.type === "opportunity_change"
        ? { relevance: 100, usefulness: 92, urgency: record.priority === "high" ? 92 : 70, uniqueness: 100 }
        : schedule.type === "weekly_digest"
          ? { relevance: 82, usefulness: 78, urgency: 55, uniqueness: 85 }
          : { relevance: 95, usefulness: 84, urgency: record.priority === "high" ? 90 : 65, uniqueness: 100 });
    if (!quality.allowed) {
      await completeNotificationSchedule(schedule.id);
      await notificationAnalytics(productIntelligenceEvents.notificationSuppressed, schedule.userId, {
        category: mappedType,
        channel: "in_app",
        suppressionReason: quality.reason,
      });
      return { status: "suppressed" as const, reason: quality.reason };
    }
    const stored = await storeNotification(schedule.userId, record);
    if (!stored.duplicate) {
      await notificationAnalytics(productIntelligenceEvents.notificationGenerated, schedule.userId, {
        category: stored.record.type,
        channel: stored.record.channels.inApp.state === "delivered" ? "in_app" : "email",
        priority: stored.record.priority,
        bundled: stored.record.bundledCount ? "yes" : "no",
      });
      if (schedule.type === "weekly_digest") {
        await notificationAnalytics(productIntelligenceEvents.notificationDigestGenerated, schedule.userId, {
          bundled: String(Math.min(stored.record.bundledCount ?? 0, 7)),
        });
      }
    }
    await sendEmailIfEligible(schedule.userId, stored.record, now);
    await completeNotificationSchedule(schedule.id);
    if (schedule.type === "opportunity_change") {
      await syncUserNotificationSchedules(schedule.userId, account, new Date(now.getTime() + 60_000)).catch((error) => {
        console.warn("[UnlockED notifications] Changed opportunity schedule sync failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
      });
    }
    if (schedule.type === "weekly_digest") await syncUserNotificationSchedules(schedule.userId, account, new Date(now.getTime() + 60_000));
    return { status: stored.duplicate ? "duplicate" as const : "generated" as const, notificationId: stored.record.id };
  } catch (error) {
    await releaseNotificationSchedule(schedule.id);
    throw error;
  }
}

export async function processDueNotificationBatch(now = new Date(), limit = 100) {
  const schedules = await readDueNotificationSchedules(now, Math.min(Math.max(limit, 1), 100));
  const results: Array<{ id: string; status: string }> = [];
  for (const schedule of schedules) {
    try {
      const result = await processNotificationSchedule(schedule, now);
      results.push({ id: schedule.id, status: result.status });
    } catch (error) {
      console.error("[UnlockED notifications] Scheduled item failed", {
        type: schedule.type,
        errorCategory: error instanceof Error ? error.name : "unknown",
      });
      results.push({ id: schedule.id, status: "failed" });
    }
  }
  return {
    processed: results.length,
    generated: results.filter((item) => item.status === "generated").length,
    suppressed: results.filter((item) => item.status === "suppressed").length,
    duplicates: results.filter((item) => item.status === "duplicate").length,
    failed: results.filter((item) => item.status === "failed").length,
  };
}

export async function queueMaterialOpportunityChanges(before: Opportunity, after: Opportunity, now = new Date()) {
  const lifecycle = resolveOpportunityLifecycle(after, now);
  const changes = detectMaterialOpportunityChanges(before, after).filter((change) => (
    change.field === "application_status"
      ? ["confirmed", "strong"].includes(lifecycle.confidence)
      : after.verification_status === "verified"
  ));
  if (!changes.length) return { changes: 0, recipients: 0, scheduled: 0 };
  const recipients = await trackedRecipients(after.id);
  let scheduled = 0;
  for (const userId of recipients) {
    const contentVersion = notificationIdempotencyKey(changes.map((change) => change.contentVersion));
    const id = notificationIdempotencyKey([userId, "opportunity_change", after.id, contentVersion]);
    if (await scheduleNotification({
      id,
      userId,
      type: "opportunity_change",
      opportunityId: after.id,
      opportunityTitle: after.title,
      organization: after.organization,
      scheduledFor: now.toISOString(),
      contentVersion,
      change: changes[0],
      changes,
    })) scheduled += 1;
  }
  return { changes: changes.length, recipients: recipients.length, scheduled };
}

export async function readNotificationCenter(userId: string, offset = 0, limit = 30) {
  return await readNotifications(userId, offset, limit);
}
