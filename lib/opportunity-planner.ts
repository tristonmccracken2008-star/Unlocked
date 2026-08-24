import type { RecommendationViewModel } from "@/data/recommendation-service";
import type { Opportunity } from "@/data/opportunities";
import type { AccountData } from "./account-types";
import type { JourneyCalendarItem } from "./journey-calendar";
import { calendarDaysAway, officialDeadlineIsCalendarReady } from "./journey-calendar";
import type { JourneyCommandCenterModel, JourneyCommandRecord } from "./journey-command-center";
import { trustedApplicationRequirements } from "./application-workspace";

export const opportunityPlannerVersion = "opportunity-planner-v1";

export type PlannerRelationship = "Pursuing" | "Watching" | "Recommended";
export type PlannerEventKind = "deadline" | "opening" | "task" | "program_start";

export type PlannerItem = {
  id: string;
  opportunityId: string;
  title: string;
  organization: string;
  relationship: PlannerRelationship;
  kind: PlannerEventKind | "match" | "change";
  label: string;
  date?: string;
  timing?: string;
  href: string;
  action: string;
  category: string;
  priority: number;
  missingMaterials?: number;
};

export type PlannerMonth = {
  key: string;
  label: string;
  shortLabel: string;
  events: PlannerItem[];
  counts: Array<{ label: string; count: number }>;
};

export type OpportunityPlannerModel = {
  version: typeof opportunityPlannerVersion;
  access: "free" | "pro";
  timezone: string;
  generatedAt: string;
  now: PlannerItem[];
  comingUp: Array<{ id: "next_30" | "next_90" | "later"; label: string; items: PlannerItem[] }>;
  months: PlannerMonth[];
  mix: Array<{ category: string; pursuing: number; watching: number; recommended: number; href: string }>;
  areasToExplore: Array<{ category: string; matchCount: number; href: string }>;
  watchingNextCycle: Array<{ opportunityId: string; title: string; organization: string; href: string }>;
  prepareAhead: Array<{ opportunityId: string; title: string; organization: string; requirements: string[]; href: string }>;
  summary: { pursuing: number; watching: number; matched: number; datedEvents: number };
};

const relationshipRank: Record<PlannerRelationship, number> = { Pursuing: 3, Watching: 2, Recommended: 1 };
const terminalStatuses = new Set(["Rejected", "Completed"]);

