import type { Opportunity } from "../opportunities";
import { journeyEventImportance, normalizeJourneyEvents, progressLevelForEvent } from "./normalize";
import { slug, stableHash, stableId, validTimestamp } from "./stable";
import type {
  JourneyEvent,
  JourneyEventType,
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

function titleCase(value: string) {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}

function categoryPhrase(event: JourneyEvent) {
  return event.category?.trim().toLowerCase() || "opportunity";
}

function opportunityTitle(event: JourneyEvent, opportunities: ReadonlyMap<string, Opportunity>) {
  return event.opportunityId ? opportunities.get(event.opportunityId)?.title : undefined;
}

function branchKeyForEvent(event: JourneyEvent) {
  if (event.type.startsWith("goal_") || event.type.startsWith("direction_")) {
    return event.careerDirection ? `career:${slug(event.careerDirection)}` : "main";
  }
  if (event.type === "skill_evidence_created" && event.skillIds?.length) {
    return `skill:${slug([...event.skillIds].sort()[0])}`;
  }
  if (progressLevelForEvent[event.type] === "exploration") return "main";
  return event.category ? `category:${slug(event.category)}` : "category:general";
}

function eventTitle(event: JourneyEvent, opportunities: ReadonlyMap<string, Opportunity>) {
  const namedOpportunity = opportunityTitle(event, opportunities);
  const category = titleCase(categoryPhrase(event));
  switch (event.type) {
    case "opportunity_viewed": return `Explored ${category}`;
    case "opportunity_saved": return namedOpportunity ? `Saved ${namedOpportunity}` : `Saved ${category}`;
    case "opportunity_chosen": return namedOpportunity ? `Chose ${namedOpportunity}` : `Chose ${category}`;
    case "application_started": return namedOpportunity ? `Started ${namedOpportunity}` : `Started a ${category} application`;
    case "application_submitted": return namedOpportunity ? `Submitted ${namedOpportunity}` : `Submitted a ${category} application`;
    case "interview_reached": return namedOpportunity ? `Interviewed for ${namedOpportunity}` : `Reached a ${category} interview`;
    case "accepted": return namedOpportunity ? `Accepted to ${namedOpportunity}` : `Accepted a ${category} opportunity`;
    case "opportunity_completed": return namedOpportunity ? `Completed ${namedOpportunity}` : `Completed a ${category} opportunity`;
    case "skill_evidence_created": return event.evidence?.label || `Built ${category} evidence`;
    case "goal_selected": return `Selected ${event.careerDirection || "a direction"}`;
    case "goal_changed": return `Changed direction to ${event.careerDirection || "a new direction"}`;
    case "direction_paused": return `Paused ${event.careerDirection || "a direction"}`;
    case "direction_closed": return `Closed ${event.careerDirection || category}`;
  }
}

function narrativeForEvent(event: JourneyEvent, priorTypeCount: number, priorCategoryTypeCount: number) {
  const first = priorTypeCount === 0;
  const firstInCategory = priorCategoryTypeCount === 0;
  const category = categoryPhrase(event);
  switch (event.type) {
    case "opportunity_viewed":
      return firstInCategory ? `You started exploring ${category}.` : `You explored another ${category} opportunity.`;
    case "opportunity_saved":
      return firstInCategory ? `You began exploring ${category}.` : `You saved another ${category} opportunity to review.`;
    case "opportunity_chosen":
      return first ? `You chose a ${category} opportunity to move forward with.` : `You chose another ${category} opportunity to pursue.`;
    case "application_started":
      return first ? `A saved ${category} opportunity became an active application.` : `You started another ${category} application.`;
    case "application_submitted":
      return firstInCategory ? `You submitted your first ${category} application.` : `You submitted another ${category} application.`;
    case "interview_reached":
      return first ? `A new path opened when you reached the interview stage for a ${category} opportunity.` : `You reached another interview for a ${category} opportunity.`;
    case "accepted":
      return first ? "You earned an opportunity to turn interest into experience." : `You earned another ${category} opportunity.`;
    case "opportunity_completed":
      return first ? `You completed a ${category} opportunity and created evidence of your experience.` : `You completed another ${category} opportunity.`;
    case "skill_evidence_created":
      return first ? "You created evidence of a skill through completed work." : "You added another piece of evidence from completed work.";
    case "goal_selected":
      return `You selected ${event.careerDirection} as a direction to explore.`;
    case "goal_changed":
      return event.previousCareerDirection
        ? `You shifted your direction from ${event.previousCareerDirection} to ${event.careerDirection}.`
        : `You shifted your direction to ${event.careerDirection}.`;
    case "direction_paused":
      return `You paused ${event.careerDirection} without removing its history.`;
    case "direction_closed":
      return event.careerDirection
        ? `You closed ${event.careerDirection} as an active direction while preserving what you learned.`
        : `This ${category} path closed without changing the rest of your journey.`;
  }
}

function whatChangedForEvent(event: JourneyEvent) {
  switch (event.type) {
    case "opportunity_chosen": return "Exploration became intention.";
    case "application_started": return "Intention became action.";
    case "application_submitted": return "Action became commitment.";
    case "interview_reached":
    case "accepted":
    case "opportunity_completed":
    case "skill_evidence_created": return "Your progress gained external or completed-work evidence.";
    case "goal_changed": return "Your current direction changed without erasing prior work.";
    case "direction_paused": return "This direction is no longer active for now.";
    case "direction_closed": return "This direction is no longer active.";
    default: return undefined;
  }
}

function toPathEvents(events: readonly JourneyEvent[], opportunities: readonly Opportunity[]) {
  const opportunityMap = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));
  const typeCounts = new Map<JourneyEventType, number>();
  const categoryTypeCounts = new Map<string, number>();

  return events.map((event): PathEvent => {
    const categoryTypeKey = `${event.type}|${categoryPhrase(event)}`;
    const priorTypeCount = typeCounts.get(event.type) ?? 0;
    const priorCategoryTypeCount = categoryTypeCounts.get(categoryTypeKey) ?? 0;
    typeCounts.set(event.type, priorTypeCount + 1);
    categoryTypeCounts.set(categoryTypeKey, priorCategoryTypeCount + 1);

    return {
      id: stableId("path-event", openLineModelVersion, event.id),
      kind: eventKinds[event.type],
      occurredAt: event.occurredAt,
      progressLevel: progressLevelForEvent[event.type],
      title: eventTitle(event, opportunityMap),
      narrative: narrativeForEvent(event, priorTypeCount, priorCategoryTypeCount),
      whatChanged: whatChangedForEvent(event),
      opportunityId: event.opportunityId,
      organizationId: event.organizationId,
      careerDirection: event.careerDirection,
      category: event.category,
      branchKey: branchKeyForEvent(event),
      importance: journeyEventImportance[event.type],
      shareable: event.visibility === "shareable",
      publicSafe: event.publicSafe,
    };
  });
}

