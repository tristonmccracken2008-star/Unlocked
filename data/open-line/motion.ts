import { stableHash, stableId } from "./stable";
import type { PathControlPoints, PathGeometry, PathGeometryNode, PathGeometrySegment } from "./geometry-types";
import type {
  OpenLineGeometryDiff,
  OpenLineMotionContext,
  OpenLineMotionPhase,
  OpenLineMotionPhaseType,
  OpenLineMotionPlan,
  OpenLineMotionPreference,
  OpenLineTransitionKind,
} from "./motion-types";
import { openLineMotionVersion } from "./motion-types";

export const OPEN_LINE_MOTION = Object.freeze({
  instant: 0,
  focus: 140,
  marker: 250,
  disclosure: 240,
  branch: 500,
  extension: 640,
  pause: 320,
  close: 340,
  rejoin: 720,
  validation: 900,
  horizon: 320,
  sessionReveal: 180,
  reducedFade: 100,
  maximumForeground: 1_600,
  maximumAnimatedChanges: 24,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
} as const);

function sortedSet(values: readonly string[]) {
  return [...new Set(values)].sort();
}

function pointsEqual(left: { x: number; y: number }, right: { x: number; y: number }) {
  return left.x === right.x && left.y === right.y;
}

function curvesEqual(left: PathControlPoints, right: PathControlPoints) {
  return pointsEqual(left.start, right.start)
    && pointsEqual(left.control1, right.control1)
    && pointsEqual(left.control2, right.control2)
    && pointsEqual(left.end, right.end);
}

function validationKind(kind: PathGeometryNode["kind"]) {
  return kind === "validated" || kind === "accepted" || kind === "completed";
}

