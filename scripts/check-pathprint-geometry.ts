import assert from "node:assert/strict";
import {
  PathGeometryError,
  createPathGeometry,
  createPublicPathprint,
  stableHash,
  type PathBranch,
  type PathEvent,
  type PathGeometry,
  type PathGeometryOptionsInput,
  type PathPossibility,
  type Pathprint,
} from "../data/open-line";

const baseTime = Date.parse("2026-01-01T12:00:00.000Z");

function timestamp(index: number, dayStep = 1) {
  return new Date(baseTime + index * dayStep * 86_400_000).toISOString();
}

const importanceByKind: Record<PathEvent["kind"], number> = {
  origin: 0,
  explored: 10,
  chosen: 25,
  active: 45,
  submitted: 65,
  validated: 80,
  accepted: 92,
  completed: 96,
  paused: 15,
  closed: 12,
  future: 0,
};

const progressByKind: Record<PathEvent["kind"], PathEvent["progressLevel"]> = {
  origin: "exploration",
  explored: "exploration",
  chosen: "intention",
  active: "action",
  submitted: "commitment",
  validated: "validation",
  accepted: "validation",
  completed: "validation",
  paused: "intention",
  closed: "intention",
  future: "exploration",
};

function event(id: string, index: number, kind: PathEvent["kind"], branchKey = kind === "explored" ? "main" : "category:internships", category = "Internships", dayStep = 1): PathEvent {
  return {
    id,
    kind,
    occurredAt: timestamp(index, dayStep),
    progressLevel: progressByKind[kind],
    title: `${kind} event`,
    narrative: `Recorded ${kind} activity.`,
    category,
    branchKey,
    importance: importanceByKind[kind],
    shareable: ["submitted", "validated", "accepted", "completed"].includes(kind),
    publicSafe: ["submitted", "validated", "accepted", "completed"].includes(kind),
  };
}

function branch(key: string, state: PathBranch["state"], events: readonly PathEvent[]): PathBranch {
  return {
    key,
    label: key,
    eventIds: events.map((item) => item.id),
    startedAt: events[0]?.occurredAt ?? timestamp(0),
    endedAt: state === "paused" || state === "closed" ? events.at(-1)?.occurredAt ?? timestamp(0) : undefined,
    state,
  };
}

function pathprint(input: {
  events?: PathEvent[];
  branches?: PathBranch[];
  waypoint?: Pathprint["currentWaypoint"];
  horizon?: PathPossibility[];
  userId?: string;
} = {}): Pathprint {
  const events = input.events ?? [];
  const branches = input.branches ?? [];
  const origin: PathEvent = {
    id: "path-origin-fixture",
    kind: "origin",
    occurredAt: events[0]?.occurredAt ?? null,
    progressLevel: "exploration",
    title: "Your path began",
    narrative: events.length ? "Earliest verified activity." : "No activity yet.",
    branchKey: "main",
    importance: 0,
    shareable: true,
    publicSafe: true,
  };
  const summary = {
    strongestProgressLevel: events.reduce<PathEvent["progressLevel"]>((level, item) => {
      const rank = { exploration: 0, intention: 1, action: 2, commitment: 3, validation: 4 };
      return rank[item.progressLevel] > rank[level] ? item.progressLevel : level;
    }, "exploration"),
    meaningfulEventCount: events.filter((item) => item.progressLevel !== "exploration").length,
    validationCount: events.filter((item) => item.progressLevel === "validation").length,
  };
  return {
    version: "open-line-data-v1",
    signature: stableHash({ events, branches, waypoint: input.waypoint, horizon: input.horizon ?? [] }),
    userId: input.userId ?? "geometry-test-user",
    generatedAt: "2026-07-14T12:00:00.000Z",
    origin,
    events,
    branches,
    currentWaypoint: input.waypoint,
    horizon: input.horizon ?? [],
    summary,
  };
}

