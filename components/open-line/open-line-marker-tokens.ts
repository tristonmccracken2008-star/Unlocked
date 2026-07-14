import type { PathGeometryNodeKind } from "@/data/open-line";

export type OpenLineMarkerSize = "trace" | "small" | "origin" | "standard" | "waypoint" | "validation";

export const openLineMarkerSizes: Readonly<Record<OpenLineMarkerSize, number>> = Object.freeze({
  trace: 8,
  small: 16,
  origin: 20,
  standard: 24,
  waypoint: 32,
  validation: 32,
});

export const openLineMarkerStrokes: Readonly<Record<OpenLineMarkerSize | "detail" | "strand" | "focus", number>> = Object.freeze({
  trace: 1.25,
  small: 1.5,
  origin: 1.75,
  standard: 2,
  waypoint: 2,
  validation: 2,
  detail: 1.5,
  strand: 1.75,
  focus: 1.5,
});

export const openLineMarkerInteractionSize = 44;

export const openLineMarkerSizeByKind: Readonly<Record<PathGeometryNodeKind, OpenLineMarkerSize>> = Object.freeze({
  origin: "origin",
  explored: "trace",
  chosen: "small",
  active: "standard",
  waypoint: "waypoint",
  submitted: "standard",
  validated: "validation",
  accepted: "validation",
  completed: "standard",
  paused: "small",
  closed: "trace",
  future: "small",
  junction: "small",
  endpoint: "trace",
});
