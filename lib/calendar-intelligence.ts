import type { Opportunity } from "@/data/opportunities";
import type { OpportunityTrackerStatus, TrackedOpportunity } from "@/data/student-activity";
import { recentOpportunityChanges } from "@/data/opportunity-changelog";
import type { AccountData } from "./account-types";
import { createApplicationMaterialProjectionContext } from "./application-materials";
import { projectApplicationWorkspace, type ApplicationWorkspaceProjection } from "./application-workspace";
import { calendarDaysAway, exactLifecycleDate, type JourneyCalendarItem, type JourneyCalendarModel } from "./journey-calendar";

export const calendarIntelligenceVersion = "calendar-intelligence-v1";
export const calendarIntelligenceHorizons = [30, 60, 90] as const;
export type CalendarIntelligenceHorizon = (typeof calendarIntelligenceHorizons)[number];
export type CalendarIntelligenceEventKind = "application_deadline" | "personal_task" | "opening_date" | "journey_date";

export type CalendarIntelligenceEvent = {
  id: string;
  kind: CalendarIntelligenceEventKind;
  date: string;
  title: string;
  opportunityId?: string;
  opportunityTitle?: string;
  organization?: string;
  relationship: "pursuing" | "watching" | "personal";
  dateControl: "fixed" | "user_editable";
  workspace?: {
    missingMaterialCount: number;
    uncoveredRequirementCount: number;
    requirementChanged: boolean;
    requirementChangeLabel?: string;
  };
};

export type CalendarIntelligenceCluster = {
  id: string;
  startDate: string;
  endDate: string;
  spanDays: number;
  sameDay: boolean;
  events: CalendarIntelligenceEvent[];
  fixedCount: number;
  userEditableCount: number;
  deadlineCount: number;
  taskCount: number;
  openingCount: number;
  journeyDateCount: number;
  applicationCount: number;
  missingMaterialApplicationCount: number;
  uncoveredRequirementCount: number;
  requirementChangeCount: number;
};

export type CalendarIntelligencePeriod = {
  horizonDays: CalendarIntelligenceHorizon;
  clusters: CalendarIntelligenceCluster[];
  featuredClusterId?: string;
  unclustered: CalendarIntelligenceEvent[];
  fixedCount: number;
  userEditableCount: number;
  deadlineCount: number;
  taskCount: number;
  openingCount: number;
  monthSummaries: Array<{ month: string; deadlineCount: number; taskCount: number; openingCount: number }>;
};

export type CalendarIntelligenceModel = {
  version: typeof calendarIntelligenceVersion;
  timezone: string;
  generatedForDate: string;
  periods: Record<`${CalendarIntelligenceHorizon}`, CalendarIntelligencePeriod>;
  undatedTaskCount: number;
};

const activePreparationStatuses = new Set<OpportunityTrackerStatus>(["Interested", "Applying", "Paused"]);

function recordFor(account: AccountData, id: string): TrackedOpportunity | undefined {
  return account.tracker?.[id] ?? account.activity?.tracked?.[id];
}

function dateNumber(value: string) {
  return Date.parse(`${value}T12:00:00.000Z`);
}

function dateInTimezone(now: Date, timezone: string) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function compareEvents(left: CalendarIntelligenceEvent, right: CalendarIntelligenceEvent) {
  return left.date.localeCompare(right.date) || left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id);
}

function canonicalEventId(item: Pick<CalendarIntelligenceEvent, "kind" | "date" | "opportunityId" | "id">) {
  if (item.kind === "application_deadline" && item.opportunityId) return `deadline:${item.opportunityId}:${item.date}`;
  if (item.kind === "opening_date" && item.opportunityId) return `opening:${item.opportunityId}:${item.date}`;
  return `${item.kind}:${item.id}:${item.date}`;
}

function workspaceContext(account: AccountData, opportunities: readonly Opportunity[], now: Date) {
  const materialContext = createApplicationMaterialProjectionContext(account.applicationMaterials);
  const contexts = new Map<string, ApplicationWorkspaceProjection>();
  const records = { ...(account.activity?.tracked ?? {}), ...(account.tracker ?? {}) };
  for (const opportunity of opportunities) {
    const record = records[opportunity.id];
    if (!record || !activePreparationStatuses.has(record.status)) continue;
    contexts.set(opportunity.id, projectApplicationWorkspace({
      opportunity,
      record,
      workspace: account.applicationWorkspaces?.[opportunity.id],
      materials: account.applicationMaterials,
      materialContext,
      now,
    }));
  }
  return contexts;
}

