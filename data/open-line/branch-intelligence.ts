import type { Opportunity } from "../opportunities";
import { journeyEventImportance, progressLevelForEvent } from "./normalize";
import { slug, stableHash, stableId } from "./stable";
import type {
  BranchIntelligenceResult,
  DirectionTransitionRecord,
  IgnoredDirectionCandidateReason,
  JourneyDirection,
  JourneyDirectionKind,
  JourneyEvent,
  JourneyEventType,
  OpenLineInput,
  RejoinEvidence,
  ValidationEvidence,
} from "./types";
import { openLineBranchRulesVersion } from "./types";

const visibleBranchConfidence = 0.55;
const maximumCandidateDirections = 160;

const eventConfidence: Record<JourneyEventType, number> = {
  opportunity_viewed: 0.1,
  opportunity_saved: 0.2,
  goal_selected: 0.35,
  goal_changed: 0.4,
  direction_paused: 0.4,
  direction_closed: 0.4,
  opportunity_chosen: 0.55,
  application_started: 0.7,
  application_submitted: 0.82,
  interview_reached: 0.92,
  skill_evidence_created: 0.94,
  accepted: 1,
  opportunity_completed: 1,
};

const progressScore = {
  exploration: 0,
  intention: 1,
  action: 2,
  commitment: 3,
  validation: 4,
} as const;

const careerAliases: Record<string, string> = {
  "ai": "artificial-intelligence",
  "artificial intelligence": "artificial-intelligence",
  "computer science": "software-engineering",
  "consulting": "consulting",
  "data and analytics": "data-science",
  "data analytics": "data-science",
  "data science": "data-science",
  "entrepreneur": "entrepreneurship",
  "entrepreneurship": "entrepreneurship",
  "finance": "finance",
  "graduate school": "graduate-study",
  "graduate studies": "graduate-study",
  "health and medicine": "medicine",
  "investment banking": "investment-banking",
  "law": "law",
  "machine learning": "artificial-intelligence",
  "medicine": "medicine",
  "pre med": "medicine",
  "pre-med": "medicine",
  "public policy": "public-policy",
  "public service": "public-service",
  "quant": "quantitative-finance",
  "quant finance": "quantitative-finance",
  "quantitative finance": "quantitative-finance",
  "research": "research",
  "software development": "software-engineering",
  "software engineer": "software-engineering",
  "software engineering": "software-engineering",
  "undecided": "undecided",
};

const skillAliases: Record<string, string> = {
  "analytical research": "research-analysis",
  "communication": "communication",
  "data analysis": "data-analysis",
  "data analytics": "data-analysis",
  "excel": "spreadsheets",
  "financial modelling": "financial-modeling",
  "financial modeling": "financial-modeling",
  "interview stories": "interviewing",
  "interviewing": "interviewing",
  "javascript": "javascript",
  "leadership": "leadership",
  "networking": "networking",
  "portfolio": "portfolio-building",
  "portfolio building": "portfolio-building",
  "presentation": "public-speaking",
  "presentations": "public-speaking",
  "programming": "programming",
  "professional communication": "communication",
  "public speaking": "public-speaking",
  "python": "python",
  "research": "research-analysis",
  "research writing": "research-writing",
  "scientific writing": "research-writing",
  "speaking": "public-speaking",
  "sql": "sql",
  "statistics": "statistics",
  "technical communication": "communication",
  "writing": "writing",
};

const categoryAliases: Record<string, string> = {
  "ai": "ai-tools",
  "ai tool": "ai-tools",
  "ai tools": "ai-tools",
  "benefit": "student-benefits",
  "benefits": "student-benefits",
  "campus job": "campus-jobs",
  "campus jobs": "campus-jobs",
  "career resources": "career-resources",
  "certification": "certifications",
  "certifications": "certifications",
  "competition": "competitions",
  "competitions": "competitions",
  "co-op": "co-ops",
  "co-ops": "co-ops",
  "conference": "conferences",
  "conferences": "conferences",
  "fellowship": "fellowships",
  "fellowships": "fellowships",
  "grant": "grants",
  "grants": "grants",
  "internship": "internships",
  "internships": "internships",
  "leadership program": "leadership-programs",
  "leadership programs": "leadership-programs",
  "research": "undergraduate-research",
  "scholarship": "scholarships",
  "scholarships": "scholarships",
  "student benefit": "student-benefits",
  "student benefits": "student-benefits",
  "study abroad": "study-abroad",
};

const experienceCategories = new Set([
  "campus-jobs",
  "competitions",
  "co-ops",
  "fellowships",
  "internships",
  "leadership-programs",
  "study-abroad",
]);

