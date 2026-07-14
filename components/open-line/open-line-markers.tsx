import type { PathGeometryNode, PathGeometryNodeKind } from "@/data/open-line";
import { openLineCoordinateText } from "./open-line-svg";
import { MarkerAperture, MarkerCenter, MarkerVisibleBounds, ValidationRing } from "./open-line-marker-primitives";
import { openLineMarkerSizes, openLineMarkerSizeByKind, openLineMarkerStrokes, type OpenLineMarkerSize } from "./open-line-marker-tokens";
import type { OpenLineThemeTokens } from "./open-line-theme";

export type OpenLineMarkerInteractionState = "default" | "hover" | "focus-visible" | "selected" | "disabled";
export type OpenLineClusterDetail = "public" | "private";

export type OpenLineMarkerProps = {
  node: PathGeometryNode;
  theme: OpenLineThemeTokens;
  id: string;
  apertureHref?: string;
  interactionState?: OpenLineMarkerInteractionState;
  interactive?: boolean;
  decorative?: boolean;
  clusterDetail?: OpenLineClusterDetail;
  showClusterCount?: boolean;
};

type MarkerArtworkProps = Pick<OpenLineMarkerProps, "node" | "theme" | "apertureHref">;
type MarkerDefinition = {
  label: string;
  description: string;
  size: OpenLineMarkerSize;
  construction: string;
  render: (props: MarkerArtworkProps) => React.ReactNode;
};

function Aperture({ size, color, stroke, apertureHref, dashed = false }: { size: OpenLineMarkerSize | number; color: string; stroke: number; apertureHref?: string; dashed?: boolean }) {
  return <MarkerAperture size={size} stroke={color} strokeWidth={stroke} apertureHref={apertureHref} dashed={dashed} />;
}

function FilledBody({ theme, apertureHref, bodySize = 22, apertureSize = 14 }: Pick<MarkerArtworkProps, "theme" | "apertureHref"> & { bodySize?: number; apertureSize?: number }) {
  return <>
    <MarkerCenter radius={bodySize / 2} fill={theme.forest} />
    <Aperture size={apertureSize} color={theme.paper} stroke={openLineMarkerStrokes.detail} apertureHref={apertureHref} />
  </>;
}