export function diffOpenLineGeometry(previous: PathGeometry | null | undefined, current: PathGeometry): OpenLineGeometryDiff {
  if (!previous) {
    const semanticChangeCount = current.nodes.length + current.segments.length + current.branches.length;
    const data = {
      addedNodeIds: current.nodes.map((node) => node.id).sort(),
      removedNodeIds: [],
      markerKindChanges: [],
      addedSegmentIds: current.segments.map((segment) => segment.id).sort(),
      removedSegmentIds: [],
      segmentStateChanges: [],
      addedBranchKeys: current.branches.map((branch) => branch.key).sort(),
      removedBranchKeys: [],
      branchStateChanges: [],
      addedValidationNodeIds: current.nodes.filter((node) => validationKind(node.kind)).map((node) => node.id).sort(),
      changedWaypointNodeIds: current.currentWaypointNodeId ? [current.currentWaypointNodeId] : [],
      addedHorizonNodeIds: [...current.horizonNodeIds].sort(),
      removedHorizonNodeIds: [],
      movedNodeIds: [],
      changedCurveSegmentIds: [],
      semanticChangeCount,
      geometryOnly: false,
    };
    return { ...data, deterministicSignature: stableHash(data) };
  }

  const previousNodes = new Map(previous.nodes.map((node) => [node.id, node]));
  const currentNodes = new Map(current.nodes.map((node) => [node.id, node]));
  const previousSegments = new Map(previous.segments.map((segment) => [segment.id, segment]));
  const currentSegments = new Map(current.segments.map((segment) => [segment.id, segment]));
  const previousBranches = new Map(previous.branches.map((branch) => [branch.key, branch]));
  const currentBranches = new Map(current.branches.map((branch) => [branch.key, branch]));
  const addedNodeIds = [...currentNodes.keys()].filter((id) => !previousNodes.has(id) && currentNodes.get(id)?.kind !== "endpoint").sort();
  const removedNodeIds = [...previousNodes.keys()].filter((id) => !currentNodes.has(id) && previousNodes.get(id)?.kind !== "endpoint").sort();
  const markerKindChanges = [...currentNodes.entries()].flatMap(([nodeId, node]) => {
    const prior = previousNodes.get(nodeId);
    return prior && prior.kind !== node.kind ? [{ nodeId, from: prior.kind, to: node.kind }] : [];
  }).sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const touchesCurrentEndpoint = (segment: PathGeometrySegment) => segment.fromNodeId === current.openEndpointNodeId || segment.toNodeId === current.openEndpointNodeId;
  const touchesPreviousEndpoint = (segment: PathGeometrySegment) => segment.fromNodeId === previous.openEndpointNodeId || segment.toNodeId === previous.openEndpointNodeId;
  const addedSegmentIds = [...currentSegments.keys()].filter((id) => !previousSegments.has(id) && !touchesCurrentEndpoint(currentSegments.get(id)!)).sort();
  const removedSegmentIds = [...previousSegments.keys()].filter((id) => !currentSegments.has(id) && !touchesPreviousEndpoint(previousSegments.get(id)!)).sort();
  const segmentStateChanges = [...currentSegments.entries()].flatMap(([segmentId, segment]) => {
    const prior = previousSegments.get(segmentId);
    return prior && prior.state !== segment.state ? [{ segmentId, from: prior.state, to: segment.state }] : [];
  }).sort((a, b) => a.segmentId.localeCompare(b.segmentId));
  const addedBranchKeys = [...currentBranches.keys()].filter((key) => !previousBranches.has(key)).sort();
  const removedBranchKeys = [...previousBranches.keys()].filter((key) => !currentBranches.has(key)).sort();
  const branchStateChanges = [...currentBranches.entries()].flatMap(([branchKey, branch]) => {
    const prior = previousBranches.get(branchKey);
    return prior && prior.state !== branch.state ? [{ branchKey, from: prior.state, to: branch.state }] : [];
  }).sort((a, b) => a.branchKey.localeCompare(b.branchKey));
  const addedValidationNodeIds = sortedSet([
    ...addedNodeIds.filter((id) => validationKind(currentNodes.get(id)?.kind ?? "explored")),
    ...markerKindChanges.filter((change) => validationKind(change.to) && !validationKind(change.from)).map((change) => change.nodeId),
  ]);
  const changedWaypointNodeIds = previous.currentWaypointNodeId === current.currentWaypointNodeId
    ? []
    : sortedSet([previous.currentWaypointNodeId, current.currentWaypointNodeId].filter((id): id is string => Boolean(id)));
  const addedHorizonNodeIds = current.horizonNodeIds.filter((id) => !previous.horizonNodeIds.includes(id)).sort();
  const removedHorizonNodeIds = previous.horizonNodeIds.filter((id) => !current.horizonNodeIds.includes(id)).sort();
  const movedNodeIds = [...currentNodes.entries()].flatMap(([id, node]) => {
    const prior = previousNodes.get(id);
    return prior && !pointsEqual(prior.point, node.point) ? [id] : [];
  }).sort();
  const changedCurveSegmentIds = [...currentSegments.entries()].flatMap(([id, segment]) => {
    const prior = previousSegments.get(id);
    return prior && !curvesEqual(prior.curve, segment.curve) ? [id] : [];
  }).sort();
  const semanticChangeCount = addedNodeIds.length + removedNodeIds.length + markerKindChanges.length + addedSegmentIds.length + removedSegmentIds.length
    + segmentStateChanges.length + addedBranchKeys.length + removedBranchKeys.length + branchStateChanges.length + changedWaypointNodeIds.length
    + addedHorizonNodeIds.length + removedHorizonNodeIds.length;
  const geometryOnly = semanticChangeCount === 0 && (movedNodeIds.length > 0 || changedCurveSegmentIds.length > 0 || previous.layoutMode !== current.layoutMode);
  const data = {
    addedNodeIds,
    removedNodeIds,
    markerKindChanges,
    addedSegmentIds,
    removedSegmentIds,
    segmentStateChanges,
    addedBranchKeys,
    removedBranchKeys,
    branchStateChanges,
    addedValidationNodeIds,
    changedWaypointNodeIds,
    addedHorizonNodeIds,
    removedHorizonNodeIds,
    movedNodeIds,
    changedCurveSegmentIds,
    semanticChangeCount,
    geometryOnly,
  };
  return { ...data, deterministicSignature: stableHash(data) };
}