const categoryLabels: Record<string, string> = {
  "ai-tools": "AI tools",
  "campus-jobs": "campus jobs",
  "career-resources": "career resources",
  "certifications": "certifications",
  "competitions": "competitions",
  "conferences": "conferences",
  "co-ops": "co-ops",
  "fellowships": "fellowships",
  "grants": "grants",
  "internships": "internships",
  "leadership-programs": "leadership programs",
  "scholarships": "scholarships",
  "student-benefits": "student benefits",
  "study-abroad": "study abroad",
  "undergraduate-research": "undergraduate research",
};

type Candidate = {
  key: string;
  kind: JourneyDirectionKind;
  label: string;
  events: JourneyEvent[];
  eventIds: Set<string>;
  evidenceEventIds: Set<string>;
  explicitSkillIds: Set<string>;
  explicitCareerKeys: Set<string>;
  rawLabels: Set<string>;
  rawLabelInputs: Set<string>;
  parentDirectionKey?: string;
  opportunitySpecific: boolean;
};

type ScoredCandidate = Candidate & {
  direction: JourneyDirection;
  activated: boolean;
  score: number;
  strongestProgress: number;
  explicitCurrentGoal: boolean;
  waypointAligned: boolean;
};

export type BranchIntelligenceOptions = {
  maxVisibleBranches?: number;
};

export type BranchIntelligenceBuildStage =
  | "validation_index"
  | "candidate_generation"
  | "candidate_scoring"
  | "branch_selection"
  | "transitions"
  | "rejoins"
  | "assignments"
  | "signature"
  | "diagnostics";

export type BranchIntelligenceBuildObserver = (stage: BranchIntelligenceBuildStage, durationMs: number) => void;

function normalizedAlias(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9+#.]+/g, " ").trim().replace(/\s+/g, " ");
}

function titleCase(value: string) {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}

export function canonicalCareerDirection(value: string) {
  const normalized = normalizedAlias(value);
  return careerAliases[normalized] ?? slug(normalized);
}

export function canonicalSkillDirection(value: string) {
  const normalized = normalizedAlias(value);
  return skillAliases[normalized] ?? slug(normalized);
}

export function canonicalOpportunityCategory(value: string) {
  const normalized = normalizedAlias(value);
  return categoryAliases[normalized] ?? slug(normalized);
}

function safeStrings(value: unknown, limit = 32) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, limit);
}

function categoryDirection(categoryValue: string | undefined) {
  const category = canonicalOpportunityCategory(categoryValue ?? "general");
  if (category === "undergraduate-research") {
    return { key: "academic:undergraduate-research", kind: "academic" as const, label: categoryLabels[category] };
  }
  if (experienceCategories.has(category)) {
    return { key: `experience:${category}`, kind: "experience" as const, label: categoryLabels[category] ?? titleCase(category) };
  }
  return { key: `category:${category}`, kind: "opportunity_category" as const, label: categoryLabels[category] ?? titleCase(category) };
}

function careerDirection(value: string) {
  const canonical = canonicalCareerDirection(value);
  return { key: `career:${canonical}`, kind: "career" as const, label: titleCase(canonical) };
}

function skillDirection(value: string) {
  const canonical = canonicalSkillDirection(value);
  return { key: `skill:${canonical}`, kind: "skill" as const, label: titleCase(canonical) };
}

function meaningful(event: JourneyEvent) {
  return !["opportunity_viewed", "opportunity_saved", "goal_selected", "goal_changed", "direction_paused", "direction_closed"].includes(event.type);
}

function validationForEvent(event: JourneyEvent, opportunity?: Opportunity): ValidationEvidence | undefined {
  let type: ValidationEvidence["type"] | undefined;
  let confidence = 0;
  if (event.type === "interview_reached") { type = "interview"; confidence = 0.94; }
  if (event.type === "accepted") {
    type = canonicalOpportunityCategory(event.category ?? "") === "scholarships" ? "award" : "acceptance";
    confidence = 1;
  }
  if (event.type === "opportunity_completed") { type = "completed_experience"; confidence = 1; }
  if (event.type === "skill_evidence_created" && event.evidence?.referenceId) {
    type = "verified_skill_evidence";
    confidence = event.source === "manual_evidence" ? 0.94 : 0.9;
  }
  if (!type) return undefined;
  return {
    eventId: event.id,
    type,
    externalSourceId: event.evidence?.referenceId ?? (event.opportunityId && opportunity?.official_source_url ? stableId("external-source", opportunity.official_source_url) : undefined),
    organizationId: event.organizationId,
    occurredAt: event.occurredAt,
    confidence,
    publicSafe: event.publicSafe,
  };
}

