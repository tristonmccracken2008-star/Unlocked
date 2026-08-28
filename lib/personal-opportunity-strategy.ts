import "server-only";

import { normalizeAccomplishmentStore } from "@/data/accomplishments";
import { applicationMaterialTypeLabels, type ApplicationMaterialType } from "@/data/application-materials";
import { opportunityPaths } from "@/data/opportunity-paths";
import type { Opportunity } from "@/data/opportunities";
import type { OpportunityTrackerStatus, TrackedOpportunity } from "@/data/student-activity";
import { normalizeResumeLabStore } from "@/data/resume-lab";
import type { AccountData } from "./account-types";
import { createApplicationMaterialProjectionContext, projectApplicationMaterialReadiness } from "./application-materials";
import { isProUser } from "./billing";
import type { CalendarIntelligenceModel } from "./calendar-intelligence";
import { opportunityMatchesPathStage } from "./opportunity-paths";

export const personalOpportunityStrategyVersion = "personal-opportunity-strategy-v1" as const;

export type StrategyRelationship = "watching" | "pursuing" | "applying";

export type StrategyMixItem = { id: string; label: string; count: number };
export type StrategySimilarityGroup = {
  id: string;
  opportunityIds: string[];
  opportunities: Array<{ id: string; title: string; organization: string }>;
  reasons: string[];
};
export type StrategyGoal = {
  id: string;
  label: string;
  currentCount: number;
  stages: Array<{ id: string; label: string; count: number }>;
};
export type OpportunityStrategyContribution = {
  line?: string;
  details: string[];
  similar: Array<{ id: string; title: string; organization: string }>;
  deadlineOverlapCount: number;
  materialContext?: string;
  resumeContext?: string;
};
export type PersonalOpportunityStrategy = {
  version: typeof personalOpportunityStrategyVersion;
  generatedAt: string;
  pro: boolean;
  currentCount: number;
  pursuingCount: number;
  watchingCount: number;
  activeApplicationCount: number;
  unknownRecordCount: number;
  typeMix: StrategyMixItem[];
  fieldMix: StrategyMixItem[];
  organizationContext: string[];
  timing: {
    knownDeadlineCount: number;
    clusterCount: number;
    summary: string;
    featured?: { startDate: string; endDate: string; deadlineCount: number; applicationCount: number };
  };
  similarities: StrategySimilarityGroup[];
  goals: StrategyGoal[];
  watching: { count: number; overlappingCount: number };
  applications: {
    activeCount: number;
    openRequirementCount: number;
    recurringRequirements: Array<{ label: string; applicationCount: number }>;
  };
  historyContext: string[];
};

type StrategyItem = {
  opportunity: Opportunity;
  relationship: StrategyRelationship;
  status?: OpportunityTrackerStatus;
  type: string;
  field: string;
  organization: string;
  requirements: string[];
  pathStages: string[];
};

export type OpportunityStrategyContext = {
  account: AccountData;
  now: Date;
  pro: boolean;
  opportunityById: ReadonlyMap<string, Opportunity>;
  current: StrategyItem[];
  pursuing: StrategyItem[];
  watching: StrategyItem[];
  applications: StrategyItem[];
  signatures: ReadonlyMap<string, Map<string, string>>;
  deadlineDates: Array<{ opportunityId: string; date: string }>;
  materialContext: ReturnType<typeof createApplicationMaterialProjectionContext>;
};

const terminalStatuses = new Set<OpportunityTrackerStatus>(["Rejected", "Completed"]);
const applicationStatuses = new Set<OpportunityTrackerStatus>(["Applying", "Submitted", "Interview", "Accepted"]);
const normalizedCache = new Map<string, string>();

function normalized(value: string) {
  const cached = normalizedCache.get(value);
  if (cached !== undefined) return cached;
  const result = value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
  if (normalizedCache.size < 2_000) normalizedCache.set(value, result);
  return result;
}

function trackedRecords(account: AccountData) {
  return { ...(account.activity?.tracked ?? {}), ...(account.tracker ?? {}) };
}

export function strategyOpportunityIds(account: AccountData) {
  return [...new Set([
    ...Object.keys(account.activity?.tracked ?? {}),
    ...Object.keys(account.tracker ?? {}),
    ...account.savedOpportunities.map((record) => record.opportunityId),
    ...(account.watchedOpportunities ?? []).map((record) => record.opportunityId),
  ])];
}