function branchLabel(branchKey: string, event: JourneyEvent) {
  const [, raw = "general"] = branchKey.split(":", 2);
  if (branchKey.startsWith("career:")) return event.careerDirection || titleCase(raw);
  if (branchKey.startsWith("skill:")) return `${titleCase(raw)} evidence`;
  if (branchKey.startsWith("category:")) return titleCase(event.category || raw);
  return "Main path";
}

function buildBranches(events: readonly JourneyEvent[], pathEvents: readonly PathEvent[]) {
  const pathByJourneyId = new Map(events.map((event, index) => [event.id, pathEvents[index]]));
  const grouped = new Map<string, JourneyEvent[]>();
  for (const event of events) {
    const key = branchKeyForEvent(event);
    if (key === "main") continue;
    const current = grouped.get(key) ?? [];
    current.push(event);
    grouped.set(key, current);
  }

  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, branchEvents]): PathBranch => {
    const latest = branchEvents[branchEvents.length - 1];
    const lastClosedIndex = branchEvents.map((event) => event.type).lastIndexOf("direction_closed");
    const lastPausedIndex = branchEvents.map((event) => event.type).lastIndexOf("direction_paused");
    const lastInactiveIndex = Math.max(lastClosedIndex, lastPausedIndex);
    const rejoined = lastInactiveIndex >= 0 && branchEvents.slice(lastInactiveIndex + 1).some((event) => event.type === "goal_selected" || event.type === "goal_changed");
    const state = rejoined ? "rejoined" : latest.type === "direction_paused" ? "paused" : latest.type === "direction_closed" ? "closed" : "active";
    return {
      key,
      label: branchLabel(key, branchEvents[0]),
      eventIds: branchEvents.map((event) => pathByJourneyId.get(event.id)?.id).filter((id): id is string => Boolean(id)),
      startedAt: branchEvents[0].occurredAt,
      endedAt: state === "paused" || state === "closed" ? latest.occurredAt : undefined,
      state,
    };
  });
}

