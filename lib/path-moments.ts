import type { Opportunity } from "@/data/opportunities";
import {
  createPathGeometry,
  stableHash,
  stableId,
  type PathEvent,
  type PathGeometry,
  type PathGeometryNode,
  type Pathprint,
} from "@/data/open-line/index";

export const pathMomentVersion = "path-moments-v1";

export const pathMomentLayouts = {
  story: { label: "Instagram Story", width: 1080, height: 1920 },
  square: { label: "Square", width: 1080, height: 1080 },
  linkedin: { label: "LinkedIn", width: 1200, height: 627 },
} as const;

export type PathMomentLayout = keyof typeof pathMomentLayouts;
export type PathMomentNameMode = "anonymous" | "first_name" | "full_name";
export type PathMomentType =
  | "first_application"
  | "first_submission"
  | "first_interview"
  | "first_acceptance"
  | "first_completed_experience"
  | "career_direction_shift"
  | "semester_recap"
  | "first_research_experience"
  | "scholarship"
  | "fellowship"
  | "leadership"
  | "portfolio_milestone";

export type PathMomentGeometry = {
  geometry: PathGeometry;
  viewport: { x: number; y: number; width: number; height: number };
  markerNodeId: string;
};

export type PathMoment = {
  id: string;
  version: typeof pathMomentVersion;
  type: PathMomentType;
  occurredAt: string;
  headline: string;
  explanation: string;
  category?: string;
  opportunity?: string;
  organization?: string;
  narrativeMomentId?: string;
  geometry: PathMomentGeometry;
  altDescription: string;
  evidence: "canonical_status" | "external_validation" | "completed_experience" | "branch_transition";
  signature: string;
};

export type PathMomentIdentity = {
  firstName: string;
  fullName: string;
  school?: string;
};

export type PathMomentCollection = {
  version: typeof pathMomentVersion;
  moments: PathMoment[];
  identity: PathMomentIdentity;
  defaultPrivacy: {
    nameMode: "anonymous";
    includeSchool: false;
    includeOrganization: false;
    includeOpportunity: false;
    includeDate: false;
  };
  diagnostics: {
    canonicalEventCount: number;
    eligibleEventCount: number;
    suppressedSavedCount: number;
    deterministicSignature: string;
  };
};

const typePriority: Record<PathMomentType, number> = {
  first_acceptance: 110,
  first_research_experience: 108,
  scholarship: 106,
  fellowship: 104,
  leadership: 102,
  first_completed_experience: 100,
  portfolio_milestone: 98,
  first_interview: 90,
  first_submission: 80,
  semester_recap: 75,
  career_direction_shift: 70,
  first_application: 60,
};

function firstPerson(value: string | undefined, fallback: string) {
  const text = value?.trim() || fallback;
  return text
    .replace(/\bYou’re\b/g, "I’m")
    .replace(/\bYou are\b/g, "I am")
    .replace(/\bYou\b/g, "I")
    .replace(/\byou\b/g, "I")
    .replace(/\bYour\b/g, "My")
    .replace(/\byour\b/g, "my");
}

