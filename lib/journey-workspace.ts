import type { JourneyCommandRecord } from "./journey-command-center";
import type { JourneyCalendarItem, JourneyCalendarModel } from "./journey-calendar";
import type { CalendarIntelligenceModel } from "./calendar-intelligence";
import type { PersonalOpportunityStrategy } from "./personal-opportunity-strategy";

export type JourneyWorkspaceActionKind =
  | "provider_change"
  | "deadline_requirements"
  | "task_due"
  | "application_requirement"
  | "verified_opening"
  | "continue_application"
  | "open_opportunity";

export type JourneyWorkspaceAction = {
  id: string;
  kind: JourneyWorkspaceActionKind;
  recordId?: string;
  title: string;
  organization?: string;
  reason: string;
  timing?: string;
  label: string;
  href: string;
  precedence: number;
  date?: string;
};

export type JourneyWorkspaceProjection = {
  nextAction?: JourneyWorkspaceAction;
  secondaryActions: JourneyWorkspaceAction[];
  upcomingDates: JourneyCalendarItem[];
  timingSummary?: string;
  strategySummary?: {
    activeCount: number;
    mix: string;
    context?: string;
    pro: boolean;
  };
};

const applicationStatuses = new Set(["Interested", "Applying"]);
const postSubmissionStatuses = new Set(["Submitted", "Interview", "Accepted"]);

function applicationHref(id: string) {
  return `/applications/${encodeURIComponent(id)}`;
}

function opportunityHref(id: string) {
  return `/opportunities/${encodeURIComponent(id)}`;
}

function nextDateValue(record: JourneyCommandRecord) {
  return record.nextDate?.value ?? "9999-12-31T23:59:59.999Z";
}

function candidateActions(records: readonly JourneyCommandRecord[], calendar: JourneyCalendarModel): JourneyWorkspaceAction[] {
  const candidates: JourneyWorkspaceAction[] = [];
  for (const record of records) {
    const workspace = record.applicationWorkspace;
    const isApplication = Boolean(workspace) && (applicationStatuses.has(record.status) || postSubmissionStatuses.has(record.status));
    if (record.recentChange && isApplication && (!postSubmissionStatuses.has(record.status) || record.recentChange.importance === "critical")) {
      candidates.push({
        id: `provider-change:${record.id}`,
        kind: "provider_change",
        recordId: record.id,
        title: record.title,
        organization: record.organization,
        reason: record.recentChange.label,
        timing: "Provider information changed recently",
        label: "Review update",
        href: workspace ? applicationHref(record.id) : opportunityHref(record.id),
        precedence: 1,
        date: record.recentChange.detectedAt,
      });
    }
    if (workspace?.requirementsVerified && workspace.unfinishedCount > 0 && applicationStatuses.has(record.status) && workspace.deadlineDaysRemaining !== undefined && workspace.deadlineDaysRemaining >= 0 && workspace.deadlineDaysRemaining <= 14) {
      candidates.push({
        id: `deadline-requirements:${record.id}`,
        kind: "deadline_requirements",
        recordId: record.id,
        title: record.title,
        organization: record.organization,
        reason: `${workspace.unfinishedCount} known application ${workspace.unfinishedCount === 1 ? "item needs" : "items need"} attention.`,
        timing: workspace.deadlineDaysRemaining === 0 ? "Deadline today" : workspace.deadlineDaysRemaining === 1 ? "Deadline tomorrow" : `Deadline in ${workspace.deadlineDaysRemaining} days`,
        label: "Continue application",
        href: applicationHref(record.id),
        precedence: 2,
        date: workspace.deadline,
      });
    }
  }

  const recordById = new Map(records.map((record) => [record.id, record]));
  for (const item of calendar.items) {
    if (item.completed || item.dismissed || item.urgency === "overdue") continue;
    const relatedRecord = item.opportunityId ? recordById.get(item.opportunityId) : undefined;
    if (item.source === "application_task" && relatedRecord && applicationStatuses.has(relatedRecord.status) && ["today", "tomorrow", "soon"].includes(item.urgency)) {
      candidates.push({
        id: `task-due:${item.id}`,
        kind: "task_due",
        recordId: item.opportunityId,
        title: item.opportunityTitle ?? item.title,
        organization: item.organization,
        reason: `${item.title} needs attention.`,
        timing: item.timingLabel,
        label: "Open application",
        href: item.opportunityId ? applicationHref(item.opportunityId) : "/applications",
        precedence: 3,
        date: item.date,
      });
    }
  }

  for (const record of records) {
    const workspace = record.applicationWorkspace;
    if (workspace?.requirementsVerified && workspace.unfinishedCount > 0 && applicationStatuses.has(record.status)) {
      candidates.push({
        id: `application-requirement:${record.id}`,
        kind: "application_requirement",
        recordId: record.id,
        title: record.title,
        organization: record.organization,
        reason: `${workspace.unfinishedCount} known application ${workspace.unfinishedCount === 1 ? "item remains" : "items remain"}.`,
        timing: workspace.deadline ? `Deadline ${workspace.deadline}` : "No verified deadline",
        label: "Continue application",
        href: applicationHref(record.id),
        precedence: 4,
        date: workspace.deadline,
      });
    }
  }

  for (const item of calendar.items) {
    if (item.type !== "application_open" || item.completed || item.dismissed || item.urgency === "overdue" || !item.opportunityId) continue;
    candidates.push({
      id: `verified-opening:${item.id}`,
      kind: "verified_opening",
      recordId: item.opportunityId,
      title: item.opportunityTitle ?? item.title,
      organization: item.organization,
      reason: `Applications open ${item.timingLabel.toLocaleLowerCase()}.`,
      timing: item.timingLabel,
      label: "Open opportunity",
      href: opportunityHref(item.opportunityId),
      precedence: 5,
      date: item.date,
    });
  }

  for (const record of records) {
    if (record.applicationWorkspace && applicationStatuses.has(record.status)) {
      candidates.push({
        id: `continue:${record.id}`,
        kind: "continue_application",
        recordId: record.id,
        title: record.title,
        organization: record.organization,
        reason: record.applicationWorkspace.requirementsVerified
          ? "Continue the application work already in progress."
          : "Review the application and its official source.",
        timing: record.nextDate?.urgency === "overdue" ? undefined : record.nextDate?.timingLabel,
        label: "Continue application",
        href: applicationHref(record.id),
        precedence: 6,
        date: nextDateValue(record),
      });
    } else if (!postSubmissionStatuses.has(record.status) && record.opportunity) {
      candidates.push({
        id: `open:${record.id}`,
        kind: "open_opportunity",
        recordId: record.id,
        title: record.title,
        organization: record.organization,
        reason: record.status === "Saved" ? "Review whether this opportunity belongs in your active plans." : "Review the opportunity and decide what to do next.",
        timing: record.nextDate?.urgency === "overdue" ? undefined : record.nextDate?.timingLabel,
        label: "Open opportunity",
        href: opportunityHref(record.id),
        precedence: 7,
        date: nextDateValue(record),
      });
    }
  }
  return candidates;
}