const markerDefinitions: Readonly<Record<PathGeometryNodeKind, MarkerDefinition>> = {
  origin: {
    label: "Journey origin",
    description: "The beginning of the student journey.",
    size: "origin",
    construction: "origin-open-cradle",
    render: ({ theme, apertureHref }) => <Aperture size="origin" color={theme.forest} stroke={openLineMarkerStrokes.origin} apertureHref={apertureHref} />,
  },
  explored: {
    label: "Explored opportunity",
    description: "An opportunity was viewed or saved for consideration.",
    size: "trace",
    construction: "exploration-hollow-trace",
    render: ({ theme, apertureHref }) => <Aperture size="trace" color={theme.neutral} stroke={openLineMarkerStrokes.trace} apertureHref={apertureHref} />,
  },
  chosen: {
    label: "Opportunity chosen",
    description: "An opportunity was deliberately added to the journey.",
    size: "small",
    construction: "chosen-open-ring",
    render: ({ theme, apertureHref }) => <Aperture size="small" color={theme.forest} stroke={openLineMarkerStrokes.small} apertureHref={apertureHref} />,
  },
  active: {
    label: "Application in progress",
    description: "Work on this opportunity has begun.",
    size: "standard",
    construction: "active-ring-center",
    render: ({ theme, apertureHref }) => <>
      <Aperture size="standard" color={theme.deepForest} stroke={openLineMarkerStrokes.standard} apertureHref={apertureHref} />
      <MarkerCenter radius={3} fill={theme.deepForest} />
    </>,
  },
  waypoint: {
    label: "Current recommended step",
    description: "The next recommended action on the open path.",
    size: "waypoint",
    construction: "waypoint-double-aperture",
    render: ({ theme, apertureHref }) => <>
      <Aperture size="waypoint" color={theme.deepForest} stroke={openLineMarkerStrokes.waypoint} apertureHref={apertureHref} />
      <Aperture size={22} color={theme.deepForest} stroke={openLineMarkerStrokes.small} apertureHref={apertureHref} />
    </>,
  },
  submitted: {
    label: "Application submitted",
    description: "A real application commitment was completed.",
    size: "standard",
    construction: "submitted-filled-aperture",
    render: ({ theme, apertureHref }) => <FilledBody theme={theme} apertureHref={apertureHref} />,
  },
  validated: {
    label: "Interview or external response reached",
    description: "The student's work received meaningful outside validation.",
    size: "validation",
    construction: "validated-gold-ring",
    render: ({ theme, apertureHref }) => <>
      <ValidationRing stroke={theme.gold} strokeWidth={openLineMarkerStrokes.validation} apertureHref={apertureHref} />
      <FilledBody theme={theme} apertureHref={apertureHref} bodySize={21} apertureSize={13} />
    </>,
  },
  accepted: {
    label: "Opportunity accepted",
    description: "The student received the opportunity.",
    size: "validation",
    construction: "accepted-ring-center",
    render: ({ theme, apertureHref }) => <>
      <ValidationRing stroke={theme.gold} strokeWidth={2.25} apertureHref={apertureHref} />
      <MarkerCenter radius={9} fill={theme.forest} />
      <Aperture size={12} color={theme.paper} stroke={openLineMarkerStrokes.detail} apertureHref={apertureHref} />
    </>,
  },
  completed: {
    label: "Experience completed",
    description: "The opportunity became real experience or evidence.",
    size: "standard",
    construction: "completed-cross-strand",
    render: ({ theme, apertureHref }) => <>
      <FilledBody theme={theme} apertureHref={apertureHref} bodySize={23} apertureSize={14} />
      <path className="marker-cross-strand" data-marker-cross-strand="" d="M-10 4C-5-1 4 7 10 0" fill="none" stroke={theme.paper} strokeWidth={openLineMarkerStrokes.strand} strokeLinecap="round" />
    </>,
  },
  paused: {
    label: "Direction paused",
    description: "This direction was intentionally paused.",
    size: "small",
    construction: "paused-terminal-cap",
    render: ({ theme, apertureHref }) => <>
      <Aperture size={10} color={theme.mineral} stroke={openLineMarkerStrokes.trace} apertureHref={apertureHref} />
      <path data-marker-terminal-cap="paused" d="M-7 7H7" stroke={theme.mineral} strokeWidth={openLineMarkerStrokes.detail} strokeLinecap="butt" />
    </>,
  },
  closed: {
    label: "Direction closed",
    description: "This direction ended and is no longer being pursued.",
    size: "trace",
    construction: "closed-open-endpoint",
    render: ({ theme, apertureHref }) => <Aperture size="trace" color={theme.neutral} stroke={openLineMarkerStrokes.trace} apertureHref={apertureHref} />,
  },
  future: {
    label: "Future possibility",
    description: "A plausible direction beyond the current step.",
    size: "small",
    construction: "future-dashed-aperture",
    render: ({ theme, apertureHref }) => <Aperture size="small" color={theme.neutral} stroke={openLineMarkerStrokes.small} apertureHref={apertureHref} dashed />,
  },
  junction: {
    label: "Directions rejoined",
    description: "Two parts of the path came back together.",
    size: "small",
    construction: "rejoin-woven-aperture",
    render: ({ theme, apertureHref }) => <>
      <Aperture size="small" color={theme.forest} stroke={openLineMarkerStrokes.small} apertureHref={apertureHref} />
      <path d="M-8 4C-4 0 3 6 8 1" fill="none" stroke={theme.paper} strokeWidth="4" strokeLinecap="round" />
      <path className="marker-cross-strand" data-marker-cross-strand="" d="M-8 4C-4 0 3 6 8 1" fill="none" stroke={theme.mineral} strokeWidth={openLineMarkerStrokes.strand} strokeLinecap="round" />
    </>,
  },
  endpoint: {
    label: "Open path",
    description: "The journey remains open to what comes next.",
    size: "trace",
    construction: "open-terminal-trace",
    render: ({ theme, apertureHref }) => <Aperture size="trace" color={theme.neutral} stroke={openLineMarkerStrokes.trace} apertureHref={apertureHref} dashed />,
  },
};

function clusterLabel(node: PathGeometryNode, detail: OpenLineClusterDetail) {
  if (!node.cluster) return markerDefinitions[node.kind].label;
  return detail === "private" ? `Grouped exploration activity, ${node.cluster.count} traces` : "Grouped exploration activity";
}

