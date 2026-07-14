import { compactPathEvents, type PathGeometryEventUnit } from "./geometry-compaction";
import { resolveNodeCollisions } from "./geometry-collisions";
import { createPathCurve, minimumVerticalTravel, segmentLabelCollisionIds } from "./geometry-curves";
import { resolvePathGeometryOptions } from "./geometry-options";
import { stableHash, stableId } from "./stable";
import type { PathBranch, PathEvent, PathPossibility, PathWaypoint } from "./types";
import {
  PathGeometryError,
  pathGeometryVersion,
  type PathBounds,
  type PathGeometry,
  type PathGeometryBranch,
  type PathGeometryDiagnostics,
  type PathGeometryNode,
  type PathGeometryNodeKind,
  type PathGeometryOptions,
  type PathGeometryOptionsInput,
  type PathGeometrySegment,
  type PathGeometrySegmentState,
  type PathIntersectionOrder,
  type PathPoint,
  type PathprintProjection,
  type PathValidationAxis,
  type PathVisualPriority,
} from "./geometry-types";

type ProjectionBranch = Pick<PathBranch, "state" | "eventIds" | "startedAt" | "endedAt"> & { key: string };

const stateRank: Record<PathBranch["state"], number> = { rejoined: 4, active: 3, paused: 2, closed: 1 };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function hashNumber(value: unknown) {
  return Number.parseInt(stableHash(value).slice(0, 8), 16);
}

function projectionBranches(pathprint: PathprintProjection): ProjectionBranch[] {
  return pathprint.branches.map((branch) => ({
    key: "key" in branch ? branch.key : `public:${branch.id}`,
    state: branch.state,
    eventIds: [...branch.eventIds],
    startedAt: branch.startedAt,
    endedAt: branch.endedAt,
  })).sort((left, right) => left.key.localeCompare(right.key));
}

function projectionEvents(pathprint: PathprintProjection, branches: readonly ProjectionBranch[]): PathEvent[] {
  const publicBranchByEvent = new Map(branches.flatMap((branch) => branch.eventIds.map((eventId) => [eventId, branch.key] as const)));
  const isPublic = !("userId" in pathprint);
  return pathprint.events.map((event) => ({
    ...event,
    branchKey: isPublic ? publicBranchByEvent.get(event.id) ?? "main" : event.branchKey,
  }));
}

function currentWaypoint(pathprint: PathprintProjection): PathWaypoint | undefined {
  return "currentWaypoint" in pathprint ? pathprint.currentWaypoint : undefined;
}

function horizon(pathprint: PathprintProjection): PathPossibility[] {
  return "horizon" in pathprint ? [...pathprint.horizon] : [];
}

function availableLanes(options: PathGeometryOptions) {
  return options.mode === "mobile" ? [-1, -2] : [-1, 1, -2, 2];
}

function selectVisibleBranches(branches: readonly ProjectionBranch[], events: readonly PathEvent[], options: PathGeometryOptions) {
  const eventMap = new Map(events.map((event) => [event.id, event]));
  const maximum = Math.min(options.maximumVisibleBranches, availableLanes(options).length);
  const ranked = [...branches].sort((left, right) => {
    const leftImportance = Math.max(0, ...left.eventIds.map((id) => eventMap.get(id)?.importance ?? 0));
    const rightImportance = Math.max(0, ...right.eventIds.map((id) => eventMap.get(id)?.importance ?? 0));
    return rightImportance - leftImportance || stateRank[right.state] - stateRank[left.state] || left.startedAt.localeCompare(right.startedAt) || left.key.localeCompare(right.key);
  });
  return new Set(ranked.slice(0, maximum).map((branch) => branch.key));
}

function assignBranchLanes(branches: readonly ProjectionBranch[], visible: ReadonlySet<string>, options: PathGeometryOptions) {
  const choices = availableLanes(options);
  const used = new Set<number>();
  const lanes = new Map<string, number>();
  const visibleBranches = branches.filter((branch) => visible.has(branch.key)).sort((left, right) => left.key.localeCompare(right.key));
  for (const branch of visibleBranches) {
    const preferred = hashNumber([pathGeometryVersion, branch.key]) % choices.length;
    let selected = choices[preferred];
    for (let offset = 0; offset < choices.length; offset += 1) {
      const candidate = choices[(preferred + offset) % choices.length];
      if (!used.has(candidate)) { selected = candidate; break; }
    }
    lanes.set(branch.key, selected);
    used.add(selected);
  }
  for (const branch of branches) if (!lanes.has(branch.key)) lanes.set(branch.key, 0);
  return lanes;
}

