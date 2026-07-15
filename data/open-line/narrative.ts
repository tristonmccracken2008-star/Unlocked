import type { Opportunity } from "../opportunities";
import {
  narrativeCategoryLabels,
  narrativeDisplayLabel,
  narrativeList,
  renderNarrativeTemplate,
  type OpenLineNarrativeTemplateKey,
} from "./narrative-templates";
import { stableHash, stableId } from "./stable";
import type {
  BranchIntelligenceResult,
  DirectionTransitionRecord,
  JourneyEvent,
  JourneyEventType,
  NarrativeEventCopy,
  NarrativeEditorialStatement,
  NarrativeExplanationSource,
  NarrativeHorizonMeaning,
  NarrativeMoment,
  NarrativeMomentKind,
  NarrativeStoryType,
  NarrativeSuppressionReason,
  NarrativeTemplateParameters,
  NarrativeText,
  NarrativeWaypointMeaning,
  OpenLineInput,
  OpenLineNarrativeResult,
  PublicOpenLineNarrativeResult,
  RejoinEvidence,
} from "./types";
import { openLineModelVersion, openLineNarrativeRulesVersion } from "./types";

export const narrativeStoryHierarchy: Record<NarrativeStoryType, number> = {
  validation: 100,
  experience: 95,
  acceptance: 90,
  commitment: 80,
  action: 70,
  rejoin: 68,
  direction: 60,
  expansion: 55,
  skill: 50,
  pause: 42,
  closed_opportunity: 40,
  waypoint: 30,
  horizon: 20,
  exploration: 10,
  origin: 0,
};

const eventConfidence: Record<JourneyEventType, number> = {
  opportunity_viewed: 0.65,
  opportunity_saved: 0.7,
  opportunity_chosen: 0.82,
  application_started: 0.9,
  application_submitted: 0.98,
  interview_reached: 1,
  accepted: 1,
  opportunity_completed: 1,
  skill_evidence_created: 0.94,
  goal_selected: 0.85,
  goal_changed: 0.9,
  direction_paused: 0.9,
  direction_closed: 0.9,
};

const publicEventTypes = new Set<JourneyEventType>([
  "application_submitted",
  "interview_reached",
  "accepted",
  "opportunity_completed",
  "skill_evidence_created",
]);

type EventCountContext = {
  priorTypeCount: number;
  priorCategoryTypeCount: number;
};

type EventNarrativeContext = {
  privateCounts: EventCountContext;
  publicCounts: EventCountContext;
  category: ReturnType<typeof narrativeCategoryLabels>;
  opportunity?: Opportunity;
  transition?: DirectionTransitionRecord;
};

type SuppressedRecord = { eventId: string; reason: NarrativeSuppressionReason };
type MergedRecord = { momentId: string; eventCount: number; reason: "exploration_sequence" };

export type OpenLineNarrativeBuildStage =
  | "indexing"
  | "narrative_generation"
  | "rejoins"
  | "editorial_composition"
  | "waypoint_reasoning"
  | "horizon_reasoning"
  | "sorting"
  | "signature_generation"
  | "diagnostics";

export type OpenLineNarrativeBuildObserver = (stage: OpenLineNarrativeBuildStage, durationMs: number) => void;

function text(
  titleTemplateKey: OpenLineNarrativeTemplateKey,
  bodyTemplateKey: OpenLineNarrativeTemplateKey,
  explanationTemplateKey: OpenLineNarrativeTemplateKey | undefined,
  parameters: NarrativeTemplateParameters,
): NarrativeText {
  return {
    title: renderNarrativeTemplate(titleTemplateKey, parameters),
    body: renderNarrativeTemplate(bodyTemplateKey, parameters),
    explanation: explanationTemplateKey ? renderNarrativeTemplate(explanationTemplateKey, parameters) : undefined,
    titleTemplateKey,
    bodyTemplateKey,
    explanationTemplateKey,
    parameters,
  };
}

function categoryForEvent(event: JourneyEvent) {
  return narrativeCategoryLabels(event.category);
}

function opportunityTitle(event: JourneyEvent, opportunity: Opportunity | undefined) {
  return opportunity?.title?.trim() || event.evidence?.label?.trim() || undefined;
}

