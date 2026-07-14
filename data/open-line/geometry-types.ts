import type { PathBranch, PathEventKind, Pathprint, PublicPathprint } from "./types";

export const pathGeometryVersion = "pathprint-geometry-v1";

export type PathprintProjection = Pathprint | PublicPathprint;
export type PathLayoutMode = "desktop" | "tablet" | "mobile" | "share";

export type PathPoint = {
  x: number;
  y: number;
};

export type PathBounds = PathPoint & {
  width: number;
  height: number;
};

export type PathControlPoints = {
  start: PathPoint;
  control1: PathPoint;
  control2: PathPoint;
  end: PathPoint;
};

export type PathGeometryNodeKind = PathEventKind | "waypoint" | "junction" | "endpoint";
export type PathVisualPriority = "quiet" | "normal" | "meaningful" | "validation";

export type PathGeometryNode = {
  id: string;
  eventId?: string;
  sourceEventIds: string[];
  branchKey: string;
  kind: PathGeometryNodeKind;
  point: PathPoint;
  bounds: PathBounds;
  labelBounds: PathBounds;
  chronologicalIndex: number;
  importance: number;
  labelSide: "left" | "right";
  visualPriority: PathVisualPriority;
  cluster?: {
    count: number;
    category?: string;
  };
  terminal?: {
    capAngleDegrees: number;
    fadeLength?: number;
  };
};

export type PathGeometrySegmentState = "completed" | "current" | "future" | "alternate" | "paused" | "closed" | "validated";

export type PathGeometrySegment = {
  id: string;
  branchKey: string;
  fromNodeId: string;
  toNodeId: string;
  state: PathGeometrySegmentState;
  curve: PathControlPoints;
  chronologicalStart: number;
  chronologicalEnd: number;
  terminalFadeLength?: number;
};

export type PathGeometryBranch = {
  key: string;
  state: PathBranch["state"];
  nodeIds: string[];
  segmentIds: string[];
  parentBranchKey?: string;
  originNodeId?: string;
  rejoinNodeId?: string;
  lane: number;
  visible: boolean;
};

export type PathIntersectionOrder = {
  id: string;
  kind: "rejoin";
  point: PathPoint;
  foregroundSegmentId: string;
  backgroundSegmentId: string;
};

export type PathValidationAxis = {
  id: string;
  nodeId: string;
  start: PathPoint;
  end: PathPoint;
};

export type PathGeometryOptions = {
  mode: PathLayoutMode;
  width: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  primaryLaneX: number;
  laneSpacing: number;
  routineSpacing: number;
  meaningfulSpacing: number;
  validationSpacing: number;
  minimumNodeSpacing: number;
  maximumVisibleBranches: number;
  maximumVisiblePossibilities: number;
  labelWidth: number;
  maximumLayoutPasses: number;
};

export type PathGeometryOptionsInput = Partial<Omit<PathGeometryOptions, "mode">> & {
  mode?: PathLayoutMode;
};

export type PathGeometryDiagnostics = {
  inputEventCount: number;
  renderedNodeCount: number;
  clusteredEventCount: number;
  visibleBranchCount: number;
  collapsedBranchKeys: string[];
  collisionPasses: number;
  unresolvedCollisions: Array<{
    type: "node" | "label" | "node_label" | "content_edge" | "segment_label";
    ids: string[];
  }>;
  waypointPlaced: boolean;
  horizonVisibleCount: number;
  horizonCollapsedCount: number;
  deterministicSignature: string;
  dimensions: { width: number; height: number };
  spacingDistribution: { minimum: number; maximum: number; average: number };
  laneAssignments: Array<{ branchId: string; lane: number; visible: boolean }>;
  compressedQuietEvents: Array<{ clusterId: string; count: number }>;
  rejectedInvalidCoordinates: number;
};

export type PathGeometry = {
  version: string;
  sourcePathprintVersion: string;
  layoutMode: PathLayoutMode;
  width: number;
  height: number;
  contentBounds: PathBounds;
  nodes: PathGeometryNode[];
  segments: PathGeometrySegment[];
  branches: PathGeometryBranch[];
  intersections: PathIntersectionOrder[];
  validationAxes: PathValidationAxis[];
  currentWaypointNodeId?: string;
  horizonNodeIds: string[];
  openEndpointNodeId: string;
  diagnostics: PathGeometryDiagnostics;
};

export class PathGeometryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathGeometryError";
  }
}