function priorityFor(progressLevel: PathEvent["progressLevel"], kind: PathGeometryNodeKind): PathVisualPriority {
  if (kind === "waypoint") return "meaningful";
  if (progressLevel === "validation") return "validation";
  if (progressLevel === "commitment" || progressLevel === "action") return "meaningful";
  if (progressLevel === "exploration") return "quiet";
  return "normal";
}

function interactionSize(priority: PathVisualPriority, kind: PathGeometryNodeKind) {
  if (kind === "waypoint") return 64;
  if (priority === "validation") return 56;
  return 44;
}

function labelHeight(priority: PathVisualPriority, kind: PathGeometryNodeKind) {
  if (kind === "endpoint" || kind === "junction") return 0;
  if (kind === "waypoint") return 96;
  if (priority === "validation") return 92;
  if (priority === "meaningful") return 76;
  if (priority === "normal") return 64;
  return 52;
}

function centeredBounds(point: PathPoint, size: number): PathBounds {
  return { x: point.x - size / 2, y: point.y - size / 2, width: size, height: size };
}

function labelSide(pointX: number, lane: number, chronologicalIndex: number, contentBounds: PathBounds, options: PathGeometryOptions) {
  if (options.mode === "mobile") return "right" as const;
  let preferred: "left" | "right" = lane < 0 ? "left" : lane > 0 ? "right" : chronologicalIndex % 2 ? "left" : "right";
  const leftSpace = pointX - 32 - contentBounds.x;
  const rightSpace = contentBounds.x + contentBounds.width - pointX - 32;
  const minimumUsefulWidth = Math.min(120, options.labelWidth);
  if (preferred === "left" && leftSpace < minimumUsefulWidth && rightSpace > leftSpace) preferred = "right";
  if (preferred === "right" && rightSpace < minimumUsefulWidth && leftSpace > rightSpace) preferred = "left";
  return preferred;
}

function expectedLabelBounds(point: PathPoint, side: "left" | "right", priority: PathVisualPriority, kind: PathGeometryNodeKind, contentBounds: PathBounds, options: PathGeometryOptions): PathBounds {
  const height = labelHeight(priority, kind);
  if (!height) return { x: point.x, y: point.y, width: 0, height: 0 };
  const mobileStart = options.primaryLaneX + 32;
  const desiredX = options.mode === "mobile" ? mobileStart : side === "right" ? point.x + 32 : point.x - 32 - options.labelWidth;
  const availableWidth = contentBounds.x + contentBounds.width - Math.max(contentBounds.x, desiredX);
  const width = Math.max(0, Math.min(options.labelWidth, availableWidth));
  const x = clamp(desiredX, contentBounds.x, contentBounds.x + contentBounds.width - width);
  return { x, y: point.y - height / 2, width, height };
}

function spacingForUnit(unit: PathGeometryEventUnit, options: PathGeometryOptions) {
  let base = options.routineSpacing;
  if (unit.clustered) base = Math.max(options.minimumNodeSpacing, Math.round(options.routineSpacing * 0.78));
  else if (unit.progressLevel === "intention") base = Math.round((options.routineSpacing + options.meaningfulSpacing) / 2);
  else if (unit.progressLevel === "action") base = options.meaningfulSpacing;
  else if (unit.progressLevel === "commitment") base = Math.round((options.meaningfulSpacing + options.validationSpacing) / 2);
  else if (unit.progressLevel === "validation") base = options.validationSpacing;
  const importanceBonus = Math.min(12, Math.floor(Math.max(0, unit.importance) / 25) * 4);
  return Math.max(options.minimumNodeSpacing, base + importanceBonus);
}

function pointXForLane(lane: number, size: number, contentBounds: PathBounds, options: PathGeometryOptions) {
  const desired = options.primaryLaneX + lane * options.laneSpacing;
  return clamp(desired, contentBounds.x + size / 2, contentBounds.x + contentBounds.width - size / 2);
}