function eventParameters(
  event: JourneyEvent,
  opportunity: Opportunity | undefined,
  category: ReturnType<typeof narrativeCategoryLabels>,
) {
  const skills = event.skillIds?.length
    ? event.skillIds
    : Array.isArray(opportunity?.metadata?.skillsGained) ? opportunity.metadata.skillsGained : [];
  return {
    category: category.singular,
    categoryPlural: category.plural,
    categoryTitle: category.title,
    opportunityTitle: opportunityTitle(event, opportunity) ?? category.title,
    evidenceLabel: event.evidence?.label?.trim() || category.title,
    skills: narrativeList(skills.slice(0, 3), category.singular),
    direction: narrativeDisplayLabel(event.careerDirection),
    previousDirection: narrativeDisplayLabel(event.previousCareerDirection),
  } satisfies NarrativeTemplateParameters;
}

function eventTitleTemplate(event: JourneyEvent, named: boolean): OpenLineNarrativeTemplateKey {
  if (event.type === "opportunity_viewed") return "event.viewed.title";
  if (event.type === "opportunity_saved") return named ? "event.saved.named.title" : "event.saved.generic.title";
  if (event.type === "opportunity_chosen") return named ? "event.chosen.named.title" : "event.chosen.generic.title";
  if (event.type === "application_started") return named ? "event.started.named.title" : "event.started.generic.title";
  if (event.type === "application_submitted") return named ? "event.submitted.named.title" : "event.submitted.generic.title";
  if (event.type === "interview_reached") return named ? "event.interview.named.title" : "event.interview.generic.title";
  if (event.type === "accepted") return named ? "event.accepted.named.title" : "event.accepted.generic.title";
  if (event.type === "opportunity_completed") return named ? "event.completed.named.title" : "event.completed.generic.title";
  if (event.type === "skill_evidence_created") return named ? "event.skill.named.title" : "event.skill.generic.title";
  if (event.type === "goal_selected") return "event.direction.selected.title";
  if (event.type === "goal_changed") return "event.direction.changed.title";
  if (event.type === "direction_paused") return "event.direction.paused.title";
  return "event.direction.closed.title";
}

function eventBodyTemplate(event: JourneyEvent, counts: EventCountContext, transition?: DirectionTransitionRecord): OpenLineNarrativeTemplateKey {
  const firstType = counts.priorTypeCount === 0;
  const firstCategoryType = counts.priorCategoryTypeCount === 0;
  if (event.type === "opportunity_viewed") return firstCategoryType ? "event.viewed.first.body" : "event.viewed.repeated.body";
  if (event.type === "opportunity_saved") return firstCategoryType ? "event.saved.first.body" : "event.saved.repeated.body";
  if (event.type === "opportunity_chosen") return firstCategoryType ? "event.chosen.first.body" : "event.chosen.repeated.body";
  if (event.type === "application_started") return firstCategoryType ? "event.started.first.body" : "event.started.repeated.body";
  if (event.type === "application_submitted") return firstCategoryType ? "event.submitted.first.body" : "event.submitted.repeated.body";
  if (event.type === "interview_reached") return firstCategoryType ? "event.interview.first.body" : "event.interview.repeated.body";
  if (event.type === "accepted") return firstCategoryType ? "event.accepted.first.body" : "event.accepted.repeated.body";
  if (event.type === "opportunity_completed") return firstCategoryType ? "event.completed.first.body" : "event.completed.repeated.body";
  if (event.type === "skill_evidence_created") return firstType ? "event.skill.first.body" : "event.skill.repeated.body";
  if (event.type === "goal_selected") return transition?.type === "expanded" ? "event.direction.expanded.body" : "event.direction.selected.body";
  if (event.type === "goal_changed") return event.previousCareerDirection ? "event.direction.changed.from.body" : "event.direction.changed.body";
  if (event.type === "direction_paused") return "event.direction.paused.body";
  return event.careerDirection ? "event.direction.closed.body" : "event.opportunity.closed.body";
}

function eventExplanationTemplate(event: JourneyEvent, hasSkills: boolean): OpenLineNarrativeTemplateKey | undefined {
  if (event.type === "opportunity_viewed" || event.type === "opportunity_saved") return "explanation.exploration";
  if (event.type === "opportunity_chosen") return "explanation.chosen";
  if (event.type === "application_started") return "explanation.started";
  if (event.type === "application_submitted") return "explanation.submitted";
  if (event.type === "interview_reached") return "explanation.interview";
  if (event.type === "accepted") return "explanation.accepted";
  if (event.type === "opportunity_completed") return hasSkills ? "explanation.completed.skills" : "explanation.completed";
  if (event.type === "skill_evidence_created") return "explanation.skill";
  if (event.type === "goal_selected") return "explanation.direction";
  if (event.type === "goal_changed") return "explanation.direction.changed";
  if (event.type === "direction_paused") return "explanation.direction.paused";
  return "explanation.direction.closed";
}