function addCandidate(map: Map<string, Candidate>, identity: { key: string; kind: JourneyDirectionKind; label: string }, event: JourneyEvent, options: {
  evidence?: boolean;
  skills?: readonly string[];
  careers?: readonly string[];
  rawLabel?: string;
  parentDirectionKey?: string;
  opportunitySpecific?: boolean;
} = {}) {
  if (!map.has(identity.key) && map.size >= maximumCandidateDirections) return;
  const candidate = map.get(identity.key) ?? {
    ...identity,
    events: [],
    eventIds: new Set<string>(),
    evidenceEventIds: new Set<string>(),
    explicitSkillIds: new Set<string>(),
    explicitCareerKeys: new Set<string>(),
    rawLabels: new Set<string>(),
    rawLabelInputs: new Set<string>(),
    parentDirectionKey: options.parentDirectionKey,
    opportunitySpecific: Boolean(options.opportunitySpecific),
  };
  if (!candidate.eventIds.has(event.id)) {
    candidate.events.push(event);
    candidate.eventIds.add(event.id);
  }
  if (options.evidence) candidate.evidenceEventIds.add(event.id);
  for (const skill of options.skills ?? []) candidate.explicitSkillIds.add(canonicalSkillDirection(skill));
  for (const career of options.careers ?? []) candidate.explicitCareerKeys.add(`career:${canonicalCareerDirection(career)}`);
  if (options.rawLabel && !candidate.rawLabelInputs.has(options.rawLabel)) {
    candidate.rawLabels.add(normalizedAlias(options.rawLabel));
    candidate.rawLabelInputs.add(options.rawLabel);
  }
  map.set(identity.key, candidate);
}

function opportunitySpecificDirection(event: JourneyEvent, opportunity: Opportunity | undefined) {
  const parent = categoryDirection(event.category);
  const opaqueOpportunityKey = stableHash(event.opportunityId ?? event.id);
  return {
    identity: {
      key: `experience:opportunity-${opaqueOpportunityKey}`,
      kind: "experience" as const,
      label: opportunity?.title?.trim() || "Opportunity path",
    },
    parentDirectionKey: parent.key,
  };
}

function eventCareerMetadata(opportunity: Opportunity | undefined) {
  return safeStrings(opportunity?.metadata?.careerPaths);
}

function eventSkillMetadata(opportunity: Opportunity | undefined) {
  return safeStrings(opportunity?.metadata?.skillsGained);
}

function buildCandidates(
  input: OpenLineInput,
  events: readonly JourneyEvent[],
  validation: readonly ValidationEvidence[],
  opportunities: ReadonlyMap<string, Opportunity>,
) {
  const candidates = new Map<string, Candidate>();
  const validationIds = new Set(validation.map((item) => item.eventId));
  const rejectedOpportunityIds = new Set<string>();
  const explicitCareerKeys = new Set<string>();
  for (const event of events) {
    if (event.type === "direction_closed" && event.opportunityId) rejectedOpportunityIds.add(event.opportunityId);
    if (event.careerDirection) explicitCareerKeys.add(`career:${canonicalCareerDirection(event.careerDirection)}`);
  }
  if (input.profile?.careerGoal?.trim()) explicitCareerKeys.add(`career:${canonicalCareerDirection(input.profile.careerGoal)}`);
  const categoryDirections = new Map<string, ReturnType<typeof categoryDirection>>();
  const directionForCategory = (value: string | undefined) => {
    const key = value ?? "";
    const cached = categoryDirections.get(key);
    if (cached) return cached;
    const direction = categoryDirection(value);
    categoryDirections.set(key, direction);
    return direction;
  };

  for (const event of events) {
    if (event.careerDirection) {
      const direction = careerDirection(event.careerDirection);
      addCandidate(candidates, direction, event, { evidence: validationIds.has(event.id), rawLabel: event.careerDirection });
      if (event.type === "goal_changed" && event.previousCareerDirection) {
        addCandidate(candidates, careerDirection(event.previousCareerDirection), event, { rawLabel: event.previousCareerDirection });
      }
      continue;
    }

    if (event.type === "skill_evidence_created") {
      for (const rawSkill of (event.skillIds ?? []).slice(0, 16)) {
        addCandidate(candidates, skillDirection(rawSkill), event, { evidence: validationIds.has(event.id), rawLabel: rawSkill });
      }
      continue;
    }

    const opportunity = event.opportunityId ? opportunities.get(event.opportunityId) : undefined;
    const careers = eventCareerMetadata(opportunity);
    const skills = eventSkillMetadata(opportunity);
    if (event.opportunityId && rejectedOpportunityIds.has(event.opportunityId)) {
      const specific = opportunitySpecificDirection(event, opportunity);
      addCandidate(candidates, specific.identity, event, {
        evidence: validationIds.has(event.id),
        careers,
        skills,
        parentDirectionKey: specific.parentDirectionKey,
        opportunitySpecific: true,
      });
      continue;
    }

    const category = directionForCategory(event.category);
    addCandidate(candidates, category, event, { evidence: validationIds.has(event.id), careers, skills, rawLabel: event.category });
    if (meaningful(event)) {
      for (const career of careers.slice(0, 8)) {
        const direction = careerDirection(career);
        if (explicitCareerKeys.has(direction.key)) {
          addCandidate(candidates, direction, event, { evidence: validationIds.has(event.id), careers, skills, rawLabel: career });
        }
      }
    }
    if (event.type === "opportunity_completed") {
      for (const skill of skills.slice(0, 8)) {
        addCandidate(candidates, skillDirection(skill), event, { evidence: true, rawLabel: skill, parentDirectionKey: category.key });
      }
    }
  }
  return candidates;
}