function normalizedCategory(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function specializedType(event: PathEvent): PathMomentType | null {
  const category = normalizedCategory(event.category);
  if (category.includes("research") && (event.kind === "accepted" || event.kind === "completed")) return "first_research_experience";
  if (category.includes("scholarship") && (event.kind === "accepted" || event.kind === "completed")) return "scholarship";
  if (category.includes("fellowship") && (event.kind === "accepted" || event.kind === "completed")) return "fellowship";
  if (category.includes("leadership") && (event.kind === "accepted" || event.kind === "completed" || event.narrativeTemplateKey?.startsWith("event.skill."))) return "leadership";
  if ((category.includes("portfolio") || category.includes("project")) && (event.kind === "completed" || event.narrativeTemplateKey?.startsWith("event.skill."))) return "portfolio_milestone";
  return null;
}

function eventType(event: PathEvent, seenKinds: ReadonlyMap<PathEvent["kind"], number>): PathMomentType | null {
  const specialized = specializedType(event);
  if (specialized) return specialized;
  if (event.kind === "active" && (seenKinds.get("active") ?? 0) === 0) return "first_application";
  if (event.kind === "submitted" && (seenKinds.get("submitted") ?? 0) === 0) return "first_submission";
  if (event.kind === "validated" && event.narrativeTemplateKey?.startsWith("event.interview.") && (seenKinds.get("validated") ?? 0) === 0) return "first_interview";
  if (event.kind === "accepted" && (seenKinds.get("accepted") ?? 0) === 0) return "first_acceptance";
  if (event.kind === "completed" && (seenKinds.get("completed") ?? 0) === 0) return "first_completed_experience";
  if (event.kind === "chosen" && event.narrativeTemplateKey?.startsWith("event.direction.changed")) return "career_direction_shift";
  return null;
}

function cropGeometry(shareGeometry: PathGeometry, event: PathEvent): PathMomentGeometry | null {
  const node = shareGeometry.nodes.find((item) => item.eventId === event.id || item.sourceEventIds.includes(event.id));
  if (!node) return null;
  const relatedSegments = shareGeometry.segments.filter((segment) => segment.fromNodeId === node.id || segment.toNodeId === node.id);
  const width = 420;
  const height = 520;
  const viewport = {
    x: Math.max(0, Math.min(shareGeometry.width - width, node.point.x - width / 2)),
    y: Math.max(0, Math.min(Math.max(0, shareGeometry.height - height), node.point.y - height / 2)),
    width: Math.min(width, shareGeometry.width),
    height: Math.min(height, shareGeometry.height),
  };
  const geometry: PathGeometry = {
    ...shareGeometry,
    contentBounds: { ...viewport },
    nodes: [{ ...node, labelBounds: { x: node.point.x, y: node.point.y, width: 0, height: 0 } }],
    segments: relatedSegments,
    branches: [],
    intersections: [],
    validationAxes: shareGeometry.validationAxes.filter((axis) => axis.nodeId === node.id),
    currentWaypointNodeId: undefined,
    horizonNodeIds: [],
    openEndpointNodeId: node.id,
    diagnostics: {
      ...shareGeometry.diagnostics,
      inputEventCount: 1,
      renderedNodeCount: 1,
      clusteredEventCount: 0,
      visibleBranchCount: 0,
      collapsedBranchKeys: [],
      unresolvedCollisions: [],
      waypointPlaced: false,
      horizonVisibleCount: 0,
      horizonCollapsedCount: 0,
      deterministicSignature: stableHash({ version: pathMomentVersion, eventId: event.id, node, relatedSegments, viewport }),
      dimensions: { width: viewport.width, height: viewport.height },
      laneAssignments: [],
      compressedQuietEvents: [],
    },
  };
  return { geometry, viewport, markerNodeId: node.id };
}

function opportunityDetails(event: PathEvent, opportunities: ReadonlyMap<string, Opportunity>) {
  const opportunity = event.opportunityId ? opportunities.get(event.opportunityId) : undefined;
  return opportunity ? { opportunity: opportunity.title, organization: opportunity.organization } : {};
}

function evidenceFor(event: PathEvent): PathMoment["evidence"] {
  if (event.kind === "validated" || event.kind === "accepted") return "external_validation";
  if (event.kind === "completed") return "completed_experience";
  if (event.kind === "chosen") return "branch_transition";
  return "canonical_status";
}

function firstPersonHeadline(type: PathMomentType, event: PathEvent) {
  const headlines: Partial<Record<PathMomentType, string>> = {
    first_application: "I started my first application.",
    first_submission: "I submitted my first application.",
    first_interview: "I reached my first interview.",
    first_acceptance: "I received my first opportunity.",
    first_completed_experience: "I followed an opportunity through to completion.",
    first_research_experience: "I earned my first research experience.",
    scholarship: "I earned a scholarship.",
    fellowship: "I earned a fellowship.",
    leadership: "I reached a leadership milestone.",
    portfolio_milestone: "I completed a portfolio milestone.",
  };
  return headlines[type] ?? firstPerson(event.publicNarrative?.narrative ?? event.narrative, "I chose a new direction for my path.");
}

function eventMoment(type: PathMomentType, event: PathEvent & { occurredAt: string }, geometry: PathMomentGeometry, opportunities: ReadonlyMap<string, Opportunity>): PathMoment {
  const publicNarrative = event.publicNarrative;
  const headline = firstPersonHeadline(type, event);
  const explanation = firstPerson(publicNarrative?.whatChanged ?? event.whatChanged, "This moment became part of my path.");
  const details = opportunityDetails(event, opportunities);
  const raw = {
    version: pathMomentVersion as typeof pathMomentVersion,
    type,
    occurredAt: event.occurredAt,
    headline,
    explanation,
    category: event.category,
    ...details,
    narrativeMomentId: event.narrativeMomentId,
    geometry,
    evidence: evidenceFor(event),
  };
  const signature = stableHash(raw);
  return {
    id: stableId("path-moment", signature),
    ...raw,
    altDescription: `${headline} ${explanation} A single Open Line marker highlights this moment.`,
    signature,
  };
}

function semesterKey(value: string) {
  const date = new Date(value);
  const month = date.getUTCMonth();
  const term = month < 5 ? "spring" : month < 8 ? "summer" : "fall";
  return `${date.getUTCFullYear()}-${term}`;
}

function semesterRecap(events: readonly PathEvent[], shareGeometry: PathGeometry, opportunities: ReadonlyMap<string, Opportunity>): PathMoment | null {
  const eligible = events.filter((event): event is PathEvent & { occurredAt: string } => Boolean(event.occurredAt) && ["active", "submitted", "validated", "accepted", "completed"].includes(event.kind));
  const latest = eligible.at(-1);
  if (!latest?.occurredAt) return null;
  const sameSemester = eligible.filter((event) => event.occurredAt && semesterKey(event.occurredAt) === semesterKey(latest.occurredAt));
  if (sameSemester.length < 2) return null;
  const geometry = cropGeometry(shareGeometry, latest);
  if (!geometry) return null;
  const earliest = sameSemester[0];
  const headline = latest.kind === "completed" || latest.kind === "accepted"
    ? "This semester, I turned preparation into real experience."
    : latest.kind === "validated"
      ? "This semester, I moved from applying to reaching an interview."
      : "This semester, I moved from exploring to taking action.";
  const explanation = firstPerson(latest.publicNarrative?.whatChanged ?? latest.whatChanged, "Each verified step gave my path more direction.");
  const details = opportunityDetails(latest, opportunities);
  const raw = {
    version: pathMomentVersion,
    type: "semester_recap" as const,
    occurredAt: latest.occurredAt,
    headline,
    explanation,
    category: latest.category,
    ...details,
    geometry,
    evidence: "canonical_status" as const,
    sourceRange: [earliest.occurredAt, latest.occurredAt],
  };
  const signature = stableHash(raw);
  return {
    id: stableId("path-moment", signature),
    version: pathMomentVersion,
    type: raw.type,
    occurredAt: raw.occurredAt,
    headline,
    explanation,
    category: raw.category,
    ...details,
    geometry,
    evidence: raw.evidence,
    altDescription: `${headline} ${explanation} A single Open Line marker highlights the latest verified step in this semester.`,
    signature,
  };
}

export function buildPathMoments(input: {
  pathprint: Pathprint;
  opportunities: readonly Opportunity[];
  identity: PathMomentIdentity;
}): PathMomentCollection {
  const shareGeometry = createPathGeometry(input.pathprint, { mode: "share" });
  const opportunities = new Map(input.opportunities.map((opportunity) => [opportunity.id, opportunity]));
  const events = input.pathprint.events.filter((event): event is PathEvent & { occurredAt: string } => Boolean(event.occurredAt));
  const seenKinds = new Map<PathEvent["kind"], number>();
  const seenTypes = new Set<PathMomentType>();
  const moments: PathMoment[] = [];

  for (const event of events) {
    if (event.kind === "explored") continue;
    const type = eventType(event, seenKinds);
    seenKinds.set(event.kind, (seenKinds.get(event.kind) ?? 0) + 1);
    if (!type || seenTypes.has(type)) continue;
    const geometry = cropGeometry(shareGeometry, event);
    if (!geometry) continue;
    moments.push(eventMoment(type, event, geometry, opportunities));
    seenTypes.add(type);
  }

  const recap = semesterRecap(events, shareGeometry, opportunities);
  if (recap) moments.push(recap);
  moments.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || typePriority[right.type] - typePriority[left.type] || left.id.localeCompare(right.id));
  const diagnostics = {
    canonicalEventCount: events.length,
    eligibleEventCount: moments.length,
    suppressedSavedCount: input.pathprint.events.filter((event) => event.kind === "explored").length,
    deterministicSignature: stableHash(moments.map((moment) => moment.signature)),
  };
  return {
    version: pathMomentVersion,
    moments,
    identity: input.identity,
    defaultPrivacy: {
      nameMode: "anonymous",
      includeSchool: false,
      includeOrganization: false,
      includeOpportunity: false,
      includeDate: false,
    },
    diagnostics,
  };
}

export function pathMomentTitle(type: PathMomentType) {
  const labels: Record<PathMomentType, string> = {
    first_application: "First application",
    first_submission: "First submission",
    first_interview: "First interview",
    first_acceptance: "First acceptance",
    first_completed_experience: "Completed experience",
    career_direction_shift: "New direction",
    semester_recap: "Semester recap",
    first_research_experience: "Research experience",
    scholarship: "Scholarship",
    fellowship: "Fellowship",
    leadership: "Leadership",
    portfolio_milestone: "Portfolio milestone",
  };
  return labels[type];
}
