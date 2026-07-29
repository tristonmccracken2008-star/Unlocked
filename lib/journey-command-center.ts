import type { Opportunity } from "@/data/opportunities";
import { resolveOpportunityLifecycle } from "@/data/opportunity-lifecycle";
import {
  getJourneyProfessionalActions,
  getJourneyProfessionalWorkflow,
  resolveJourneyProfessionalStage,
} from "@/data/journey-professional";
import type {
  JourneyMilestoneDetails,
  OpportunityTrackerStatus,
  TrackedOpportunity,
} from "@/data/student-activity";
import { resolveOrganizationLogo } from "@/data/organization-logos";
import type { AccountData, AuthUser } from "./account-types";
import type { JourneyTimelineControl, JourneyTimelineModel } from "./journey-timeline";
import { buildJourneyTimelineModel } from "./journey-timeline";

export const journeyCommandFilters = ["active", "saved", "preparing", "applied", "interviewing", "offers", "accepted", "paused", "history"] as const;
export type JourneyCommandFilter = (typeof journeyCommandFilters)[number];
export const journeyCommandSorts = ["attention", "deadline", "recent", "added", "organization"] as const;
export type JourneyCommandSort = (typeof journeyCommandSorts)[number];

export type JourneyCommandRecord = {
  id: string;
  title: string;
  organization: string;
  category: string;
  status: OpportunityTrackerStatus;
  stageLabel: string;
  stageFilter: JourneyCommandFilter;
  savedAt: string;
  updatedAt: string;
  nextDate?: {
    label: string;
    value: string;
    urgency: "normal" | "approaching" | "due_soon" | "tomorrow" | "today" | "overdue";
    timingLabel: string;
    daysAway: number;
  };
  statusDetail: string;
  lifecycle?: { label: string; state: string; actionable: boolean };
  latestDetails?: JourneyMilestoneDetails;
  history: Array<{ id: string; label: string; transition: string; occurredAt: string; details?: JourneyMilestoneDetails }>;
  opportunity?: Opportunity;
  control?: JourneyTimelineControl;
  unavailable: boolean;
};

export type JourneyAttentionItem = {
  id: string;
  recordId: string;
  title: string;
  reason: string;
  priority: 1 | 2 | 3 | 4;
  date?: string;
};

export type JourneyHistoryGroup = {
  year: string;
  records: JourneyCommandRecord[];
  count: number;
  completed: number;
  closed: number;
  archived: number;
};

export type JourneyOverviewCard = {
  id: "next_deadline" | "waiting_on" | "newest_milestone" | "year";
  label: string;
  value: string;
  title: string;
  detail: string;
  href: string;
  tone: "primary" | "warm" | "milestone" | "neutral";
};

export type JourneyCommandCenterModel = {
  accountKey: string;
  overview: JourneyOverviewCard[];
  attention: JourneyAttentionItem[];
  attentionCount: number;
  activeRecords: JourneyCommandRecord[];
  historyGroups: JourneyHistoryGroup[];
  activeCount: number;
  matchingActiveCount: number;
  shownActiveCount: number;
  historyCount: number;
  unavailableCount: number;
  shownHistoryCount: number;
  trackedIds: string[];
  filterCounts: Record<JourneyCommandFilter, number>;
  filter: JourneyCommandFilter;
  sort: JourneyCommandSort;
  query: string;
  activeLimit: number;
  card: JourneyTimelineModel["card"];
  cardEligible: boolean;
  theme: JourneyTimelineModel["theme"];
  showFirstUseHints: boolean;
};

const terminalStatuses = new Set<OpportunityTrackerStatus>(["Rejected", "Completed"]);
const validationTransitions = new Set(["interview", "accept", "complete"]);