function dateMs(date: string) {
  const parsed = Date.parse(`${date}T12:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, count: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1, 12));
}

function exactOpeningDate(opportunity: Opportunity, now: Date) {
  const lifecycle = opportunity.metadata.lifecycle;
  const opening = lifecycle?.openingDate;
  if (opportunity.verification_status !== "verified" || !lifecycle || !["confirmed", "strong"].includes(lifecycle.confidence ?? "")) return undefined;
  if (!opening?.normalizedValue || opening.estimated || !["date", "timestamp"].includes(opening.precision)) return undefined;
  const date = opening.normalizedValue.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const verifiedAt = Date.parse(`${opportunity.last_verified}T12:00:00.000Z`);
  return Number.isFinite(verifiedAt) && now.getTime() - verifiedAt <= 366 * 86_400_000 ? date : undefined;
}

function canonicalCategory(opportunity: Opportunity) {
  const source = `${opportunity.type} ${opportunity.category}`.toLocaleLowerCase();
  if (/scholarship|grant|financial aid/.test(source)) return "Scholarships";
  if (/research|lab/.test(source)) return "Research";
  if (/internship|co-op|career/.test(source)) return "Internships";
  if (/fellowship/.test(source)) return "Fellowships";
  if (/competition|challenge|award/.test(source)) return "Competitions";
  return "Programs";
}

function categoryHref(category: string) {
  const type = category === "Scholarships" ? "Scholarship"
    : category === "Research" ? "Research"
      : category === "Internships" ? "Career"
        : category === "Competitions" ? "Competition"
          : category === "Fellowships" ? "Fellowship" : "Program";
  return `/opportunities?type=${encodeURIComponent(type)}`;
}

function eventLabel(kind: PlannerEventKind) {
  if (kind === "opening") return "Applications open";
  if (kind === "program_start") return "Program starts";
  if (kind === "task") return "Application task";
  return "Deadline";
}

function plannerAction(relationship: PlannerRelationship, kind: PlannerItem["kind"]) {
  if (relationship === "Pursuing") return kind === "task" ? "Continue application" : "View in Journey";
  if (relationship === "Watching") return "Review opportunity";
  return "View match";
}

function plannerHref(relationship: PlannerRelationship, opportunityId: string, kind: PlannerItem["kind"]) {
  if (relationship === "Pursuing") return kind === "task" ? `/?application=${encodeURIComponent(opportunityId)}#active-opportunities` : `/#active-opportunities`;
  return `/opportunities/${encodeURIComponent(opportunityId)}`;
}

function relationshipByOpportunity(input: {
  account: AccountData;
  journey: JourneyCommandCenterModel;
  recommendations: readonly RecommendationViewModel[];
  pro: boolean;
}) {
  const relationships = new Map<string, PlannerRelationship>();
  for (const recommendation of input.pro ? input.recommendations : []) {
    if (recommendation.opportunity) relationships.set(recommendation.opportunity.id, "Recommended");
  }
  for (const watched of input.pro ? input.account.watchedOpportunities ?? [] : []) relationships.set(watched.opportunityId, "Watching");
  for (const record of input.journey.activeRecords) relationships.set(record.id, "Pursuing");
  return relationships;
}

function itemFromCalendar(item: JourneyCalendarItem, record: JourneyCommandRecord | undefined): PlannerItem | null {
  if (!item.opportunityId || !item.opportunityTitle || !record?.opportunity || terminalStatuses.has(record.status)) return null;
  const kind: PlannerEventKind = item.source === "application_task" ? "task"
    : item.type === "application_open" ? "opening"
      : item.type === "program_start" ? "program_start" : "deadline";
  const missingMaterials = kind === "deadline" && record.applicationWorkspace?.materials.mappedRequirements.length
    ? record.applicationWorkspace.materials.missingCount
    : 0;
  return {
    id: `calendar:${item.id}`,
    opportunityId: item.opportunityId,
    title: item.opportunityTitle,
    organization: item.organization ?? record.organization,
    relationship: "Pursuing",
    kind,
    label: kind === "task" ? item.title : eventLabel(kind),
    date: item.date,
    timing: item.timingLabel,
    href: missingMaterials ? "/materials" : plannerHref("Pursuing", item.opportunityId, kind),
    action: missingMaterials ? "Prepare materials" : plannerAction("Pursuing", kind),
    category: canonicalCategory(record.opportunity),
    priority: kind === "task" ? 1 : item.urgency === "today" || item.urgency === "tomorrow" ? 0 : 2,
    missingMaterials: missingMaterials || undefined,
  };
}

function directEvents(opportunity: Opportunity, relationship: PlannerRelationship, now: Date, timezone: string): PlannerItem[] {
  const category = canonicalCategory(opportunity);
  const candidates: Array<{ kind: PlannerEventKind; date: string } | null> = [
    officialDeadlineIsCalendarReady(opportunity, now) ? { kind: "deadline", date: opportunity.application_deadline! } : null,
    exactOpeningDate(opportunity, now) ? { kind: "opening", date: exactOpeningDate(opportunity, now)! } : null,
  ];
  return candidates.flatMap((candidate) => {
    if (!candidate) return [];
    const days = calendarDaysAway(candidate.date, now, timezone);
    if (days < 0 || days > 400) return [];
    return [{
      id: `${relationship.toLocaleLowerCase()}:${opportunity.id}:${candidate.kind}`,
      opportunityId: opportunity.id,
      title: opportunity.title,
      organization: opportunity.organization,
      relationship,
      kind: candidate.kind,
      label: eventLabel(candidate.kind),
      date: candidate.date,
      timing: days === 0 ? "Today" : days === 1 ? "Tomorrow" : days <= 14 ? `${days} days` : undefined,
      href: plannerHref(relationship, opportunity.id, candidate.kind),
      action: plannerAction(relationship, candidate.kind),
      category,
      priority: days <= 7 ? 1 : days <= 30 ? 2 : 4,
    }];
  });
}

function recentlyOpened(opportunity: Opportunity, relationship: PlannerRelationship, now: Date): PlannerItem | null {
  if (relationship !== "Watching" || !["open", "rolling"].includes(opportunity.metadata.lifecycle?.state ?? "")) return null;
  const event = [...(opportunity.metadata.lifecycle?.events ?? [])].reverse().find((candidate) =>
    ["application_opened", "application_reopened"].includes(candidate.type)
    && ["confirmed", "strong"].includes(candidate.confidence)
    && now.getTime() - Date.parse(candidate.detectedAt) >= 0
    && now.getTime() - Date.parse(candidate.detectedAt) <= 30 * 86_400_000);
  if (!event) return null;
  return {
    id: `watching:${opportunity.id}:change:${event.id}`,
    opportunityId: opportunity.id,
    title: opportunity.title,
    organization: opportunity.organization,
    relationship,
    kind: "change",
    label: event.type === "application_reopened" ? "Applications reopened" : "Applications opened",
    href: `/opportunities/${encodeURIComponent(opportunity.id)}`,
    action: "Review opportunity",
    category: canonicalCategory(opportunity),
    priority: 1,
  };
}

function monthCounts(events: PlannerItem[]) {
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.label, (counts.get(event.label) ?? 0) + 1);
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildOpportunityPlanner(input: {
  account: AccountData;
  journey: JourneyCommandCenterModel;
  opportunities: readonly Opportunity[];
  recommendations?: readonly RecommendationViewModel[];
  pro: boolean;
  now?: Date;
}): OpportunityPlannerModel {
  const now = input.now ?? new Date();
  const recommendations = input.recommendations ?? [];
  const relationships = relationshipByOpportunity({ account: input.account, journey: input.journey, recommendations, pro: input.pro });
  const opportunityById = new Map(input.opportunities.map((item) => [item.id, item]));
  for (const recommendation of recommendations) if (recommendation.opportunity) opportunityById.set(recommendation.opportunity.id, recommendation.opportunity);
  const recordById = new Map(input.journey.activeRecords.map((record) => [record.id, record]));

  const nextTaskByOpportunity = new Set<string>();
  const calendarEvents = input.journey.calendar.items.flatMap((item) => {
    const projected = itemFromCalendar(item, item.opportunityId ? recordById.get(item.opportunityId) : undefined);
    if (!projected || item.statusAwarePassed) return [];
    if (projected.kind === "task") {
      if (nextTaskByOpportunity.has(projected.opportunityId)) return [];
      nextTaskByOpportunity.add(projected.opportunityId);
    }
    return [projected];
  });
  const calendarEventKeys = new Set(calendarEvents.map((item) => `${item.opportunityId}:${item.kind}`));
  const direct = [...relationships].flatMap(([opportunityId, relationship]) => {
    if (relationship === "Pursuing") return [];
    const opportunity = opportunityById.get(opportunityId);
    return opportunity ? directEvents(opportunity, relationship, now, input.journey.calendar.timezone) : [];
  }).filter((item) => !calendarEventKeys.has(`${item.opportunityId}:${item.kind}`));
  const events = [...calendarEvents, ...direct].sort((a, b) => dateMs(a.date!) - dateMs(b.date!) || a.priority - b.priority || a.title.localeCompare(b.title));

  const watchChanges = input.pro ? [...relationships].flatMap(([opportunityId, relationship]) => {
    const opportunity = opportunityById.get(opportunityId);
    const changed = opportunity ? recentlyOpened(opportunity, relationship, now) : null;
    return changed ? [changed] : [];
  }) : [];
  const newMatches = input.pro ? recommendations.flatMap((recommendation): PlannerItem[] => {
    const opportunity = recommendation.opportunity;
    if (!opportunity || relationships.get(opportunity.id) !== "Recommended") return [];
    const isNew = Boolean(input.journey && input.account.advisor?.forYouSnapshots?.at(-1)?.briefing?.insights?.[opportunity.id]?.state?.newForYou);
    if (!isNew && recommendation !== recommendations[0]) return [];
    return [{
      id: `match:${opportunity.id}`,
      opportunityId: opportunity.id,
      title: opportunity.title,
      organization: opportunity.organization,
      relationship: "Recommended",
      kind: "match",
      label: isNew ? "New match" : "Recommended now",
      href: "/advisor",
      action: "View match",
      category: canonicalCategory(opportunity),
      priority: isNew ? 2 : 4,
    }];
  }) : [];

  const nowItems = [...events.filter((item) => {
    const days = item.date ? calendarDaysAway(item.date, now, input.journey.calendar.timezone) : 999;
    return days >= 0 && (item.kind === "task" ? days <= 14 : days <= 30);
  }), ...watchChanges, ...newMatches]
    .sort((a, b) => a.priority - b.priority || dateMs(a.date ?? "9999-12-31") - dateMs(b.date ?? "9999-12-31"))
    .filter((item, index, values) => values.findIndex((candidate) => candidate.opportunityId === item.opportunityId && candidate.kind === item.kind) === index)
    .slice(0, 5);

  const nowIds = new Set(nowItems.map((item) => item.id));
  const comingDefinitions = [
    { id: "next_30" as const, label: "Next 30 days", min: 0, max: 30 },
    { id: "next_90" as const, label: "Next 2–3 months", min: 30, max: 90 },
    { id: "later" as const, label: "Later this year", min: 90, max: 400 },
  ];
  const comingUp = comingDefinitions.flatMap((group) => {
    const items = events.filter((item) => {
      const days = calendarDaysAway(item.date!, now, input.journey.calendar.timezone);
      return days > group.min && days <= group.max && !nowIds.has(item.id);
    });
    return items.length ? [{ id: group.id, label: group.label, items: items.slice(0, 6) }] : [];
  });

  const months = Array.from({ length: 9 }, (_, index) => addMonths(now, index)).map((month) => {
    const key = monthKey(month);
    const monthEvents = events.filter((event) => event.date?.startsWith(key));
    return {
      key,
      label: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(month),
      shortLabel: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(month),
      events: monthEvents,
      counts: monthCounts(monthEvents),
    };
  });

  const mixMap = new Map<string, { pursuing: Set<string>; watching: Set<string>; recommended: Set<string> }>();
  for (const [opportunityId, relationship] of relationships) {
    const opportunity = opportunityById.get(opportunityId);
    if (!opportunity) continue;
    const category = canonicalCategory(opportunity);
    const entry = mixMap.get(category) ?? { pursuing: new Set(), watching: new Set(), recommended: new Set() };
    entry[relationship === "Pursuing" ? "pursuing" : relationship === "Watching" ? "watching" : "recommended"].add(opportunityId);
    mixMap.set(category, entry);
  }
  const mix = ["Internships", "Research", "Scholarships", "Fellowships", "Competitions", "Programs"].map((category) => {
    const entry = mixMap.get(category) ?? { pursuing: new Set(), watching: new Set(), recommended: new Set() };
    return { category, pursuing: entry.pursuing.size, watching: entry.watching.size, recommended: entry.recommended.size, href: categoryHref(category) };
  }).filter((item) => item.pursuing + item.watching + item.recommended > 0 || ["Internships", "Research", "Scholarships", "Competitions"].includes(item.category));
  const areasToExplore = input.pro ? mix.filter((item) => item.pursuing === 0 && item.watching === 0 && item.recommended > 0)
    .sort((a, b) => b.recommended - a.recommended).slice(0, 2).map((item) => ({ category: item.category, matchCount: item.recommended, href: item.href })) : [];

  const watchingNextCycle = input.pro ? (input.account.watchedOpportunities ?? []).flatMap((record) => {
    if (relationships.get(record.opportunityId) !== "Watching") return [];
    const opportunity = opportunityById.get(record.opportunityId);
    if (!opportunity?.metadata.lifecycle?.recurrence || events.some((item) => item.opportunityId === record.opportunityId)) return [];
    return [{ opportunityId: opportunity.id, title: opportunity.title, organization: opportunity.organization, href: `/opportunities/${encodeURIComponent(opportunity.id)}` }];
  }).slice(0, 5) : [];

  const prepareAhead = input.pro ? (input.account.watchedOpportunities ?? []).flatMap((record) => {
    if (relationships.get(record.opportunityId) !== "Watching") return [];
    const opportunity = opportunityById.get(record.opportunityId);
    const requirements = opportunity ? trustedApplicationRequirements(opportunity) : [];
    return opportunity && requirements.length ? [{ opportunityId: opportunity.id, title: opportunity.title, organization: opportunity.organization, requirements: requirements.slice(0, 4), href: `/opportunities/${encodeURIComponent(opportunity.id)}` }] : [];
  }).slice(0, 3) : [];

  const relationshipCounts = { Pursuing: 0, Watching: 0, Recommended: 0 };
  for (const relationship of relationships.values()) relationshipCounts[relationship] += 1;
  return {
    version: opportunityPlannerVersion,
    access: input.pro ? "pro" : "free",
    timezone: input.journey.calendar.timezone,
    generatedAt: now.toISOString(),
    now: nowItems,
    comingUp,
    months,
    mix,
    areasToExplore,
    watchingNextCycle,
    prepareAhead,
    summary: { pursuing: relationshipCounts.Pursuing, watching: relationshipCounts.Watching, matched: relationshipCounts.Recommended, datedEvents: events.length },
  };
}

export function strongestPlannerRelationship(left: PlannerRelationship, right: PlannerRelationship) {
  return relationshipRank[left] >= relationshipRank[right] ? left : right;
}