function eventExplanationSource(event: JourneyEvent, opportunity: Opportunity | undefined): NarrativeExplanationSource {
  if (event.type === "interview_reached" || event.type === "accepted") return "validation_evidence";
  if (event.type === "skill_evidence_created") return "skill_evidence";
  if (event.type === "goal_selected" || event.type === "goal_changed" || event.type === "direction_paused" || event.type === "direction_closed") return "branch_transition";
  if (event.type === "opportunity_completed" && Array.isArray(opportunity?.metadata?.skillsGained) && opportunity.metadata.skillsGained.length) return "opportunity_metadata";
  return "event_type";
}

function createEventNarrative(event: JourneyEvent, context: EventNarrativeContext): NarrativeEventCopy {
  const parameters = eventParameters(event, context.opportunity, context.category);
  const named = Boolean(opportunityTitle(event, context.opportunity));
  const skills = event.skillIds?.length || (Array.isArray(context.opportunity?.metadata?.skillsGained) && context.opportunity.metadata.skillsGained.length);
  const explanationKey = eventExplanationTemplate(event, Boolean(skills));
  const privateTitleKey = eventTitleTemplate(event, named);
  const privateBodyKey = eventBodyTemplate(event, context.privateCounts, context.transition);
  const publicTitleKey = eventTitleTemplate(event, false);
  const publicBodyKey = eventBodyTemplate(event, context.publicCounts, context.transition);
  const privateCopy = text(
    privateTitleKey,
    privateBodyKey,
    explanationKey,
    parameters,
  );
  const publicCopy = privateTitleKey === publicTitleKey && privateBodyKey === publicBodyKey
    ? privateCopy
    : text(publicTitleKey, publicBodyKey, explanationKey, parameters);
  return {
    eventId: event.id,
    ...privateCopy,
    publicCopy,
    confidence: eventConfidence[event.type],
    explanationSource: eventExplanationSource(event, context.opportunity),
  };
}

function momentKind(event: JourneyEvent): NarrativeMomentKind {
  if (event.type === "opportunity_viewed" || event.type === "opportunity_saved") return "exploration";
  if (event.type === "opportunity_chosen" || event.type === "goal_selected") return "direction";
  if (event.type === "application_started") return "action";
  if (event.type === "application_submitted") return "commitment";
  if (event.type === "interview_reached" || event.type === "accepted") return "validation";
  if (event.type === "opportunity_completed" || event.type === "skill_evidence_created") return "experience";
  return "transition";
}

function storyType(event: JourneyEvent, transition?: DirectionTransitionRecord): NarrativeStoryType {
  if (event.type === "opportunity_viewed" || event.type === "opportunity_saved") return "exploration";
  if (event.type === "opportunity_chosen" || event.type === "goal_selected" || event.type === "goal_changed") return transition?.type === "expanded" ? "expansion" : "direction";
  if (event.type === "application_started") return "action";
  if (event.type === "application_submitted") return "commitment";
  if (event.type === "interview_reached") return "validation";
  if (event.type === "accepted") return "acceptance";
  if (event.type === "opportunity_completed") return "experience";
  if (event.type === "skill_evidence_created") return "skill";
  if (event.type === "direction_paused") return "pause";
  return "closed_opportunity";
}

function eventMoment(event: JourneyEvent, copy: NarrativeEventCopy, transition: DirectionTransitionRecord | undefined, branchKey: string | undefined): NarrativeMoment {
  const type = storyType(event, transition);
  return {
    id: stableId("narrative-moment", openLineNarrativeRulesVersion, type, event.id),
    kind: momentKind(event),
    storyType: type,
    occurredAt: event.occurredAt,
    title: copy.title,
    body: copy.body,
    explanation: copy.explanation,
    titleTemplateKey: copy.titleTemplateKey,
    bodyTemplateKey: copy.bodyTemplateKey,
    explanationTemplateKey: copy.explanationTemplateKey,
    parameters: copy.parameters,
    evidenceEventIds: [event.id],
    publicSafe: event.publicSafe && event.visibility === "shareable" && publicEventTypes.has(event.type),
    confidence: copy.confidence,
    explanationSource: copy.explanationSource,
    branchKey,
    publicCopy: copy.publicCopy,
  };
}