function latestTimestamp(events: readonly JourneyEvent[]) {
  return events.reduce((latest, event) => event.occurredAt > latest ? event.occurredAt : latest, events[0]?.occurredAt ?? "1970-01-01T00:00:00.000Z");
}

function explicitCurrentGoalKey(input: OpenLineInput, events: readonly JourneyEvent[]) {
  let latestDirection: JourneyEvent | undefined;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.careerDirection && (event.type === "goal_selected" || event.type === "goal_changed")) {
      latestDirection = event;
      break;
    }
  }
  const value = latestDirection?.careerDirection ?? input.profile?.careerGoal?.trim();
  return value ? `career:${canonicalCareerDirection(value)}` : undefined;
}

function currentWaypointOpportunityId(input: OpenLineInput) {
  return input.currentWaypoint?.sourceOpportunityId;
}

function confidenceFor(candidate: Candidate, currentGoalKey: string | undefined) {
  const strongest = candidate.events.reduce((value, event) => Math.max(value, eventConfidence[event.type]), 0);
  const meaningfulCount = candidate.events.filter(meaningful).length;
  const sustainedBonus = Math.min(0.08, Math.max(0, meaningfulCount - 1) * 0.025);
  const goalSupportBonus = candidate.key === currentGoalKey && meaningfulCount > 0 ? 0.08 : 0;
  return Math.min(1, Number((strongest + sustainedBonus + goalSupportBonus).toFixed(4)));
}

function deriveDirectionState(candidate: Candidate, confidence: number, currentGoalKey: string | undefined) {
  const events = candidate.events;
  let inactiveIndex = -1;
  let inactiveType: "paused" | "closed" | undefined;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const directlyTargetsDirection = event.careerDirection ? `career:${canonicalCareerDirection(event.careerDirection)}` === candidate.key : candidate.opportunitySpecific;
    const previousTarget = event.previousCareerDirection ? `career:${canonicalCareerDirection(event.previousCareerDirection)}` === candidate.key : false;
    if (directlyTargetsDirection && event.type === "direction_paused") { inactiveIndex = index; inactiveType = "paused"; }
    if (directlyTargetsDirection && event.type === "direction_closed") { inactiveIndex = index; inactiveType = "closed"; }
    if (previousTarget && event.type === "goal_changed") { inactiveIndex = index; inactiveType = "paused"; }
  }
  if (inactiveIndex >= 0) {
    const resumed = events.slice(inactiveIndex + 1).some(meaningful);
    if (resumed) return { state: "rejoined" as const, endedAt: undefined };
    return { state: inactiveType as "paused" | "closed", endedAt: events[inactiveIndex].occurredAt };
  }
  if (confidence >= visibleBranchConfidence || (candidate.key === currentGoalKey && candidate.events.some(meaningful))) {
    return { state: "active" as const, endedAt: undefined };
  }
  return { state: "exploring" as const, endedAt: undefined };
}