function assertFiniteGeometry(geometry: PathGeometry) {
  const values = [geometry.width, geometry.height, geometry.contentBounds.x, geometry.contentBounds.y, geometry.contentBounds.width, geometry.contentBounds.height];
  for (const node of geometry.nodes) {
    values.push(node.point.x, node.point.y, node.bounds.x, node.bounds.y, node.bounds.width, node.bounds.height, node.labelBounds.x, node.labelBounds.y, node.labelBounds.width, node.labelBounds.height);
    assert.ok(node.bounds.width >= 0 && node.bounds.height >= 0 && node.labelBounds.width >= 0 && node.labelBounds.height >= 0, "Node dimensions must be non-negative.");
    assert.ok(node.bounds.x >= 0 && node.bounds.y >= 0 && node.bounds.x + node.bounds.width <= geometry.width && node.bounds.y + node.bounds.height <= geometry.height, "Node bounds must remain inside the geometry.");
  }
  for (const segment of geometry.segments) {
    for (const point of [segment.curve.start, segment.curve.control1, segment.curve.control2, segment.curve.end]) values.push(point.x, point.y);
    assert.ok(segment.curve.end.y > segment.curve.start.y, "Every segment must move forward chronologically.");
    assert.ok(segment.curve.end.y - segment.curve.start.y >= 48, "Every curve must have at least 48px of meaningful travel.");
    const angle = Math.atan2(Math.abs(segment.curve.end.x - segment.curve.start.x), segment.curve.end.y - segment.curve.start.y) * 180 / Math.PI;
    assert.ok(angle <= 42.01, `${geometry.layoutMode} segment ${segment.id} exceeded the 42 degree direction limit (${angle}) from ${JSON.stringify(segment.curve.start)} to ${JSON.stringify(segment.curve.end)}.`);
  }
  assert.equal(values.every(Number.isFinite), true, "All geometry coordinates must be finite.");
}

const empty = createPathGeometry(pathprint(), { mode: "desktop" });
assert.equal(empty.nodes.length, 2, "An empty Pathprint needs only origin and open endpoint geometry.");
assert.equal(empty.segments.length, 1);
assert.equal(empty.currentWaypointNodeId, undefined);
assert.equal(empty.horizonNodeIds.length, 0);
assert.equal(empty.diagnostics.unresolvedCollisions.length, 0);
assert.ok(empty.height < 300, "Empty geometry must not fabricate a long path.");
assertFiniteGeometry(empty);

const oneSaved = event("saved-one", 0, "explored", "main", "Research");
const oneEvent = createPathGeometry(pathprint({ events: [oneSaved] }));
assert.equal(oneEvent.nodes.filter((node) => node.eventId === oneSaved.id).length, 1);
assert.equal(oneEvent.branches.length, 0);
assertFiniteGeometry(oneEvent);

const quietEvents = Array.from({ length: 12 }, (_, index) => event(`saved-${index}`, index, "explored", "main", "Research"));
const quietGeometry = createPathGeometry(pathprint({ events: quietEvents }));
const clusters = quietGeometry.nodes.filter((node) => node.cluster);
assert.equal(clusters.length, 2, "Twelve same-category exploration events should compact into stable groups of eight and four.");
assert.equal(quietGeometry.diagnostics.clusteredEventCount, 12);
assert.deepEqual(clusters.flatMap((node) => node.sourceEventIds), quietEvents.map((item) => item.id), "Clusters must preserve every original event ID in order.");
assert.equal(quietGeometry.nodes.length, 4, "Compaction must retain origin and endpoint without rendering twelve traces independently.");
const separatedQuiet = [event("separated-one", 0, "explored", "main", "Research", 40), event("separated-two", 1, "explored", "main", "Research", 40), event("separated-three", 2, "explored", "main", "Research", 40)];
assert.equal(createPathGeometry(pathprint({ events: separatedQuiet })).nodes.some((node) => node.cluster), false, "Exploration from separate chronological periods must not be compacted together.");

const nonCompactableKinds = ["submitted", "validated", "accepted", "completed"] as const;
for (const kind of nonCompactableKinds) {
  const events = Array.from({ length: 4 }, (_, index) => event(`${kind}-${index}`, index, kind));
  const geometry = createPathGeometry(pathprint({ events, branches: [branch("category:internships", "active", events)] }));
  assert.equal(geometry.nodes.filter((node) => node.sourceEventIds.some((id) => id.startsWith(kind))).length, 4, `${kind} events must never be clustered.`);
  assert.equal(geometry.nodes.some((node) => node.cluster), false);
}