function safeTime(value: string | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysUntil(value: string, now: Date) {
  return Math.ceil((safeTime(value) - now.getTime()) / 86_400_000);
}

export function journeyDeadlineTiming(deadline: string, now: Date, timezone = "UTC") {
  let localDate = now.toISOString().slice(0, 10);
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(now);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    localDate = `${value.year}-${value.month}-${value.day}`;
  } catch {
    timezone = "UTC";
  }
  const days = Math.round((Date.parse(`${deadline}T00:00:00.000Z`) - Date.parse(`${localDate}T00:00:00.000Z`)) / 86_400_000);
  if (days < 0) return { urgency: "overdue" as const, timingLabel: "Overdue", timezone, daysAway: days };
  if (days === 0) return { urgency: "today" as const, timingLabel: "Due today", timezone, daysAway: days };
  if (days === 1) return { urgency: "tomorrow" as const, timingLabel: "Due tomorrow", timezone, daysAway: days };
  if (days <= 6) return { urgency: "due_soon" as const, timingLabel: `Due in ${days} days`, timezone, daysAway: days };
  if (days <= 14) return { urgency: "approaching" as const, timingLabel: `Approaching · ${days} days`, timezone, daysAway: days };
  return { urgency: "normal" as const, timingLabel: "Official deadline", timezone, daysAway: days };
}

function latestDetails(record: TrackedOpportunity) {
  return [...(record.history ?? [])].reverse().find((item) => item.details)?.details;
}

function stageFilter(record: TrackedOpportunity, stageId: string): JourneyCommandFilter {
  if (terminalStatuses.has(record.status)) return "history";
  if (record.status === "Saved") return "saved";
  if (record.status === "Interested" || record.status === "Applying") return "preparing";
  if (record.status === "Submitted") return "applied";
  if (record.status === "Interview") return "interviewing";
  if (record.status === "Paused") return "paused";
  if (record.status === "Accepted" && /offer|award|winner/i.test(stageId)) return "offers";
  if (record.status === "Accepted") return "accepted";
  return "active";
}

function statusDetail(record: TrackedOpportunity, details: JourneyMilestoneDetails | undefined, stageLabel: string) {
  if (details?.reminderText) return details.reminderText;
  if (record.status === "Saved") return "Saved for review";
  if (record.status === "Paused") return "Paused by you";
  if (record.status === "Rejected") return stageLabel === "Archived" ? "Kept in History" : "Closed by you";
  if (record.status === "Completed") return "Completed and preserved in History";
  return `Current stage: ${stageLabel}`;
}

function nextRelevantDate(opportunity: Opportunity | undefined, details: JourneyMilestoneDetails | undefined, now: Date, timezone: string) {
  const candidates: Array<{ label: string; value: string }> = [];
  if (details?.reminderAt) candidates.push({ label: "Reminder", value: details.reminderAt });
  if (opportunity?.application_deadline) candidates.push({ label: "Official deadline", value: `${opportunity.application_deadline}T23:59:59.999Z` });
  const next = candidates.sort((left, right) => safeTime(left.value) - safeTime(right.value))[0];
  if (!next) return undefined;
  if (next.label === "Official deadline" && opportunity?.application_deadline) {
    return { ...next, ...journeyDeadlineTiming(opportunity.application_deadline, now, timezone) };
  }
  const days = daysUntil(next.value, now);
  if (days < 0) return { ...next, urgency: "overdue" as const, timingLabel: "Overdue", daysAway: days };
  if (days === 0) return { ...next, urgency: "today" as const, timingLabel: "Due today", daysAway: days };
  if (days === 1) return { ...next, urgency: "tomorrow" as const, timingLabel: "Due tomorrow", daysAway: days };
  if (days <= 6) return { ...next, urgency: "due_soon" as const, timingLabel: `Due in ${days} days`, daysAway: days };
  if (days <= 14) return { ...next, urgency: "approaching" as const, timingLabel: `Approaching · ${days} days`, daysAway: days };
  return { ...next, urgency: "normal" as const, timingLabel: next.label, daysAway: days };
}