function mergedExplorationMoment(events: readonly JourneyEvent[], copies: ReadonlyMap<string, NarrativeEventCopy>, branchKey?: string): NarrativeMoment {
  const first = events[0];
  const labels = categoryForEvent(first);
  const parameters = { categoryPlural: labels.plural, categoryTitle: labels.title };
  const copy = text("moment.exploration.merged.title", "moment.exploration.merged.body", "moment.exploration.merged.explanation", parameters);
  return {
    id: stableId("narrative-moment", openLineNarrativeRulesVersion, "merged-exploration", events.map((event) => event.id)),
    kind: "exploration",
    storyType: "exploration",
    occurredAt: events.at(-1)?.occurredAt ?? first.occurredAt,
    ...copy,
    evidenceEventIds: events.map((event) => event.id),
    publicSafe: events.every((event) => event.publicSafe && event.visibility === "shareable"),
    confidence: Math.min(...events.map((event) => copies.get(event.id)?.confidence ?? 0.65)),
    explanationSource: "event_type",
    branchKey,
    publicCopy: copy,
  };
}

function directionLabel(key: string, intelligence: BranchIntelligenceResult) {
  return narrativeDisplayLabel(intelligence.directions.find((direction) => direction.key === key)?.label, "a direction");
}

function rejoinMoment(rejoin: RejoinEvidence, eventsById: ReadonlyMap<string, JourneyEvent>, intelligence: BranchIntelligenceResult): NarrativeMoment {
  const sources = rejoin.sourceBranchKeys.map((key) => directionLabel(key, intelligence));
  const target = directionLabel(rejoin.targetBranchKey, intelligence);
  const skills = narrativeList(rejoin.supportingSkillIds ?? [], "shared experience");
  const parameters = {
    sourceOne: sources[0] ?? "one direction",
    sourceTwo: sources[1] ?? "another direction",
    target,
    skills,
  };
  const bodyKey: OpenLineNarrativeTemplateKey = rejoin.reason === "shared_skill"
    ? "moment.rejoin.shared-skill.body"
    : rejoin.reason === "shared_goal"
      ? "moment.rejoin.shared-goal.body"
      : rejoin.reason === "experience_completed"
        ? "moment.rejoin.experience.body"
        : "moment.rejoin.synthesis.body";
  const copy = text("moment.rejoin.title", bodyKey, "moment.rejoin.explanation", parameters);
  const publicParameters = { sourceOne: "One experience", sourceTwo: "another experience", target: "the same broader direction", skills: "shared skills" };
  const publicCopy = text("moment.rejoin.title", "moment.rejoin.shared-goal.body", "moment.rejoin.explanation", publicParameters);
  const supportingEvents = rejoin.supportingEventIds.map((id) => eventsById.get(id)).filter((event): event is JourneyEvent => Boolean(event));
  return {
    id: stableId("narrative-moment", openLineNarrativeRulesVersion, "rejoin", rejoin.id),
    kind: "transition",
    storyType: "rejoin",
    occurredAt: supportingEvents.map((event) => event.occurredAt).sort().at(-1) ?? null,
    ...copy,
    evidenceEventIds: [...rejoin.supportingEventIds].sort(),
    publicSafe: supportingEvents.length === rejoin.supportingEventIds.length && supportingEvents.every((event) => event.publicSafe && event.visibility === "shareable"),
    confidence: rejoin.confidence,
    explanationSource: "rejoin_evidence",
    branchKey: rejoin.targetBranchKey,
    publicCopy,
  };
}

function parseEstimatedMinutes(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  if (/week/.test(normalized)) return Math.round(amount * 7 * 60);
  if (/day/.test(normalized)) return Math.round(amount * 24 * 60);
  if (/hour|hr/.test(normalized)) return Math.round(amount * 60);
  if (/minute|min/.test(normalized)) return Math.round(amount);
  return undefined;
}

function impactLevel(value: string | undefined): "low" | "medium" | "high" {
  const normalized = value?.toLowerCase() ?? "";
  if (/critical|high|foundational|strong/.test(normalized)) return "high";
  if (/optional|low|explor/.test(normalized)) return "low";
  return "medium";
}

function opportunityCategory(opportunity: Opportunity | undefined, fallback?: string) {
  if (!opportunity) return narrativeCategoryLabels(fallback);
  if (opportunity.type === "Research") return narrativeCategoryLabels("research");
  if (opportunity.type === "Scholarship") return narrativeCategoryLabels("scholarship");
  if (opportunity.type === "Benefit") return narrativeCategoryLabels("student benefit");
  if (opportunity.type === "AI") return narrativeCategoryLabels("AI tool");
  if (/internship/i.test(opportunity.category)) return narrativeCategoryLabels("internship");
  return narrativeCategoryLabels(opportunity.category || opportunity.type);
}

