import { memo, useId } from "react";
import type { OpenLineMotionPlan, PathGeometry, PathGeometryNode, PathGeometrySegment } from "@/data/open-line";
import { openLineAperturePath } from "./open-line-marker-primitives";
import { openLineMarkerInteractionSize } from "./open-line-marker-tokens";
import { getOpenLineMarkerAccessibleLabel, OpenLineMarker, type OpenLineClusterDetail, type OpenLineMarkerInteractionState } from "./open-line-markers";
import { openLineCoordinate, openLineCoordinateText } from "./open-line-svg";
import { resolveOpenLineTheme, type OpenLineTheme } from "./open-line-theme";

export type OpenLineRenderQuality = "standard" | "high" | "print";

export type OpenLineRendererProps = {
  geometry: PathGeometry;
  theme?: OpenLineTheme;
  quality?: OpenLineRenderQuality;
  interactive?: boolean;
  showLabels?: boolean;
  showWaypoint?: boolean;
  showFuture?: boolean;
  showBranches?: boolean;
  showDiagnostics?: boolean;
  markerStates?: Readonly<Record<string, OpenLineMarkerInteractionState>>;
  decorativeMarkers?: boolean;
  clusterDetail?: OpenLineClusterDetail;
  showClusterCounts?: boolean;
  background?: "transparent" | "paper";
  title?: string;
  description?: string;
  className?: string;
  idPrefix?: string;
  motionPlan?: OpenLineMotionPlan;
  motionLayer?: "current" | "previous";
};

type PathRecord = { segment: PathGeometrySegment; d: string };

const geometryPathCache = new WeakMap<PathGeometry, ReadonlyArray<PathRecord>>();

function curvePath(segment: PathGeometrySegment) {
  const { start, control1, control2, end } = segment.curve;
  return `M${openLineCoordinateText(start.x)} ${openLineCoordinateText(start.y)}C${openLineCoordinateText(control1.x)} ${openLineCoordinateText(control1.y)} ${openLineCoordinateText(control2.x)} ${openLineCoordinateText(control2.y)} ${openLineCoordinateText(end.x)} ${openLineCoordinateText(end.y)}`;
}

function pathRecords(geometry: PathGeometry) {
  const cached = geometryPathCache.get(geometry);
  if (cached) return cached;
  const records = geometry.segments.map((segment) => ({ segment, d: curvePath(segment) }));
  geometryPathCache.set(geometry, records);
  return records;
}

function safeId(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "-");
}

function segmentVisible(segment: PathGeometrySegment, geometry: PathGeometry, showFuture: boolean, showBranches: boolean) {
  if (!showFuture && segment.state === "future" && segment.toNodeId !== geometry.openEndpointNodeId) return false;
  if (!showBranches && segment.branchKey !== "main") return false;
  return true;
}

function nodeVisible(node: PathGeometryNode, geometry: PathGeometry, showFuture: boolean, showBranches: boolean) {
  if (!showFuture && geometry.horizonNodeIds.includes(node.id)) return false;
  if (!showBranches && node.branchKey !== "main" && node.id !== geometry.currentWaypointNodeId) return false;
  return true;
}

function pathColor(state: PathGeometrySegment["state"], theme: ReturnType<typeof resolveOpenLineTheme>) {
  switch (state) {
    case "completed": return theme.forest;
    case "current": return theme.deepForest;
    case "future": return theme.neutral;
    case "alternate": return theme.mineral;
    case "paused": return theme.mineral;
    case "closed": return theme.clay;
    case "validated": return theme.deepForest;
  }
}

function pathWidth(state: PathGeometrySegment["state"], quality: OpenLineRenderQuality) {
  const base = quality === "print" ? 2.25 : quality === "high" ? 2.5 : 2;
  return state === "current" || state === "validated" ? base + 0.5 : base;
}