function eventWorkspace(opportunity: Opportunity | undefined, workspace: ApplicationWorkspaceProjection | undefined, now: Date) {
  if (!opportunity || !workspace) return undefined;
  const requirementChange = recentOpportunityChanges(opportunity, 8).find((event) => event.field === "requirements"
    && now.getTime() - Date.parse(event.detectedAt) <= 30 * 86_400_000);
  return {
    missingMaterialCount: workspace.materials.missingCount,
    uncoveredRequirementCount: workspace.tasks.filter((task) => task.source === "verified_requirement" && !task.completed).length,
    requirementChanged: Boolean(requirementChange),
    requirementChangeLabel: requirementChange ? "Verified requirements changed recently" : undefined,
  };
}

function projectCalendarEvent(
  item: JourneyCalendarItem,
  account: AccountData,
  opportunityById: ReadonlyMap<string, Opportunity>,
  workspaces: ReadonlyMap<string, ApplicationWorkspaceProjection>,
  now: Date,
): CalendarIntelligenceEvent | null {
  const opportunity = item.opportunityId ? opportunityById.get(item.opportunityId) : undefined;
  const record = item.opportunityId ? recordFor(account, item.opportunityId) : undefined;
  if (item.source === "official" && item.type === "application_deadline" && (!record || !activePreparationStatuses.has(record.status))) return null;
  if (item.source === "application_task" && (!record || !activePreparationStatuses.has(record.status))) return null;
  const kind: CalendarIntelligenceEventKind = item.source === "official" && item.type === "application_deadline"
    ? "application_deadline"
    : item.source === "official" && item.type === "application_open"
      ? "opening_date"
      : item.source === "application_task"
        ? "personal_task"
        : "journey_date";
  const event: CalendarIntelligenceEvent = {
    id: item.id,
    kind,
    date: item.date,
    title: item.source === "official" ? item.opportunityTitle ?? item.title : item.title,
    opportunityId: item.opportunityId,
    opportunityTitle: item.opportunityTitle,
    organization: item.organization,
    relationship: item.source === "user" ? "personal" : "pursuing",
    dateControl: item.source === "official" ? "fixed" : "user_editable",
    workspace: kind === "application_deadline" ? eventWorkspace(opportunity, item.opportunityId ? workspaces.get(item.opportunityId) : undefined, now) : undefined,
  };
  return { ...event, id: canonicalEventId(event) };
}

function watchedOpeningEvents(input: { account: AccountData; opportunityById: ReadonlyMap<string, Opportunity>; now: Date }) {
  return (input.account.watchedOpportunities ?? []).flatMap((watch): CalendarIntelligenceEvent[] => {
    const opportunity = input.opportunityById.get(watch.opportunityId);
    if (!opportunity || recordFor(input.account, opportunity.id)) return [];
    const date = exactLifecycleDate(opportunity, "openingDate", input.now);
    if (!date) return [];
    const event: CalendarIntelligenceEvent = {
      id: `watch:${opportunity.id}`,
      kind: "opening_date",
      date,
      title: opportunity.title,
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      organization: opportunity.organization,
      relationship: "watching",
      dateControl: "fixed",
    };
    return [{ ...event, id: canonicalEventId(event) }];
  });
}

function toCluster(events: CalendarIntelligenceEvent[]): CalendarIntelligenceCluster {
  const startDate = events[0].date;
  const endDate = events[events.length - 1].date;
  const deadlineCount = events.filter((event) => event.kind === "application_deadline").length;
  const taskCount = events.filter((event) => event.kind === "personal_task").length;
  const openingCount = events.filter((event) => event.kind === "opening_date").length;
  const journeyDateCount = events.filter((event) => event.kind === "journey_date").length;
  const applicationIds = new Set(events.flatMap((event) => event.opportunityId ? [event.opportunityId] : []));
  const materialApplications = new Set(events.flatMap((event) => event.workspace?.missingMaterialCount && event.opportunityId ? [event.opportunityId] : []));
  return {
    id: `cluster:${startDate}:${endDate}:${events.map((event) => event.id).join("|")}`,
    startDate,
    endDate,
    spanDays: Math.round((dateNumber(endDate) - dateNumber(startDate)) / 86_400_000) + 1,
    sameDay: startDate === endDate,
    events,
    fixedCount: events.filter((event) => event.dateControl === "fixed").length,
    userEditableCount: events.filter((event) => event.dateControl === "user_editable").length,
    deadlineCount,
    taskCount,
    openingCount,
    journeyDateCount,
    applicationCount: applicationIds.size,
    missingMaterialApplicationCount: materialApplications.size,
    uncoveredRequirementCount: events.reduce((count, event) => count + (event.workspace?.uncoveredRequirementCount ?? 0), 0),
    requirementChangeCount: events.filter((event) => event.workspace?.requirementChanged).length,
  };
}

