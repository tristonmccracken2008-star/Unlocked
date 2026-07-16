import type { Opportunity } from "@/data/opportunities";
import {
  createPathGeometry,
  stableHash,
  stableId,
  type PathBranch,
  type PathEvent,
  type PathGeometry,
  type Pathprint,
  type ProgressLevel,
} from "@/data/open-line/index";
import type { PathMomentIdentity } from "@/lib/path-moments";

export const semesterStoryVersion = "semester-story-v1";

export const semesterStoryLayouts = {
  story: { label: "Instagram Story", width: 1080, height: 1920 },
  square: { label: "Square", width: 1080, height: 1080 },
  linkedin: { label: "LinkedIn", width: 1200, height: 627 },
} as const;

export type SemesterStoryLayout = keyof typeof semesterStoryLayouts;
export type AcademicTermSeason = "fall" | "winter" | "spring" | "summer";

export type AcademicTerm = {
  id: string;
  label: string;
  season: AcademicTermSeason;
  startDate: string;
  endDate: string;
  academicYear: string;
  source: "school_calendar" | "profile" | "default_calendar";
};

export type SemesterStoryPrivacy = {
  nameMode: "anonymous" | "first_name" | "full_name";
  includeSchool: boolean;
  includeMajor: boolean;
  includeTerm: boolean;
  includeOpportunity: boolean;
  includeOrganization: boolean;
  includeDate: boolean;
  includeCounts: boolean;
  includeProfileLink: boolean;
};

export type SemesterStoryMoment = {
  id: string;
  occurredAt: string;
  kind: PathEvent["kind"];
  headline: string;
  explanation: string;
  whatChanged: string;
  category?: string;
  opportunity?: string;
  organization?: string;
  evidence: "direction" | "application" | "validation" | "experience";
  weight: number;
};

export type SemesterStory = {
  id: string;
  version: typeof semesterStoryVersion;
  term: AcademicTerm;
  state: "active" | "completed";
  heading: string;
  opening: string;
  openingSource: "direction" | "action" | "commitment" | "validation" | "experience" | "sparse";
  moments: SemesterStoryMoment[];
  whatChanged: string[];
  counts: Array<{ id: "submitted" | "validated" | "completed"; label: string; value: number }>;
  comparison?: string;
  geometry: {
    geometry: PathGeometry;
    viewport: { x: number; y: number; width: number; height: number };
  };
  altDescription: string;
  signature: string;
};

export type SemesterStoryCollection = {
  version: typeof semesterStoryVersion;
  stories: SemesterStory[];
  selectedTermId?: string;
  identity: PathMomentIdentity & { major?: string; profileHref?: string };
  defaultPrivacy: SemesterStoryPrivacy;
  diagnostics: {
    calendarSource: AcademicTerm["source"];
    canonicalEventCount: number;
    includedEventCount: number;
    suppressedEvents: Record<string, number>;
    selectedTermId?: string;
    openingSources: string[];
    comparisonEligibleTermIds: string[];
    privacyProjection: string;
    deterministicSignature: string;
  };
};

type TermOverride = Omit<AcademicTerm, "id"> & { id?: string };

const eligibleKinds = new Set<PathEvent["kind"]>(["chosen", "active", "submitted", "validated", "accepted", "completed"]);
const momentPriority: Record<PathEvent["kind"], number> = {
  origin: 0,
  explored: 0,
  future: 0,
  paused: 10,
  closed: 10,
  chosen: 40,
  active: 55,
  submitted: 75,
  validated: 90,
  accepted: 105,
  completed: 100,
};
const progressRank: Record<ProgressLevel, number> = { exploration: 0, intention: 1, action: 2, commitment: 3, validation: 4 };

function isoDate(year: number, month: number, day: number, end = false) {
  return new Date(Date.UTC(year, month, day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0)).toISOString();
}

function academicYear(startYear: number) {
  return `${startYear}\u2013${String(startYear + 1).slice(-2)}`;
}

/** General fallback only. Schools can provide term overrides without changing the story engine. */
export function defaultAcademicTerm(value: string | Date): AcademicTerm {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Academic terms require a valid timestamp.");
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  let season: AcademicTermSeason;
  let startDate: string;
  let endDate: string;
  if (month === 0) {
    season = "winter";
    startDate = isoDate(year, 0, 1);
    endDate = isoDate(year, 0, 31, true);
  } else if (month <= 4) {
    season = "spring";
    startDate = isoDate(year, 1, 1);
    endDate = isoDate(year, 4, 31, true);
  } else if (month <= 7) {
    season = "summer";
    startDate = isoDate(year, 5, 1);
    endDate = isoDate(year, 7, 31, true);
  } else {
    season = "fall";
    startDate = isoDate(year, 8, 1);
    endDate = isoDate(year, 11, 31, true);
  }
  const startYear = season === "fall" ? year : year - 1;
  const label = `${season[0].toUpperCase()}${season.slice(1)} ${year}`;
  return {
    id: `${season}-${year}`,
    label,
    season,
    startDate,
    endDate,
    academicYear: academicYear(startYear),
    source: "default_calendar",
  };
}