const chosenEvent = event("chosen", 0, "chosen");
const submittedEvent = event("submitted", 1, "submitted");
const interviewEvent = event("interview", 2, "validated");
const acceptedEvent = event("accepted", 3, "accepted");
const completedEvent = event("completed", 4, "completed");
const semanticEvents = [chosenEvent, submittedEvent, interviewEvent, acceptedEvent, completedEvent];
const semanticGeometry = createPathGeometry(pathprint({ events: semanticEvents, branches: [branch("category:internships", "active", semanticEvents)] }));
for (const kind of ["chosen", "submitted", "validated", "accepted", "completed"] as const) assert.ok(semanticGeometry.nodes.some((node) => node.kind === kind), `Missing ${kind} geometry.`);
assert.equal(semanticGeometry.validationAxes.length, 3, "Only interview, acceptance, and completion nodes receive validation axes.");
const submittedGap = semanticGeometry.segments.find((segment) => segment.toNodeId === semanticGeometry.nodes.find((node) => node.eventId === submittedEvent.id)?.id);
const interviewGap = semanticGeometry.segments.find((segment) => segment.toNodeId === semanticGeometry.nodes.find((node) => node.eventId === interviewEvent.id)?.id);
assert.ok((interviewGap?.curve.end.y ?? 0) - (interviewGap?.curve.start.y ?? 0) > (submittedGap?.curve.end.y ?? 0) - (submittedGap?.curve.start.y ?? 0), "Validation must receive more space than commitment.");

const fiveSavedAndInterview = [...Array.from({ length: 5 }, (_, index) => event(`five-saved-${index}`, index, "explored", "main", "Research")), event("one-interview", 6, "validated", "category:research", "Research")];
const weightedGeometry = createPathGeometry(pathprint({ events: fiveSavedAndInterview, branches: [branch("category:research", "active", [fiveSavedAndInterview.at(-1)!])] }));
assert.equal(weightedGeometry.nodes.filter((node) => node.cluster).length, 1);
assert.equal(weightedGeometry.nodes.find((node) => node.eventId === "one-interview")?.visualPriority, "validation", "One interview must remain visually stronger than five saved traces.");

const branchFixtures = [
  ["category:research", event("research-action", 0, "active", "category:research", "Research")],
  ["category:internships", event("internship-submit", 1, "submitted", "category:internships", "Internships")],
  ["category:scholarships", event("scholarship-accepted", 2, "accepted", "category:scholarships", "Scholarships")],
  ["skill:python", event("python-evidence", 3, "validated", "skill:python", "Projects")],
] as const;
const multipleBranchEvents = branchFixtures.map(([, item]) => item);
const multipleBranchPath = pathprint({ events: multipleBranchEvents, branches: branchFixtures.map(([key, item]) => branch(key, "active", [item])) });
const multipleBranchGeometry = createPathGeometry(multipleBranchPath, { mode: "desktop" });
assert.equal(multipleBranchGeometry.diagnostics.visibleBranchCount, 3);
assert.equal(multipleBranchGeometry.diagnostics.collapsedBranchKeys.length, 1);
assert.equal(new Set(multipleBranchGeometry.branches.filter((item) => item.visible).map((item) => item.lane)).size, 3, "Visible desktop branches need distinct bounded lanes.");
assert.ok(multipleBranchGeometry.branches.every((item) => [-2, -1, 0, 1, 2].includes(item.lane)));
const reorderedBranches = createPathGeometry(pathprint({ events: multipleBranchEvents, branches: [...multipleBranchPath.branches].reverse() }), { mode: "desktop" });
assert.equal(reorderedBranches.diagnostics.deterministicSignature, multipleBranchGeometry.diagnostics.deterministicSignature, "Equivalent branch order must not affect lanes or signatures.");
const unrelatedLowPriority = event("unrelated-low-priority", 4, "chosen", "career:undecided", "Exploration");
const withUnrelatedBranch = createPathGeometry(pathprint({ events: [...multipleBranchEvents, unrelatedLowPriority], branches: [...multipleBranchPath.branches, branch("career:undecided", "active", [unrelatedLowPriority])] }), { mode: "desktop" });
const visibleLanes = (geometry: PathGeometry) => Object.fromEntries(geometry.branches.filter((item) => item.visible).map((item) => [item.key, item.lane]));
assert.deepEqual(visibleLanes(withUnrelatedBranch), visibleLanes(multipleBranchGeometry), "An unrelated collapsed branch must not move existing visible lanes.");
for (const item of multipleBranchGeometry.branches.filter((candidate) => candidate.visible)) {
  assert.ok(item.originNodeId && multipleBranchGeometry.nodes.some((node) => node.id === item.originNodeId && !["waypoint", "future", "endpoint"].includes(node.kind)), "Every visible semantic branch must originate from existing history geometry.");
}