function addedKinds(diff: OpenLineGeometryDiff, current: PathGeometry) {
  const nodes = new Map(current.nodes.map((node) => [node.id, node]));
  return new Set(diff.addedNodeIds.map((id) => nodes.get(id)?.kind).filter(Boolean));
}

function changedTo(diff: OpenLineGeometryDiff, kind: PathGeometryNode["kind"]) {
  return diff.markerKindChanges.some((change) => change.to === kind);
}

export function classifyOpenLineTransition(previous: PathGeometry | null | undefined, current: PathGeometry, diff: OpenLineGeometryDiff, context: OpenLineMotionContext): OpenLineTransitionKind {
  if (!previous) {
    if (context.cause === "first_journey_creation" || context.cause === "session_reveal") return "initial_reveal";
    return "no_visible_change";
  }
  if (context.cause === "layout_change" || context.cause === "theme_change") return "no_visible_change";
  if (context.cause === "privacy_projection_change") return diff.semanticChangeCount ? "snapshot_refreshed" : "no_visible_change";
  if (context.cause === "imported_history" || diff.semanticChangeCount > OPEN_LINE_MOTION.maximumAnimatedChanges) return "snapshot_refreshed";
  if (diff.semanticChangeCount === 0) return context.cause === "snapshot_refresh" ? "snapshot_refreshed" : "no_visible_change";

  const rejoined = diff.branchStateChanges.some((change) => change.to === "rejoined") || current.branches.some((branch) => diff.addedBranchKeys.includes(branch.key) && branch.state === "rejoined");
  if (rejoined) return "branch_rejoined";
  if (diff.branchStateChanges.some((change) => change.to === "closed")) return "branch_closed";
  if (diff.branchStateChanges.some((change) => change.to === "paused")) return "branch_paused";
  if (diff.addedBranchKeys.length) return "branch_created";

  const kinds = addedKinds(diff, current);
  if (kinds.has("completed") || changedTo(diff, "completed")) return "experience_completed";
  if (kinds.has("accepted") || changedTo(diff, "accepted")) return "opportunity_accepted";
  if (kinds.has("validated") || changedTo(diff, "validated") || diff.addedValidationNodeIds.length) return "validation_received";
  if (kinds.has("submitted") || changedTo(diff, "submitted")) return "application_submitted";
  if (kinds.has("active") || changedTo(diff, "active")) return "application_started";
  if (kinds.has("chosen") || changedTo(diff, "chosen")) return "direction_chosen";
  if (kinds.has("explored")) return "exploration_added";
  if (diff.changedWaypointNodeIds.length) return "waypoint_changed";
  if (diff.addedHorizonNodeIds.length || diff.removedHorizonNodeIds.length) return "horizon_changed";
  return context.cause === "snapshot_refresh" || diff.geometryOnly ? "snapshot_refreshed" : "no_visible_change";
}

function cubicLength(segment: PathGeometrySegment) {
  const points = [segment.curve.start];
  for (let index = 1; index <= 12; index += 1) {
    const t = index / 12;
    const inverse = 1 - t;
    points.push({
      x: inverse ** 3 * segment.curve.start.x + 3 * inverse ** 2 * t * segment.curve.control1.x + 3 * inverse * t ** 2 * segment.curve.control2.x + t ** 3 * segment.curve.end.x,
      y: inverse ** 3 * segment.curve.start.y + 3 * inverse ** 2 * t * segment.curve.control1.y + 3 * inverse * t ** 2 * segment.curve.control2.y + t ** 3 * segment.curve.end.y,
    });
  }
  return Math.ceil(points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0));
}

type PhaseInput = Omit<OpenLineMotionPhase, "id" | "easing">;

function phase(type: OpenLineMotionPhaseType, targetIds: readonly string[], delayMs: number, durationMs: number, source: "current" | "previous" = "current", pathLength?: number): PhaseInput | null {
  const targets = sortedSet(targetIds);
  return targets.length ? { type, targetIds: targets, source, delayMs, durationMs, pathLength } : null;
}

