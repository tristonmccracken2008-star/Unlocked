import "server-only";

import { accomplishmentKindLabels } from "@/data/accomplishments";
import { applicationMaterialTypeLabels, normalizeApplicationMaterialStore, type ApplicationMaterialType } from "@/data/application-materials";
import { getJourneyProfessionalWorkflow, resolveJourneyProfessionalStage } from "@/data/journey-professional";
import { opportunityPaths } from "@/data/opportunity-paths";
import type { Opportunity } from "@/data/opportunities";
import type { OpportunityInsightsModel, InsightsPeriod } from "@/data/opportunity-insights";
import type { JourneyTransitionHistoryRecord, TrackedOpportunity } from "@/data/student-activity";
import type { AccountData } from "./account-types";
import { buildAccomplishmentsModel } from "./accomplishments";
import { materialTypeForRequirement } from "./application-materials";
import { opportunityMatchesPathStage } from "./opportunity-paths";
import { verifiedApplicationRequirements } from "@/data/opportunity-trust";

type DatedKind = "added" | "submitted" | "outcome" | "completed";
type DatedEvent = { id: string; opportunityId: string; kind: DatedKind; occurredAt: string };
type ApplicationFact = {
  opportunityId: string;
  submitted: boolean;
  submittedAt?: string;
  accepted: boolean;
  notSelected: boolean;
  withdrawnOrDeclined: boolean;
  outcomeAt?: string;
};

const applicationWorkflowKinds = new Set(["career", "scholarship", "research"]);
const terminalStatuses = new Set<TrackedOpportunity["status"]>(["Rejected", "Completed"]);
const categoryDefinitions = [
  { id: "internships", label: "Internships and career", pattern: /internship|career|co-op|campus job/i, href: "/opportunities?type=Career" },
  { id: "research", label: "Research", pattern: /research|lab/i, href: "/opportunities?type=Research" },
  { id: "scholarships", label: "Scholarships", pattern: /scholarship|grant|financial aid/i, href: "/opportunities?type=Scholarship" },
  { id: "competitions", label: "Competitions", pattern: /competition|challenge|hackathon/i, href: "/opportunities?category=Competitions" },
  { id: "fellowships", label: "Fellowships", pattern: /fellowship/i, href: "/opportunities?category=Fellowships" },
  { id: "programs", label: "Programs and resources", pattern: /program|conference|certification|benefit|software|ai tool|student organization/i, href: "/opportunities" },
] as const;

function validTime(value: string | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function yearOf(value: string | undefined) {
  const valid = validTime(value);
  return valid?.slice(0, 4);
}

function monthOf(value: string | undefined) {
  const valid = validTime(value);
  return valid?.slice(0, 7);
}

function periodYear(period: InsightsPeriod, now: Date) {
  if (period === "current_year") return String(now.getUTCFullYear());
  if (period === "previous_year") return String(now.getUTCFullYear() - 1);
  return undefined;
}

function inPeriod(value: string | undefined, period: InsightsPeriod, now: Date) {
  const target = periodYear(period, now);
  return !target || yearOf(value) === target;
}

function periodLabel(period: InsightsPeriod, now: Date) {
  if (period === "current_year") return String(now.getUTCFullYear());
  if (period === "previous_year") return String(now.getUTCFullYear() - 1);
  return "All recorded activity";
}

function canonicalTracked(account: AccountData) {
  const records = new Map<string, TrackedOpportunity>();
  for (const [id, record] of Object.entries(account.activity?.tracked ?? {})) records.set(id, record);
  for (const [id, record] of Object.entries(account.tracker ?? {})) records.set(id, record);
  for (const saved of account.savedOpportunities ?? []) if (!records.has(saved.opportunityId)) records.set(saved.opportunityId, { id: saved.opportunityId, status: "Saved", savedAt: saved.savedAt, updatedAt: saved.savedAt, history: [] });
  return records;
}

function activeHistory(record: TrackedOpportunity) {
  const undone = new Set(record.undoneTransitionIds ?? []);
  return (record.history ?? []).filter((event) => !undone.has(event.id) && validTime(event.occurredAt));
}

function firstTransition(history: readonly JourneyTransitionHistoryRecord[], transition: JourneyTransitionHistoryRecord["transition"]) {
  return history.filter((event) => event.transition === transition).sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))[0];
}

function categoryFor(opportunity: Pick<Opportunity, "type" | "category">) {
  const value = `${opportunity.type} ${opportunity.category}`;
  return categoryDefinitions.find((definition) => definition.pattern.test(value)) ?? categoryDefinitions.at(-1)!;
}