function buildOrigin(events: readonly PathEvent[]): PathEvent {
  return {
    id: stableId("path-origin", openLineModelVersion),
    kind: "origin",
    occurredAt: events[0]?.occurredAt ?? null,
    progressLevel: "exploration",
    title: "Your path began",
    narrative: events.length ? "This is the earliest activity UnlockED can verify." : "No journey activity has been recorded yet.",
    branchKey: "main",
    importance: 0,
    shareable: true,
    publicSafe: true,
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

function buildCurrentWaypoint(source: OpenLineInput["currentWaypoint"]) {
  if (!source?.id.trim() || !source.title.trim() || !source.whyItMatters.trim()) return undefined;
  return {
    id: stableId("path-waypoint", openLineModelVersion, source.type, source.id),
    title: source.title.trim(),
    whyItMatters: source.whyItMatters.trim(),
    estimatedMinutes: parseEstimatedMinutes(source.estimatedTime),
    impact: impactLevel(source.impact),
    sourceOpportunityId: source.sourceOpportunityId,
    source: source.type,
  } as const;
}

function buildHorizon(sources: OpenLineInput["horizon"]): PathPossibility[] {
  return [...(sources ?? [])]
    .filter((source) => source.id.trim() && source.title.trim() && source.rationale.trim())
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((source) => ({
      id: stableId("path-possibility", openLineModelVersion, source.id),
      title: source.title.trim(),
      rationale: source.rationale.trim(),
      branchKey: source.branchKey,
    }));
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
  const events = toPathEvents(normalization.events, input.opportunities ?? []);
  const branches = buildBranches(normalization.events, events);
  const currentWaypoint = buildCurrentWaypoint(input.currentWaypoint);
  const horizon = buildHorizon(input.horizon);
  const summary = {
    currentDirection: currentDirection(normalization.events, input),
    strongestProgressLevel: strongestLevel(events),
    meaningfulEventCount: events.filter((event) => event.progressLevel !== "exploration").length,
    validationCount: events.filter((event) => event.progressLevel === "validation").length,
  };
  const signature = stableHash({ version: openLineModelVersion, userId: input.userId, events, branches, currentWaypoint, horizon, summary });

  return {
    version: openLineModelVersion,
    signature,
    userId: input.userId,
    generatedAt: validTimestamp(input.generatedAt) ? input.generatedAt : new Date().toISOString(),
    origin: buildOrigin(events),
    events,
    branches,
    currentWaypoint,
    horizon,
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
  };
}

export function createPublicPathprint(pathprint: Pathprint): PublicPathprint {
  const sourceEvents = pathprint.events.filter((event) => event.shareable && event.publicSafe);
  const publicEvents = sourceEvents.map((event, index): PublicPathEvent => {
    const { id: _id, opportunityId: _opportunityId, organizationId: _organizationId, careerDirection: _careerDirection, ...safe } = event;
    return { ...safe, id: stableId("public-path-event", pathprint.version, index, safe) };
  });
  const eventIds = new Map(sourceEvents.map((event, index) => [event.id, publicEvents[index].id]));
  const branches = pathprint.branches.flatMap((branch) => {
    const retainedIds = branch.eventIds.map((id) => eventIds.get(id)).filter((id): id is string => Boolean(id));
    if (!retainedIds.length) return [];
    const retainedEvents = publicEvents.filter((event) => retainedIds.includes(event.id));
    const startedAt = retainedEvents[0]?.occurredAt ?? branch.startedAt;
    return [{
      id: stableId("public-path-branch", pathprint.version, retainedIds, startedAt),
      eventIds: retainedIds,
      startedAt,
      state: "active" as const,
    }];
  });
  const { id: _originId, opportunityId: _originOpportunityId, organizationId: _originOrganizationId, careerDirection: _originCareerDirection, ...originSafe } = pathprint.origin;
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
    summary,
  };
  return { ...publicData, signature: stableHash(publicData) };
}