export function detectCalendarClusters(events: readonly CalendarIntelligenceEvent[]) {
  const ordered = [...events].sort(compareEvents);
  const deadlinePrefix = [0];
  const taskPrefix = [0];
  for (const event of ordered) {
    deadlinePrefix.push(deadlinePrefix[deadlinePrefix.length - 1]! + Number(event.kind === "application_deadline"));
    taskPrefix.push(taskPrefix[taskPrefix.length - 1]! + Number(event.kind === "personal_task"));
  }
  const clusters: CalendarIntelligenceCluster[] = [];
  const unclustered: CalendarIntelligenceEvent[] = [];
  let index = 0;
  let end = 0;
  while (index < ordered.length) {
    end = Math.max(end, index + 1);
    const maximum = dateNumber(ordered[index].date) + 7 * 86_400_000;
    while (end < ordered.length && dateNumber(ordered[end].date) <= maximum) end += 1;
    const deadlineCount = deadlinePrefix[end]! - deadlinePrefix[index]!;
    const taskCount = taskPrefix[end]! - taskPrefix[index]!;
    const totalCount = end - index;
    if (deadlineCount >= 2 || taskCount >= 3 || (deadlineCount >= 1 && totalCount >= 3)) {
      clusters.push(toCluster(ordered.slice(index, end)));
      index = end;
    } else {
      unclustered.push(ordered[index]);
      index += 1;
    }
  }
  return { clusters, unclustered };
}

function buildPeriod(events: readonly CalendarIntelligenceEvent[], horizonDays: CalendarIntelligenceHorizon, now: Date, timezone: string): CalendarIntelligencePeriod {
  const inHorizon = events.filter((event) => {
    const days = calendarDaysAway(event.date, now, timezone);
    return days >= 0 && days <= horizonDays;
  });
  const { clusters, unclustered } = detectCalendarClusters(inHorizon);
  const featured = [...clusters].sort((left, right) => right.deadlineCount - left.deadlineCount
    || right.taskCount - left.taskCount
    || right.missingMaterialApplicationCount - left.missingMaterialApplicationCount
    || left.startDate.localeCompare(right.startDate))[0];
  const monthMap = new Map<string, { month: string; deadlineCount: number; taskCount: number; openingCount: number }>();
  for (const event of inHorizon) {
    const month = event.date.slice(0, 7);
    const summary = monthMap.get(month) ?? { month, deadlineCount: 0, taskCount: 0, openingCount: 0 };
    if (event.kind === "application_deadline") summary.deadlineCount += 1;
    if (event.kind === "personal_task") summary.taskCount += 1;
    if (event.kind === "opening_date") summary.openingCount += 1;
    monthMap.set(month, summary);
  }
  return {
    horizonDays,
    clusters,
    featuredClusterId: featured?.id,
    unclustered,
    fixedCount: inHorizon.filter((event) => event.dateControl === "fixed").length,
    userEditableCount: inHorizon.filter((event) => event.dateControl === "user_editable").length,
    deadlineCount: inHorizon.filter((event) => event.kind === "application_deadline").length,
    taskCount: inHorizon.filter((event) => event.kind === "personal_task").length,
    openingCount: inHorizon.filter((event) => event.kind === "opening_date").length,
    monthSummaries: [...monthMap.values()].sort((left, right) => left.month.localeCompare(right.month)),
  };
}

export function buildCalendarIntelligenceModel(input: { account: AccountData; opportunities: readonly Opportunity[]; calendar: JourneyCalendarModel; now?: Date }): CalendarIntelligenceModel {
  const now = input.now ?? new Date();
  const opportunityById = new Map(input.opportunities.map((item) => [item.id, item]));
  const workspaces = workspaceContext(input.account, input.opportunities, now);
  const canonical = new Map<string, CalendarIntelligenceEvent>();
  for (const item of input.calendar.items) {
    const event = projectCalendarEvent(item, input.account, opportunityById, workspaces, now);
    if (event) canonical.set(event.id, event);
  }
  for (const event of watchedOpeningEvents({ account: input.account, opportunityById, now })) canonical.set(event.id, event);
  const events = [...canonical.values()].sort(compareEvents);
  const undatedTaskCount = [...workspaces.values()].reduce((count, workspace) => count + workspace.tasks.filter((task) => task.source === "user" && !task.completed && !task.dueDate).length, 0);
  return {
    version: calendarIntelligenceVersion,
    timezone: input.calendar.timezone,
    generatedForDate: dateInTimezone(now, input.calendar.timezone),
    periods: {
      "30": buildPeriod(events, 30, now, input.calendar.timezone),
      "60": buildPeriod(events, 60, now, input.calendar.timezone),
      "90": buildPeriod(events, 90, now, input.calendar.timezone),
    },
    undatedTaskCount,
  };
}