function createNode(input: {
  id: string;
  eventId?: string;
  sourceEventIds?: string[];
  branchKey: string;
  kind: PathGeometryNodeKind;
  point: PathPoint;
  chronologicalIndex: number;
  importance: number;
  progressLevel: PathEvent["progressLevel"];
  lane: number;
  contentBounds: PathBounds;
  options: PathGeometryOptions;
  cluster?: PathGeometryNode["cluster"];
  terminal?: PathGeometryNode["terminal"];
}): PathGeometryNode {
  const visualPriority = priorityFor(input.progressLevel, input.kind);
  const size = interactionSize(visualPriority, input.kind);
  const side = labelSide(input.point.x, input.lane, input.chronologicalIndex, input.contentBounds, input.options);
  return {
    id: input.id,
    eventId: input.eventId,
    sourceEventIds: input.sourceEventIds ?? [],
    branchKey: input.branchKey,
    kind: input.kind,
    point: input.point,
    bounds: centeredBounds(input.point, size),
    labelBounds: expectedLabelBounds(input.point, side, visualPriority, input.kind, input.contentBounds, input.options),
    chronologicalIndex: input.chronologicalIndex,
    importance: input.importance,
    labelSide: side,
    visualPriority,
    cluster: input.cluster,
    terminal: input.terminal,
  };
}

function segmentState(from: PathGeometryNode, to: PathGeometryNode, branchKey: string): PathGeometrySegmentState {
  if (to.kind === "waypoint") return "current";
  if (to.kind === "future" || to.kind === "endpoint") return "future";
  if (to.kind === "paused") return "paused";
  if (to.kind === "closed") return "closed";
  if (to.visualPriority === "validation") return "validated";
  if (branchKey !== "main") return "alternate";
  return "completed";
}

function createSegment(from: PathGeometryNode, to: PathGeometryNode, branchKey: string, contentBounds: PathBounds, options: PathGeometryOptions): PathGeometrySegment {
  const id = stableId("geometry-segment", pathGeometryVersion, from.id, to.id, branchKey);
  const state = segmentState(from, to, branchKey);
  return {
    id,
    branchKey,
    fromNodeId: from.id,
    toNodeId: to.id,
    state,
    curve: createPathCurve(from.point, to.point, contentBounds, id, options.mode === "mobile" ? options.primaryLaneX : undefined),
    chronologicalStart: from.chronologicalIndex,
    chronologicalEnd: to.chronologicalIndex,
    terminalFadeLength: state === "closed" ? 48 : undefined,
  };
}

function safeDiagnosticBranchId(sourceSignature: string, branchKey: string) {
  return stableId("geometry-diagnostic-branch", sourceSignature, branchKey);
}

function coordinateValues(geometry: Omit<PathGeometry, "diagnostics">) {
  const values: number[] = [geometry.width, geometry.height, geometry.contentBounds.x, geometry.contentBounds.y, geometry.contentBounds.width, geometry.contentBounds.height];
  for (const node of geometry.nodes) values.push(node.point.x, node.point.y, node.bounds.x, node.bounds.y, node.bounds.width, node.bounds.height, node.labelBounds.x, node.labelBounds.y, node.labelBounds.width, node.labelBounds.height);
  for (const segment of geometry.segments) for (const point of [segment.curve.start, segment.curve.control1, segment.curve.control2, segment.curve.end]) values.push(point.x, point.y);
  for (const axis of geometry.validationAxes) values.push(axis.start.x, axis.start.y, axis.end.x, axis.end.y);
  return values;
}

function assertValidGeometry(geometry: Omit<PathGeometry, "diagnostics">) {
  if (coordinateValues(geometry).some((value) => !Number.isFinite(value))) throw new PathGeometryError("Geometry contains a non-finite coordinate.");
  for (const bounds of [geometry.contentBounds, ...geometry.nodes.flatMap((node) => [node.bounds, node.labelBounds])]) {
    if (bounds.width < 0 || bounds.height < 0) throw new PathGeometryError("Geometry contains a negative dimension.");
    if (bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > geometry.width + 0.001 || bounds.y + bounds.height > geometry.height + 0.001) throw new PathGeometryError("Geometry falls outside its declared bounds.");
  }
}

function spacingDistribution(segments: readonly PathGeometrySegment[]) {
  const values = segments.map((segment) => Math.abs(segment.curve.end.y - segment.curve.start.y)).filter((value) => value > 0);
  if (!values.length) return { minimum: 0, maximum: 0, average: 0 };
  return {
    minimum: Math.round(Math.min(...values) * 100) / 100,
    maximum: Math.round(Math.max(...values) * 100) / 100,
    average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100,
  };
}