function canonicalField(opportunity: Opportunity) {
  const career = opportunity.metadata.careerPaths?.find(Boolean);
  const research = opportunity.metadata.researchArea?.trim();
  const major = opportunity.majors.find((item) => item !== "Any Major");
  return career || research || major || opportunity.category || opportunity.type;
}

function canonicalType(opportunity: Opportunity) {
  return opportunity.type === "Career" && opportunity.category ? opportunity.category : opportunity.type;
}

function singular(label: string) {
  if (/ies$/i.test(label)) return label.replace(/ies$/i, "y");
  if (/ships$/i.test(label)) return label.replace(/s$/i, "");
  return label.replace(/s$/i, "");
}

function requirementShape(opportunity: Opportunity) {
  const text = (opportunity.metadata.applicationRequirements ?? []).map(normalized);
  const groups = [
    ["resume", /resume|curriculum vitae|\bcv\b/],
    ["transcript", /transcript|academic record/],
    ["essay", /essay|personal statement|statement of purpose|writing sample/],
    ["recommendation", /recommendation|reference|nomination/],
    ["portfolio", /portfolio|project sample|work sample/],
    ["interview", /interview/],
  ] as const;
  return groups.flatMap(([label, pattern]) => text.some((value) => pattern.test(value)) ? [label] : []);
}

function pathStages(opportunity: Opportunity) {
  return opportunityPaths.flatMap((path) => path.stages.flatMap((stage) =>
    opportunityMatchesPathStage(opportunity, stage) ? [`${path.id}:${stage.id}`] : [],
  ));
}

function relationshipFor(record: TrackedOpportunity | undefined): StrategyRelationship {
  return record && applicationStatuses.has(record.status) ? "applying" : "pursuing";
}

function toItem(opportunity: Opportunity, relationship: StrategyRelationship, status?: OpportunityTrackerStatus): StrategyItem {
  return {
    opportunity,
    relationship,
    status,
    type: canonicalType(opportunity),
    field: canonicalField(opportunity),
    organization: opportunity.organization,
    requirements: requirementShape(opportunity),
    pathStages: pathStages(opportunity),
  };
}

function signature(item: StrategyItem) {
  const values = new Map<string, string>();
  values.set("type", normalized(item.type));
  values.set("field", normalized(item.field));
  values.set("organization", normalized(item.organization));
  for (const value of item.requirements) values.set(`requirement:${value}`, value);
  for (const value of item.pathStages) values.set(`path:${value}`, value);
  const mode = item.opportunity.remote === true ? "remote" : item.opportunity.metadata.workMode ? normalized(item.opportunity.metadata.workMode) : "";
  if (mode) values.set("mode", mode);
  return values;
}

export function createOpportunityStrategyContext(input: {
  account: AccountData;
  opportunities: readonly Opportunity[];
  now?: Date;
}): OpportunityStrategyContext {
  const now = input.now ?? new Date();
  const opportunityById = new Map(input.opportunities.map((item) => [item.id, item]));
  const tracked = trackedRecords(input.account);
  const trackedIds = new Set(Object.keys(tracked));
  const currentById = new Map<string, StrategyItem>();
  for (const [id, record] of Object.entries(tracked)) {
    const opportunity = opportunityById.get(id);
    if (!opportunity || terminalStatuses.has(record.status)) continue;
    currentById.set(id, toItem(opportunity, relationshipFor(record), record.status));
  }
  for (const record of input.account.savedOpportunities) {
    if (trackedIds.has(record.opportunityId) || currentById.has(record.opportunityId)) continue;
    const opportunity = opportunityById.get(record.opportunityId);
    if (opportunity) currentById.set(opportunity.id, toItem(opportunity, "pursuing", "Saved"));
  }
  for (const watch of input.account.watchedOpportunities ?? []) {
    if (trackedIds.has(watch.opportunityId) || currentById.has(watch.opportunityId)) continue;
    const opportunity = opportunityById.get(watch.opportunityId);
    if (opportunity) currentById.set(opportunity.id, toItem(opportunity, "watching"));
  }
  const current = [...currentById.values()];
  const signatures = new Map(current.map((item) => [item.opportunity.id, signature(item)]));
  const deadlineDates = current.filter((item) => item.relationship === "applying").flatMap((item) => {
    const verified = item.opportunity.metadata.verification?.deadlineVerified === true;
    return verified && item.opportunity.application_deadline ? [{ opportunityId: item.opportunity.id, date: item.opportunity.application_deadline }] : [];
  });
  return {
    account: input.account,
    now,
    pro: isProUser(input.account.billing),
    opportunityById,
    current,
    pursuing: current.filter((item) => item.relationship !== "watching"),
    watching: current.filter((item) => item.relationship === "watching"),
    applications: current.filter((item) => item.relationship === "applying"),
    signatures,
    deadlineDates,
    materialContext: createApplicationMaterialProjectionContext(input.account.applicationMaterials),
  };
}