function segmentLength(geometry: PathGeometry, ids: readonly string[]) {
  const set = new Set(ids);
  const lengths = geometry.segments.filter((segment) => set.has(segment.id)).map(cubicLength);
  return lengths.length ? Math.max(...lengths) : undefined;
}

function affectedNodes(diff: OpenLineGeometryDiff) {
  return sortedSet([
    ...diff.addedNodeIds,
    ...diff.removedNodeIds,
    ...diff.markerKindChanges.map((change) => change.nodeId),
    ...diff.addedValidationNodeIds,
    ...diff.changedWaypointNodeIds,
    ...diff.addedHorizonNodeIds,
    ...diff.removedHorizonNodeIds,
  ]);
}

function affectedSegments(diff: OpenLineGeometryDiff, current: PathGeometry) {
  const branchKeys = new Set([
    ...diff.addedBranchKeys,
    ...diff.branchStateChanges.map((change) => change.branchKey),
  ]);
  return sortedSet([
    ...diff.addedSegmentIds,
    ...diff.removedSegmentIds,
    ...diff.segmentStateChanges.map((change) => change.segmentId),
    ...current.segments.filter((segment) => branchKeys.has(segment.branchKey)).map((segment) => segment.id),
  ]);
}

function fullMotionPhases(kind: OpenLineTransitionKind, previous: PathGeometry | null | undefined, current: PathGeometry, diff: OpenLineGeometryDiff, context: OpenLineMotionContext): PhaseInput[] {
  const addedNodes = diff.addedNodeIds;
  const addedSegments = diff.addedSegmentIds;
  const markerChanges = diff.markerKindChanges.map((change) => change.nodeId);
  const phases: Array<PhaseInput | null> = [];
  if (kind === "initial_reveal") {
    if (!previous && context.cause === "session_reveal") {
      phases.push(phase("marker_enter", current.nodes.filter((node) => node.kind !== "origin" && node.kind !== "endpoint").map((node) => node.id), 0, OPEN_LINE_MOTION.sessionReveal));
    } else if (!previous) {
      phases.push(phase("line_reveal", current.segments.filter((segment) => segment.state !== "future").map((segment) => segment.id), 0, OPEN_LINE_MOTION.extension, "current", segmentLength(current, current.segments.map((segment) => segment.id))));
      phases.push(phase("marker_enter", current.nodes.filter((node) => node.kind !== "origin" && node.kind !== "endpoint").map((node) => node.id), 260, OPEN_LINE_MOTION.marker));
      phases.push(phase("label_fade", current.nodes.map((node) => node.id), 420, OPEN_LINE_MOTION.disclosure));
    }
  } else if (kind === "exploration_added" || kind === "direction_chosen") {
    phases.push(phase("line_extend", addedSegments, 0, 520, "current", segmentLength(current, addedSegments)));
    phases.push(phase(markerChanges.length ? "marker_transform" : "marker_enter", [...addedNodes, ...markerChanges], 180, OPEN_LINE_MOTION.marker));
    phases.push(phase("label_fade", addedNodes, 360, OPEN_LINE_MOTION.disclosure));
  } else if (kind === "application_started") {
    const nodes = sortedSet([...addedNodes, ...markerChanges]);
    phases.push(phase("marker_fill", nodes, 0, OPEN_LINE_MOTION.marker));
    phases.push(phase("line_extend", addedSegments, 120, 520, "current", segmentLength(current, addedSegments)));
    phases.push(phase("label_fade", nodes, 420, OPEN_LINE_MOTION.disclosure));
  } else if (kind === "application_submitted") {
    const nodes = sortedSet([...addedNodes, ...markerChanges]);
    phases.push(phase("marker_fill", nodes, 0, OPEN_LINE_MOTION.marker));
    phases.push(phase("line_extend", addedSegments, 150, 520, "current", segmentLength(current, addedSegments)));
    phases.push(phase("label_fade", nodes, 460, OPEN_LINE_MOTION.disclosure));
  } else if (kind === "validation_received" || kind === "opportunity_accepted") {
    const nodes = sortedSet([...diff.addedValidationNodeIds, ...markerChanges, ...addedNodes]);
    phases.push(phase("marker_transform", nodes, 0, OPEN_LINE_MOTION.marker));
    phases.push(phase("validation_ring", nodes, 180, 460, "current", 96));
    phases.push(phase("intersection_draw", nodes, 330, 300, "current", 56));
    phases.push(phase("label_fade", nodes, 660, OPEN_LINE_MOTION.disclosure));
    phases.push(phase("horizon_reveal", diff.addedHorizonNodeIds, 720, 180));
  } else if (kind === "experience_completed") {
    const nodes = sortedSet([...diff.addedValidationNodeIds, ...markerChanges, ...addedNodes]);
    phases.push(phase("marker_fill", nodes, 0, OPEN_LINE_MOTION.marker));
    phases.push(phase("line_extend", addedSegments, 150, 520, "current", segmentLength(current, addedSegments)));
    phases.push(phase("marker_transform", nodes, 360, OPEN_LINE_MOTION.marker));
    phases.push(phase("label_fade", nodes, 610, OPEN_LINE_MOTION.disclosure));
    phases.push(phase("focus_shift", diff.changedWaypointNodeIds.filter((id) => id === current.currentWaypointNodeId), 700, OPEN_LINE_MOTION.focus));
    phases.push(phase("horizon_reveal", diff.addedHorizonNodeIds, 820, 160));
  } else if (kind === "branch_created") {
    const branchSegments = current.segments.filter((segment) => diff.addedBranchKeys.includes(segment.branchKey)).map((segment) => segment.id);
    const branchNodes = current.nodes.filter((node) => diff.addedBranchKeys.includes(node.branchKey)).map((node) => node.id);
    phases.push(phase("branch_create", branchSegments, 0, OPEN_LINE_MOTION.branch, "current", segmentLength(current, branchSegments)));
    phases.push(phase("marker_enter", branchNodes, 280, OPEN_LINE_MOTION.marker));
    phases.push(phase("label_fade", branchNodes, 420, 140));
  } else if (kind === "branch_paused" || kind === "branch_closed") {
    const changes = diff.branchStateChanges.filter((change) => change.to === (kind === "branch_paused" ? "paused" : "closed"));
    const keys = new Set(changes.map((change) => change.branchKey));
    const segmentIds = current.segments.filter((segment) => keys.has(segment.branchKey)).map((segment) => segment.id);
    const nodeIds = current.nodes.filter((node) => keys.has(node.branchKey)).map((node) => node.id);
    phases.push(phase(kind === "branch_paused" ? "branch_pause" : "branch_close", segmentIds, 0, kind === "branch_paused" ? OPEN_LINE_MOTION.pause : OPEN_LINE_MOTION.close));
    phases.push(phase("marker_transform", nodeIds.slice(-1), 120, OPEN_LINE_MOTION.marker));
  } else if (kind === "branch_rejoined") {
    const changes = diff.branchStateChanges.filter((change) => change.to === "rejoined");
    const keys = new Set([...changes.map((change) => change.branchKey), ...diff.addedBranchKeys.filter((key) => current.branches.find((branch) => branch.key === key)?.state === "rejoined")]);
    const segmentIds = current.segments.filter((segment) => keys.has(segment.branchKey)).map((segment) => segment.id);
    const intersections = current.intersections.filter((intersection) => segmentIds.includes(intersection.backgroundSegmentId) || segmentIds.includes(intersection.foregroundSegmentId));
    const junctionIds = current.branches.filter((branch) => keys.has(branch.key)).map((branch) => branch.rejoinNodeId).filter((id): id is string => Boolean(id));
    phases.push(phase("branch_rejoin", segmentIds, 0, 560, "current", segmentLength(current, segmentIds)));
    phases.push(phase("intersection_draw", intersections.map((intersection) => intersection.id), 360, 260));
    phases.push(phase("marker_transform", junctionIds, 500, 220));
  } else if (kind === "waypoint_changed") {
    const oldWaypoint = previous?.currentWaypointNodeId;
    phases.push(phase("focus_shift", oldWaypoint ? [oldWaypoint] : [], 0, OPEN_LINE_MOTION.focus, "previous"));
    phases.push(phase("focus_shift", current.currentWaypointNodeId ? [current.currentWaypointNodeId] : [], 140, OPEN_LINE_MOTION.marker));
    phases.push(phase("horizon_reveal", diff.addedHorizonNodeIds, 320, OPEN_LINE_MOTION.horizon));
  } else if (kind === "horizon_changed") {
    phases.push(phase("label_fade", diff.removedHorizonNodeIds, 0, 140, "previous"));
    phases.push(phase("horizon_reveal", diff.addedHorizonNodeIds, 160, OPEN_LINE_MOTION.horizon));
  }
  if (diff.removedSegmentIds.length && kind !== "horizon_changed") phases.unshift(phase("line_fade", diff.removedSegmentIds, 0, 180, "previous"));
  return phases.filter((item): item is PhaseInput => Boolean(item));
}