function controlFor(record: TrackedOpportunity, opportunity: Opportunity, now: Date): JourneyTimelineControl | undefined {
  const workflow = getJourneyProfessionalWorkflow(opportunity);
  const actions = getJourneyProfessionalActions(record, workflow);
  if (!actions.length) return undefined;
  const inactiveDays = Math.max(0, Math.floor((now.getTime() - safeTime(record.updatedAt)) / 86_400_000));
  return {
    opportunityId: record.id,
    opportunityTitle: opportunity.title,
    organization: opportunity.organization,
    branding: resolveOrganizationLogo(opportunity),
    workflow,
    currentStageId: resolveJourneyProfessionalStage(record, workflow).id,
    status: record.status,
    version: record.version ?? 0,
    actions,
    details: latestDetails(record),
    inactiveDays: inactiveDays >= 30 && !["Saved", "Paused"].includes(record.status) ? inactiveDays : undefined,
  };
}

function projectRecord(record: TrackedOpportunity, opportunity: Opportunity | undefined, now: Date, timezone: string): JourneyCommandRecord {
  const workflow = opportunity ? getJourneyProfessionalWorkflow(opportunity) : undefined;
  const resolvedStage = workflow ? resolveJourneyProfessionalStage(record, workflow) : undefined;
  const stageLabel = resolvedStage?.label
    ?? (record.status === "Interview" ? "Interviewing" : record.status === "Rejected" ? "Closed" : record.status);
  const details = latestDetails(record);
  const lifecycle = opportunity ? resolveOpportunityLifecycle(opportunity, now) : undefined;
  return {
    id: record.id,
    title: opportunity?.title ?? "Unavailable opportunity",
    organization: opportunity?.organization ?? "Original listing unavailable",
    category: opportunity?.category ?? "Legacy record",
    status: record.status,
    stageLabel,
    stageFilter: stageFilter(record, resolvedStage?.id ?? ""),
    savedAt: record.savedAt,
    updatedAt: record.updatedAt,
    nextDate: nextRelevantDate(opportunity, details, now, timezone),
    statusDetail: statusDetail(record, details, stageLabel),
    lifecycle: lifecycle ? { label: lifecycle.label, state: lifecycle.displayState, actionable: lifecycle.actionable } : undefined,
    latestDetails: details,
    history: [...(record.history ?? [])].slice(-10).reverse().map((item) => ({
      id: item.id,
      label: item.professionalStageId?.replaceAll("_", " ") ?? item.transition,
      transition: item.transition,
      occurredAt: item.occurredAt,
      details: item.details,
    })),
    opportunity,
    control: opportunity ? controlFor(record, opportunity, now) : undefined,
    unavailable: !opportunity,
  };
}

function attentionItems(records: readonly JourneyCommandRecord[], now: Date): JourneyAttentionItem[] {
  const items: JourneyAttentionItem[] = [];
  for (const record of records) {
    const date = record.nextDate;
    if (date?.label === "Reminder" && date.urgency === "overdue") {
      items.push({ id: `reminder-overdue:${record.id}`, recordId: record.id, title: record.title, reason: "A reminder you set is overdue.", priority: 1, date: date.value });
    } else if (date?.label === "Reminder" && date.urgency !== "normal") {
      items.push({ id: `reminder-soon:${record.id}`, recordId: record.id, title: record.title, reason: "A reminder you set is approaching.", priority: 2, date: date.value });
    }
    if (date?.label === "Official deadline" && date.urgency !== "normal" && date.urgency !== "overdue") {
      const days = Math.max(0, date.daysAway);
      items.push({ id: `deadline:${record.id}`, recordId: record.id, title: record.title, reason: days === 0 ? "The confirmed application deadline is today." : days === 1 ? "The confirmed application deadline is tomorrow." : `The confirmed application deadline is in ${days} days.`, priority: days <= 1 ? 1 : 2, date: date.value });
    }
    if (record.lifecycle && ["canceled", "closed", "temporarily_closed"].includes(record.lifecycle.state) && !["Saved", "Paused"].includes(record.status)) {
      items.push({ id: `lifecycle:${record.id}`, recordId: record.id, title: record.title, reason: `${record.lifecycle.label}. Your Journey stage remains ${record.stageLabel}.`, priority: record.lifecycle.state === "canceled" ? 1 : 3 });
    }
    const inactiveDays = Math.floor((now.getTime() - safeTime(record.updatedAt)) / 86_400_000);
    if (inactiveDays >= 45 && !["Saved", "Paused"].includes(record.status)) {
      items.push({ id: `inactive:${record.id}`, recordId: record.id, title: record.title, reason: `This active record has not been updated in ${inactiveDays} days.`, priority: 4 });
    }
  }
  return items.sort((left, right) => left.priority - right.priority || safeTime(left.date) - safeTime(right.date) || left.title.localeCompare(right.title));
}

