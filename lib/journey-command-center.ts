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
  nextDate?: { label: string; value: string; urgency: "normal" | "soon" | "overdue" };
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
};

export type JourneyCommandCenterModel = {
  overview: Array<{ id: "active" | "deadlines" | "submitted" | "milestones"; label: string; value: number; href?: string }>;
  attention: JourneyAttentionItem[];
  activeRecords: JourneyCommandRecord[];
  historyGroups: JourneyHistoryGroup[];
  activeCount: number;
  historyCount: number;
  unavailableCount: number;
  shownHistoryCount: number;
  filterCounts: Record<JourneyCommandFilter, number>;
  filter: JourneyCommandFilter;
  sort: JourneyCommandSort;
  query: string;
  card: JourneyTimelineModel["card"];
  theme: JourneyTimelineModel["theme"];
};

const terminalStatuses = new Set<OpportunityTrackerStatus>(["Rejected", "Completed"]);
const submittedStatuses = new Set<OpportunityTrackerStatus>(["Submitted", "Interview", "Accepted", "Completed"]);
const validationTransitions = new Set(["interview", "accept", "complete"]);

function safeTime(value: string | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysUntil(value: string, now: Date) {
  return Math.ceil((safeTime(value) - now.getTime()) / 86_400_000);
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

function nextRelevantDate(opportunity: Opportunity | undefined, details: JourneyMilestoneDetails | undefined, now: Date) {
  const candidates: Array<{ label: string; value: string }> = [];
  if (details?.reminderAt) candidates.push({ label: "Reminder", value: details.reminderAt });
  if (opportunity?.application_deadline) candidates.push({ label: "Official deadline", value: `${opportunity.application_deadline}T23:59:59.999Z` });
  const next = candidates.sort((left, right) => safeTime(left.value) - safeTime(right.value))[0];
  if (!next) return undefined;
  const days = daysUntil(next.value, now);
  return { ...next, urgency: days < 0 ? "overdue" as const : days <= 14 ? "soon" as const : "normal" as const };
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
    inactiveDays: inactiveDays >= 30 && !["Saved", "Paused"].includes(record.status) ? inactiveDays : undefined,
  };
}

function projectRecord(record: TrackedOpportunity, opportunity: Opportunity | undefined, now: Date): JourneyCommandRecord {
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
    nextDate: nextRelevantDate(opportunity, details, now),
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
    } else if (date?.label === "Reminder" && date.urgency === "soon") {
      items.push({ id: `reminder-soon:${record.id}`, recordId: record.id, title: record.title, reason: "A reminder you set is approaching.", priority: 2, date: date.value });
    }
    if (date?.label === "Official deadline" && date.urgency === "soon") {
      const days = Math.max(0, daysUntil(date.value, now));
      items.push({ id: `deadline:${record.id}`, recordId: record.id, title: record.title, reason: `The confirmed application deadline is in ${days} ${days === 1 ? "day" : "days"}.`, priority: 2, date: date.value });
    }
    if (record.lifecycle && ["canceled", "closed", "temporarily_closed"].includes(record.lifecycle.state) && !["Saved", "Paused"].includes(record.status)) {
      items.push({ id: `lifecycle:${record.id}`, recordId: record.id, title: record.title, reason: `${record.lifecycle.label}. Your Journey stage remains ${record.stageLabel}.`, priority: record.lifecycle.state === "canceled" ? 1 : 3 });
    }
    const inactiveDays = Math.floor((now.getTime() - safeTime(record.updatedAt)) / 86_400_000);
    if (inactiveDays >= 45 && !["Saved", "Paused"].includes(record.status)) {
      items.push({ id: `inactive:${record.id}`, recordId: record.id, title: record.title, reason: `This active record has not been updated in ${inactiveDays} days.`, priority: 4 });
    }
  }
  return items.sort((left, right) => left.priority - right.priority || safeTime(left.date) - safeTime(right.date) || left.title.localeCompare(right.title)).slice(0, 5);
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

function matchesQuery(record: JourneyCommandRecord, query: string) {
  if (!query) return true;
  const normalized = query.toLocaleLowerCase();
  return `${record.title} ${record.organization} ${record.latestDetails?.notes ?? ""}`.toLocaleLowerCase().includes(normalized);
}