function scoreCandidates(input: OpenLineInput, events: readonly JourneyEvent[], candidates: Map<string, Candidate>) {
  const currentGoalKey = explicitCurrentGoalKey(input, events);
  const waypointOpportunity = currentWaypointOpportunityId(input);
  const latestOverall = Date.parse(latestTimestamp(events));
  const scored: ScoredCandidate[] = [];

  for (const candidate of candidates.values()) {
    candidate.events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
    const confidence = confidenceFor(candidate, currentGoalKey);
    const state = deriveDirectionState(candidate, confidence, currentGoalKey);
    const meaningfulEvents = candidate.events.filter(meaningful);
    const strongestProgress = candidate.events.reduce((rank, event) => Math.max(rank, progressScore[progressLevelForEvent[event.type]]), 0);
    const lastMeaningfulActivityAt = latestTimestamp(meaningfulEvents.length ? meaningfulEvents : candidate.events);
    const latestCandidate = Date.parse(lastMeaningfulActivityAt);
    const ageDays = Number.isFinite(latestOverall - latestCandidate) ? Math.max(0, (latestOverall - latestCandidate) / 86_400_000) : 0;
    const recency = Math.max(0, 8 - Math.min(8, ageDays / 30));
    const explicitGoal = candidate.key === currentGoalKey;
    const waypointAligned = Boolean(waypointOpportunity && candidate.events.some((event) => event.opportunityId === waypointOpportunity));
    const score = Math.round(
      confidence * 100
      + strongestProgress * 25
      + Math.min(2, candidate.evidenceEventIds.size) * 8
      + (explicitGoal ? 35 : 0)
      + (waypointAligned ? 10 : 0)
      + Math.min(3, meaningfulEvents.length) * 3
      + recency
      + (candidate.events.every((event) => event.publicSafe) ? 1 : 0)
      - (candidate.kind === "skill" ? 90 : 0)
      - (candidate.key === "category:student-benefits" || candidate.key === "category:ai-tools" ? 20 : 0),
    );
    const skillHasEvidence = candidate.kind !== "skill" || candidate.evidenceEventIds.size > 0;
    const activated = skillHasEvidence && (confidence >= visibleBranchConfidence || state.state === "paused" || state.state === "closed" || state.state === "rejoined");
    const direction: JourneyDirection = {
      key: candidate.key,
      kind: candidate.kind,
      label: candidate.label,
      state: state.state,
      startedAt: candidate.events[0].occurredAt,
      lastMeaningfulActivityAt,
      endedAt: state.endedAt,
      eventIds: candidate.events.map((event) => event.id),
      evidenceEventIds: [...candidate.evidenceEventIds].sort(),
      parentDirectionKey: candidate.parentDirectionKey,
      confidence,
      publicSafe: candidate.events.every((event) => event.publicSafe),
    };
    scored.push({ ...candidate, direction, activated, score, strongestProgress, explicitCurrentGoal: explicitGoal, waypointAligned });
  }
  return scored;
}

function compareCandidates(a: ScoredCandidate, b: ScoredCandidate) {
  return b.score - a.score
    || b.direction.confidence - a.direction.confidence
    || b.strongestProgress - a.strongestProgress
    || b.evidenceEventIds.size - a.evidenceEventIds.size
    || b.direction.lastMeaningfulActivityAt.localeCompare(a.direction.lastMeaningfulActivityAt)
    || a.key.localeCompare(b.key);
}

function selectPrimary(scored: readonly ScoredCandidate[]) {
  const eligible = scored.filter((candidate) => candidate.direction.state !== "closed");
  const substantive = eligible.filter((candidate) => candidate.kind !== "skill");
  return [...(substantive.length ? substantive : eligible)].sort(compareCandidates)[0];
}

function preferredAssignment(event: JourneyEvent, containing: readonly ScoredCandidate[], primaryKey: string | undefined) {
  if (containing.length === 1) return containing[0].key;
  if (event.type === "skill_evidence_created") {
    return [...containing].filter((candidate) => candidate.kind === "skill").sort(compareCandidates)[0]?.key;
  }
  if (event.type.startsWith("goal_") || event.type.startsWith("direction_")) {
    const directCareer = event.careerDirection ? `career:${canonicalCareerDirection(event.careerDirection)}` : undefined;
    if (directCareer && containing.some((candidate) => candidate.key === directCareer)) return directCareer;
  }
  const opportunityDirection = [...containing]
    .filter((candidate) => candidate.kind !== "career" && candidate.kind !== "skill")
    .sort((a, b) => Number(b.opportunitySpecific) - Number(a.opportunitySpecific) || compareCandidates(a, b))[0];
  if (opportunityDirection) return opportunityDirection.key;
  const primary = containing.find((candidate) => candidate.key === primaryKey);
  if (primary) return primary.key;
  return [...containing].sort((a, b) => Number(b.opportunitySpecific) - Number(a.opportunitySpecific) || compareCandidates(a, b))[0]?.key;
}

function transitionExplanation(type: DirectionTransitionRecord["type"], label: string, previousLabel?: string) {
  if (type === "continued") return `Activity continued in ${label}.`;
  if (type === "expanded") return `${label} became an additional direction.`;
  if (type === "shifted") return previousLabel ? `Your current direction shifted from ${previousLabel} to ${label}.` : `Your current direction shifted to ${label}.`;
  if (type === "paused") return `${label} is paused while its history remains available.`;
  if (type === "closed") return `${label} closed without changing broader directions.`;
  return `${label} became active again through new meaningful activity.`;
}