const rejoinEvents = [
  event("direction-start", 0, "chosen", "career:research", "Research"),
  event("direction-pause", 1, "paused", "career:research", "Research"),
  event("direction-return", 2, "chosen", "career:research", "Research"),
];
const rejoinGeometry = createPathGeometry(pathprint({ events: rejoinEvents, branches: [branch("career:research", "rejoined", rejoinEvents)] }));
const rejoinedBranch = rejoinGeometry.branches[0];
assert.ok(rejoinedBranch.rejoinNodeId, "Rejoined branches need a dedicated junction node.");
assert.equal(rejoinGeometry.nodes.find((node) => node.id === rejoinedBranch.rejoinNodeId)?.kind, "junction");
assert.equal(rejoinGeometry.intersections.length, 1, "Rejoins need explicit foreground/background crossing order.");
assert.notEqual(rejoinGeometry.intersections[0].foregroundSegmentId, rejoinGeometry.intersections[0].backgroundSegmentId);
const rejoinNode = rejoinGeometry.nodes.find((node) => node.id === rejoinedBranch.rejoinNodeId)!;
const rejoinPredecessor = rejoinGeometry.nodes.filter((node) => node.chronologicalIndex < rejoinNode.chronologicalIndex).at(-1)!;
assert.ok(rejoinNode.point.y - rejoinPredecessor.point.y >= 32, "Rejoin junctions need at least 32px of clear space.");

const pausedEvent = event("paused-path", 0, "paused", "career:medicine", "Medicine");
const pausedGeometry = createPathGeometry(pathprint({ events: [pausedEvent], branches: [branch("career:medicine", "paused", [pausedEvent])] }));
assert.deepEqual(pausedGeometry.nodes.find((node) => node.eventId === pausedEvent.id)?.terminal, { capAngleDegrees: 0 });
assert.equal(pausedGeometry.segments.find((segment) => segment.toNodeId === pausedGeometry.nodes.find((node) => node.eventId === pausedEvent.id)?.id)?.state, "paused");

const closedEvent = event("closed-path", 0, "closed", "career:law", "Law");
const closedGeometry = createPathGeometry(pathprint({ events: [closedEvent], branches: [branch("career:law", "closed", [closedEvent])] }));
assert.equal(closedGeometry.nodes.find((node) => node.eventId === closedEvent.id)?.terminal?.fadeLength, 48);
assert.equal(closedGeometry.segments.find((segment) => segment.state === "closed")?.terminalFadeLength, 48);

const waypoint = { id: "waypoint-one", title: "Start a verified application", whyItMatters: "It is the current highest-impact next step.", estimatedMinutes: 45, impact: "high" as const, source: "recommendation" as const };
const possibilities = Array.from({ length: 4 }, (_, index): PathPossibility => ({ id: `future-${index}`, title: `Possibility ${index}`, rationale: "A structured future possibility." }));
const waypointGeometry = createPathGeometry(pathprint({ events: [submittedEvent], branches: [branch("category:internships", "active", [submittedEvent])], waypoint, horizon: possibilities }), { mode: "desktop" });
assert.ok(waypointGeometry.currentWaypointNodeId);
assert.equal(waypointGeometry.nodes.find((node) => node.id === waypointGeometry.currentWaypointNodeId)?.kind, "waypoint");
assert.equal(waypointGeometry.segments.find((segment) => segment.toNodeId === waypointGeometry.currentWaypointNodeId)?.state, "current");
assert.equal(waypointGeometry.horizonNodeIds.length, 3);
assert.equal(waypointGeometry.diagnostics.horizonCollapsedCount, 1);
assert.ok(waypointGeometry.nodes.find((node) => node.id === waypointGeometry.currentWaypointNodeId)!.point.y <= 720, "Canonical short histories must place the waypoint in the first meaningful viewport.");
assert.ok(waypointGeometry.nodes.find((node) => node.id === waypointGeometry.openEndpointNodeId)!.point.y > Math.max(...waypointGeometry.horizonNodeIds.map((id) => waypointGeometry.nodes.find((node) => node.id === id)!.point.y)), "The primary line must remain open beyond future possibilities.");

