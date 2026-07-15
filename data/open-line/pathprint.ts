import { analyzeJourneyBranches } from "./branch-intelligence";
import { buildOpenLineNarratives, createPublicNarrativeProjection } from "./narrative";
import { journeyEventImportance, normalizeJourneyEvents, progressLevelForEvent } from "./normalize";
import { stableHash, stableId, validTimestamp } from "./stable";
import type {
  JourneyEvent,
  JourneyEventType,
  BranchIntelligenceResult,
  OpenLineNarrativeResult,
  OpenLineDiagnostics,
  OpenLineInput,
  PathBranch,
  PathEvent,
  PathEventKind,
  PathPossibility,
  Pathprint,
  ProgressLevel,
  PublicPathEvent,
  PublicPathprint,
} from "./types";
import { openLineModelVersion } from "./types";

const progressRank: Record<ProgressLevel, number> = {
  exploration: 0,
  intention: 1,
  action: 2,
  commitment: 3,
  validation: 4,
};

const eventKinds: Record<JourneyEventType, PathEventKind> = {
  opportunity_viewed: "explored",
  opportunity_saved: "explored",
  opportunity_chosen: "chosen",
  application_started: "active",
  application_submitted: "submitted",
  interview_reached: "validated",
  accepted: "accepted",
  opportunity_completed: "completed",
  skill_evidence_created: "validated",
  goal_selected: "chosen",
  goal_changed: "chosen",
  direction_paused: "paused",
  direction_resumed: "active",
  direction_closed: "closed",
};

const sensitiveFieldsExcludedFromPublicPathprints = [
  "application_answers",
  "email",
  "gpa",
  "private_notes",
  "rejection_details",
  "sensitive_eligibility",
] as const;

function toPathEvents(events: readonly JourneyEvent[], branchIntelligence: BranchIntelligenceResult, narrative: OpenLineNarrativeResult) {
  const assignments = new Map(branchIntelligence.eventAssignments.map((assignment) => [assignment.eventId, assignment.directionKey]));
  const activated = new Set(branchIntelligence.directions.filter((direction) => direction.state !== "exploring").map((direction) => direction.key));
  const copies = new Map(narrative.eventNarratives.map((copy) => [copy.eventId, copy]));
  const momentByEvent = new Map(narrative.moments.flatMap((moment) => moment.evidenceEventIds.map((eventId) => [eventId, moment.id] as const)));

  return events.map((event): PathEvent => {
    const copy = copies.get(event.id);
    if (!copy) throw new Error(`Missing canonical narrative for event ${event.id}`);
    const directionKey = assignments.get(event.id);
    return {
      id: stableId("path-event", openLineModelVersion, event.id),
      kind: eventKinds[event.type],
      occurredAt: event.occurredAt,
      progressLevel: progressLevelForEvent[event.type],
      title: copy.title,
      narrative: copy.body,
      whatChanged: copy.explanation,
      opportunityId: event.opportunityId,
      organizationId: event.organizationId,
      careerDirection: event.careerDirection,
      category: event.category,
      directionKey,
      branchKey: !directionKey || directionKey === branchIntelligence.primaryDirectionKey || !activated.has(directionKey) ? "main" : directionKey,
      importance: journeyEventImportance[event.type],
      shareable: event.visibility === "shareable",
      publicSafe: event.publicSafe,
      narrativeMomentId: momentByEvent.get(event.id),
      narrativeTemplateKey: copy.bodyTemplateKey,
      publicNarrative: {
        title: copy.publicCopy.title,
        narrative: copy.publicCopy.body,
        whatChanged: copy.publicCopy.explanation,
      },
    };
  });
}

function buildBranches(events: readonly JourneyEvent[], pathEvents: readonly PathEvent[], intelligence: BranchIntelligenceResult) {
  const pathByJourneyId = new Map(events.map((event, index) => [event.id, pathEvents[index]]));
  const directionByKey = new Map(intelligence.directions.map((direction) => [direction.key, direction]));
  return intelligence.secondaryDirectionKeys.flatMap((key): PathBranch[] => {
    const direction = directionByKey.get(key);
    if (!direction || direction.state === "exploring") return [];
    const eventIds = direction.eventIds
      .map((eventId) => pathByJourneyId.get(eventId))
      .filter((event): event is PathEvent => Boolean(event) && event?.branchKey === key)
      .map((event) => event.id);
    if (!eventIds.length) return [];
    return [{
      key,
      label: direction.kind === "skill" ? `${direction.label} evidence` : direction.label,
      eventIds,
      startedAt: direction.startedAt,
      endedAt: direction.endedAt,
      state: direction.state === "rejoined" ? "rejoined" : direction.state === "paused" ? "paused" : direction.state === "closed" ? "closed" : "active",
    }];
  });
}