function applyPreference(phases: readonly PhaseInput[], preference: OpenLineMotionPreference) {
  if (preference === "none") return [];
  if (preference === "full") return phases;
  const immediateTypes = new Set<OpenLineMotionPhaseType>(["line_reveal", "line_extend", "branch_create", "branch_rejoin", "intersection_draw", "validation_ring"]);
  return phases.map((item) => ({
    ...item,
    delayMs: Math.round(item.delayMs * 0.12),
    durationMs: immediateTypes.has(item.type) ? 0 : Math.min(OPEN_LINE_MOTION.reducedFade, item.durationMs),
  }));
}

export function createOpenLineMotionPlan(previous: PathGeometry | null | undefined, current: PathGeometry, context: OpenLineMotionContext): OpenLineMotionPlan {
  const preference = context.preference ?? "full";
  const diff = diffOpenLineGeometry(previous, current);
  const transitionKind = classifyOpenLineTransition(previous, current, diff, context);
  const suppress = transitionKind === "no_visible_change" || transitionKind === "snapshot_refreshed"
    || context.cause === "normal_revisit" || context.cause === "layout_change" || context.cause === "theme_change"
    || context.cause === "privacy_projection_change" || context.cause === "imported_history";
  const rawPhases = suppress ? [] : fullMotionPhases(transitionKind, previous, current, diff, context);
  const preferred = applyPreference(rawPhases, preference);
  const bounded = preferred.map((item) => ({ ...item, delayMs: Math.min(item.delayMs, OPEN_LINE_MOTION.maximumForeground), durationMs: Math.min(item.durationMs, OPEN_LINE_MOTION.maximumForeground - Math.min(item.delayMs, OPEN_LINE_MOTION.maximumForeground)) }));
  const signatureSeed = { version: openLineMotionVersion, transitionKind, preference, diff: diff.deterministicSignature, phases: bounded };
  const phases = bounded.map((item, index): OpenLineMotionPhase => ({
    ...item,
    id: stableId("open-line-motion-phase", openLineMotionVersion, signatureSeed, index),
    easing: OPEN_LINE_MOTION.easing,
  }));
  const affectedNodeIds = affectedNodes(diff);
  const affectedSegmentIds = affectedSegments(diff, current);
  const totalDurationMs = phases.reduce((maximum, item) => Math.max(maximum, item.delayMs + item.durationMs), 0);
  const signatureData = { ...signatureSeed, phases, affectedNodeIds, affectedSegmentIds, totalDurationMs };
  return {
    version: openLineMotionVersion,
    transitionKind,
    preference,
    totalDurationMs,
    phases,
    affectedNodeIds,
    affectedSegmentIds,
    deterministicSignature: stableHash(signatureData),
  };
}