function yearLabel(year: string | undefined) {
  const normalized = year?.toLowerCase() ?? "";
  if (/first|freshman/.test(normalized)) return "first-year";
  if (/second|sophomore/.test(normalized)) return "second-year";
  if (/third|junior/.test(normalized)) return "third-year";
  if (/fourth|senior/.test(normalized)) return "fourth-year";
  return "undergraduate";
}

function buildWaypoint(input: OpenLineInput, opportunities: ReadonlyMap<string, Opportunity>): NarrativeWaypointMeaning | undefined {
  const source = input.currentWaypoint;
  if (!source?.id.trim() || !source.title.trim() || !source.whyItMatters.trim()) return undefined;
  const opportunity = source.sourceOpportunityId ? opportunities.get(source.sourceOpportunityId) : undefined;
  const category = opportunityCategory(opportunity, source.relatedOpportunityCategories?.[0]);
  const skills = source.requiredSkills?.length
    ? source.requiredSkills
    : Array.isArray(opportunity?.metadata?.skillsGained) ? opportunity.metadata.skillsGained : [];
  const parameters = {
    category: category.singular,
    categoryPlural: category.plural,
    skills: narrativeList(skills.slice(0, 3), category.singular),
    recommendedBefore: narrativeList(source.recommendedBefore?.slice(0, 2) ?? [], "later applications"),
    unlocks: narrativeList(source.unlocks?.slice(0, 2) ?? [], "later opportunities"),
    yearLabel: yearLabel(input.profile?.year),
  };
  let templateKey: OpenLineNarrativeTemplateKey;
  let explanationSource: NarrativeExplanationSource;
  let confidence: number;
  const earlyYear = /first|freshman|second|sophomore/i.test(input.profile?.year ?? "");
  const earlyEligible = opportunity?.academic_years.some((year) => /first|freshman|second|sophomore|any year/i.test(year)) ?? false;
  if (opportunity && earlyYear && earlyEligible) {
    templateKey = "waypoint.early-program";
    explanationSource = "opportunity_metadata";
    confidence = 0.94;
  } else if (skills.length) {
    templateKey = "waypoint.skill";
    explanationSource = opportunity ? "opportunity_metadata" : "roadmap_metadata";
    confidence = 0.9;
  } else if (source.recommendedBefore?.length) {
    templateKey = "waypoint.before";
    explanationSource = "roadmap_metadata";
    confidence = 0.88;
  } else if (source.unlocks?.length) {
    templateKey = "waypoint.unlocks";
    explanationSource = "roadmap_metadata";
    confidence = 0.88;
  } else if (source.type === "roadmap") {
    templateKey = "waypoint.roadmap";
    explanationSource = "roadmap_metadata";
    confidence = 0.76;
  } else if (opportunity || source.relatedOpportunityCategories?.length) {
    templateKey = "waypoint.opportunity";
    explanationSource = "opportunity_metadata";
    confidence = 0.72;
  } else {
    templateKey = "waypoint.fallback";
    explanationSource = "safe_fallback";
    confidence = 0.62;
  }
  return {
    id: stableId("path-waypoint", openLineModelVersion, source.type, source.id),
    title: source.title.trim(),
    whyItMatters: renderNarrativeTemplate(templateKey, parameters),
    estimatedMinutes: parseEstimatedMinutes(source.estimatedTime),
    impact: impactLevel(source.impact),
    sourceOpportunityId: source.sourceOpportunityId,
    source: source.type,
    confidence,
    explanationSource,
    templateKey,
    parameters,
  };
}

function buildHorizon(input: OpenLineInput, opportunities: ReadonlyMap<string, Opportunity>): NarrativeHorizonMeaning[] {
  return [...(input.horizon ?? [])]
    .filter((source) => source.id.trim() && source.title.trim() && source.rationale.trim())
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((source) => {
      const opportunity = source.sourceOpportunityId ? opportunities.get(source.sourceOpportunityId) : undefined;
      const skills = source.requiredSkills?.length
        ? source.requiredSkills
        : Array.isArray(opportunity?.metadata?.skillsGained) ? opportunity.metadata.skillsGained : [];
      const parameters = { title: source.title.trim(), skills: narrativeList(skills.slice(0, 3), "relevant skills") };
      const templateKey: OpenLineNarrativeTemplateKey = skills.length
        ? "horizon.skill"
        : source.prerequisiteMilestoneIds?.length ? "horizon.prerequisite" : "horizon.progress";
      const explanationSource: NarrativeExplanationSource = skills.length
        ? opportunity ? "opportunity_metadata" : "roadmap_metadata"
        : source.prerequisiteMilestoneIds?.length ? "roadmap_metadata" : "safe_fallback";
      return {
        id: stableId("path-possibility", openLineModelVersion, source.id),
        title: source.title.trim(),
        rationale: renderNarrativeTemplate(templateKey, parameters),
        branchKey: source.branchKey,
        confidence: skills.length ? 0.88 : source.prerequisiteMilestoneIds?.length ? 0.82 : 0.62,
        explanationSource,
        templateKey,
        parameters,
      };
    });
}