function SegmentPath({ record, theme, quality, elementId, curveId, fadeMaskId }: { record: PathRecord; theme: ReturnType<typeof resolveOpenLineTheme>; quality: OpenLineRenderQuality; elementId: string; curveId: string; fadeMaskId?: string }) {
  const { segment } = record;
  return <use
    id={elementId}
    href={`#${curveId}`}
    fill="none"
    stroke={pathColor(segment.state, theme)}
    strokeWidth={pathWidth(segment.state, quality)}
    strokeLinecap={segment.state === "paused" || segment.state === "closed" ? "butt" : "round"}
    strokeLinejoin="round"
    strokeDasharray={segment.state === "future" ? "6 8" : undefined}
    opacity={segment.state === "closed" ? 0.68 : segment.state === "future" ? 0.72 : 1}
    mask={fadeMaskId ? `url(#${fadeMaskId})` : undefined}
    data-open-line-segment=""
    data-segment-id={segment.id}
    data-branch-id={segment.branchKey}
    data-state={segment.state}
    data-from-node-id={segment.fromNodeId}
    data-to-node-id={segment.toNodeId}
    data-terminal-fade-length={segment.terminalFadeLength}
    aria-hidden="true"
  />;
}

function LabelAnchors({ node, prefix }: { node: PathGeometryNode; prefix: string }) {
  if (node.labelBounds.width <= 0 || node.labelBounds.height <= 0) return null;
  const { x, y, width, height } = node.labelBounds;
  const headlineHeight = Math.min(28, height * 0.36);
  const metadataHeight = Math.min(22, height * 0.28);
  const bodyY = y + headlineHeight;
  const bodyHeight = Math.max(0, height - headlineHeight - metadataHeight);
  return <g id={`${prefix}-label-${safeId(node.id)}`} data-label-anchor="" data-node-id={node.id} data-label-side={node.labelSide} opacity="0" pointerEvents="none" aria-hidden="true">
    <rect id={`${prefix}-headline-${safeId(node.id)}`} x={openLineCoordinate(x)} y={openLineCoordinate(y)} width={openLineCoordinate(width)} height={openLineCoordinate(headlineHeight)} fill="none" data-anchor="headline" />
    <rect id={`${prefix}-body-${safeId(node.id)}`} x={openLineCoordinate(x)} y={openLineCoordinate(bodyY)} width={openLineCoordinate(width)} height={openLineCoordinate(bodyHeight)} fill="none" data-anchor="body" />
    <rect id={`${prefix}-metadata-${safeId(node.id)}`} x={openLineCoordinate(x)} y={openLineCoordinate(y + height - metadataHeight)} width={openLineCoordinate(width)} height={openLineCoordinate(metadataHeight)} fill="none" data-anchor="metadata" />
  </g>;
}

