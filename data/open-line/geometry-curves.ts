import { stableHash } from "./stable";
import type { PathBounds, PathControlPoints, PathGeometrySegment, PathPoint } from "./geometry-types";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function hashFraction(seed: string, offset: number) {
  const hash = stableHash([seed, offset]);
  return Number.parseInt(hash.slice(0, 8), 16) / 0xffffffff;
}

export function minimumVerticalTravel(start: PathPoint, endX: number, minimumSpacing: number, maximumAngleDegrees = 42) {
  const lateralDistance = Math.abs(endX - start.x);
  const angleRadians = maximumAngleDegrees * Math.PI / 180;
  return Math.max(48, minimumSpacing, lateralDistance / Math.tan(angleRadians));
}

export function createPathCurve(start: PathPoint, end: PathPoint, bounds: Pick<PathBounds, "x" | "width">, seed: string, mobileRailX?: number): PathControlPoints {
  const dy = Math.max(48, end.y - start.y);
  const dx = end.x - start.x;
  const minimumX = bounds.x;
  const maximumX = mobileRailX ?? bounds.x + bounds.width;
  const direction = hashFraction(seed, 0) >= 0.5 ? 1 : -1;
  const sway = direction * (8 + hashFraction(seed, 1) * Math.min(12, dy * 0.08));
  const firstWeight = 0.12 + hashFraction(seed, 2) * 0.08;
  const secondWeight = 0.72 + hashFraction(seed, 3) * 0.1;
  return {
    start: { ...start },
    control1: {
      x: clamp(start.x + dx * firstWeight + (Math.abs(dx) < 8 ? sway : sway * 0.22), minimumX, maximumX),
      y: start.y + dy * (0.34 + hashFraction(seed, 4) * 0.05),
    },
    control2: {
      x: clamp(start.x + dx * secondWeight - (Math.abs(dx) < 8 ? sway * 0.35 : sway * 0.12), minimumX, maximumX),
      y: end.y - dy * (0.27 + hashFraction(seed, 5) * 0.06),
    },
    end: { ...end },
  };
}

function cubicCoordinate(start: number, control1: number, control2: number, end: number, time: number) {
  const inverse = 1 - time;
  return inverse ** 3 * start + 3 * inverse ** 2 * time * control1 + 3 * inverse * time ** 2 * control2 + time ** 3 * end;
}

export function pointOnCurve(curve: PathControlPoints, time: number): PathPoint {
  return {
    x: cubicCoordinate(curve.start.x, curve.control1.x, curve.control2.x, curve.end.x, time),
    y: cubicCoordinate(curve.start.y, curve.control1.y, curve.control2.y, curve.end.y, time),
  };
}

export function segmentLabelCollisionIds(segments: readonly PathGeometrySegment[], labelBounds: ReadonlyMap<string, PathBounds>, connectedNodeIds: ReadonlyMap<string, ReadonlySet<string>>) {
  const collisions: Array<{ type: "segment_label"; ids: string[] }> = [];
  for (const segment of segments) {
    const connected = connectedNodeIds.get(segment.id) ?? new Set([segment.fromNodeId, segment.toNodeId]);
    for (const [nodeId, bounds] of labelBounds) {
      if (!bounds.width || !bounds.height || connected.has(nodeId)) continue;
      const intersects = [0.2, 0.35, 0.5, 0.65, 0.8].some((time) => {
        const point = pointOnCurve(segment.curve, time);
        return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
      });
      if (intersects) collisions.push({ type: "segment_label", ids: [segment.id, nodeId] });
    }
  }
  return collisions;
}