function applicationFact(opportunity: Opportunity, record: TrackedOpportunity): ApplicationFact | null {
  const workflow = getJourneyProfessionalWorkflow(opportunity);
  if (!applicationWorkflowKinds.has(workflow.id)) return null;
  const history = activeHistory(record);
  const stage = resolveJourneyProfessionalStage(record, workflow);
  const submittedEvent = firstTransition(history, "submit");
  const acceptedEvent = firstTransition(history, "accept");
  const closeEvents = history.filter((event) => event.transition === "close");
  const terminalStage = /^(not_selected|withdrawn|declined_)/.test(stage.id);
  const submittedByState = ["Submitted", "Interview", "Accepted", "Completed"].includes(record.status)
    || stage.id === "not_selected"
    || stage.id.startsWith("declined_");
  const submitted = Boolean(submittedEvent || submittedByState);
  if (!submitted && !terminalStage) return { opportunityId: opportunity.id, submitted: false, accepted: false, notSelected: false, withdrawnOrDeclined: false };
  const accepted = Boolean(acceptedEvent || ["Accepted", "Completed"].includes(record.status) || /accepted|awarded|funds_received/.test(stage.id));
  const notSelected = stage.id === "not_selected";
  const withdrawnOrDeclined = stage.id === "withdrawn" || stage.id.startsWith("declined_");
  const outcomeEvent = acceptedEvent ?? closeEvents.at(-1);
  return { opportunityId: opportunity.id, submitted, submittedAt: submittedEvent?.occurredAt, accepted, notSelected, withdrawnOrDeclined, outcomeAt: outcomeEvent?.occurredAt };
}

function addEvent(target: Map<string, DatedEvent>, event: DatedEvent) {
  const date = validTime(event.occurredAt);
  if (!date) return;
  const key = `${event.opportunityId}:${event.kind}:${date.slice(0, 10)}`;
  if (!target.has(key)) target.set(key, { ...event, occurredAt: date });
}

function datedEvents(
  records: ReadonlyMap<string, TrackedOpportunity>,
  accomplishments: ReturnType<typeof buildAccomplishmentsModel>["records"],
  opportunityById: ReadonlyMap<string, Opportunity>,
) {
  const events = new Map<string, DatedEvent>();
  for (const record of records.values()) {
    addEvent(events, { id: `added:${record.id}`, opportunityId: record.id, kind: "added", occurredAt: record.savedAt });
    for (const event of activeHistory(record)) {
      if (event.transition === "submit") addEvent(events, { id: event.id, opportunityId: record.id, kind: "submitted", occurredAt: event.occurredAt });
      if (event.transition === "accept") addEvent(events, { id: event.id, opportunityId: record.id, kind: "outcome", occurredAt: event.occurredAt });
      if (event.transition === "close") {
        const opportunity = opportunityById.get(record.id);
        const workflow = opportunity ? getJourneyProfessionalWorkflow(opportunity) : undefined;
        const stageId = event.professionalStageId ?? (workflow ? resolveJourneyProfessionalStage(record, workflow).id : undefined);
        if (stageId === "not_selected" || stageId === "withdrawn" || stageId?.startsWith("declined_")) {
          addEvent(events, { id: event.id, opportunityId: record.id, kind: "outcome", occurredAt: event.occurredAt });
        }
      }
      if (event.transition === "complete") addEvent(events, { id: event.id, opportunityId: record.id, kind: "completed", occurredAt: event.occurredAt });
    }
  }
  for (const accomplishment of accomplishments) {
    const opportunityId = accomplishment.canonicalOpportunityId ?? accomplishment.journeyOpportunityId ?? `manual:${accomplishment.id}`;
    addEvent(events, { id: `accomplishment:${accomplishment.id}`, opportunityId, kind: "completed", occurredAt: `${accomplishment.outcomeDate}T12:00:00.000Z` });
  }
  return [...events.values()].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id));
}

