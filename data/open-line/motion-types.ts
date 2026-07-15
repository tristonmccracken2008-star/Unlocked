import type { PathGeometryNodeKind, PathGeometrySegmentState } from "./geometry-types";

export const openLineMotionVersion = "open-line-motion-v1";

export type OpenLineMotionPreference = "full" | "reduced" | "none";

export type OpenLineTransitionKind =
  | "initial_reveal"
  | "exploration_added"
  | "direction_chosen"
  | "application_started"
  | "application_submitted"
  | "validation_received"
  | "opportunity_accepted"
  | "experience_completed"
  | "branch_created"
  | "branch_paused"
  | "branch_closed"
  | "branch_rejoined"
  | "waypoint_changed"
  | "horizon_changed"
  | "snapshot_refreshed"
  | "no_visible_change";

export type OpenLineMotionPhaseType =
  | "line_reveal"
  | "line_extend"
  | "line_fade"
  | "marker_enter"
  | "marker_transform"
  | "marker_fill"
  | "validation_ring"
  | "intersection_draw"
  | "branch_create"
  | "branch_rejoin"
  | "branch_pause"
  | "branch_close"
  | "label_fade"
  | "horizon_reveal"
  | "focus_shift";

export type OpenLineMotionPhase = {
  id: string;
  type: OpenLineMotionPhaseType;
  targetIds: string[];
  source: "current" | "previous";
  delayMs: number;
  durationMs: number;
  easing: string;
  pathLength?: number;
};

export type OpenLineMotionPlan = {
  version: string;
  transitionKind: OpenLineTransitionKind;
  preference: OpenLineMotionPreference;
  totalDurationMs: number;
  phases: OpenLineMotionPhase[];
  affectedNodeIds: string[];
  affectedSegmentIds: string[];
  deterministicSignature: string;
};

export type OpenLineMotionCause =
  | "first_journey_creation"
  | "meaningful_update"
  | "normal_revisit"
  | "session_reveal"
  | "snapshot_refresh"
  | "layout_change"
  | "theme_change"
  | "privacy_projection_change"
  | "imported_history";

export type OpenLineMotionContext = {
  cause: OpenLineMotionCause;
  preference?: OpenLineMotionPreference;
  allowDeveloperReplay?: boolean;
};

export type OpenLineMarkerKindChange = {
  nodeId: string;
  from: PathGeometryNodeKind;
  to: PathGeometryNodeKind;
};

export type OpenLineSegmentStateChange = {
  segmentId: string;
  from: PathGeometrySegmentState;
  to: PathGeometrySegmentState;
};

export type OpenLineBranchStateChange = {
  branchKey: string;
  from: "active" | "paused" | "closed" | "rejoined";
  to: "active" | "paused" | "closed" | "rejoined";
};

export type OpenLineGeometryDiff = {
  addedNodeIds: string[];
  removedNodeIds: string[];
  markerKindChanges: OpenLineMarkerKindChange[];
  addedSegmentIds: string[];
  removedSegmentIds: string[];
  segmentStateChanges: OpenLineSegmentStateChange[];
  addedBranchKeys: string[];
  removedBranchKeys: string[];
  branchStateChanges: OpenLineBranchStateChange[];
  addedValidationNodeIds: string[];
  changedWaypointNodeIds: string[];
  addedHorizonNodeIds: string[];
  removedHorizonNodeIds: string[];
  movedNodeIds: string[];
  changedCurveSegmentIds: string[];
  semanticChangeCount: number;
  geometryOnly: boolean;
  deterministicSignature: string;
};

export type OpenLineMotionDiagnostics = {
  transitionKind: OpenLineTransitionKind;
  preference: OpenLineMotionPreference;
  phaseCount: number;
  totalPlannedDurationMs: number;
  affectedNodeCount: number;
  affectedSegmentCount: number;
  startedAt?: number;
  completedAt?: number;
  interrupted: boolean;
  skipped: boolean;
  deterministicSignature: string;
};