function compareRecords(sort: JourneyCommandSort) {
  return (left: JourneyCommandRecord, right: JourneyCommandRecord) => {
    if (sort === "organization") return left.organization.localeCompare(right.organization) || left.title.localeCompare(right.title);
    if (sort === "added") return safeTime(right.savedAt) - safeTime(left.savedAt);
    if (sort === "deadline") return (safeTime(left.nextDate?.value) || Number.MAX_SAFE_INTEGER) - (safeTime(right.nextDate?.value) || Number.MAX_SAFE_INTEGER) || safeTime(right.updatedAt) - safeTime(left.updatedAt);
    return safeTime(right.updatedAt) - safeTime(left.updatedAt);
  };
}

function meaningfulYear(record: JourneyCommandRecord) {
  const value = record.history[0]?.occurredAt ?? record.updatedAt ?? record.savedAt;
  const year = new Date(value).getUTCFullYear();
  return Number.isFinite(year) ? String(year) : "Earlier";
}

function historyYear(record: JourneyCommandRecord, currentYear: number) {
  const year = Number(meaningfulYear(record));
  if (!Number.isFinite(year) || year < currentYear - 1) return "Earlier";
  return String(year);
}

function matchesQuery(record: JourneyCommandRecord, query: string) {
  if (!query) return true;
  const normalized = query.toLocaleLowerCase();
  return `${record.title} ${record.organization} ${record.latestDetails?.notes ?? ""}`.toLocaleLowerCase().includes(normalized);
}