function RendererDiagnostics({ geometry, prefix, theme, records }: { geometry: PathGeometry; prefix: string; theme: ReturnType<typeof resolveOpenLineTheme>; records: ReadonlyArray<PathRecord> }) {
  const collisionIds = new Set(geometry.diagnostics.unresolvedCollisions.flatMap((collision) => collision.ids));
  const laneXs = [...new Set(geometry.branches.filter((branch) => branch.visible).map((branch) => geometry.nodes.find((node) => node.branchKey === branch.key)?.point.x).filter((x): x is number => typeof x === "number").map(openLineCoordinate))];
  return <g id={`${prefix}-diagnostics`} data-layer="diagnostics" pointerEvents="none" aria-hidden="true">
    <rect x={openLineCoordinate(geometry.contentBounds.x)} y={openLineCoordinate(geometry.contentBounds.y)} width={openLineCoordinate(geometry.contentBounds.width)} height={openLineCoordinate(geometry.contentBounds.height)} fill="none" stroke={theme.gold} strokeWidth="1" strokeDasharray="5 5" opacity="0.6" />
    {laneXs.map((x) => <line key={`lane-${x}`} x1={x} y1={openLineCoordinate(geometry.contentBounds.y)} x2={x} y2={openLineCoordinate(geometry.contentBounds.y + geometry.contentBounds.height)} stroke={theme.border} strokeWidth="1" strokeDasharray="2 6" data-diagnostic="lane" />)}
    {records.map(({ segment, d }) => <g key={`control-${segment.id}`} data-diagnostic="control-points" data-branch-id={segment.branchKey}>
      <path d={`M${openLineCoordinateText(segment.curve.start.x)} ${openLineCoordinateText(segment.curve.start.y)}L${openLineCoordinateText(segment.curve.control1.x)} ${openLineCoordinateText(segment.curve.control1.y)}M${openLineCoordinateText(segment.curve.control2.x)} ${openLineCoordinateText(segment.curve.control2.y)}L${openLineCoordinateText(segment.curve.end.x)} ${openLineCoordinateText(segment.curve.end.y)}`} fill="none" stroke={theme.border} strokeWidth="1" strokeDasharray="2 3" />
      <circle cx={openLineCoordinate(segment.curve.control1.x)} cy={openLineCoordinate(segment.curve.control1.y)} r="2.5" fill={theme.paper} stroke={theme.mineral} strokeWidth="1" />
      <circle cx={openLineCoordinate(segment.curve.control2.x)} cy={openLineCoordinate(segment.curve.control2.y)} r="2.5" fill={theme.paper} stroke={theme.mineral} strokeWidth="1" />
      <use href={`#${prefix}-curve-${safeId(segment.id)}`} fill="none" stroke={theme.gold} strokeWidth="0.5" opacity="0.42" />
    </g>)}
    {geometry.nodes.map((node) => <g key={`bounds-${node.id}`} data-diagnostic="node-bounds" data-branch-id={node.branchKey}>
      <rect x={openLineCoordinate(node.bounds.x)} y={openLineCoordinate(node.bounds.y)} width={openLineCoordinate(node.bounds.width)} height={openLineCoordinate(node.bounds.height)} fill="none" stroke={collisionIds.has(node.id) ? theme.clay : theme.mineral} strokeWidth="1" strokeDasharray="3 3" />
      {node.labelBounds.width > 0 && <rect x={openLineCoordinate(node.labelBounds.x)} y={openLineCoordinate(node.labelBounds.y)} width={openLineCoordinate(node.labelBounds.width)} height={openLineCoordinate(node.labelBounds.height)} fill="none" stroke={collisionIds.has(node.id) ? theme.clay : theme.gold} strokeWidth="1" strokeDasharray="4 4" opacity="0.7" />}
    </g>)}
  </g>;
}