function buildTransitions(events: readonly JourneyEvent[], scored: readonly ScoredCandidate[]) {
  const labels = new Map(scored.map((candidate) => [candidate.key, candidate.label]));
  const transitions: DirectionTransitionRecord[] = [];
  const activeCareerKeys = new Set<string>();
  const inactiveAt = new Map<string, JourneyEvent>();
  for (const event of events) {
    if (event.careerDirection && (event.type === "goal_selected" || event.type === "goal_changed")) {
      const key = `career:${canonicalCareerDirection(event.careerDirection)}`;
      const previousKey = event.previousCareerDirection ? `career:${canonicalCareerDirection(event.previousCareerDirection)}` : undefined;
      const type = event.type === "goal_changed" && previousKey && previousKey !== key
        ? "shifted"
        : activeCareerKeys.size > 0 && !activeCareerKeys.has(key) ? "expanded" : "continued";
      transitions.push({
        id: stableId("direction-transition", openLineBranchRulesVersion, event.id, type, key),
        type,
        directionKey: key,
        occurredAt: event.occurredAt,
        supportingEventIds: [event.id],
        previousDirectionKey: previousKey,
        explanation: transitionExplanation(type, labels.get(key) ?? titleCase(key.split(":").at(-1) ?? key), previousKey ? labels.get(previousKey) : undefined),
      });
      activeCareerKeys.add(key);
      if (previousKey && previousKey !== key) {
        activeCareerKeys.delete(previousKey);
        inactiveAt.set(previousKey, event);
      }
      continue;
    }
    if (event.careerDirection && (event.type === "direction_paused" || event.type === "direction_closed")) {
      const key = `career:${canonicalCareerDirection(event.careerDirection)}`;
      const type = event.type === "direction_paused" ? "paused" : "closed";
      transitions.push({
        id: stableId("direction-transition", openLineBranchRulesVersion, event.id, type, key),
        type,
        directionKey: key,
        occurredAt: event.occurredAt,
        supportingEventIds: [event.id],
        explanation: transitionExplanation(type, labels.get(key) ?? titleCase(key.split(":").at(-1) ?? key)),
      });
      activeCareerKeys.delete(key);
      inactiveAt.set(key, event);
    }
  }
  for (const candidate of scored) {
    const inactive = inactiveAt.get(candidate.key);
    if (!inactive) continue;
    const resumed = candidate.events.find((event) => event.occurredAt > inactive.occurredAt && meaningful(event));
    if (!resumed) continue;
    transitions.push({
      id: stableId("direction-transition", openLineBranchRulesVersion, resumed.id, "rejoined", candidate.key),
      type: "rejoined",
      directionKey: candidate.key,
      occurredAt: resumed.occurredAt,
      supportingEventIds: [inactive.id, resumed.id],
      explanation: transitionExplanation("rejoined", candidate.label),
    });
  }
  return transitions.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
}

function buildExperienceCompletionRejoins(scored: readonly ScoredCandidate[], primary: ScoredCandidate | undefined) {
  if (!primary) return [];
  const rejoins: RejoinEvidence[] = [];
  for (const candidate of scored) {
    if (candidate.key === primary.key || candidate.kind !== "experience" || !candidate.activated) continue;
    const completed = candidate.events.filter((event) => event.type === "opportunity_completed").at(-1);
    if (!completed) continue;
    rejoins.push({
      id: stableId("rejoin-evidence", openLineBranchRulesVersion, candidate.key, primary.key, completed.id, "experience_completed"),
      sourceBranchKeys: [candidate.key],
      targetBranchKey: primary.key,
      reason: "experience_completed",
      supportingEventIds: [completed.id],
      supportingSkillIds: [...candidate.explicitSkillIds].sort(),
      confidence: 1,
      explanation: `Completing ${candidate.label} added verified experience back into ${primary.label}.`,
    });
  }
  return rejoins;
}