export function getOpenLineMarkerAccessibleLabel(node: PathGeometryNode, detail: OpenLineClusterDetail = "public") {
  return clusterLabel(node, detail);
}

function ClusterArtwork({ node, theme, apertureHref, detail, showCount }: MarkerArtworkProps & { detail: OpenLineClusterDetail; showCount: boolean }) {
  return <g data-cluster-marker="" data-cluster-detail={detail}>
    <g transform="translate(-4 3)"><Aperture size="trace" color={theme.neutral} stroke={openLineMarkerStrokes.trace} apertureHref={apertureHref} /></g>
    <g transform="translate(4 -3)"><Aperture size="trace" color={theme.mineral} stroke={openLineMarkerStrokes.trace} apertureHref={apertureHref} /></g>
    {showCount && detail === "private" && <text x="9" y="-7" fill={theme.neutral} fontSize="8" fontFamily="system-ui, sans-serif" textAnchor="start" data-private-cluster-count="">{node.cluster?.count}</text>}
  </g>;
}

function InteractionState({ state, theme }: { state: OpenLineMarkerInteractionState; theme: OpenLineThemeTokens }) {
  return <g className="marker-focus-target" data-marker-focus-target="" data-interaction-state={state} aria-hidden="true">
    {state === "hover" && <rect x="-18" y="-18" width="36" height="36" rx="10" fill={theme.forest} opacity="0.07" stroke={theme.border} strokeWidth="1" />}
    {state === "focus-visible" && <rect x="-20" y="-20" width="40" height="40" rx="11" fill="none" stroke={theme.mineral} strokeWidth={openLineMarkerStrokes.focus} strokeDasharray="3 2" />}
    {state === "selected" && <path d="M-18-12v-5h5M13-17h5v5M18 12v5h-5M-13 17h-5v-5" fill="none" stroke={theme.forest} strokeWidth={openLineMarkerStrokes.focus} strokeLinecap="round" />}
  </g>;
}

export function getOpenLineMarkerLabel(kind: PathGeometryNodeKind) {
  return markerDefinitions[kind].label;
}

export function OpenLineMarker({
  node,
  theme,
  id,
  apertureHref,
  interactionState = "default",
  interactive = false,
  decorative = false,
  clusterDetail = "public",
  showClusterCount = false,
}: OpenLineMarkerProps) {
  const definition = markerDefinitions[node.kind as PathGeometryNodeKind];
  if (!definition) {
    if (process.env.NODE_ENV !== "production") throw new Error(`Unknown Open Line marker kind: ${String(node.kind)}`);
    return null;
  }
  const sizeToken = node.cluster ? "small" : openLineMarkerSizeByKind[node.kind];
  const visibleSize = openLineMarkerSizes[sizeToken];
  const label = clusterLabel(node, clusterDetail);
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  return <g
    id={id}
    className="marker-shell"
    data-open-line-marker=""
    data-node-id={node.id}
    data-marker-kind={node.kind}
    data-marker-size={sizeToken}
    data-visible-size={visibleSize}
    data-marker-construction={node.cluster ? "exploration-cluster" : definition.construction}
    data-branch-id={node.branchKey}
    data-visual-priority={node.visualPriority}
    data-interactive={interactive ? "true" : "false"}
    data-decorative={decorative ? "true" : "false"}
    transform={`translate(${openLineCoordinateText(node.point.x)} ${openLineCoordinateText(node.point.y)})`}
    opacity={interactionState === "disabled" ? 0.46 : 1}
    role={decorative ? undefined : "img"}
    aria-labelledby={decorative ? undefined : `${titleId} ${descriptionId}`}
    aria-hidden={decorative ? true : undefined}
  >
    {!decorative && <><title id={titleId}>{label}</title><desc id={descriptionId}>{definition.description}</desc></>}
    <InteractionState state={interactionState} theme={theme} />
    <MarkerVisibleBounds size={visibleSize} />
    {node.cluster
      ? <ClusterArtwork node={node} theme={theme} apertureHref={apertureHref} detail={clusterDetail} showCount={showClusterCount} />
      : definition.render({ node, theme, apertureHref })}
  </g>;
}

export { markerDefinitions as openLineMarkerDefinitions };