function normalizeTerm(override: TermOverride): AcademicTerm {
  const start = new Date(override.startDate);
  const end = new Date(override.endDate);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) throw new Error("Academic term overrides require a valid date range.");
  return { ...override, id: override.id ?? stableId("academic-term", override.label, override.startDate, override.endDate) };
}

function termFor(value: string, overrides: readonly AcademicTerm[]) {
  const time = new Date(value).getTime();
  return overrides.find((term) => time >= new Date(term.startDate).getTime() && time <= new Date(term.endDate).getTime()) ?? defaultAcademicTerm(value);
}

function eventCopy(event: PathEvent): Omit<SemesterStoryMoment, "id" | "occurredAt" | "kind" | "category" | "opportunity" | "organization"> {
  switch (event.kind) {
    case "chosen": return { headline: "You chose a direction.", explanation: "You identified a path worth exploring more deliberately.", whatChanged: "Your exploration gained a clearer focus.", evidence: "direction", weight: momentPriority.chosen };
    case "active": return { headline: "You began turning direction into work.", explanation: "You moved beyond considering an opportunity and started preparing for it.", whatChanged: "A possibility became active work.", evidence: "application", weight: momentPriority.active };
    case "submitted": return { headline: "You submitted an application.", explanation: "You put your preparation into practice through a real application.", whatChanged: "You gained application experience you can build on.", evidence: "application", weight: momentPriority.submitted };
    case "validated": return { headline: "You reached an interview.", explanation: "Someone outside UnlockED responded to the work you put forward.", whatChanged: "Your work received external validation.", evidence: "validation", weight: momentPriority.validated };
    case "accepted": return { headline: "You received an opportunity.", explanation: "A direction you pursued became a concrete opportunity.", whatChanged: "Your preparation opened a path to real experience.", evidence: "validation", weight: momentPriority.accepted };
    case "completed": return { headline: "You completed an experience.", explanation: "You carried an opportunity through and created evidence for future applications and interviews.", whatChanged: "Your work became experience you can point to.", evidence: "experience", weight: momentPriority.completed };
    default: return { headline: "Your direction changed.", explanation: "Your path became clearer through a meaningful choice.", whatChanged: "You gained a clearer starting point.", evidence: "direction", weight: 20 };
  }
}

function termProjection(pathprint: Pathprint, term: AcademicTerm, events: readonly PathEvent[]) {
  const eventIds = new Set(events.map((event) => event.id));
  const idMap = new Map(events.map((event, index) => [event.id, stableId("semester-path-event", semesterStoryVersion, term.id, index, event.kind, event.occurredAt)]));
  const projectedEvents = events.map((event) => {
    const copy = eventCopy(event);
    return {
      id: idMap.get(event.id)!,
      kind: event.kind,
      occurredAt: event.occurredAt,
      progressLevel: event.progressLevel,
      title: copy.headline,
      narrative: copy.explanation,
      whatChanged: copy.whatChanged,
      category: event.category,
      branchKey: event.branchKey === "main" ? "main" : stableId("semester-branch", term.id, event.branchKey),
      importance: event.importance,
      shareable: true,
      publicSafe: true,
    } satisfies PathEvent;
  });
  const projectedBranches: PathBranch[] = pathprint.branches.flatMap((branch) => {
    const branchEventIds = branch.eventIds.filter((id) => eventIds.has(id)).map((id) => idMap.get(id)!);
    if (!branchEventIds.length) return [];
    return [{
      key: stableId("semester-branch", term.id, branch.key),
      label: "Related direction",
      eventIds: branchEventIds,
      startedAt: events.find((event) => event.id === branch.eventIds.find((id) => eventIds.has(id)))?.occurredAt ?? term.startDate,
      state: "active",
    }];
  });
  const prior = [...pathprint.events]
    .filter((event) => event.occurredAt && event.occurredAt < term.startDate && eligibleKinds.has(event.kind))
    .sort((left, right) => (right.occurredAt ?? "").localeCompare(left.occurredAt ?? ""))[0];
  const origin: PathEvent = {
    id: stableId("semester-origin", semesterStoryVersion, term.id, prior?.kind ?? "beginning"),
    kind: "origin",
    occurredAt: term.startDate,
    progressLevel: prior?.progressLevel ?? "exploration",
    title: prior ? "Where the term began" : "A new chapter began",
    narrative: prior ? "This was the state of your path at the start of the term." : "This term began with an open path.",
    branchKey: "main",
    importance: 0,
    shareable: true,
    publicSafe: true,
  };
  const strongest = projectedEvents.reduce<ProgressLevel>((level, event) => progressRank[event.progressLevel] > progressRank[level] ? event.progressLevel : level, "exploration");
  const projection: Pathprint = {
    version: semesterStoryVersion,
    signature: stableHash([semesterStoryVersion, term.id, origin, projectedEvents, projectedBranches]),
    userId: stableId("semester-viewer", term.id),
    generatedAt: term.endDate,
    origin,
    events: projectedEvents,
    branches: projectedBranches,
    horizon: [],
    summary: {
      strongestProgressLevel: strongest,
      meaningfulEventCount: projectedEvents.length,
      validationCount: projectedEvents.filter((event) => event.progressLevel === "validation").length,
    },
  };
  const geometry = createPathGeometry(projection, { mode: "share", width: 900, maximumVisiblePossibilities: 1 });
  const relevantNodes = geometry.nodes.filter((node) => node.kind !== "future");
  const minimumX = Math.min(...relevantNodes.map((node) => node.bounds.x));
  const maximumX = Math.max(...relevantNodes.map((node) => node.bounds.x + node.bounds.width));
  const minimumY = Math.min(...relevantNodes.map((node) => node.bounds.y));
  const maximumY = Math.max(...relevantNodes.map((node) => node.bounds.y + node.bounds.height));
  const x = Math.max(0, minimumX - 96);
  const y = Math.max(0, minimumY - 56);
  return {
    geometry,
    viewport: {
      x,
      y,
      width: Math.min(geometry.width - x, maximumX - minimumX + 192),
      height: Math.min(geometry.height - y, maximumY - minimumY + 112),
    },
  };
}