function buildOrigin(events: readonly PathEvent[], narrative: OpenLineNarrativeResult): PathEvent {
  return {
    id: stableId("path-origin", openLineModelVersion),
    kind: "origin",
    occurredAt: events[0]?.occurredAt ?? null,
    progressLevel: "exploration",
    title: narrative.origin.title,
    narrative: narrative.origin.body,
    whatChanged: narrative.origin.explanation,
    branchKey: "main",
    importance: 0,
    shareable: true,
    publicSafe: true,
  };
}

function currentDirection(events: readonly JourneyEvent[], input: OpenLineInput) {
  const directionEvents = events.filter((event) => event.careerDirection && (event.type === "goal_selected" || event.type === "goal_changed"));
  return directionEvents.at(-1)?.careerDirection ?? (input.profile?.careerGoal?.trim() || undefined);
}

function strongestLevel(events: readonly PathEvent[]): ProgressLevel {
  return events.reduce<ProgressLevel>((strongest, event) => progressRank[event.progressLevel] > progressRank[strongest] ? event.progressLevel : strongest, "exploration");
}

export function buildPathprint(input: OpenLineInput): Pathprint {
  const normalization = normalizeJourneyEvents(input);
  const branchIntelligence = analyzeJourneyBranches(input, normalization.events);
  const narrative = buildOpenLineNarratives(input, normalization.events, branchIntelligence);
  const events = toPathEvents(normalization.events, branchIntelligence, narrative);
  const branches = buildBranches(normalization.events, events, branchIntelligence);
  const currentWaypoint = narrative.waypoint ? {
    id: narrative.waypoint.id,
    title: narrative.waypoint.title,
    whyItMatters: narrative.waypoint.whyItMatters,
    estimatedMinutes: narrative.waypoint.estimatedMinutes,
    impact: narrative.waypoint.impact,
    sourceOpportunityId: narrative.waypoint.sourceOpportunityId,
    source: narrative.waypoint.source,
  } : undefined;
  const horizon: PathPossibility[] = narrative.horizon.map((item) => ({ id: item.id, title: item.title, rationale: item.rationale, branchKey: item.branchKey }));
  const summary = {
    currentDirection: currentDirection(normalization.events, input),
    strongestProgressLevel: strongestLevel(events),
    meaningfulEventCount: events.filter((event) => event.progressLevel !== "exploration").length,
    validationCount: events.filter((event) => event.progressLevel === "validation").length,
  };
  const signature = stableHash({ version: openLineModelVersion, userId: input.userId, events, branches, currentWaypoint, horizon, summary, branchIntelligence, narrative });

  return {
    version: openLineModelVersion,
    signature,
    userId: input.userId,
    generatedAt: validTimestamp(input.generatedAt) ? input.generatedAt : new Date().toISOString(),
    origin: buildOrigin(events, narrative),
    events,
    branches,
    currentWaypoint,
    horizon,
    branchIntelligence,
    narrative,
    summary,
  };
}

export function getOpenLineDiagnostics(input: OpenLineInput, pathprint = buildPathprint(input)): OpenLineDiagnostics {
  const normalization = normalizeJourneyEvents(input);
  const privateEventCount = normalization.events.filter((event) => event.visibility === "private").length;
  const publicUnsafeEventCount = normalization.events.filter((event) => !event.publicSafe).length;
  const ignored = { ...normalization.diagnostics.ignored };
  ignored.exploration_does_not_create_branch += normalization.events.filter((event) => progressLevelForEvent[event.type] === "exploration").length;
  return {
    sourceEventCount: normalization.diagnostics.sourceEventCount,
    normalizedEventCount: normalization.events.length,
    pathEventCount: pathprint.events.length,
    branchCount: pathprint.branches.length,
    currentWaypointSource: pathprint.currentWaypoint?.source ?? "none",
    ignoredEvents: Object.entries(ignored)
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([reason, count]) => ({ reason: reason as keyof typeof ignored, count })),
    privacyExclusions: {
      privateEventCount,
      publicUnsafeEventCount,
      excludedSensitiveFields: [...sensitiveFieldsExcludedFromPublicPathprints],
    },
    branchIntelligence: pathprint.branchIntelligence?.diagnostics,
    narrative: pathprint.narrative?.diagnostics,
  };
}