export function buildJourneyCommandCenterModel(input: {
  user: Pick<AuthUser, "name">;
  account: AccountData;
  opportunities: readonly Opportunity[];
  resolvedTheme?: "light" | "dark";
  now?: Date;
  filter?: string;
  sort?: string;
  query?: string;
  historyLimit?: number;
}): JourneyCommandCenterModel {
  const now = input.now ?? new Date();
  const filter = journeyCommandFilters.includes(input.filter as JourneyCommandFilter) ? input.filter as JourneyCommandFilter : "active";
  const sort = journeyCommandSorts.includes(input.sort as JourneyCommandSort) ? input.sort as JourneyCommandSort : "attention";
  const query = (input.query ?? "").trim().slice(0, 100);
  const opportunityById = new Map(input.opportunities.map((item) => [item.id, item]));
  const recordsById = { ...(input.account.activity?.tracked ?? {}), ...(input.account.tracker ?? {}) };
  const records = Object.values(recordsById).map((record) => projectRecord(record, opportunityById.get(record.id), now));
  const allActive = records.filter((record) => !terminalStatuses.has(record.status));
  const allHistory = records.filter((record) => terminalStatuses.has(record.status));
  const attention = attentionItems(allActive, now);
  const attentionIds = new Set(attention.map((item) => item.recordId));
  const filteredActive = allActive
    .filter((record) => filter === "active" || filter === "history" ? true : record.stageFilter === filter)
    .filter((record) => matchesQuery(record, query))
    .sort((left, right) => sort === "attention"
      ? Number(attentionIds.has(right.id)) - Number(attentionIds.has(left.id)) || compareRecords("deadline")(left, right)
      : compareRecords(sort)(left, right));
  const filteredHistory = allHistory.filter((record) => matchesQuery(record, query)).sort(compareRecords(sort === "attention" ? "recent" : sort));
  const historyLimit = Math.max(1, Math.min(input.historyLimit ?? 24, 100));
  const shownHistory = filteredHistory.slice(0, historyLimit);
  const historyGroups = [...new Set(shownHistory.map(meaningfulYear))].sort((a, b) => b.localeCompare(a)).map((year) => ({
    year,
    records: shownHistory.filter((record) => meaningfulYear(record) === year),
  }));
  const year = now.getUTCFullYear();
  const submitted = records.filter((record) => {
    const recordedSubmission = record.history.some((item) => item.transition === "submit" && new Date(item.occurredAt).getUTCFullYear() === year);
    const legacySubmission = !record.history.length && submittedStatuses.has(record.status) && new Date(record.updatedAt).getUTCFullYear() === year;
    return recordedSubmission || legacySubmission;
  }).length;
  const milestones = records.reduce((total, record) => total + record.history.filter((item) => validationTransitions.has(item.transition) && new Date(item.occurredAt).getUTCFullYear() === year).length, 0);
  const upcoming = allActive.filter((record) => record.nextDate && ["normal", "soon"].includes(record.nextDate.urgency)).length;
  const filterCounts = Object.fromEntries(journeyCommandFilters.map((key) => [
    key,
    key === "active" ? allActive.length : key === "history" ? allHistory.length : allActive.filter((record) => record.stageFilter === key).length,
  ])) as Record<JourneyCommandFilter, number>;
  const timeline = buildJourneyTimelineModel({ user: input.user, account: input.account, opportunities: input.opportunities, resolvedTheme: input.resolvedTheme, now });
  return {
    overview: [
      { id: "active", label: "Active opportunities", value: allActive.length, href: "/?stage=active#active-opportunities" },
      { id: "deadlines", label: "Upcoming dates", value: upcoming, href: "/?sort=deadline#active-opportunities" },
      { id: "submitted", label: `Submitted in ${year}`, value: submitted, href: "/?stage=applied#active-opportunities" },
      { id: "milestones", label: `Milestones in ${year}`, value: milestones, href: "#journey-history" },
    ],
    attention,
    activeRecords: filter === "history" ? [] : filteredActive.slice(0, 100),
    historyGroups,
    activeCount: allActive.length,
    historyCount: filteredHistory.length,
    unavailableCount: records.filter((record) => record.unavailable).length,
    shownHistoryCount: shownHistory.length,
    filterCounts,
    filter,
    sort,
    query,
    card: timeline.card,
    theme: timeline.theme,
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