function overviewCards(records: readonly JourneyCommandRecord[], now: Date): JourneyOverviewCard[] {
  const active = records.filter((record) => !terminalStatuses.has(record.status));
  const verifiedDeadline = active
    .filter((record) => record.opportunity?.application_deadline && record.opportunity.verification_status === "verified")
    .map((record) => ({
      record,
      value: `${record.opportunity!.application_deadline}T23:59:59.999Z`,
    }))
    .filter((item) => safeTime(item.value) >= now.getTime())
    .sort((left, right) => safeTime(left.value) - safeTime(right.value))[0];
  const waitingOn = active
    .filter((record) => ["interviewing", "offers", "accepted"].includes(record.stageFilter) && record.latestDetails?.reminderAt)
    .map((record) => ({ record, value: record.latestDetails!.reminderAt! }))
    .filter((item) => safeTime(item.value) >= now.getTime())
    .sort((left, right) => safeTime(left.value) - safeTime(right.value))[0];
  const newestMilestone = records
    .flatMap((record) => record.history.filter((item) => validationTransitions.has(item.transition)).map((item) => ({ record, item })))
    .sort((left, right) => safeTime(right.item.occurredAt) - safeTime(left.item.occurredAt))[0];
  const currentYear = now.getUTCFullYear();
  const yearEvents = records.flatMap((record) => record.history.filter((item) => new Date(item.occurredAt).getUTCFullYear() === currentYear));
  const yearMilestones = yearEvents.filter((item) => validationTransitions.has(item.transition)).length;
  const yearInterviews = yearEvents.filter((item) => item.transition === "interview").length;
  const yearOffers = yearEvents.filter((item) => item.transition === "accept").length;
  const yearSaved = yearEvents.filter((item) => item.transition === "choose").length;
  const cards: JourneyOverviewCard[] = [];
  if (verifiedDeadline) {
    const days = Math.max(0, daysUntil(verifiedDeadline.value, now));
    cards.push({
      id: "next_deadline",
      label: "Next deadline",
      value: days === 0 ? "Today" : `${days} ${days === 1 ? "day" : "days"}`,
      title: verifiedDeadline.record.title,
      detail: `Due ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(verifiedDeadline.value))}`,
      href: `#journey-record-${verifiedDeadline.record.id}`,
      tone: "primary",
    });
  }
  if (waitingOn) {
    cards.push({
      id: "waiting_on",
      label: "Waiting on",
      value: waitingOn.record.stageLabel,
      title: waitingOn.record.title,
      detail: `Reminder ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(waitingOn.value))}`,
      href: `#journey-record-${waitingOn.record.id}`,
      tone: "warm",
    });
  }
  if (newestMilestone) {
    cards.push({
      id: "newest_milestone",
      label: "Newest milestone",
      value: newestMilestone.record.stageLabel,
      title: newestMilestone.record.title,
      detail: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(newestMilestone.item.occurredAt)),
      href: `#journey-record-${newestMilestone.record.id}`,
      tone: "milestone",
    });
  }
  if (yearEvents.length) {
    cards.push({
      id: "year",
      label: "This year",
      value: yearMilestones
        ? `${yearMilestones} ${yearMilestones === 1 ? "milestone" : "milestones"}`
        : `${yearEvents.length} recorded ${yearEvents.length === 1 ? "update" : "updates"}`,
      title: yearOffers || yearInterviews
        ? `${yearOffers} ${yearOffers === 1 ? "offer" : "offers"} · ${yearInterviews} ${yearInterviews === 1 ? "interview" : "interviews"}`
        : `${yearSaved} ${yearSaved === 1 ? "opportunity" : "opportunities"} saved`,
      detail: `${yearEvents.length} recorded ${yearEvents.length === 1 ? "update" : "updates"}`,
      href: "#journey-history",
      tone: "neutral",
    });
  }
  return cards;
}