function buildGroupedRejoins(scored: readonly ScoredCandidate[], primary: ScoredCandidate | undefined) {
  if (!primary) return [];
  const activated = scored.filter((candidate) => candidate.activated && candidate.key !== primary.key && candidate.kind !== "skill");
  const rejoins: RejoinEvidence[] = [];
  const skillGroups = new Map<string, ScoredCandidate[]>();
  const goalGroups = new Map<string, ScoredCandidate[]>();
  for (const candidate of activated) {
    if (!candidate.evidenceEventIds.size) continue;
    for (const skill of candidate.explicitSkillIds) {
      const group = skillGroups.get(skill) ?? [];
      group.push(candidate);
      skillGroups.set(skill, group);
    }
    for (const goal of candidate.explicitCareerKeys) {
      const group = goalGroups.get(goal) ?? [];
      group.push(candidate);
      goalGroups.set(goal, group);
    }
  }
  for (const [skill, candidates] of [...skillGroups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const unique = [...new Map(candidates.map((candidate) => [candidate.key, candidate])).values()].sort(compareCandidates);
    if (unique.length < 2) continue;
    const sources = unique.slice(0, 2);
    const supporting = sources.flatMap((candidate) => [...candidate.evidenceEventIds]).sort();
    rejoins.push({
      id: stableId("rejoin-evidence", openLineBranchRulesVersion, "shared_skill", skill, sources.map((candidate) => candidate.key), primary.key),
      sourceBranchKeys: sources.map((candidate) => candidate.key).sort(),
      targetBranchKey: primary.key,
      reason: "shared_skill",
      supportingEventIds: supporting,
      supportingSkillIds: [skill],
      confidence: 0.9,
      explanation: `${sources[0].label} and ${sources[1].label} both created verified ${titleCase(skill)} evidence for ${primary.label}.`,
    });
  }
  for (const [goal, candidates] of [...goalGroups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (goal !== primary.key) continue;
    const unique = [...new Map(candidates.map((candidate) => [candidate.key, candidate])).values()].sort(compareCandidates);
    if (unique.length < 2) continue;
    const sources = unique.slice(0, 2);
    rejoins.push({
      id: stableId("rejoin-evidence", openLineBranchRulesVersion, "shared_goal", sources.map((candidate) => candidate.key), primary.key),
      sourceBranchKeys: sources.map((candidate) => candidate.key).sort(),
      targetBranchKey: primary.key,
      reason: "shared_goal",
      supportingEventIds: sources.flatMap((candidate) => candidate.events.filter(meaningful).map((event) => event.id)).sort(),
      confidence: 0.88,
      explanation: `${sources[0].label} and ${sources[1].label} now both support ${primary.label}.`,
    });
  }
  return rejoins;
}

const synthesisRules: Array<{ target: string; sourceGroups: string[][] }> = [
  {
    target: "career:quantitative-finance",
    sourceGroups: [
      ["career:mathematics", "skill:statistics", "skill:data-analysis"],
      ["career:software-engineering", "skill:programming", "skill:python", "career:finance", "career:investment-banking"],
    ],
  },
  {
    target: "career:data-science",
    sourceGroups: [
      ["career:mathematics", "skill:statistics", "skill:data-analysis"],
      ["career:software-engineering", "skill:programming", "skill:python", "career:research"],
    ],
  },
  {
    target: "career:medicine",
    sourceGroups: [
      ["career:research", "academic:undergraduate-research"],
      ["skill:communication", "skill:research-analysis", "experience:internships"],
    ],
  },
];

function buildSynthesisRejoins(scored: readonly ScoredCandidate[], primary: ScoredCandidate | undefined) {
  if (!primary) return [];
  const rule = synthesisRules.find((candidate) => candidate.target === primary.key);
  if (!rule) return [];
  const activated = new Map(scored.filter((candidate) => candidate.activated && candidate.key !== primary.key).map((candidate) => [candidate.key, candidate]));
  const sources = rule.sourceGroups.map((group) => group.map((key) => activated.get(key)).find(Boolean)).filter((candidate): candidate is ScoredCandidate => Boolean(candidate));
  if (sources.length !== rule.sourceGroups.length || new Set(sources.map((candidate) => candidate.key)).size !== sources.length) return [];
  return [{
    id: stableId("rejoin-evidence", openLineBranchRulesVersion, "direction_synthesis", sources.map((candidate) => candidate.key), primary.key),
    sourceBranchKeys: sources.map((candidate) => candidate.key).sort(),
    targetBranchKey: primary.key,
    reason: "direction_synthesis" as const,
    supportingEventIds: sources.flatMap((candidate) => candidate.events.filter(meaningful).map((event) => event.id)).sort(),
    confidence: 0.9,
    explanation: `${sources[0].label} and ${sources[1].label} now combine in ${primary.label}.`,
  }];
}

function deduplicateRejoins(rejoins: readonly RejoinEvidence[]) {
  const seen = new Set<string>();
  return [...rejoins].sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id)).filter((rejoin) => {
    const key = `${rejoin.reason}|${rejoin.sourceBranchKeys.join(",")}|${rejoin.targetBranchKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ignoreReason(candidate: ScoredCandidate): IgnoredDirectionCandidateReason {
  if (candidate.events.every((event) => event.type === "opportunity_saved" || event.type === "opportunity_viewed")) return "saved_only";
  if (candidate.kind === "skill" && candidate.evidenceEventIds.size === 0) return "insufficient_evidence";
  if (candidate.direction.confidence < visibleBranchConfidence) return "low_confidence";
  return "insufficient_evidence";
}

export function analyzeJourneyBranches(
  input: OpenLineInput,
  events: readonly JourneyEvent[],
  options: BranchIntelligenceOptions = {},
  observeStage?: BranchIntelligenceBuildObserver,
): BranchIntelligenceResult {
  let stageStartedAt = observeStage ? performance.now() : 0;
  const completeStage = (stage: BranchIntelligenceBuildStage) => {
    if (!observeStage) return;
    const completedAt = performance.now();
    observeStage(stage, completedAt - stageStartedAt);
    stageStartedAt = completedAt;
  };
  const maxVisibleBranches = Math.max(0, Math.min(3, Math.floor(options.maxVisibleBranches ?? 3)));
  const opportunities = new Map((input.opportunities ?? []).map((opportunity) => [opportunity.id, opportunity]));
  const validationEvidence = events.map((event) => validationForEvent(event, event.opportunityId ? opportunities.get(event.opportunityId) : undefined)).filter((item): item is ValidationEvidence => Boolean(item));
  completeStage("validation_index");
  const candidates = buildCandidates(input, events, validationEvidence, opportunities);
  completeStage("candidate_generation");
  const scored = scoreCandidates(input, events, candidates);
  completeStage("candidate_scoring");
  const primary = selectPrimary(scored);
  const secondary = scored.filter((candidate) => candidate.activated && candidate.key !== primary?.key).sort(compareCandidates);
  const visibleSecondary = secondary.slice(0, maxVisibleBranches);
  completeStage("branch_selection");
  const transitions = buildTransitions(events, scored);
  completeStage("transitions");
  const rejoins = deduplicateRejoins([
    ...buildExperienceCompletionRejoins(scored, primary),
    ...buildGroupedRejoins(scored, primary),
    ...buildSynthesisRejoins(scored, primary),
  ]);
  completeStage("rejoins");
  const rejoinBySource = new Map<string, RejoinEvidence>();
  for (const rejoin of rejoins) for (const source of rejoin.sourceBranchKeys) if (!rejoinBySource.has(source)) rejoinBySource.set(source, rejoin);
  const directions = scored.sort((a, b) => a.direction.startedAt.localeCompare(b.direction.startedAt) || a.key.localeCompare(b.key)).map((candidate) => {
    const rejoin = rejoinBySource.get(candidate.key);
    return rejoin ? { ...candidate.direction, state: "rejoined" as const, rejoinTargetKey: rejoin.targetBranchKey } : candidate.direction;
  });
  const candidatesByEvent = new Map<string, ScoredCandidate[]>();
  for (const candidate of scored) {
    for (const event of candidate.events) {
      const containing = candidatesByEvent.get(event.id) ?? [];
      containing.push(candidate);
      candidatesByEvent.set(event.id, containing);
    }
  }
  const eventAssignments = events.flatMap((event) => {
    const directionKey = preferredAssignment(event, candidatesByEvent.get(event.id) ?? [], primary?.key);
    return directionKey ? [{ eventId: event.id, directionKey }] : [];
  });
  completeStage("assignments");
  const rawSignatureData = {
    version: openLineBranchRulesVersion,
    primaryDirectionKey: primary?.key,
    directions,
    secondaryDirectionKeys: secondary.map((candidate) => candidate.key),
    eventAssignments,
    transitions,
    rejoins,
    validationEvidence,
  };
  const signature = stableHash(rawSignatureData);
  completeStage("signature");
  const opaque = (key: string) => stableId("direction-diagnostic", signature, key);
  const ignoredCandidates = scored.filter((candidate) => !candidate.activated).map((candidate) => ({ opaqueKey: opaque(candidate.key), reason: ignoreReason(candidate) }));
  for (const candidate of scored) {
    if (candidate.rawLabels.size > 1) ignoredCandidates.push({ opaqueKey: opaque(`${candidate.key}:alias`), reason: "duplicate_alias" });
  }
  for (const candidate of secondary.slice(maxVisibleBranches)) ignoredCandidates.push({ opaqueKey: opaque(`${candidate.key}:limit`), reason: "display_limit" });
  const diagnostics = {
    sourceDirectionCount: scored.length,
    visibleDirectionCount: visibleSecondary.length,
    primaryDirectionKey: primary ? opaque(primary.key) : undefined,
    visibleBranchKeys: visibleSecondary.map((candidate) => opaque(candidate.key)),
    collapsedBranchKeys: secondary.slice(maxVisibleBranches).map((candidate) => opaque(candidate.key)),
    rejoinCount: rejoins.length,
    validationCount: validationEvidence.length,
    skillStrandCount: scored.filter((candidate) => candidate.kind === "skill" && candidate.activated).length,
    ignoredCandidates: ignoredCandidates.sort((a, b) => a.opaqueKey.localeCompare(b.opaqueKey) || a.reason.localeCompare(b.reason)),
    deterministicSignature: signature,
  };
  completeStage("diagnostics");
  return {
    version: openLineBranchRulesVersion,
    signature,
    primaryDirectionKey: primary?.key,
    directions,
    secondaryDirectionKeys: secondary.map((candidate) => candidate.key),
    visibleSecondaryDirectionKeys: visibleSecondary.map((candidate) => candidate.key),
    eventAssignments,
    transitions,
    rejoins,
    validationEvidence,
    diagnostics,
  };
}

export function branchActivationThreshold() {
  return visibleBranchConfidence;
}
