import "server-only";

import type { StudentProfile } from "@/data/student-profile";
import type { ReturnBriefingItem, ReturnBriefingModel } from "@/data/return-experience";
import type { NotificationRecord } from "./notification-types";
import type { JourneyCommandCenterModel, JourneyCommandRecord } from "./journey-command-center";
import { calendarDaysAway } from "./journey-calendar";

type RankedItem = ReturnBriefingItem & { rank: number; occurredAt: string };
const dayMs = 86_400_000;

function safeTime(value: string | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function localHour(now: Date, timezone: string) {
  try {
    const value = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(now);
    return Number(value);
  } catch {
    return now.getUTCHours();
  }
}

function greeting(profile: StudentProfile, now: Date, timezone: string) {
  const hour = localHour(now, timezone);
  const period = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const name = profile.firstName?.trim();
  return `Good ${period}${name ? `, ${name}` : ""}`;
}

function timingTitle(title: string, days: number) {
  if (days < 0) return `${title} needs a status review`;
  if (days === 0) return `${title} is due today`;
  if (days === 1) return `${title} is due tomorrow`;
  return `${title} closes in ${days} days`;
}

function applicationItem(record: JourneyCommandRecord, days: number, date: string): RankedItem | null {
  const workspace = record.applicationWorkspace;
  if (!workspace || workspace.submitted) return null;
  const detail = workspace.readyForSubmission
    ? "Your application checklist is complete. Confirm when you’ve submitted it."
    : workspace.unfinishedCount
      ? `You have ${workspace.unfinishedCount} application ${workspace.unfinishedCount === 1 ? "task" : "tasks"} remaining.`
      : "Continue preparing your application."
  return {
    id: `application:${record.id}:${date}`,
    kind: "application",
    title: workspace.readyForSubmission ? "Application looks ready" : timingTitle(record.title, days),
    detail,
    meta: `${record.title} · ${workspace.completedCount}/${workspace.totalCount} tasks complete`,
    href: `/#journey-record-${encodeURIComponent(record.id)}`,
    actionLabel: workspace.readyForSubmission ? "Review application" : "Continue application",
    urgency: days <= 1 ? "critical" : "high",
    opportunityId: record.id,
    applicationTargetId: `journey-record-details-${record.id}`,
    dismissible: false,
    rank: workspace.readyForSubmission ? 970 : days <= 0 ? 1_000 : days === 1 ? 960 : 870 - days,
    occurredAt: date,
  };
}

function deadlineItems(model: JourneyCommandCenterModel, now: Date): RankedItem[] {
  const records = new Map(model.activeRecords.map((record) => [record.id, record]));
  return model.calendar.items.flatMap((calendar): RankedItem[] => {
    if (calendar.completed || calendar.dismissed || calendar.statusAwarePassed || !["application_deadline", "personal_target", "essay_deadline"].includes(calendar.type)) return [];
    const days = calendarDaysAway(calendar.date, now, model.calendar.timezone);
    if (days < -7 || days > 7) return [];
    const record = calendar.opportunityId ? records.get(calendar.opportunityId) : undefined;
    if (record) {
      const application = applicationItem(record, days, calendar.date);
      if (application) return [application];
    }
    const title = calendar.opportunityTitle ?? calendar.title;
    return [{
      id: `deadline:${calendar.id}:${calendar.date}`,
      kind: "deadline",
      title: timingTitle(title, days),
      detail: calendar.type === "application_deadline" ? "Review the official requirements before submitting." : calendar.title,
      meta: calendar.organization,
      href: calendar.opportunityId ? `/opportunities/${encodeURIComponent(calendar.opportunityId)}` : "/#journey-calendar",
      actionLabel: "View deadline",
      urgency: days <= 1 ? "critical" : "high",
      opportunityId: calendar.opportunityId,
      dismissible: false,
      rank: days <= 0 ? 990 : days === 1 ? 950 : 840 - days,
      occurredAt: calendar.date,
    }];
  });
}

function freshNotifications(records: readonly NotificationRecord[], freshnessCutoff: string | undefined) {
  const cutoff = safeTime(freshnessCutoff);
  return records.filter((record) => !record.readAt && !record.dismissedAt && safeTime(record.createdAt) > cutoff);
}

function notificationItems(records: readonly NotificationRecord[], freshnessCutoff: string | undefined): RankedItem[] {
  const fresh = freshNotifications(records, freshnessCutoff);
  const changes = fresh.filter((record) => record.type === "opportunity_change").map((record): RankedItem => ({
    id: `notification:${record.id}`,
    kind: "opportunity_change",
    title: record.title,
    detail: record.body,
    meta: record.organization,
    href: record.actionHref,
    actionLabel: "View update",
    urgency: record.priority === "critical" || record.priority === "high" ? "high" : "normal",
    notificationId: record.id,
    opportunityId: record.opportunityId,
    dismissible: true,
    rank: record.priority === "critical" || record.priority === "high" ? 790 : 700,
    occurredAt: record.createdAt,
  }));
  const recommendations = fresh.filter((record) => record.type === "recommendation_update");
  const recommendation = recommendations.length ? [{
    id: `recommendations:${recommendations.map((record) => record.id).sort().join(":")}`,
    kind: "recommendation" as const,
    title: recommendations.length === 1 ? "A new match fits your profile" : `${recommendations.length} new matches fit your profile`,
    detail: recommendations.length === 1 ? recommendations[0]!.body : "New opportunities passed UnlockED’s recommendation safeguards.",
    href: "/advisor",
    actionLabel: "See matches",
    urgency: "normal" as const,
    notificationId: recommendations.length === 1 ? recommendations[0]!.id : undefined,
    dismissible: recommendations.length === 1,
    rank: 560,
    occurredAt: recommendations[0]!.createdAt,
  }] satisfies RankedItem[] : [];
  const important = fresh.filter((record) => record.priority === "critical" || record.priority === "high")
    .filter((record) => !["deadline_reminder", "opportunity_change", "recommendation_update"].includes(record.type));
  const notification = important.length ? [{
    id: `notifications:${important.map((record) => record.id).sort().join(":")}`,
    kind: "notification" as const,
    title: important.length === 1 ? important[0]!.title : `${important.length} important updates while you were away`,
    detail: important.length === 1 ? important[0]!.body : "Review the latest important activity in Notifications.",
    href: important.length === 1 ? important[0]!.actionHref : "/notifications",
    actionLabel: important.length === 1 ? important[0]!.actionLabel : "View updates",
    urgency: "high" as const,
    notificationId: important.length === 1 ? important[0]!.id : undefined,
    dismissible: important.length === 1,
    rank: 760,
    occurredAt: important[0]!.createdAt,
  }] satisfies RankedItem[] : [];
  return [...changes, ...recommendation, ...notification];
}

function continuationItems(model: JourneyCommandCenterModel, now: Date): RankedItem[] {
  return model.activeRecords.flatMap((record): RankedItem[] => {
    if (["Saved", "Paused"].includes(record.status) || safeTime(record.updatedAt) < now.getTime() - 30 * dayMs) return [];
    const workspace = record.applicationWorkspace;
    return [{
      id: `continuation:${record.id}:${record.updatedAt}`,
      kind: workspace && !workspace.submitted ? "application" : "continuation",
      title: workspace && !workspace.submitted ? `Continue ${record.title}` : `Return to ${record.title}`,
      detail: workspace?.totalCount ? `${workspace.completedCount} of ${workspace.totalCount} application tasks complete.` : record.statusDetail,
      meta: `${record.stageLabel} · ${record.organization}`,
      href: `/#journey-record-${encodeURIComponent(record.id)}`,
      actionLabel: workspace && !workspace.submitted ? "Continue application" : "Continue in Journey",
      urgency: "normal",
      opportunityId: record.id,
      applicationTargetId: workspace && !workspace.submitted ? `journey-record-details-${record.id}` : undefined,
      dismissible: false,
      rank: workspace && !workspace.submitted ? 520 : 420,
      occurredAt: record.updatedAt,
    }];
  });
}

export function buildReturnBriefing(input: {
  profile: StudentProfile;
  journey: JourneyCommandCenterModel;
  notifications?: readonly NotificationRecord[];
  freshnessCutoff?: string;
  now?: Date;
}): ReturnBriefingModel | null {
  const now = input.now ?? new Date();
  const notificationRecords = input.notifications ?? [];
  const meaningfulActivity = input.journey.activeCount + input.journey.historyCount > 0 || notificationRecords.some((record) => !record.readAt);
  if (!meaningfulActivity) return null;
  const ranked = [
    ...deadlineItems(input.journey, now),
    ...notificationItems(notificationRecords, input.freshnessCutoff),
    ...continuationItems(input.journey, now),
  ].sort((left, right) => right.rank - left.rank || safeTime(right.occurredAt) - safeTime(left.occurredAt) || left.id.localeCompare(right.id));
  const selected: RankedItem[] = [];
  const opportunities = new Set<string>();
  for (const item of ranked) {
    if (item.opportunityId && opportunities.has(item.opportunityId)) continue;
    selected.push(item);
    if (item.opportunityId) opportunities.add(item.opportunityId);
    if (selected.length === 3) break;
  }
  return {
    greeting: greeting(input.profile, now, input.journey.calendar.timezone),
    heading: selected.length ? "Here’s what matters right now." : "You’re all caught up.",
    items: selected.map(({ rank: _rank, occurredAt: _occurredAt, ...item }) => item),
    allCaughtUp: selected.length === 0,
    generatedAt: now.toISOString(),
  };
}