function openingFor(events: readonly PathEvent[]) {
  const kinds = new Set(events.map((event) => event.kind));
  if (kinds.has("completed")) return { text: "This semester, you turned a direction into experience you can carry forward.", source: "experience" as const };
  if (kinds.has("accepted")) return { text: "This semester, a direction you pursued became a real opportunity.", source: "validation" as const };
  if (kinds.has("validated")) return { text: "This semester, your work moved from action to external validation.", source: "validation" as const };
  if (kinds.has("submitted")) return { text: "This semester, you moved from considering opportunities to taking concrete action.", source: "commitment" as const };
  if (kinds.has("active")) return { text: "This semester, you began turning a direction into active work.", source: "action" as const };
  if (kinds.has("chosen")) return { text: "This semester gave you a clearer direction to pursue.", source: "direction" as const };
  return { text: "This semester gave you a clearer starting point.", source: "sparse" as const };
}

function phaseLabel(events: readonly PathEvent[]) {
  const kinds = new Set(events.map((event) => event.kind));
  if (kinds.has("completed") || kinds.has("accepted")) return "turning effort into experience";
  if (kinds.has("validated")) return "receiving external validation";
  if (kinds.has("submitted")) return "submitting real applications";
  if (kinds.has("active")) return "preparing opportunities";
  return "choosing a direction";
}

function termStory(input: {
  term: AcademicTerm;
  events: readonly PathEvent[];
  pathprint: Pathprint;
  opportunities: ReadonlyMap<string, Opportunity>;
  now: string;
}): SemesterStory {
  const { term, events, pathprint, opportunities, now } = input;
  const state = new Date(now).getTime() <= new Date(term.endDate).getTime() && new Date(now).getTime() >= new Date(term.startDate).getTime() ? "active" as const : "completed" as const;
  const opening = openingFor(events);
  const moments = [...events]
    .sort((left, right) => momentPriority[right.kind] - momentPriority[left.kind] || (right.occurredAt ?? "").localeCompare(left.occurredAt ?? ""))
    .slice(0, 4)
    .sort((left, right) => (left.occurredAt ?? "").localeCompare(right.occurredAt ?? ""))
    .map((event, index): SemesterStoryMoment => {
      const copy = eventCopy(event);
      const opportunity = event.opportunityId ? opportunities.get(event.opportunityId) : undefined;
      return {
        id: stableId("semester-moment", semesterStoryVersion, term.id, index, event.kind, event.occurredAt),
        occurredAt: event.occurredAt!,
        kind: event.kind,
        ...copy,
        category: event.category,
        opportunity: opportunity?.title,
        organization: opportunity?.organization,
      };
    });
  const whatChanged = [...new Set(moments.map((moment) => moment.whatChanged))].slice(0, 3);
  const counts = [
    { id: "submitted" as const, label: "Applications submitted", value: events.filter((event) => event.kind === "submitted").length },
    { id: "validated" as const, label: "Validated milestones", value: events.filter((event) => event.kind === "validated" || event.kind === "accepted").length },
    { id: "completed" as const, label: "Experiences completed", value: events.filter((event) => event.kind === "completed").length },
  ].filter((count) => count.value > 0).slice(0, 3);
  const geometry = termProjection(pathprint, term, events);
  const heading = state === "active" ? `${term.label} so far` : term.label;
  const signature = stableHash({ version: semesterStoryVersion, term, state, opening, moments, whatChanged, counts, geometry: geometry.geometry.diagnostics.deterministicSignature });
  return {
    id: stableId("semester-story", semesterStoryVersion, term.id),
    version: semesterStoryVersion,
    term,
    state,
    heading,
    opening: opening.text,
    openingSource: opening.source,
    moments,
    whatChanged,
    counts,
    geometry,
    altDescription: `${heading}. ${opening.text} ${moments.map((moment) => moment.headline).join(" ")} ${whatChanged.join(" ")}`.trim(),
    signature,
  };
}