for (const [mode, width] of [["desktop", 1200], ["tablet", 880], ["mobile", 390], ["share", 1080]] as const) {
  const geometry = createPathGeometry(multipleBranchPath, { mode, width });
  assert.equal(geometry.layoutMode, mode);
  assert.equal(geometry.width, width);
  assertFiniteGeometry(geometry);
}

const mobile = createPathGeometry(pathprint({ events: semanticEvents, branches: [branch("category:internships", "active", semanticEvents)], waypoint, horizon: possibilities }), { mode: "mobile", width: 390 });
assert.equal(mobile.diagnostics.horizonVisibleCount, 2);
assert.ok(mobile.nodes.filter((node) => node.labelBounds.width > 0).every((node) => node.labelSide === "right" && node.labelBounds.x >= 72), "Mobile labels must remain entirely to the right of the 40px rail.");
assert.ok(mobile.segments.every((segment) => [segment.curve.start, segment.curve.control1, segment.curve.control2, segment.curve.end].every((point) => point.x <= 40)), "Mobile path geometry must never run behind copy.");

const desktopAlternationEvents = [event("alternate-one", 0, "explored", "main", "Research", 40), event("alternate-two", 1, "explored", "main", "Finance", 40), event("alternate-three", 2, "explored", "main", "Software", 40)];
const desktopAlternation = createPathGeometry(pathprint({ events: desktopAlternationEvents }), { mode: "desktop" });
assert.deepEqual([...new Set(desktopAlternation.nodes.filter((node) => node.eventId).map((node) => node.labelSide))].sort(), ["left", "right"], "Desktop labels should alternate when space permits.");

const narrow = createPathGeometry(multipleBranchPath, { mode: "mobile", width: 240 });
assert.equal(narrow.width, 240);
assert.equal(narrow.diagnostics.unresolvedCollisions.length, 0, "Bounded narrow layouts must resolve collisions.");
assertFiniteGeometry(narrow);

const deterministicA = createPathGeometry(waypointGeometrySource(), { mode: "desktop", width: 1120 });
const deterministicB = createPathGeometry(waypointGeometrySource(), { mode: "desktop", width: 1120 });
assert.deepEqual(deterministicA, deterministicB, "Repeated runs must produce byte-equivalent geometry.");
assert.equal(deterministicA.diagnostics.deterministicSignature, deterministicB.diagnostics.deterministicSignature);

function waypointGeometrySource() {
  return pathprint({ events: semanticEvents, branches: [branch("category:internships", "active", semanticEvents)], waypoint, horizon: possibilities });
}

assert.throws(() => createPathGeometry(pathprint(), { mode: "desktop", width: Number.NaN }), PathGeometryError);
assert.throws(() => createPathGeometry(pathprint(), { mode: "desktop", width: -1 }), PathGeometryError);
assert.throws(() => createPathGeometry(pathprint(), { mode: "desktop", minimumNodeSpacing: 32 }), PathGeometryError);