function countMix(values: readonly string[]): StrategyMixItem[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const label of values.filter(Boolean)) {
    const id = normalized(label);
    const current = counts.get(id) ?? { label, count: 0 };
    current.count += 1;
    counts.set(id, current);
  }
  return [...counts.entries()].map(([id, value]) => ({ id, ...value }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function overlap(left: Map<string, string>, right: Map<string, string>) {
  const reasons: string[] = [];
  let score = 0;
  if (left.get("type") === right.get("type")) { score += 2; reasons.push("same opportunity type"); }
  if (left.get("field") === right.get("field")) { score += 2; reasons.push("same field"); }
  if (left.get("organization") === right.get("organization")) { score += 3; reasons.push("same organization"); }
  const sharedPaths = [...left.keys()].some((key) => key.startsWith("path:") && right.has(key));
  if (sharedPaths) { score += 2; reasons.push("same Path stage"); }
  const sharedRequirements = [...left.keys()].some((key) => key.startsWith("requirement:") && right.has(key));
  if (sharedRequirements) { score += 1; reasons.push("similar requirements"); }
  if (left.get("mode") && left.get("mode") === right.get("mode")) score += 1;
  return { score, reasons };
}

function similarityGroups(context: OpportunityStrategyContext): StrategySimilarityGroup[] {
  const bucket = new Map<string, Set<string>>();
  for (const item of context.pursuing) {
    const signatureValues = context.signatures.get(item.opportunity.id);
    if (!signatureValues) continue;
    for (const [key, value] of signatureValues) {
      if (!["type", "field", "organization"].includes(key) && !key.startsWith("path:")) continue;
      const bucketKey = `${key}:${value}`;
      const ids = bucket.get(bucketKey) ?? new Set<string>();
      ids.add(item.opportunity.id);
      bucket.set(bucketKey, ids);
    }
  }
  const candidatePairs = new Set<string>();
  for (const ids of bucket.values()) {
    const ordered = [...ids].sort();
    for (let left = 0; left < ordered.length; left += 1) for (let right = left + 1; right < ordered.length; right += 1) {
      candidatePairs.add(`${ordered[left]}|${ordered[right]}`);
    }
  }
  const adjacency = new Map<string, Set<string>>();
  const pairReasons = new Map<string, string[]>();
  for (const key of candidatePairs) {
    const [leftId, rightId] = key.split("|");
    const left = context.signatures.get(leftId);
    const right = context.signatures.get(rightId);
    if (!left || !right) continue;
    const result = overlap(left, right);
    if (result.score < 5) continue;
    const leftNeighbors = adjacency.get(leftId) ?? new Set<string>(); leftNeighbors.add(rightId); adjacency.set(leftId, leftNeighbors);
    const rightNeighbors = adjacency.get(rightId) ?? new Set<string>(); rightNeighbors.add(leftId); adjacency.set(rightId, rightNeighbors);
    pairReasons.set(key, result.reasons);
  }
  const visited = new Set<string>();
  const groups: StrategySimilarityGroup[] = [];
  for (const root of [...adjacency.keys()].sort()) {
    if (visited.has(root)) continue;
    const stack = [root];
    const ids: string[] = [];
    while (stack.length) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id); ids.push(id);
      for (const neighbor of adjacency.get(id) ?? []) stack.push(neighbor);
    }
    if (ids.length < 2) continue;
    const reasonCounts = new Map<string, number>();
    const groupIds = new Set(ids);
    for (const [pair, reasons] of pairReasons) {
      const [leftId, rightId] = pair.split("|");
      if (!groupIds.has(leftId) || !groupIds.has(rightId)) continue;
      for (const reason of reasons) reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
    groups.push({
      id: `similar:${ids.sort().join(":")}`,
      opportunityIds: ids,
      opportunities: ids.flatMap((id) => {
        const opportunity = context.opportunityById.get(id);
        return opportunity ? [{ id, title: opportunity.title, organization: opportunity.organization }] : [];
      }),
      reasons: [...reasonCounts].sort((left, right) => right[1] - left[1]).map(([reason]) => reason).slice(0, 3),
    });
  }
  return groups.sort((left, right) => right.opportunityIds.length - left.opportunityIds.length || left.id.localeCompare(right.id));
}

function goalContext(context: OpportunityStrategyContext): StrategyGoal[] {
  const followed = new Set(Object.keys(context.account.pathPreferences ?? {}));
  return opportunityPaths.filter((path) => followed.has(path.id)).map((path) => {
    const stages = path.stages.map((stage) => ({
      id: stage.id,
      label: stage.name,
      count: context.pursuing.filter((item) => opportunityMatchesPathStage(item.opportunity, stage)).length,
    }));
    return { id: path.id, label: path.shortName, currentCount: stages.reduce((sum, stage) => sum + stage.count, 0), stages };
  });
}

function applicationContext(context: OpportunityStrategyContext) {
  const recurring = new Map<ApplicationMaterialType, number>();
  let openRequirementCount = 0;
  for (const item of context.applications) {
    const readiness = projectApplicationMaterialReadiness({ opportunity: item.opportunity, store: context.account.applicationMaterials, context: context.materialContext });
    openRequirementCount += readiness.missingCount;
    for (const requirement of readiness.mappedRequirements) recurring.set(requirement.type, (recurring.get(requirement.type) ?? 0) + 1);
  }
  return {
    activeCount: context.applications.length,
    openRequirementCount,
    recurringRequirements: [...recurring.entries()].filter(([, count]) => count >= 2)
      .map(([type, applicationCount]) => ({ label: applicationMaterialTypeLabels[type], applicationCount }))
      .sort((left, right) => right.applicationCount - left.applicationCount || left.label.localeCompare(right.label)),
  };
}

function timingContext(context: OpportunityStrategyContext, calendar?: CalendarIntelligenceModel) {
  const period = calendar?.periods["90"];
  const clusters = period?.clusters ?? [];
  const featured = period?.featuredClusterId ? clusters.find((cluster) => cluster.id === period.featuredClusterId) : clusters[0];
  const knownDeadlineCount = period?.deadlineCount ?? context.deadlineDates.length;
  return {
    knownDeadlineCount,
    clusterCount: clusters.length,
    summary: featured
      ? `${featured.deadlineCount} application ${featured.deadlineCount === 1 ? "deadline falls" : "deadlines fall"} within ${featured.spanDays} days.`
      : knownDeadlineCount ? `${knownDeadlineCount} verified ${knownDeadlineCount === 1 ? "deadline is" : "deadlines are"} currently recorded.` : "No verified application deadlines are currently recorded.",
    featured: featured ? { startDate: featured.startDate, endDate: featured.endDate, deadlineCount: featured.deadlineCount, applicationCount: featured.applicationCount } : undefined,
  };
}

export function buildPersonalOpportunityStrategy(input: {
  context: OpportunityStrategyContext;
  calendar?: CalendarIntelligenceModel;
}): PersonalOpportunityStrategy {
  const { context } = input;
  const similarities = similarityGroups(context);
  const organizations = countMix(context.pursuing.map((item) => item.organization)).filter((item) => item.count >= 2);
  const completed = Object.values(normalizeAccomplishmentStore(context.account.accomplishments)).filter((item) => !item.hidden);
  const completedMix = countMix(completed.map((item) => item.snapshot.opportunityType || item.snapshot.category || item.kind));
  const historyContext = completedMix.slice(0, 3).map((item) => `${item.count} ${item.label.toLowerCase()} ${item.count === 1 ? "experience" : "experiences"} recorded previously`);
  const overlappingWatch = context.watching.filter((item) => {
    const candidate = context.signatures.get(item.opportunity.id);
    return candidate && context.pursuing.some((current) => {
      const currentSignature = context.signatures.get(current.opportunity.id);
      return currentSignature ? overlap(candidate, currentSignature).score >= 5 : false;
    });
  }).length;
  return {
    version: personalOpportunityStrategyVersion,
    generatedAt: context.now.toISOString(),
    pro: context.pro,
    currentCount: context.current.length,
    pursuingCount: context.pursuing.length,
    watchingCount: context.watching.length,
    activeApplicationCount: context.applications.length,
    unknownRecordCount: Math.max(0, strategyOpportunityIds(context.account).length - context.current.length - Object.values(trackedRecords(context.account)).filter((record) => terminalStatuses.has(record.status)).length),
    typeMix: countMix(context.pursuing.map((item) => item.type)),
    fieldMix: countMix(context.pursuing.map((item) => item.field)),
    organizationContext: organizations.slice(0, 3).map((item) => `${item.count} current opportunities are from ${item.label}.`),
    timing: timingContext(context, input.calendar),
    similarities: context.pro ? similarities : [],
    goals: context.pro ? goalContext(context) : [],
    watching: { count: context.watching.length, overlappingCount: overlappingWatch },
    applications: applicationContext(context),
    historyContext,
  };
}

function sameWeek(deadline: string, current: string) {
  const delta = Math.abs(Date.parse(`${deadline}T12:00:00Z`) - Date.parse(`${current}T12:00:00Z`));
  return Number.isFinite(delta) && delta <= 7 * 86_400_000;
}

export function projectOpportunityStrategyContribution(context: OpportunityStrategyContext, opportunity: Opportunity): OpportunityStrategyContribution {
  const candidate = toItem(opportunity, "watching");
  const candidateSignature = signature(candidate);
  const similar = context.pursuing.flatMap((item) => {
    const current = context.signatures.get(item.opportunity.id);
    return current && overlap(candidateSignature, current).score >= 5
      ? [{ id: item.opportunity.id, title: item.opportunity.title, organization: item.opportunity.organization }]
      : [];
  }).slice(0, 3);
  const details: string[] = [];
  const existingTypes = new Set(context.pursuing.map((item) => normalized(item.type)));
  const existingFields = new Set(context.pursuing.map((item) => normalized(item.field)));
  const existingOrganizations = new Set(context.pursuing.map((item) => normalized(item.organization)));
  if (context.pursuing.length && !existingTypes.has(normalized(candidate.type))) details.push(`First ${singular(candidate.type).toLowerCase()} among your current opportunities.`);
  else if (context.pursuing.length && !existingFields.has(normalized(candidate.field))) details.push(`Adds a new field: ${candidate.field}.`);
  else if (context.pursuing.length && !existingOrganizations.has(normalized(candidate.organization))) details.push(`Adds a new organization: ${candidate.organization}.`);
  if (similar.length) details.push(`Similar to ${similar.length} ${similar.length === 1 ? "opportunity" : "opportunities"} already in Journey.`);
  const deadlineOverlapCount = opportunity.metadata.verification?.deadlineVerified === true && opportunity.application_deadline
    ? context.deadlineDates.filter((item) => item.opportunityId !== opportunity.id && sameWeek(opportunity.application_deadline!, item.date)).length
    : 0;
  if (deadlineOverlapCount) details.push(`Deadline falls within a week of ${deadlineOverlapCount} current application ${deadlineOverlapCount === 1 ? "deadline" : "deadlines"}.`);
  const readiness = projectApplicationMaterialReadiness({ opportunity, store: context.account.applicationMaterials, context: context.materialContext });
  const materialContext = readiness.requirementsVerified && readiness.mappedRequirements.length && readiness.availableCount === readiness.mappedRequirements.length
    ? "Your recorded Materials cover the known reusable requirements."
    : undefined;
  if (materialContext) details.push(materialContext);
  const resumes = Object.values(normalizeResumeLabStore(context.account.resumeLab).resumes).filter((resume) => !resume.archivedAt);
  const targeted = resumes.find((resume) => resume.target.type === "opportunity" && resume.target.id === opportunity.id);
  const resumeContext = targeted ? "A targeted resume is already recorded for this opportunity." : undefined;
  if (resumeContext) details.push(resumeContext);
  return { line: details[0], details: details.slice(0, 4), similar, deadlineOverlapCount, materialContext, resumeContext };
}