function OpenLineRendererComponent({
  geometry,
  theme: themeInput = "light",
  quality = "high",
  interactive = false,
  showLabels = true,
  showWaypoint = true,
  showFuture = true,
  showBranches = true,
  showDiagnostics = false,
  markerStates,
  decorativeMarkers = false,
  clusterDetail = "public",
  showClusterCounts = false,
  background = "transparent",
  title = "Your Open Line",
  description = "A visual path of completed steps, current direction, and future possibilities.",
  className,
  idPrefix,
  motionPlan,
  motionLayer = "current",
}: OpenLineRendererProps) {
  const instanceId = useId();
  const prefix = safeId(idPrefix ?? `open-line-${instanceId}`);
  const theme = resolveOpenLineTheme(themeInput);
  const records = pathRecords(geometry);
  const visibleRecords = records.filter(({ segment }) => segmentVisible(segment, geometry, showFuture, showBranches));
  const nodes = geometry.nodes.filter((node) => nodeVisible(node, geometry, showFuture, showBranches));
  const waypointId = geometry.currentWaypointNodeId;
  const markerNodes = nodes.filter((node) => showWaypoint || node.id !== waypointId);
  const visibleSegmentIds = new Set(visibleRecords.map(({ segment }) => segment.id));
  const recordsById = new Map(records.map((record) => [record.segment.id, record]));
  const titleId = `${prefix}-title`;
  const descriptionId = `${prefix}-description`;

  const renderState = (state: PathGeometrySegment["state"], layer: string) => <g id={`${prefix}-${layer}`} data-path-state={state}>
    {visibleRecords.filter(({ segment }) => segment.state === state).map((record) => <SegmentPath
      key={record.segment.id}
      record={record}
      theme={theme}
      quality={quality}
      elementId={`${prefix}-segment-${safeId(record.segment.id)}`}
      curveId={`${prefix}-curve-${safeId(record.segment.id)}`}
      fadeMaskId={record.segment.state === "closed" ? `${prefix}-closed-mask-${safeId(record.segment.id)}` : undefined}
    />)}
  </g>;

  return <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox={`0 0 ${geometry.width} ${geometry.height}`}
    width="100%"
    height="auto"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-labelledby={`${titleId} ${descriptionId}`}
    tabIndex={0}
    focusable="true"
    className={className}
    data-open-line-renderer=""
    data-geometry-version={geometry.version}
    data-layout-mode={geometry.layoutMode}
    data-theme={theme.name}
    data-quality={quality}
    data-motion-layer={motionLayer}
    data-motion-plan-signature={motionPlan?.deterministicSignature}
    data-motion-transition={motionPlan?.transitionKind}
    shapeRendering="geometricPrecision"
  >
    <title id={titleId}>{title}</title>
    <desc id={descriptionId}>{description}</desc>
    <defs>
      <path id={`${prefix}-canonical-marker-aperture`} d={openLineAperturePath} data-canonical-marker-aperture="" />
      <filter id={`${prefix}-soft-shadow`} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={theme.ink} floodOpacity={theme.dark ? 0.24 : 0.12} />
      </filter>
      <filter id={`${prefix}-soft-blur`} x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="1.25" />
      </filter>
      <mask id={`${prefix}-aperture-mask`} maskUnits="userSpaceOnUse" x="-16" y="-16" width="32" height="36">
        <rect x="-16" y="-16" width="32" height="36" fill={theme.paper} />
        <use href={`#${prefix}-canonical-marker-aperture`} fill="none" stroke={theme.ink} strokeWidth="2" />
      </mask>
      <clipPath id={`${prefix}-viewport-clip`}>
        <rect x="0" y="0" width={geometry.width} height={geometry.height} />
      </clipPath>
      {records.map((record) => <path key={record.segment.id} id={`${prefix}-curve-${safeId(record.segment.id)}`} d={record.d} data-open-line-curve="" />)}
      {records.filter(({ segment }) => segment.state === "closed").map(({ segment }) => <g key={`fade-${segment.id}`}>
        <linearGradient id={`${prefix}-closed-gradient-${safeId(segment.id)}`} gradientUnits="userSpaceOnUse" x1={openLineCoordinate(segment.curve.control2.x)} y1={openLineCoordinate(segment.curve.control2.y)} x2={openLineCoordinate(segment.curve.end.x)} y2={openLineCoordinate(segment.curve.end.y)}>
          <stop offset="0" stopColor={theme.ink} stopOpacity="1" />
          <stop offset="0.58" stopColor={theme.ink} stopOpacity="1" />
          <stop offset="1" stopColor={theme.ink} stopOpacity="0.08" />
        </linearGradient>
        <mask id={`${prefix}-closed-mask-${safeId(segment.id)}`} maskUnits="userSpaceOnUse" x="0" y="0" width={geometry.width} height={geometry.height} style={{ maskType: "alpha" }}>
          <rect x="0" y="0" width={geometry.width} height={geometry.height} fill={`url(#${prefix}-closed-gradient-${safeId(segment.id)})`} />
        </mask>
      </g>)}
      {geometry.intersections.map((intersection) => <clipPath key={intersection.id} id={`${prefix}-intersection-clip-${safeId(intersection.id)}`}>
        <circle cx={openLineCoordinate(intersection.point.x)} cy={openLineCoordinate(intersection.point.y)} r="11" />
      </clipPath>)}
    </defs>
    <g id={`${prefix}-background`} data-layer="background" aria-hidden="true">
      <rect x="0" y="0" width={geometry.width} height={geometry.height} fill={background === "paper" ? theme.paper : "none"} />
    </g>
    <g id={`${prefix}-paths`} data-layer="paths" clipPath={`url(#${prefix}-viewport-clip)`}>
      {renderState("future", "future-paths")}
      {renderState("completed", "completed-paths")}
      {renderState("current", "current-paths")}
    </g>
    <g id={`${prefix}-branches`} data-layer="branches" clipPath={`url(#${prefix}-viewport-clip)`}>
      {renderState("alternate", "alternate-paths")}
      {renderState("paused", "paused-paths")}
      {renderState("closed", "closed-paths")}
    </g>
    <g id={`${prefix}-validation`} data-layer="validation" clipPath={`url(#${prefix}-viewport-clip)`}>
      {renderState("validated", "validation-paths")}
      {geometry.validationAxes.filter((axis) => markerNodes.some((node) => node.id === axis.nodeId)).map((axis) => <line key={axis.id} id={`${prefix}-validation-axis-${safeId(axis.id)}`} x1={openLineCoordinate(axis.start.x)} y1={openLineCoordinate(axis.start.y)} x2={openLineCoordinate(axis.end.x)} y2={openLineCoordinate(axis.end.y)} stroke={theme.gold} strokeWidth={quality === "standard" ? 1.5 : 1.8} strokeLinecap="round" data-validation-axis="" data-node-id={axis.nodeId} aria-hidden="true" />)}
    </g>
    <g id={`${prefix}-intersections`} data-layer="intersections" aria-hidden="true">
      {geometry.intersections.filter((intersection) => visibleSegmentIds.has(intersection.foregroundSegmentId) && visibleSegmentIds.has(intersection.backgroundSegmentId)).map((intersection) => {
        const foreground = recordsById.get(intersection.foregroundSegmentId);
        if (!foreground) return null;
        return <g key={intersection.id} id={`${prefix}-intersection-${safeId(intersection.id)}`} clipPath={`url(#${prefix}-intersection-clip-${safeId(intersection.id)})`} data-intersection-id={intersection.id} data-intersection-kind={intersection.kind} data-foreground-segment-id={intersection.foregroundSegmentId} data-background-segment-id={intersection.backgroundSegmentId}>
          <use href={`#${prefix}-curve-${safeId(foreground.segment.id)}`} fill="none" stroke={theme.paper} strokeWidth={pathWidth(foreground.segment.state, quality) + 5} strokeLinecap="round" />
          <use href={`#${prefix}-curve-${safeId(foreground.segment.id)}`} fill="none" stroke={pathColor(foreground.segment.state, theme)} strokeWidth={pathWidth(foreground.segment.state, quality)} strokeLinecap="round" />
        </g>;
      })}
    </g>
    <g id={`${prefix}-markers`} data-layer="markers">
      {markerNodes.map((node) => <OpenLineMarker
        key={node.id}
        id={`${prefix}-marker-${safeId(node.id)}`}
        node={node}
        theme={theme}
        apertureHref={`#${prefix}-canonical-marker-aperture`}
        interactionState={markerStates?.[node.id] ?? "default"}
        interactive={interactive}
        decorative={interactive || decorativeMarkers}
        clusterDetail={clusterDetail}
        showClusterCount={showClusterCounts}
      />)}
    </g>
    <g id={`${prefix}-labels`} data-layer="labels">
      {showLabels && markerNodes.map((node) => <LabelAnchors key={node.id} node={node} prefix={prefix} />)}
    </g>
    <g id={`${prefix}-interaction`} data-layer="interaction">
      {markerNodes.map((node) => <rect
        key={node.id}
        id={`${prefix}-interaction-${safeId(node.id)}`}
        x={openLineCoordinate(node.point.x - openLineMarkerInteractionSize / 2)}
        y={openLineCoordinate(node.point.y - openLineMarkerInteractionSize / 2)}
        width={openLineMarkerInteractionSize}
        height={openLineMarkerInteractionSize}
        rx="8"
        fill="transparent"
        pointerEvents={interactive ? "all" : "none"}
        tabIndex={interactive ? 0 : -1}
        focusable={interactive ? "true" : "false"}
        role={interactive ? "button" : undefined}
        aria-label={interactive ? getOpenLineMarkerAccessibleLabel(node, clusterDetail) : undefined}
        aria-disabled={interactive && markerStates?.[node.id] === "disabled" ? true : undefined}
        aria-hidden={interactive ? undefined : true}
        data-node-id={node.id}
        data-marker-kind={node.kind}
        data-interaction-target=""
      />)}
    </g>
    {showDiagnostics && <RendererDiagnostics geometry={geometry} prefix={prefix} theme={theme} records={visibleRecords} />}
  </svg>;
}

export const OpenLineRenderer = memo(OpenLineRendererComponent);
