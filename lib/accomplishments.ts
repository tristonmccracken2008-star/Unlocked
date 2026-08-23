import "server-only";

import type { Opportunity } from "@/data/opportunities";
import {
  accomplishmentKindLabels,
  accomplishmentOutcomeLabels,
  type AccomplishmentKind,
  type AccomplishmentOutcome,
  type AccomplishmentRecord,
  type AccomplishmentStore,
} from "@/data/accomplishments";
import { getJourneyProfessionalWorkflow, journeyWorkflowKind, resolveJourneyProfessionalStage } from "@/data/journey-professional";
import type { TrackedOpportunity } from "@/data/student-activity";
import type { AccountData } from "./account-types";

export type AccomplishmentView = AccomplishmentRecord & {
  year: string;
  kindLabel: string;
  outcomeLabel: string;
  opportunityHref?: string;
  journeyHref?: string;
};

export type AccomplishmentsModel = {
  records: AccomplishmentView[];
  groups: Array<{ year: string; records: AccomplishmentView[] }>;
  summary: Array<{ kind: AccomplishmentKind; label: string; count: number }>;
  total: number;
  journeyCount: number;
  manualCount: number;
};

function dateOnly(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function kindFor(opportunity: Pick<Opportunity, "type" | "category">): AccomplishmentKind {
  const value = `${opportunity.type} ${opportunity.category}`.toLowerCase();
  if (/internship|co-op|campus job|career/.test(value)) return "internship";
  if (/research/.test(value)) return "research";
  if (/scholarship|grant|financial/.test(value)) return "scholarship";
  if (/fellowship/.test(value)) return "fellowship";
  if (/competition|challenge|hackathon/.test(value)) return "competition";
  if (/leadership|student organization/.test(value)) return "leadership";
  if (/project/.test(value)) return "project";
  if (/program|conference|study abroad|certification/.test(value)) return "program";
  return "other";
}

function meaningfulResource(opportunity: Pick<Opportunity, "type" | "category">) {
  return /fellowship|program|conference|study abroad|certification|leadership|student organization|campus job|co-op|project/i.test(`${opportunity.type} ${opportunity.category}`);
}

export function journeyAccomplishmentOutcome(opportunity: Opportunity, record: TrackedOpportunity): AccomplishmentOutcome | null {
  const workflow = getJourneyProfessionalWorkflow(opportunity);
  const stage = resolveJourneyProfessionalStage(record, workflow);
  if (workflow.id === "career") return stage.id === "completed_program" ? "completed" : null;
  if (workflow.id === "scholarship") return stage.id === "awarded" ? "awarded" : stage.id === "funds_received" ? "completed" : null;
  if (workflow.id === "research") return stage.id === "research_completed" ? "completed" : null;
  if (workflow.id === "competition") {
    if (stage.id === "participated") return "participated";
    if (stage.id === "competition_finalist") return "finalist";
    if (stage.id === "placed") return "placed";
    if (stage.id === "winner") return "won";
    return stage.id === "competition_completed" ? "completed" : null;
  }
  return stage.id === "resource_completed" && meaningfulResource(opportunity) ? "completed" : null;
}

function journeyOutcomeDate(record: TrackedOpportunity) {
  const matching = [...(record.history ?? [])].reverse().find((item) => item.professionalStageId === record.professionalStageId);
  return dateOnly(matching?.details?.milestoneDate ?? matching?.occurredAt ?? record.updatedAt);
}

export function reconcileJourneyAccomplishment(input: {
  account: AccountData;
  opportunity: Opportunity;
  record: TrackedOpportunity;
  now: string;
}): AccomplishmentStore {
  const id = `journey:${input.record.id}`;
  const current = input.account.accomplishments?.[id];
  const outcome = journeyAccomplishmentOutcome(input.opportunity, input.record);
  const next = { ...(input.account.accomplishments ?? {}) };
  if (!outcome) {
    if (current && !current.inactiveAt) next[id] = { ...current, inactiveAt: input.now, updatedAt: input.now, version: current.version + 1 };
    return next;
  }
  const record: AccomplishmentRecord = {
    id,
    source: "journey",
    canonicalOpportunityId: input.opportunity.id,
    journeyOpportunityId: input.record.id,
    snapshot: current?.snapshot ?? {
      title: input.opportunity.title,
      organization: input.opportunity.organization,
      opportunityType: input.opportunity.type,
      category: input.opportunity.category,
      capturedAt: input.now,
    },
    kind: current?.kind ?? kindFor(input.opportunity),
    outcome,
    outcomeDate: journeyOutcomeDate(input.record),
    startDate: current?.startDate,
    endDate: current?.endDate,
    roleTitle: current?.roleTitle,
    team: current?.team,
    location: current?.location ?? input.opportunity.location,
    projectTitle: current?.projectTitle,
    mentor: current?.mentor,
    labOrGroup: current?.labOrGroup,
    researchArea: current?.researchArea,
    placement: current?.placement,
    awardAmount: current?.awardAmount,
    description: current?.description,
    notes: current?.notes,
    skills: current?.skills,
    hidden: current?.hidden ?? false,
    inactiveAt: undefined,
    createdAt: current?.createdAt ?? input.now,
    updatedAt: input.now,
    version: current ? current.version + Number(current.outcome !== outcome || Boolean(current.inactiveAt)) : 0,
    lastMutationKey: current?.lastMutationKey,
  };
  next[id] = record;
  return next;
}

function synthesizedJourneyRecord(opportunity: Opportunity, tracked: TrackedOpportunity): AccomplishmentRecord | null {
  const outcome = journeyAccomplishmentOutcome(opportunity, tracked);
  if (!outcome) return null;
  const capturedAt = tracked.updatedAt;
  return {
    id: `journey:${tracked.id}`,
    source: "journey",
    canonicalOpportunityId: opportunity.id,
    journeyOpportunityId: tracked.id,
    snapshot: { title: opportunity.title, organization: opportunity.organization, opportunityType: opportunity.type, category: opportunity.category, capturedAt },
    kind: kindFor(opportunity),
    outcome,
    outcomeDate: journeyOutcomeDate(tracked),
    location: opportunity.location,
    hidden: false,
    createdAt: capturedAt,
    updatedAt: capturedAt,
    version: 0,
  };
}

export function buildAccomplishmentsModel(input: { account: AccountData; opportunities: readonly Opportunity[] }): AccomplishmentsModel {
  const opportunityById = new Map(input.opportunities.map((item) => [item.id, item]));
  const tracked = { ...(input.account.activity?.tracked ?? {}), ...(input.account.tracker ?? {}) };
  const records = new Map<string, AccomplishmentRecord>();
  for (const record of Object.values(input.account.accomplishments ?? {})) {
    if (record.source === "manual" && !record.hidden && !record.inactiveAt) records.set(record.id, record);
  }
  for (const trackedRecord of Object.values(tracked)) {
    const opportunity = opportunityById.get(trackedRecord.id);
    if (!opportunity) continue;
    const eligible = journeyAccomplishmentOutcome(opportunity, trackedRecord);
    if (!eligible) continue;
    const stored = input.account.accomplishments?.[`journey:${trackedRecord.id}`];
    const record = stored && !stored.hidden ? { ...stored, outcome: eligible, inactiveAt: undefined } : stored?.hidden ? null : synthesizedJourneyRecord(opportunity, trackedRecord);
    if (record) records.set(record.id, record);
  }
  const views = [...records.values()].map((record): AccomplishmentView => ({
    ...record,
    year: record.outcomeDate.slice(0, 4),
    kindLabel: accomplishmentKindLabels[record.kind],
    outcomeLabel: accomplishmentOutcomeLabels[record.outcome],
    opportunityHref: record.canonicalOpportunityId ? `/opportunities/${encodeURIComponent(record.canonicalOpportunityId)}` : undefined,
    journeyHref: record.journeyOpportunityId ? `/?q=${encodeURIComponent(record.snapshot.title)}#journey-record-${encodeURIComponent(record.journeyOpportunityId)}` : undefined,
  })).sort((left, right) => right.outcomeDate.localeCompare(left.outcomeDate) || right.updatedAt.localeCompare(left.updatedAt) || left.snapshot.title.localeCompare(right.snapshot.title));
  const years = [...new Set(views.map((record) => record.year))];
  const counts = new Map<AccomplishmentKind, number>();
  for (const record of views) counts.set(record.kind, (counts.get(record.kind) ?? 0) + 1);
  return {
    records: views,
    groups: years.map((year) => ({ year, records: views.filter((record) => record.year === year) })),
    summary: [...counts.entries()].sort((left, right) => right[1] - left[1] || accomplishmentKindLabels[left[0]].localeCompare(accomplishmentKindLabels[right[0]])).map(([kind, count]) => ({ kind, label: accomplishmentKindLabels[kind], count })),
    total: views.length,
    journeyCount: views.filter((record) => record.source === "journey").length,
    manualCount: views.filter((record) => record.source === "manual").length,
  };
}

export function workflowKindForRecord(opportunity: Opportunity) {
  return journeyWorkflowKind(opportunity);
}