export function createPathGeometry(pathprint: PathprintProjection, optionsInput: PathGeometryOptionsInput = {}): PathGeometry {
  const options = resolvePathGeometryOptions(optionsInput);
  const contentBounds: PathBounds = { x: options.paddingLeft, y: options.paddingTop, width: options.width - options.paddingLeft - options.paddingRight, height: 0 };
  const branches = projectionBranches(pathprint);
  const events = projectionEvents(pathprint, branches);
  const visibleBranches = selectVisibleBranches(branches, events, options);
  const lanes = assignBranchLanes(branches, visibleBranches, options);
  const units = compactPathEvents(events);
  const nodes: PathGeometryNode[] = [];
  const primaryNodes: PathGeometryNode[] = [];
  const eventNodeIds = new Map<string, string>();
  const rejoinNodeIds = new Map<string, string>();
  let chronologicalIndex = 0;

  const originPoint = { x: options.primaryLaneX, y: options.paddingTop + 32 };
  const origin = createNode({
    id: stableId("geometry-origin", pathGeometryVersion, pathprint.origin.id),
    eventId: pathprint.origin.id,
    sourceEventIds: [],
    branchKey: "main",
    kind: "origin",
    point: originPoint,
    chronologicalIndex: chronologicalIndex++,
    importance: 0,
    progressLevel: "exploration",
    lane: 0,
    contentBounds,
    options,
  });
  nodes.push(origin);
  primaryNodes.push(origin);

  const rejoinedLastEvent = new Map(branches.filter((branch) => branch.state === "rejoined").map((branch) => [branch.eventIds.at(-1), branch.key]));
  for (const unit of units) {
    const branchKey = unit.branchKey;
    const lane = lanes.get(branchKey) ?? 0;
    const priority = priorityFor(unit.progressLevel, unit.kind);
    const size = interactionSize(priority, unit.kind);
    const x = pointXForLane(lane, size, contentBounds, options);
    const previous = primaryNodes[primaryNodes.length - 1];
    const gap = Math.max(spacingForUnit(unit, options), minimumVerticalTravel(previous.point, x, options.minimumNodeSpacing));
    const terminal = unit.kind === "paused" ? { capAngleDegrees: 0 } : unit.kind === "closed" ? { capAngleDegrees: 0, fadeLength: 48 } : undefined;
    const node = createNode({
      id: stableId("geometry-node", pathGeometryVersion, unit.id),
      eventId: unit.clustered ? undefined : unit.eventIds[0],
      sourceEventIds: unit.eventIds,
      branchKey,
      kind: unit.kind,
      point: { x, y: previous.point.y + gap },
      chronologicalIndex: chronologicalIndex++,
      importance: unit.importance,
      progressLevel: unit.progressLevel,
      lane,
      contentBounds,
      options,
      cluster: unit.clustered ? { count: unit.eventIds.length, category: unit.category } : undefined,
      terminal,
    });
    nodes.push(node);
    primaryNodes.push(node);
    for (const eventId of unit.eventIds) eventNodeIds.set(eventId, node.id);

    const rejoinKey = unit.eventIds.map((eventId) => rejoinedLastEvent.get(eventId)).find((key): key is string => Boolean(key));
    if (rejoinKey && visibleBranches.has(rejoinKey)) {
      const junctionX = options.primaryLaneX;
      const junctionGap = Math.max(options.minimumNodeSpacing, 64, minimumVerticalTravel(node.point, junctionX, options.minimumNodeSpacing));
      const junction = createNode({
        id: stableId("geometry-rejoin", pathGeometryVersion, rejoinKey, unit.id),
        sourceEventIds: [],
        branchKey: "main",
        kind: "junction",
        point: { x: junctionX, y: node.point.y + junctionGap },
        chronologicalIndex: chronologicalIndex++,
        importance: unit.importance,
        progressLevel: "intention",
        lane: 0,
        contentBounds,
        options,
      });
      nodes.push(junction);
      primaryNodes.push(junction);
      rejoinNodeIds.set(rejoinKey, junction.id);
    }
  }

  const waypoint = currentWaypoint(pathprint);
  let waypointNode: PathGeometryNode | undefined;
  if (waypoint) {
    const previous = primaryNodes[primaryNodes.length - 1];
    const x = options.primaryLaneX;
    const gap = Math.max(options.meaningfulSpacing + 16, minimumVerticalTravel(previous.point, x, options.minimumNodeSpacing));
    waypointNode = createNode({
      id: stableId("geometry-waypoint", pathGeometryVersion, waypoint.id),
      sourceEventIds: [],
      branchKey: "main",
      kind: "waypoint",
      point: { x, y: previous.point.y + gap },
      chronologicalIndex: chronologicalIndex++,
      importance: waypoint.impact === "high" ? 88 : waypoint.impact === "medium" ? 64 : 40,
      progressLevel: "action",
      lane: 0,
      contentBounds,
      options,
    });
    nodes.push(waypointNode);
    primaryNodes.push(waypointNode);
  }

  const anchor = primaryNodes[primaryNodes.length - 1];
  const possibilities = horizon(pathprint);
  const visiblePossibilities = possibilities.slice(0, options.maximumVisiblePossibilities);
  const horizonNodes: PathGeometryNode[] = [];
  const horizonLanes = availableLanes(options);
  for (let index = 0; index < visiblePossibilities.length; index += 1) {
    const possibility = visiblePossibilities[index];
    const lane = horizonLanes[index % horizonLanes.length];
    const size = interactionSize("quiet", "future");
    const x = pointXForLane(lane, size, contentBounds, options);
    const minimumTravel = minimumVerticalTravel(anchor.point, x, options.minimumNodeSpacing);
    const y = anchor.point.y + Math.max(options.meaningfulSpacing + index * options.minimumNodeSpacing, minimumTravel + index * options.minimumNodeSpacing);
    const node = createNode({
      id: stableId("geometry-horizon", pathGeometryVersion, possibility.id),
      sourceEventIds: [],
      branchKey: `future:${possibility.id}`,
      kind: "future",
      point: { x, y },
      chronologicalIndex: chronologicalIndex++,
      importance: 0,
      progressLevel: "exploration",
      lane,
      contentBounds,
      options,
    });
    nodes.push(node);
    horizonNodes.push(node);
  }

  const lastHorizonY = Math.max(anchor.point.y, ...horizonNodes.map((node) => node.point.y));
  const endpointTravel = minimumVerticalTravel(anchor.point, options.primaryLaneX, options.minimumNodeSpacing);
  const endpoint = createNode({
    id: stableId("geometry-endpoint", pathGeometryVersion, pathprint.version, options.mode),
    sourceEventIds: [],
    branchKey: "main",
    kind: "endpoint",
    point: { x: options.primaryLaneX, y: Math.max(lastHorizonY + options.minimumNodeSpacing, anchor.point.y + endpointTravel) },
    chronologicalIndex: chronologicalIndex++,
    importance: 0,
    progressLevel: "exploration",
    lane: 0,
    contentBounds,
    options,
  });
  nodes.push(endpoint);

  const collisionResult = resolveNodeCollisions(nodes, contentBounds, options);
  const segments: PathGeometrySegment[] = [];
  for (let index = 1; index < primaryNodes.length; index += 1) {
    const from = primaryNodes[index - 1];
    const to = primaryNodes[index];
    const branchKey = to.kind === "junction" && from.branchKey !== "main" ? from.branchKey : to.branchKey;
    segments.push(createSegment(from, to, branchKey, contentBounds, options));
  }
  for (const node of horizonNodes) segments.push(createSegment(anchor, node, node.branchKey, contentBounds, options));
  segments.push(createSegment(anchor, endpoint, "main", contentBounds, options));

  const geometryBranches: PathGeometryBranch[] = branches.map((branch) => {
    const nodeIds = [...new Set(branch.eventIds.map((eventId) => eventNodeIds.get(eventId)).filter((id): id is string => Boolean(id)))];
    const firstNode = nodes.find((node) => node.id === nodeIds[0]);
    const originNode = firstNode ? [...primaryNodes].reverse().find((node) => node.chronologicalIndex < firstNode.chronologicalIndex) : undefined;
    return {
      key: branch.key,
      state: branch.state,
      nodeIds,
      segmentIds: segments.filter((segment) => segment.branchKey === branch.key).map((segment) => segment.id),
      parentBranchKey: "main",
      originNodeId: originNode?.id,
      rejoinNodeId: rejoinNodeIds.get(branch.key),
      lane: lanes.get(branch.key) ?? 0,
      visible: visibleBranches.has(branch.key),
    };
  });

  const intersections: PathIntersectionOrder[] = geometryBranches.flatMap((branch) => {
    if (!branch.rejoinNodeId) return [];
    const junction = nodes.find((node) => node.id === branch.rejoinNodeId);
    const background = segments.find((segment) => segment.toNodeId === branch.rejoinNodeId && segment.branchKey === branch.key);
    const foreground = segments.find((segment) => segment.fromNodeId === branch.rejoinNodeId);
    if (!junction || !background || !foreground) return [];
    return [{ id: stableId("geometry-intersection", pathGeometryVersion, branch.key, junction.id), kind: "rejoin" as const, point: { ...junction.point }, foregroundSegmentId: foreground.id, backgroundSegmentId: background.id }];
  });

  const validationAxes: PathValidationAxis[] = nodes.filter((node) => node.visualPriority === "validation").map((node) => ({
    id: stableId("geometry-validation-axis", pathGeometryVersion, node.id),
    nodeId: node.id,
    start: { x: clamp(node.point.x - 28, contentBounds.x, contentBounds.x + contentBounds.width), y: node.point.y },
    end: { x: clamp(node.point.x + 28, contentBounds.x, contentBounds.x + contentBounds.width), y: node.point.y },
  }));

  const bottom = Math.max(options.paddingTop, ...nodes.flatMap((node) => [node.bounds.y + node.bounds.height, node.labelBounds.y + node.labelBounds.height]));
  const height = Math.ceil(bottom + options.paddingBottom);
  contentBounds.height = Math.max(0, height - options.paddingTop - options.paddingBottom);
  const connectedNodeIds = new Map(segments.map((segment) => [segment.id, new Set([segment.fromNodeId, segment.toNodeId])]));
  const labelBounds = new Map(nodes.map((node) => [node.id, node.labelBounds]));
  const segmentLabelCollisions = segmentLabelCollisionIds(segments, labelBounds, connectedNodeIds);
  const unresolvedCollisions = [...collisionResult.unresolved, ...segmentLabelCollisions];

  const geometryWithoutDiagnostics: Omit<PathGeometry, "diagnostics"> = {
    version: pathGeometryVersion,
    sourcePathprintVersion: pathprint.version,
    layoutMode: options.mode,
    width: options.width,
    height,
    contentBounds,
    nodes,
    segments,
    branches: geometryBranches,
    intersections,
    validationAxes,
    currentWaypointNodeId: waypointNode?.id,
    horizonNodeIds: horizonNodes.map((node) => node.id),
    openEndpointNodeId: endpoint.id,
  };
  assertValidGeometry(geometryWithoutDiagnostics);
  const deterministicSignature = stableHash({
    sourceVersion: pathprint.version,
    geometryVersion: pathGeometryVersion,
    options,
    nodes,
    segments,
    branches: geometryBranches,
    intersections,
    validationAxes,
  });
  const diagnostics: PathGeometryDiagnostics = {
    inputEventCount: pathprint.events.length,
    renderedNodeCount: nodes.length,
    clusteredEventCount: units.filter((unit) => unit.clustered).reduce((sum, unit) => sum + unit.eventIds.length, 0),
    visibleBranchCount: geometryBranches.filter((branch) => branch.visible).length,
    collapsedBranchKeys: geometryBranches.filter((branch) => !branch.visible).map((branch) => safeDiagnosticBranchId(pathprint.signature, branch.key)).sort(),
    collisionPasses: collisionResult.passes,
    unresolvedCollisions,
    waypointPlaced: Boolean(waypointNode),
    horizonVisibleCount: horizonNodes.length,
    horizonCollapsedCount: Math.max(0, possibilities.length - horizonNodes.length),
    deterministicSignature,
    dimensions: { width: options.width, height },
    spacingDistribution: spacingDistribution(segments),
    laneAssignments: geometryBranches.map((branch) => ({ branchId: safeDiagnosticBranchId(pathprint.signature, branch.key), lane: branch.lane, visible: branch.visible })),
    compressedQuietEvents: nodes.filter((node) => node.cluster).map((node) => ({ clusterId: node.id, count: node.cluster?.count ?? 0 })),
    rejectedInvalidCoordinates: 0,
  };
  return { ...geometryWithoutDiagnostics, diagnostics };
}