export function buildSemesterStories(input: {
  pathprint: Pathprint;
  opportunities: readonly Opportunity[];
  identity: SemesterStoryCollection["identity"];
  generatedAt?: string;
  termOverrides?: readonly TermOverride[];
}): SemesterStoryCollection {
  const now = input.generatedAt ?? input.pathprint.generatedAt;
  const overrides = (input.termOverrides ?? []).map(normalizeTerm);
  const suppressedEvents: Record<string, number> = {};
  const eligible = input.pathprint.events.filter((event) => {
    if (!event.occurredAt) { suppressedEvents.missing_timestamp = (suppressedEvents.missing_timestamp ?? 0) + 1; return false; }
    if (!eligibleKinds.has(event.kind)) { suppressedEvents[`kind:${event.kind}`] = (suppressedEvents[`kind:${event.kind}`] ?? 0) + 1; return false; }
    return true;
  });
  const groups = new Map<string, { term: AcademicTerm; events: PathEvent[] }>();
  for (const event of eligible) {
    const term = termFor(event.occurredAt!, overrides);
    const group = groups.get(term.id) ?? { term, events: [] };
    group.events.push(event);
    groups.set(term.id, group);
  }
  const opportunityMap = new Map(input.opportunities.map((opportunity) => [opportunity.id, opportunity]));
  const stories = [...groups.values()]
    .map(({ term, events }) => termStory({ term, events, pathprint: input.pathprint, opportunities: opportunityMap, now }))
    .sort((left, right) => right.term.startDate.localeCompare(left.term.startDate));

  for (let index = 0; index < stories.length - 1; index += 1) {
    const current = stories[index];
    const previous = stories[index + 1];
    if (current.moments.length < 2 || previous.moments.length < 2) continue;
    const currentEvents = groups.get(current.term.id)!.events;
    const previousEvents = groups.get(previous.term.id)!.events;
    const currentPhase = Math.max(...currentEvents.map((event) => momentPriority[event.kind]));
    const previousPhase = Math.max(...previousEvents.map((event) => momentPriority[event.kind]));
    if (currentPhase <= previousPhase) continue;
    current.comparison = `Last term centered on ${phaseLabel(previousEvents)}. This term, you moved toward ${phaseLabel(currentEvents)}.`;
    current.signature = stableHash({ signature: current.signature, comparison: current.comparison });
  }

  const selectedTermId = stories.find((story) => story.state === "active")?.term.id ?? stories[0]?.term.id;
  const defaultPrivacy: SemesterStoryPrivacy = {
    nameMode: "anonymous",
    includeSchool: false,
    includeMajor: false,
    includeTerm: true,
    includeOpportunity: false,
    includeOrganization: false,
    includeDate: false,
    includeCounts: false,
    includeProfileLink: false,
  };
  const deterministicSignature = stableHash({ version: semesterStoryVersion, stories: stories.map((story) => story.signature), defaultPrivacy });
  return {
    version: semesterStoryVersion,
    stories,
    selectedTermId,
    identity: input.identity,
    defaultPrivacy,
    diagnostics: {
      calendarSource: overrides.length ? overrides[0].source : "default_calendar",
      canonicalEventCount: input.pathprint.events.length,
      includedEventCount: eligible.length,
      suppressedEvents,
      selectedTermId,
      openingSources: stories.map((story) => story.openingSource),
      comparisonEligibleTermIds: stories.filter((story) => Boolean(story.comparison)).map((story) => story.term.id),
      privacyProjection: "anonymous;term;general_narrative;pathprint",
      deterministicSignature,
    },
  };
}
