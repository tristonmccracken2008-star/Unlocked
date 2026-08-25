import type { Opportunity } from "@/data/opportunities";
import type { TrackedOpportunity } from "@/data/student-activity";
import {
  applicationMaterialStatusLabels,
  applicationMaterialTypeLabels,
  materialAssociationId,
  normalizeApplicationMaterialStore,
  type ApplicationMaterialContext,
  type ApplicationMaterialRecord,
  type ApplicationMaterialStore,
  type ApplicationMaterialType,
} from "@/data/application-materials";
import type { AccountData } from "./account-types";
import { verifiedApplicationRequirements } from "@/data/opportunity-trust";

export type MaterialRequirementProjection = {
  title: string;
  type: ApplicationMaterialType;
  typeLabel: string;
  state: "selected" | "available" | "needs_attention" | "missing";
  selected?: ApplicationMaterialRecord;
  candidates: ApplicationMaterialRecord[];
  recentlyAdded: boolean;
};

export type ApplicationMaterialReadiness = {
  opportunityId: string;
  storeVersion: number;
  requirementsVerified: boolean;
  mappedRequirements: MaterialRequirementProjection[];
  availableCount: number;
  missingCount: number;
  summary: string;
};

export type ApplicationMaterialProjectionContext = {
  store: ApplicationMaterialStore;
  recordsByType: ReadonlyMap<ApplicationMaterialType, readonly ApplicationMaterialRecord[]>;
  candidatesByContext: Map<string, ApplicationMaterialRecord[]>;
};

export type ApplicationMaterialRow = ApplicationMaterialRecord & {
  typeLabel: string;
  statusLabel: string;
  selectedFor: Array<{ opportunityId: string; title: string }>;
  relevantApplicationCount: number;
};

export type ApplicationMaterialsModel = {
  storeVersion: number;
  records: ApplicationMaterialRow[];
  ready: ApplicationMaterialRow[];
  needsAttention: ApplicationMaterialRow[];
  archived: ApplicationMaterialRow[];
  applications: Array<{ opportunityId: string; title: string; organization: string; readiness: ApplicationMaterialReadiness }>;
  recurringRequirements: Array<{ type: ApplicationMaterialType; label: string; applicationCount: number; available: boolean; missingApplications: string[] }>;
};

const terminalStatuses = new Set<TrackedOpportunity["status"]>(["Rejected", "Completed"]);

const requirementRules: Array<[ApplicationMaterialType, RegExp]> = [
  ["personal_statement", /\b(personal statement|statement of purpose)\b/i],
  ["cover_letter", /\bcover letter\b/i],
  ["writing_sample", /\b(writing sample|written sample)\b/i],
  ["project_sample", /\b(project sample|work sample|project summary)\b/i],
  ["recommendation", /\b(recommendation|reference|recommender|letter of recommendation)\b/i],
  ["transcript", /\btranscript(s)?\b/i],
  ["resume", /\b(resume|résumé|curriculum vitae|cv)\b/i],
  ["portfolio", /\bportfolio\b/i],
  ["certification", /\b(certification|certificate|license)\b/i],
  ["essay", /\b(essay|short answer|supplemental response)\b/i],
];

export function materialTypeForRequirement(requirement: string): ApplicationMaterialType | null {
  return requirementRules.find(([, pattern]) => pattern.test(requirement))?.[0] ?? null;
}

function contextForOpportunity(opportunity: Opportunity): ApplicationMaterialContext[] {
  const values = new Set<string>([opportunity.category, opportunity.type, ...opportunity.tags, ...opportunity.majors, ...(opportunity.metadata.careerPaths ?? [])].map((item) => item.toLocaleLowerCase()));
  const has = (pattern: RegExp) => [...values].some((item) => pattern.test(item));
  return [
    has(/finance|business|economic|accounting|consult/) ? "finance" : null,
    has(/research|science|academic|graduate/) ? "research" : null,
    has(/software|computer|data|cyber|engineering|technology/) ? "software" : null,
    has(/policy|government|public service|law|civic/) ? "public_service" : null,
    has(/health|medicine|biology|nursing|pre-med/) ? "health" : null,
    has(/journal|humanit|writing|history|arts|media/) ? "humanities" : null,
  ].filter((item): item is ApplicationMaterialContext => Boolean(item));
}

function candidateOrder(contexts: ReadonlySet<ApplicationMaterialContext>, left: ApplicationMaterialRecord, right: ApplicationMaterialRecord) {
  const relevance = (record: ApplicationMaterialRecord) => record.contexts.filter((item) => contexts.has(item)).length * 10 + Number(record.preferred) * 5 + Number(record.contexts.includes("general"));
  return relevance(right) - relevance(left) || right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title);
}

export function createApplicationMaterialProjectionContext(store: ApplicationMaterialStore | null | undefined): ApplicationMaterialProjectionContext {
  const normalized = normalizeApplicationMaterialStore(store);
  const recordsByType = new Map<ApplicationMaterialType, ApplicationMaterialRecord[]>();
  for (const record of Object.values(normalized.records)) {
    if (record.status === "archived") continue;
    const records = recordsByType.get(record.type) ?? [];
    records.push(record);
    recordsByType.set(record.type, records);
  }
  return { store: normalized, recordsByType, candidatesByContext: new Map() };
}

function candidatesFor(context: ApplicationMaterialProjectionContext, type: ApplicationMaterialType, opportunityContexts: ReadonlySet<ApplicationMaterialContext>) {
  const contextKey = [...opportunityContexts].sort().join("|");
  const key = `${type}:${contextKey}`;
  const cached = context.candidatesByContext.get(key);
  if (cached) return cached;
  const candidates = [...(context.recordsByType.get(type) ?? [])].sort((a, b) => candidateOrder(opportunityContexts, a, b));
  context.candidatesByContext.set(key, candidates);
  return candidates;
}