function compareMoments(a: NarrativeMoment, b: NarrativeMoment) {
  if (a.occurredAt === null && b.occurredAt !== null) return -1;
  if (a.occurredAt !== null && b.occurredAt === null) return 1;
  return (a.occurredAt ?? "").localeCompare(b.occurredAt ?? "")
    || narrativeStoryHierarchy[b.storyType] - narrativeStoryHierarchy[a.storyType]
    || a.id.localeCompare(b.id);
}

function buildOrigin(hasEvents: boolean, occurredAt: string | null = null, evidenceEventIds: string[] = []): NarrativeMoment {
  const copy = text("origin.title", hasEvents ? "origin.started.body" : "origin.empty.body", "origin.explanation", {});
  return {
    id: stableId("narrative-moment", openLineNarrativeRulesVersion, "origin", occurredAt),
    kind: "origin",
    storyType: "origin",
    occurredAt,
    ...copy,
    evidenceEventIds,
    publicSafe: true,
    confidence: hasEvents ? 1 : 0.6,
    explanationSource: hasEvents ? "event_type" : "safe_fallback",
    publicCopy: copy,
  };
}

function buildEditorialStatement(
  events: readonly JourneyEvent[],
  moments: readonly NarrativeMoment[],
  branchIntelligence: BranchIntelligenceResult,
): NarrativeEditorialStatement {
  let activeCareerDirection: (typeof branchIntelligence.directions)[number] | undefined;
  let configuredPrimaryDirection: (typeof branchIntelligence.directions)[number] | undefined;
  for (const direction of branchIntelligence.directions) {
    if (direction.key === branchIntelligence.primaryDirectionKey) configuredPrimaryDirection = direction;
    if (direction.kind !== "career" || direction.state === "closed") continue;
    const preferred = activeCareerDirection
      ? activeCareerDirection.lastMeaningfulActivityAt.localeCompare(direction.lastMeaningfulActivityAt)
        || activeCareerDirection.confidence - direction.confidence
        || direction.key.localeCompare(activeCareerDirection.key)
      : -1;
    if (preferred < 0) {
      activeCareerDirection = direction;
    }
  }
  const primaryDirection = activeCareerDirection ?? configuredPrimaryDirection;
  if (primaryDirection?.label.trim()) {
    const templateKey: OpenLineNarrativeTemplateKey = primaryDirection.kind === "career"
      ? "editorial.story.career"
      : "editorial.story.direction";
    const parameters = { direction: primaryDirection.label.trim() };
    return {
      text: renderNarrativeTemplate(templateKey, parameters),
      source: "branch_direction",
      confidence: primaryDirection.confidence,
      explanationSource: "branch_transition",
      templateKey,
      parameters,
    };
  }

  let latestMeaningfulMoment: NarrativeMoment | undefined;
  for (const moment of moments) {
    if (moment.storyType === "exploration" || moment.storyType === "origin") continue;
    const preferred = latestMeaningfulMoment
      ? (latestMeaningfulMoment.occurredAt ?? "").localeCompare(moment.occurredAt ?? "")
        || narrativeStoryHierarchy[latestMeaningfulMoment.storyType] - narrativeStoryHierarchy[moment.storyType]
        || moment.id.localeCompare(latestMeaningfulMoment.id)
      : -1;
    if (preferred < 0) {
      latestMeaningfulMoment = moment;
    }
  }
  if (latestMeaningfulMoment) {
    const templateKey: OpenLineNarrativeTemplateKey = "editorial.story.moment";
    const parameters = { statement: latestMeaningfulMoment.body };
    return {
      text: renderNarrativeTemplate(templateKey, parameters),
      source: "narrative_moment",
      confidence: latestMeaningfulMoment.confidence,
      explanationSource: latestMeaningfulMoment.explanationSource,
      templateKey,
      parameters,
    };
  }

  const templateKey: OpenLineNarrativeTemplateKey = events.length ? "editorial.story.progress" : "editorial.story.empty";
  const parameters = {};
  return {
    text: renderNarrativeTemplate(templateKey, parameters),
    source: events.length ? "narrative_moment" : "origin",
    confidence: events.length ? 0.7 : 0.6,
    explanationSource: "safe_fallback",
    templateKey,
    parameters,
  };
}