function strategyMix(strategy: PersonalOpportunityStrategy) {
  return strategy.typeMix.slice(0, 3).map((item) => `${item.count} ${item.label.toLocaleLowerCase()}`).join(" · ");
}

export function projectJourneyWorkspace(input: {
  records: readonly JourneyCommandRecord[];
  calendar: JourneyCalendarModel;
  calendarIntelligence: CalendarIntelligenceModel;
  strategy: PersonalOpportunityStrategy;
}): JourneyWorkspaceProjection {
  const candidates = candidateActions(input.records, input.calendar).sort((left, right) =>
    left.precedence - right.precedence
    || (left.date ?? "9999").localeCompare(right.date ?? "9999")
    || left.title.localeCompare(right.title)
    || left.id.localeCompare(right.id));
  const chosenRecords = new Set<string>();
  const actions = candidates.filter((candidate) => {
    const key = candidate.recordId ?? candidate.id;
    if (chosenRecords.has(key)) return false;
    chosenRecords.add(key);
    return true;
  }).slice(0, 3);
  const upcomingDates = input.calendar.items.filter((item) => !item.completed && !item.dismissed && item.urgency !== "overdue").slice(0, 3);
  const cluster = input.calendarIntelligence.periods["30"].clusters.find((item) => item.id === input.calendarIntelligence.periods["30"].featuredClusterId);
  const timingSummary = cluster?.deadlineCount
    ? `${cluster.deadlineCount} application ${cluster.deadlineCount === 1 ? "deadline falls" : "deadlines fall"} within ${cluster.spanDays} days.`
    : cluster?.taskCount
      ? `${cluster.taskCount} application ${cluster.taskCount === 1 ? "task falls" : "tasks fall"} within ${cluster.spanDays} days.`
      : undefined;
  return {
    nextAction: actions[0],
    secondaryActions: actions.slice(1),
    upcomingDates,
    timingSummary,
    strategySummary: input.strategy.currentCount ? {
      activeCount: input.records.length,
      mix: strategyMix(input.strategy),
      context: input.strategy.pro && input.strategy.similarities.length
        ? `${input.strategy.similarities.length} similar ${input.strategy.similarities.length === 1 ? "group" : "groups"} in your current mix.`
        : undefined,
      pro: input.strategy.pro,
    } : undefined,
  };
}