function projectNormalizedApplicationMaterialReadiness(input: {
  opportunity: Opportunity;
  context: ApplicationMaterialProjectionContext;
  recentlyAddedRequirements?: ReadonlySet<string>;
}): ApplicationMaterialReadiness {
  const store = input.context.store;
  const verifiedRequirements = verifiedApplicationRequirements(input.opportunity);
  const opportunityContexts = new Set(contextForOpportunity(input.opportunity));
  const mappedTypes = new Set<ApplicationMaterialType>();
  const mappedRequirements = verifiedRequirements.flatMap((title): MaterialRequirementProjection[] => {
    const type = materialTypeForRequirement(title);
    if (!type || mappedTypes.has(type)) return [];
    mappedTypes.add(type);
    const candidates = candidatesFor(input.context, type, opportunityContexts);
    const association = store.associations[materialAssociationId(input.opportunity.id, type)];
    const selectedRecord = association && !association.materialDeletedAt ? store.records[association.materialId] : undefined;
    const selected = selectedRecord?.status === "archived" ? undefined : selectedRecord;
    const ready = candidates.filter((record) => record.status === "ready");
    const state = selected?.status === "ready" ? "selected" : ready.length ? "available" : candidates.length ? "needs_attention" : "missing";
    return [{ title, type, typeLabel: applicationMaterialTypeLabels[type], state, selected, candidates, recentlyAdded: input.recentlyAddedRequirements?.has(title) ?? false }];
  });
  const availableCount = mappedRequirements.filter((item) => item.state === "selected" || item.state === "available").length;
  const missingCount = mappedRequirements.length - availableCount;
  const requirementsVerified = verifiedRequirements.length > 0;
  return {
    opportunityId: input.opportunity.id,
    storeVersion: store.version,
    requirementsVerified,
    mappedRequirements,
    availableCount,
    missingCount,
    summary: mappedRequirements.length
      ? `${availableCount} of ${mappedRequirements.length} required ${mappedRequirements.length === 1 ? "material" : "materials"} available`
      : requirementsVerified ? "No reusable materials identified in the verified requirements" : "Requirements not fully verified",
  };
}

export function projectApplicationMaterialReadiness(input: {
  opportunity: Opportunity;
  store: ApplicationMaterialStore | null | undefined;
  context?: ApplicationMaterialProjectionContext;
  recentlyAddedRequirements?: ReadonlySet<string>;
}): ApplicationMaterialReadiness {
  return projectNormalizedApplicationMaterialReadiness({ ...input, context: input.context ?? createApplicationMaterialProjectionContext(input.store) });
}

export function buildApplicationMaterialsModel(input: { account: AccountData; opportunities: readonly Opportunity[] }): ApplicationMaterialsModel {
  const projectionContext = createApplicationMaterialProjectionContext(input.account.applicationMaterials);
  const store = projectionContext.store;
  const opportunityById = new Map(input.opportunities.map((item) => [item.id, item]));
  const tracked = { ...(input.account.activity?.tracked ?? {}), ...(input.account.tracker ?? {}) };
  const activeOpportunities = Object.values(tracked).flatMap((record) => {
    const opportunity = opportunityById.get(record.id);
    return opportunity && !terminalStatuses.has(record.status) ? [opportunity] : [];
  });
  const applications = activeOpportunities.flatMap((opportunity) => {
    const readiness = projectNormalizedApplicationMaterialReadiness({ opportunity, context: projectionContext });
    return readiness.requirementsVerified ? [{ opportunityId: opportunity.id, title: opportunity.title, organization: opportunity.organization, readiness }] : [];
  });
  const demand = new Map<ApplicationMaterialType, Set<string>>();
  for (const application of applications) for (const requirement of application.readiness.mappedRequirements) {
    const ids = demand.get(requirement.type) ?? new Set<string>();
    ids.add(application.opportunityId);
    demand.set(requirement.type, ids);
  }
  const selectedByMaterial = new Map<string, Array<{ opportunityId: string; title: string }>>();
  for (const association of Object.values(store.associations)) {
    const opportunity = opportunityById.get(association.opportunityId);
    if (!opportunity) continue;
    const selected = selectedByMaterial.get(association.materialId) ?? [];
    selected.push({ opportunityId: opportunity.id, title: opportunity.title });
    selectedByMaterial.set(association.materialId, selected);
  }
  const records = Object.values(store.records).map((record): ApplicationMaterialRow => ({
    ...record,
    typeLabel: applicationMaterialTypeLabels[record.type],
    statusLabel: applicationMaterialStatusLabels[record.status],
    selectedFor: selectedByMaterial.get(record.id) ?? [],
    relevantApplicationCount: demand.get(record.type)?.size ?? 0,
  })).sort((a, b) => Number(b.preferred) - Number(a.preferred) || b.updatedAt.localeCompare(a.updatedAt));
  const recurringRequirements = [...demand].map(([type, opportunityIds]) => {
    const related = applications.filter((item) => opportunityIds.has(item.opportunityId));
    const available = records.some((record) => record.type === type && record.status === "ready");
    return {
      type,
      label: applicationMaterialTypeLabels[type],
      applicationCount: opportunityIds.size,
      available,
      missingApplications: available ? [] : related.map((item) => item.title),
    };
  }).sort((a, b) => b.applicationCount - a.applicationCount || a.label.localeCompare(b.label));
  return {
    storeVersion: store.version,
    records,
    ready: records.filter((record) => record.status === "ready"),
    needsAttention: records.filter((record) => record.status === "draft" || record.status === "needs_update"),
    archived: records.filter((record) => record.status === "archived"),
    applications,
    recurringRequirements,
  };
}