export function createPublicPathprint(pathprint: Pathprint): PublicPathprint {
  const sourceEvents = pathprint.events.filter((event) => event.shareable && event.publicSafe);
  const grouped = new Map<string, PathEvent[]>();
  for (const event of sourceEvents) {
    const key = event.directionKey ?? "main";
    const current = grouped.get(key) ?? [];
    current.push(event);
    grouped.set(key, current);
  }
  const publicPrimaryKey = [...grouped.entries()].sort(([keyA, eventsA], [keyB, eventsB]) => {
    const score = (events: readonly PathEvent[]) => Math.max(...events.map((event) => event.importance), 0) + events.filter((event) => event.progressLevel === "validation").length * 10;
    return score(eventsB) - score(eventsA) || keyA.localeCompare(keyB);
  })[0]?.[0];
  const projectedSourceEvents = sourceEvents.map((event) => ({
    ...event,
    title: event.publicNarrative?.title ?? event.title,
    narrative: event.publicNarrative?.narrative ?? event.narrative,
    whatChanged: event.publicNarrative?.whatChanged ?? event.whatChanged,
    branchKey: !event.directionKey || event.directionKey === publicPrimaryKey ? "main" : event.directionKey,
  }));
  const publicEvents = projectedSourceEvents.map((event, index): PublicPathEvent => {
    const {
      id: _id,
      opportunityId: _opportunityId,
      organizationId: _organizationId,
      careerDirection: _careerDirection,
      directionKey: _directionKey,
      narrativeMomentId: _narrativeMomentId,
      narrativeTemplateKey: _narrativeTemplateKey,
      publicNarrative: _publicNarrative,
      ...safe
    } = event;
    return { ...safe, id: stableId("public-path-event", pathprint.version, index, safe) };
  });
  const branches = [...new Set(projectedSourceEvents.map((event) => event.branchKey).filter((key) => key !== "main"))].sort().flatMap((branchKey) => {
    const retainedIds = projectedSourceEvents.flatMap((event, index) => event.branchKey === branchKey ? [publicEvents[index].id] : []);
    const startedAt = projectedSourceEvents.find((event) => event.branchKey === branchKey)?.occurredAt;
    if (!retainedIds.length || !startedAt) return [];
    return [{ id: stableId("public-path-branch", pathprint.version, retainedIds, startedAt), eventIds: retainedIds, startedAt, state: "active" as const }];
  });
  const { id: _originId, opportunityId: _originOpportunityId, organizationId: _originOrganizationId, careerDirection: _originCareerDirection, directionKey: _originDirectionKey, ...originSafe } = pathprint.origin;
  const publicOrigin: PublicPathEvent = {
    ...originSafe,
    id: stableId("public-path-origin", pathprint.version, publicEvents[0]?.occurredAt ?? null),
    occurredAt: publicEvents[0]?.occurredAt ?? null,
    narrative: publicEvents.length ? "This is the earliest shareable activity in this Pathprint." : "No shareable journey activity has been selected.",
  };
  const summary = {
    strongestProgressLevel: strongestLevel(publicEvents),
    meaningfulEventCount: publicEvents.filter((event) => event.progressLevel !== "exploration").length,
    validationCount: publicEvents.filter((event) => event.progressLevel === "validation").length,
  };
  const publicData = {
    version: pathprint.version,
    origin: publicOrigin,
    events: publicEvents,
    branches,
    narrative: pathprint.narrative ? createPublicNarrativeProjection(pathprint.narrative) : undefined,
    summary,
  };
  return { ...publicData, signature: stableHash(publicData) };
}