const publicAccepted = event("public-accepted", 1, "accepted", "category:internships", "Internships");
const privateClosed = { ...event("private-closed", 2, "closed", "career:private-direction", "Private Direction"), title: "Private direction title", narrative: "Private direction narrative.", shareable: false, publicSafe: false };
const privateSourceA = pathprint({ events: [publicAccepted, privateClosed], branches: [branch("category:internships", "active", [publicAccepted]), branch("career:private-direction", "closed", [privateClosed])], userId: "private-user-a" });
const publicProjectionA = createPublicPathprint(privateSourceA);
const unrelatedPrivate = { ...event("another-private", 3, "chosen", "career:another-private", "Secret Career"), title: "Secret Career", narrative: "Secret private history.", shareable: false, publicSafe: false };
const privateSourceB = pathprint({ events: [publicAccepted, unrelatedPrivate], branches: [branch("category:internships", "active", [publicAccepted]), branch("career:another-private", "active", [unrelatedPrivate])], userId: "private-user-b" });
const publicProjectionB = createPublicPathprint(privateSourceB);
const publicGeometryA = createPathGeometry(publicProjectionA, { mode: "share" });
const publicGeometryB = createPathGeometry(publicProjectionB, { mode: "share" });
assert.equal(publicGeometryA.diagnostics.deterministicSignature, publicGeometryB.diagnostics.deterministicSignature, "Private-only history must not alter public geometry.");
assert.deepEqual(publicGeometryA, publicGeometryB);
const publicJson = JSON.stringify(publicGeometryA);
for (const privateValue of ["private-user", "private-direction", "Secret Career", "Private direction", "private-closed", "another-private"]) assert.equal(publicJson.includes(privateValue), false, `Public geometry leaked ${privateValue}.`);
assert.equal(publicGeometryA.diagnostics.inputEventCount, 1, "Public diagnostics must count only projected public events.");
assert.equal(JSON.stringify(multipleBranchGeometry.diagnostics).includes("category:scholarships"), false, "Geometry diagnostics must use opaque branch identifiers rather than semantic user content.");

function percentile(values: readonly number[], percentileValue: number) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * percentileValue) - 1)] ?? 0;
}

function benchmark(source: Pathprint, options: PathGeometryOptionsInput, runs: number) {
  createPathGeometry(source, options);
  const durations: number[] = [];
  for (let index = 0; index < runs; index += 1) {
    const started = performance.now();
    createPathGeometry(source, options);
    durations.push(performance.now() - started);
  }
  return { p50: percentile(durations, 0.5), p95: percentile(durations, 0.95), maximum: Math.max(...durations) };
}

const typicalEvents = Array.from({ length: 36 }, (_, index) => index % 9 === 8 ? event(`typical-submit-${index}`, index, "submitted", "category:research", "Research") : event(`typical-save-${index}`, index, "explored", "main", "Research"));
const typicalSource = pathprint({ events: typicalEvents, branches: [branch("category:research", "active", typicalEvents.filter((item) => item.kind === "submitted"))] });
const largeEvents = Array.from({ length: 1000 }, (_, index) => index % 20 === 19 ? event(`large-submit-${index}`, index, "submitted", "category:research", "Research") : event(`large-save-${index}`, index, "explored", "main", "Research"));
const largeSource = pathprint({ events: largeEvents, branches: [branch("category:research", "active", largeEvents.filter((item) => item.kind === "submitted"))] });
const typicalBenchmark = benchmark(typicalSource, { mode: "desktop" }, 40);
const largeBenchmark = benchmark(largeSource, { mode: "desktop" }, 25);
const largeGeometry = createPathGeometry(largeSource);
assert.equal(largeGeometry.diagnostics.unresolvedCollisions.length, 0, "Large compacted histories must resolve geometry collisions within bounded passes.");
assert.ok(typicalBenchmark.p95 < 10, `Typical geometry p95 exceeded 10ms (${typicalBenchmark.p95.toFixed(2)}ms).`);
assert.ok(largeBenchmark.p95 < 50, `Large geometry p95 exceeded 50ms (${largeBenchmark.p95.toFixed(2)}ms).`);

console.log(JSON.stringify({
  message: "Pathprint geometry checks passed.",
  typicalBenchmarkMs: Object.fromEntries(Object.entries(typicalBenchmark).map(([key, value]) => [key, Number(value.toFixed(3))])),
  largeBenchmarkMs: Object.fromEntries(Object.entries(largeBenchmark).map(([key, value]) => [key, Number(value.toFixed(3))])),
  largeInputEvents: largeEvents.length,
  largeRenderedNodes: largeGeometry.nodes.length,
}, null, 2));