function activitySeries(events: readonly DatedEvent[], period: InsightsPeriod, now: Date) {
  const filtered = events.filter((event) => inPeriod(event.occurredAt, period, now));
  if (!filtered.length) return [];
  const months = new Map<string, { added: number; submitted: number; outcomes: number; completed: number }>();
  for (const event of filtered) {
    const month = monthOf(event.occurredAt)!;
    const value = months.get(month) ?? { added: 0, submitted: 0, outcomes: 0, completed: 0 };
    if (event.kind === "added") value.added += 1;
    if (event.kind === "submitted") value.submitted += 1;
    if (event.kind === "outcome") value.outcomes += 1;
    if (event.kind === "completed") value.completed += 1;
    months.set(month, value);
  }
  const keys = [...months.keys()].sort().slice(-18);
  return keys.map((month) => {
    const value = months.get(month)!;
    return {
      month,
      label: new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`)),
      ...value,
      total: value.added + value.submitted + value.outcomes + value.completed,
    };
  });
}

function annualRecaps(events: readonly DatedEvent[], materialSelections: readonly string[]) {
  const years = new Map<string, { pursued: Set<string>; submitted: Set<string>; outcomes: Set<string>; accomplishments: Set<string>; materialSelections: Set<string> }>();
  const get = (year: string) => {
    const current = years.get(year) ?? { pursued: new Set<string>(), submitted: new Set<string>(), outcomes: new Set<string>(), accomplishments: new Set<string>(), materialSelections: new Set<string>() };
    years.set(year, current);
    return current;
  };
  for (const event of events) {
    const year = yearOf(event.occurredAt);
    if (!year) continue;
    const value = get(year);
    if (event.kind === "added") value.pursued.add(event.opportunityId);
    if (event.kind === "submitted") value.submitted.add(event.opportunityId);
    if (event.kind === "outcome") value.outcomes.add(event.opportunityId);
    if (event.kind === "completed") value.accomplishments.add(event.opportunityId);
  }
  for (const selection of materialSelections) {
    const [date, id] = selection.split("|");
    const year = yearOf(date);
    if (year && id) get(year).materialSelections.add(id);
  }
  return [...years.entries()].sort(([left], [right]) => right.localeCompare(left)).slice(0, 6).map(([year, value]) => ({
    year,
    pursued: value.pursued.size,
    submitted: value.submitted.size,
    outcomes: value.outcomes.size,
    accomplishments: value.accomplishments.size,
    materialSelections: value.materialSelections.size,
  }));
}

function safeProjection<T>(fallback: T, projection: () => T): T {
  try { return projection(); } catch { return fallback; }
}

export function buildOpportunityInsights(input: { account: AccountData; opportunities: readonly Opportunity[]; period?: InsightsPeriod; now?: Date }): OpportunityInsightsModel {
  const now = input.now ?? new Date();
  const period = input.period ?? "all";
  const opportunityById = new Map(input.opportunities.map((opportunity) => [opportunity.id, opportunity]));
  const tracked = canonicalTracked(input.account);
  const accomplishmentsModel = safeProjection<ReturnType<typeof buildAccomplishmentsModel>>(
    { records: [], groups: [], summary: [], total: 0, journeyCount: 0, manualCount: 0 },
    () => buildAccomplishmentsModel({ account: input.account, opportunities: input.opportunities }),
  );
  const accomplishments = accomplishmentsModel.records;
  const accomplishmentIds = new Set(accomplishments.flatMap((record) => record.canonicalOpportunityId ? [record.canonicalOpportunityId] : record.journeyOpportunityId ? [record.journeyOpportunityId] : []));
  const events = datedEvents(tracked, accomplishments, opportunityById);
  const filteredEvents = events.filter((event) => inPeriod(event.occurredAt, period, now));
  const applicationFacts = [...tracked.entries()].flatMap(([id, record]) => {
    const opportunity = opportunityById.get(id);
    if (!opportunity) return [];
    const fact = applicationFact(opportunity, record);
    return fact ? [fact] : [];
  });
  const applications = applicationFacts.filter((fact) => fact.submitted && (period === "all" || inPeriod(fact.submittedAt, period, now)));
  const accepted = applications.filter((fact) => fact.accepted).length;
  const notSelected = applications.filter((fact) => fact.notSelected).length;
  const withdrawnOrDeclined = applications.filter((fact) => fact.withdrawnOrDeclined).length;
  const awaiting = applications.filter((fact) => !fact.accepted && !fact.notSelected && !fact.withdrawnOrDeclined).length;
  const applicationCoverageComplete = applications.every((fact) => fact.submittedAt);

  const categoryCounts = new Map<string, { pursued: Set<string>; completed: Set<string> }>();
  const completedInPeriod = new Set(filteredEvents.filter((event) => event.kind === "completed").map((event) => event.opportunityId));
  for (const [id, record] of tracked) {
    const opportunity = opportunityById.get(id);
    if (!opportunity) continue;
    const category = categoryFor(opportunity);
    const value = categoryCounts.get(category.id) ?? { pursued: new Set<string>(), completed: new Set<string>() };
    if (inPeriod(record.savedAt, period, now)) value.pursued.add(id);
    if (completedInPeriod.has(id) || period === "all" && (record.status === "Completed" || accomplishmentIds.has(id))) value.completed.add(id);
    categoryCounts.set(category.id, value);
  }
  for (const accomplishment of accomplishments.filter((record) => inPeriod(record.outcomeDate, period, now))) {
    const linkedOpportunityId = accomplishment.canonicalOpportunityId ?? accomplishment.journeyOpportunityId;
    if (linkedOpportunityId && tracked.has(linkedOpportunityId)) continue;
    const category = categoryDefinitions.find((item) => item.pattern.test(`${accomplishment.snapshot.opportunityType ?? ""} ${accomplishment.snapshot.category ?? ""} ${accomplishment.kind}`)) ?? categoryDefinitions.at(-1)!;
    const value = categoryCounts.get(category.id) ?? { pursued: new Set<string>(), completed: new Set<string>() };
    value.completed.add(`accomplishment:${accomplishment.id}`);
    categoryCounts.set(category.id, value);
  }
  const categories = categoryDefinitions.map((definition) => ({
    id: definition.id,
    label: definition.label,
    pursued: categoryCounts.get(definition.id)?.pursued.size ?? 0,
    completed: categoryCounts.get(definition.id)?.completed.size ?? 0,
    discoverHref: definition.href,
  }));

  const materials = normalizeApplicationMaterialStore(input.account.applicationMaterials);
  const materialUsage = new Map<string, { title: string; type: ApplicationMaterialType; opportunities: Set<string> }>();
  const selectionDates: string[] = [];
  for (const association of Object.values(materials.associations)) {
    selectionDates.push(`${association.selectedAt}|${association.id}`);
    if (!inPeriod(association.selectedAt, period, now)) continue;
    const record = materials.records[association.materialId];
    const current = materialUsage.get(association.materialId) ?? { title: record?.title ?? association.materialSnapshot.title, type: record?.type ?? association.materialSnapshot.type, opportunities: new Set<string>() };
    current.opportunities.add(association.opportunityId);
    materialUsage.set(association.materialId, current);
  }
  const requirementPatterns = new Map<ApplicationMaterialType, Set<string>>();
  for (const [id, record] of tracked) {
    if (!inPeriod(record.savedAt, period, now)) continue;
    const opportunity = opportunityById.get(id);
    if (!opportunity) continue;
    const seen = new Set<ApplicationMaterialType>();
    for (const requirement of verifiedApplicationRequirements(opportunity)) {
      const type = materialTypeForRequirement(requirement);
      if (!type || seen.has(type)) continue;
      seen.add(type);
      const applicationsForType = requirementPatterns.get(type) ?? new Set<string>();
      applicationsForType.add(id);
      requirementPatterns.set(type, applicationsForType);
    }
  }

  const activeIds = new Set([...tracked.values()].filter((record) => !terminalStatuses.has(record.status)).map((record) => record.id));
  const watchedIds = new Set((input.account.watchedOpportunities ?? []).map((record) => record.opportunityId));
  const historicalOpportunityIds = [...new Set([...tracked.keys(), ...accomplishmentIds, ...watchedIds])];
  const pathHistory = safeProjection<OpportunityInsightsModel["paths"]>([], () => opportunityPaths.flatMap((path) => {
    const assigned = new Set<string>();
    const stages = path.stages.map((stage) => {
      const ids = historicalOpportunityIds.filter((id) => {
        if (assigned.has(id)) return false;
        const opportunity = opportunityById.get(id);
        return Boolean(opportunity && opportunityMatchesPathStage(opportunity, stage));
      });
      ids.forEach((id) => assigned.add(id));
      return {
        name: stage.name,
        completed: ids.filter((id) => accomplishmentIds.has(id) || tracked.get(id)?.status === "Completed").length,
        inJourney: ids.filter((id) => activeIds.has(id)).length,
        watching: ids.filter((id) => watchedIds.has(id)).length,
      };
    });
    const followed = Boolean(input.account.pathPreferences?.[path.id]);
    const totals = stages.reduce((sum, stage) => ({ completed: sum.completed + stage.completed, inJourney: sum.inJourney + stage.inJourney, watching: sum.watching + stage.watching }), { completed: 0, inJourney: 0, watching: 0 });
    return followed || totals.completed + totals.inJourney + totals.watching > 0 ? [{ id: path.id, name: path.name, followed, ...totals, stages: stages.filter((stage) => stage.completed + stage.inJourney + stage.watching > 0) }] : [];
  }).sort((left, right) => Number(right.followed) - Number(left.followed) || (right.completed + right.inJourney + right.watching) - (left.completed + left.inJourney + left.watching) || left.name.localeCompare(right.name)).slice(0, 6));

  const filteredAccomplishments = accomplishments.filter((record) => inPeriod(record.outcomeDate, period, now));
  const accomplishmentGroups = new Map<string, number>();
  for (const accomplishment of filteredAccomplishments) accomplishmentGroups.set(accomplishment.kind, (accomplishmentGroups.get(accomplishment.kind) ?? 0) + 1);
  const submittedByMonth = new Map<number, number>();
  for (const event of events.filter((item) => item.kind === "submitted")) {
    const month = new Date(event.occurredAt).getUTCMonth();
    submittedByMonth.set(month, (submittedByMonth.get(month) ?? 0) + 1);
  }
  const busiest = [...submittedByMonth.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0];
  const seasonality = busiest && events.filter((item) => item.kind === "submitted").length >= 4 ? {
    month: new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, busiest[0], 1))),
    count: busiest[1],
    detail: `${busiest[1]} recorded ${busiest[1] === 1 ? "submission falls" : "submissions fall"} in this month.`,
  } : undefined;
  const earliest = events.map((event) => event.occurredAt).sort()[0];
  const progressionCompleted = new Set(filteredEvents.filter((event) => event.kind === "completed").map((event) => event.opportunityId)).size;
  const outcomesRecorded = accepted + notSelected + withdrawnOrDeclined;
  const activeJourney = [...tracked.values()].filter((record) => !terminalStatuses.has(record.status)).length;

  return {
    period,
    periodLabel: periodLabel(period, now),
    recordedSince: earliest ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(earliest)) : undefined,
    sparse: tracked.size <= 1 && applications.length === 0 && filteredAccomplishments.length === 0,
    overview: { activeJourney, applicationsSubmitted: applications.length, outcomesRecorded, accomplishments: filteredAccomplishments.length },
    applications: {
      submitted: applications.length,
      awaiting,
      accepted,
      notSelected,
      withdrawnOrDeclined,
      datedSubmissions: applications.filter((fact) => fact.submittedAt).length,
      coverage: applicationCoverageComplete
        ? { level: "fully_supported", detail: "Every counted submission has a recorded Journey event." }
        : { level: "partially_supported", detail: "Some counts come from current Journey stages without an exact historical date." },
    },
    progression: [
      { id: "pursued", label: "Added to Journey", count: new Set(filteredEvents.filter((event) => event.kind === "added").map((event) => event.opportunityId)).size },
      { id: "submitted", label: "Applications or entries", count: new Set(filteredEvents.filter((event) => event.kind === "submitted").map((event) => event.opportunityId)).size },
      { id: "accepted", label: "Accepted or awarded", count: accepted },
      { id: "completed", label: "Completed", count: progressionCompleted },
    ],
    categories,
    activity: activitySeries(events, period, now),
    accomplishments: { total: filteredAccomplishments.length, groups: [...accomplishmentGroups.entries()].map(([kind, count]) => ({ label: accomplishmentKindLabels[kind as keyof typeof accomplishmentKindLabels], count })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)) },
    paths: pathHistory,
    materials: {
      reuse: [...materialUsage.entries()].map(([materialId, value]) => ({ materialId, title: value.title, typeLabel: applicationMaterialTypeLabels[value.type], applicationCount: value.opportunities.size })).sort((left, right) => right.applicationCount - left.applicationCount || left.title.localeCompare(right.title)).slice(0, 8),
      requirements: [...requirementPatterns.entries()].map(([type, opportunityIds]) => ({ type, label: applicationMaterialTypeLabels[type], applicationCount: opportunityIds.size })).sort((left, right) => right.applicationCount - left.applicationCount || left.label.localeCompare(right.label)).slice(0, 8),
    },
    watch: { current: input.account.watchedOpportunities?.length ?? 0, coverage: { level: "partially_supported", detail: "Watch shows current records only; earlier removals were not stored as durable history." } },
    seasonality,
    annual: annualRecaps(events, selectionDates),
    coverage: {
      lifecycle: applicationCoverageComplete ? { level: "fully_supported", detail: "Journey event dates support the application history shown." } : { level: "partially_supported", detail: "Legacy Journey stages can support counts without reconstructing missing event dates." },
      watchHistory: { level: "partially_supported", detail: "Only current Watch records have durable account-level timestamps." },
      recommendationAttribution: { level: "unavailable", detail: "Recommendation impressions are privacy-bounded product analytics, not authoritative personal history." },
      discoverySource: { level: "unavailable", detail: "Older Journey records do not retain a reliable first-discovery source." },
      academicYear: { level: "unavailable", detail: "Graduation year does not prove academic standing at the time of an event, so calendar years are used." },
    },
  };
}