export function buildOpenLineNarratives(
  input: OpenLineInput,
  events: readonly JourneyEvent[],
  branchIntelligence: BranchIntelligenceResult,
  observeStage?: OpenLineNarrativeBuildObserver,
): OpenLineNarrativeResult {
  let stageStartedAt = observeStage ? performance.now() : 0;
  const completeStage = (stage: OpenLineNarrativeBuildStage) => {
    if (!observeStage) return;
    const completedAt = performance.now();
    observeStage(stage, completedAt - stageStartedAt);
    stageStartedAt = completedAt;
  };
  const opportunities = new Map((input.opportunities ?? []).map((opportunity) => [opportunity.id, opportunity]));
  const assignments = new Map(branchIntelligence.eventAssignments.map((assignment) => [assignment.eventId, assignment.directionKey]));
  const transitionsByEvent = new Map<string, DirectionTransitionRecord>();
  for (const transition of branchIntelligence.transitions) {
    for (const eventId of transition.supportingEventIds) if (!transitionsByEvent.has(eventId)) transitionsByEvent.set(eventId, transition);
  }
  const privateTypeCounts = new Map<JourneyEventType, number>();
  const privateCategoryCounts = new Map<string, number>();
  const publicTypeCounts = new Map<JourneyEventType, number>();
  const publicCategoryCounts = new Map<string, number>();
  const categories = new Map<string, ReturnType<typeof narrativeCategoryLabels>>();
  const copies: NarrativeEventCopy[] = [];
  const copiesByEvent = new Map<string, NarrativeEventCopy>();
  const suppressed: SuppressedRecord[] = [];
  const merged: MergedRecord[] = [];
  const moments: NarrativeMoment[] = [];
  const explorationGroups = new Map<string, JourneyEvent[]>();
  completeStage("indexing");

  for (const event of events) {
    const rawCategory = event.category ?? "";
    let category = categories.get(rawCategory);
    if (!category) {
      category = categoryForEvent(event);
      categories.set(rawCategory, category);
    }
    const categoryKey = `${event.type}|${category.singular}`;
    const privateCounts = {
      priorTypeCount: privateTypeCounts.get(event.type) ?? 0,
      priorCategoryTypeCount: privateCategoryCounts.get(categoryKey) ?? 0,
    };
    const isPublic = event.publicSafe && event.visibility === "shareable" && publicEventTypes.has(event.type);
    const publicCounts = {
      priorTypeCount: publicTypeCounts.get(event.type) ?? 0,
      priorCategoryTypeCount: publicCategoryCounts.get(categoryKey) ?? 0,
    };
    const copy = createEventNarrative(event, {
      privateCounts,
      publicCounts,
      category,
      opportunity: event.opportunityId ? opportunities.get(event.opportunityId) : undefined,
      transition: transitionsByEvent.get(event.id),
    });
    copies.push(copy);
    copiesByEvent.set(event.id, copy);
    privateTypeCounts.set(event.type, privateCounts.priorTypeCount + 1);
    privateCategoryCounts.set(categoryKey, privateCounts.priorCategoryTypeCount + 1);
    if (isPublic) {
      publicTypeCounts.set(event.type, publicCounts.priorTypeCount + 1);
      publicCategoryCounts.set(categoryKey, publicCounts.priorCategoryTypeCount + 1);
    }

    if (event.type === "opportunity_saved") {
      suppressed.push({ eventId: event.id, reason: "saved_only" });
      continue;
    }
    if (event.type === "opportunity_viewed") {
      const groupKey = category.singular;
      const group = explorationGroups.get(groupKey) ?? [];
      group.push(event);
      explorationGroups.set(groupKey, group);
      continue;
    }
    moments.push(eventMoment(event, copy, transitionsByEvent.get(event.id), assignments.get(event.id)));
  }

  for (const [category, explorationEvents] of [...explorationGroups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (explorationEvents.length === 1) {
      const event = explorationEvents[0];
      const copy = copiesByEvent.get(event.id);
      if (copy) moments.push(eventMoment(event, copy, undefined, assignments.get(event.id)));
      continue;
    }
    const moment = mergedExplorationMoment(explorationEvents, copiesByEvent, assignments.get(explorationEvents[0].id));
    moments.push(moment);
    merged.push({ momentId: moment.id, eventCount: explorationEvents.length, reason: "exploration_sequence" });
    for (const event of explorationEvents) suppressed.push({ eventId: event.id, reason: "merged_exploration" });
  }
  completeStage("narrative_generation");

  if (branchIntelligence.rejoins.length) {
    const eventsById = new Map(events.map((event) => [event.id, event]));
    for (const rejoin of branchIntelligence.rejoins) moments.push(rejoinMoment(rejoin, eventsById, branchIntelligence));
  }
  completeStage("rejoins");

  const origin = buildOrigin(events.length > 0, events[0]?.occurredAt ?? null, events[0] ? [events[0].id] : []);
  const editorialStatement = buildEditorialStatement(events, moments, branchIntelligence);
  completeStage("editorial_composition");
  const waypoint = buildWaypoint(input, opportunities);
  completeStage("waypoint_reasoning");
  const horizon = buildHorizon(input, opportunities);
  completeStage("horizon_reasoning");
  const sortedMoments = moments.sort(compareMoments);
  completeStage("sorting");
  const raw = {
    version: openLineNarrativeRulesVersion,
    origin,
    eventNarratives: copies,
    moments: sortedMoments,
    editorialStatement,
    waypoint,
    horizon,
  };
  const signature = stableHash({
    version: openLineNarrativeRulesVersion,
    origin: [origin.id, origin.occurredAt, origin.evidenceEventIds, origin.titleTemplateKey, origin.bodyTemplateKey, origin.explanationTemplateKey],
    eventNarratives: copies.map((copy) => [
      copy.eventId,
      copy.titleTemplateKey,
      copy.bodyTemplateKey,
      copy.explanationTemplateKey,
      copy.parameters,
      copy.publicCopy.titleTemplateKey,
      copy.publicCopy.bodyTemplateKey,
      copy.confidence,
      copy.explanationSource,
    ]),
    moments: sortedMoments.map((moment) => [
      moment.id,
      moment.kind,
      moment.storyType,
      moment.occurredAt,
      moment.evidenceEventIds,
      moment.publicSafe,
      moment.confidence,
      moment.explanationSource,
      moment.branchKey,
      moment.titleTemplateKey,
      moment.bodyTemplateKey,
      moment.explanationTemplateKey,
      moment.parameters,
    ]),
    editorialStatement,
    waypoint,
    horizon,
  });
  completeStage("signature_generation");
  const sourceCounts = new Map<NarrativeExplanationSource, number>();
  const countSource = (source: NarrativeExplanationSource) => {
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  };
  for (const moment of sortedMoments) countSource(moment.explanationSource);
  if (waypoint) countSource(waypoint.explanationSource);
  for (const item of horizon) countSource(item.explanationSource);
  const diagnostics = {
    sourceEventCount: events.length,
    momentCount: sortedMoments.length,
    suppressedMoments: suppressed
      .map((item) => ({ opaqueEventId: stableId("narrative-diagnostic", signature, item.eventId), reason: item.reason }))
      .sort((a, b) => a.opaqueEventId.localeCompare(b.opaqueEventId) || a.reason.localeCompare(b.reason)),
    mergedNarratives: merged
      .map((item) => ({ opaqueMomentId: stableId("narrative-diagnostic", signature, item.momentId), eventCount: item.eventCount, reason: item.reason }))
      .sort((a, b) => a.opaqueMomentId.localeCompare(b.opaqueMomentId)),
    explanationSources: [...sourceCounts.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => a.source.localeCompare(b.source)),
    deterministicSignature: signature,
  };
  completeStage("diagnostics");
  return { ...raw, signature, diagnostics };
}

export function createPublicNarrativeProjection(narrative: OpenLineNarrativeResult): PublicOpenLineNarrativeResult {
  const moments = narrative.moments.filter((moment) => moment.publicSafe).map((moment, index) => ({
    id: stableId("public-narrative-moment", narrative.version, index, moment.occurredAt, moment.publicCopy.title, moment.publicCopy.body, moment.publicCopy.explanation),
    kind: moment.kind,
    storyType: moment.storyType,
    occurredAt: moment.occurredAt,
    title: moment.publicCopy.title,
    body: moment.publicCopy.body,
    explanation: moment.publicCopy.explanation,
    confidence: moment.confidence,
  }));
  const publicOrigin = buildOrigin(moments.length > 0, moments[0]?.occurredAt ?? null);
  const raw = {
    version: narrative.version,
    origin: { title: publicOrigin.title, body: publicOrigin.body, explanation: publicOrigin.explanation },
    moments,
  };
  return { ...raw, signature: stableHash(raw) };
}