export function buildJourneyCommandCenterModel(input: {
  user: Pick<AuthUser, "id" | "name">;
  account: AccountData;
  opportunities: readonly Opportunity[];
  resolvedTheme?: "light" | "dark";
  now?: Date;
  filter?: string;
  sort?: string;
  query?: string;
  historyLimit?: number;
  activeLimit?: number;
}): JourneyCommandCenterModel {
  const now = input.now ?? new Date();
  const filter = journeyCommandFilters.includes(input.filter as JourneyCommandFilter) ? input.filter as JourneyCommandFilter : "active";
  const sort = journeyCommandSorts.includes(input.sort as JourneyCommandSort) ? input.sort as JourneyCommandSort : "attention";
  const query = (input.query ?? "").trim().slice(0, 100);
  const timezone = input.account.preferences?.notifications?.timezone ?? "UTC";
  const opportunityById = new Map(input.opportunities.map((item) => [item.id, item]));
  const recordsById = { ...(input.account.activity?.tracked ?? {}), ...(input.account.tracker ?? {}) };
  const records = Object.values(recordsById).map((record) => projectRecord(record, opportunityById.get(record.id), now, timezone));
  const allActive = records.filter((record) => !terminalStatuses.has(record.status));
  const allHistory = records.filter((record) => terminalStatuses.has(record.status));
  const allAttention = attentionItems(allActive, now);
  const attention = allAttention.slice(0, 3);
  const attentionIds = new Set(attention.map((item) => item.recordId));
  const filteredActive = allActive
    .filter((record) => filter === "active" || filter === "history" ? true : record.stageFilter === filter)
    .filter((record) => matchesQuery(record, query))
    .sort((left, right) => sort === "attention"
      ? Number(attentionIds.has(right.id)) - Number(attentionIds.has(left.id)) || compareRecords("deadline")(left, right)
      : compareRecords(sort)(left, right));
  const filteredHistory = allHistory.filter((record) => matchesQuery(record, query)).sort(compareRecords(sort === "attention" ? "recent" : sort));
  const historyLimit = Math.max(1, Math.min(input.historyLimit ?? 24, 100));
  const activeLimit = Math.max(4, Math.min(input.activeLimit ?? 6, 100));
  const shownHistory = filteredHistory.slice(0, historyLimit);
  const currentYear = now.getUTCFullYear();
  const allHistoryYears = [...new Set(filteredHistory.map((record) => historyYear(record, currentYear)))].sort((left, right) => left === "Earlier" ? 1 : right === "Earlier" ? -1 : right.localeCompare(left));
  const historyGroups = allHistoryYears.map((year) => {
    const allYearRecords = filteredHistory.filter((record) => historyYear(record, currentYear) === year);
    return {
    year,
    records: shownHistory.filter((record) => historyYear(record, currentYear) === year),
    count: allYearRecords.length,
    completed: allYearRecords.filter((record) => record.status === "Completed").length,
    archived: allYearRecords.filter((record) => record.stageLabel === "Archived").length,
    closed: allYearRecords.filter((record) => record.status === "Rejected" && record.stageLabel !== "Archived").length,
  }; });
  const filterCounts = Object.fromEntries(journeyCommandFilters.map((key) => [
    key,
    key === "active" ? allActive.length : key === "history" ? allHistory.length : allActive.filter((record) => record.stageFilter === key).length,
  ])) as Record<JourneyCommandFilter, number>;
  const timeline = buildJourneyTimelineModel({ user: input.user, account: input.account, opportunities: input.opportunities, resolvedTheme: input.resolvedTheme, now });
  return {
    accountKey: input.user.id,
    overview: overviewCards(records, now),
    attention,
    attentionCount: allAttention.length,
    activeRecords: filter === "history" ? [] : filteredActive.slice(0, activeLimit),
    historyGroups,
    activeCount: allActive.length,
    matchingActiveCount: filter === "history" ? 0 : filteredActive.length,
    shownActiveCount: Math.min(filteredActive.length, activeLimit),
    historyCount: filteredHistory.length,
    unavailableCount: records.filter((record) => record.unavailable).length,
    shownHistoryCount: shownHistory.length,
    trackedIds: records.map((record) => record.id),
    filterCounts,
    filter,
    sort,
    query,
    activeLimit,
    card: timeline.card,
    cardEligible: records.some((record) => record.history.some((item) => validationTransitions.has(item.transition)))
      || Object.values(input.account.journeyProgress ?? {}).some(Boolean),
    theme: timeline.theme,
    showFirstUseHints: records.length > 0 && !records.some((record) => record.history.some((item) => item.transition !== "choose")),
  };
}

export function auditJourneyProjection(account: AccountData, model: JourneyCommandCenterModel) {
  const sourceIds = new Set([
    ...Object.keys(account.activity?.tracked ?? {}),
    ...Object.keys(account.tracker ?? {}),
  ]);
  const projectedIds = new Set([
    ...model.activeRecords.map((record) => record.id),
    ...model.historyGroups.flatMap((group) => group.records.map((record) => record.id)),
  ]);
  return {
    sourceRecords: sourceIds.size,
    projectedInitialRecords: projectedIds.size,
    activeRecords: model.activeCount,
    historicalRecords: model.historyCount,
    unavailableRecords: model.unavailableCount,
    intentionallyDeferredHistory: Math.max(0, model.historyCount - model.shownHistoryCount),
  };
}
