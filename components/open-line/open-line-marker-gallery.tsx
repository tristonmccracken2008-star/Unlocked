import type { PathGeometryNode, PathGeometryNodeKind } from "@/data/open-line";
import { OpenLineEventGlyph, type OpenLineEventGlyphType } from "./open-line-event-glyphs";
import { MarkerAperture, openLineAperturePath } from "./open-line-marker-primitives";
import { openLineMarkerSizes, openLineMarkerStrokes, type OpenLineMarkerSize } from "./open-line-marker-tokens";
import { OpenLineMarker, openLineMarkerDefinitions } from "./open-line-markers";
import { openLineDarkTheme, openLineLightTheme, type OpenLineThemeTokens } from "./open-line-theme";

const markerKinds: PathGeometryNodeKind[] = ["origin", "explored", "chosen", "active", "submitted", "validated", "accepted", "completed", "waypoint", "future", "paused", "closed", "junction", "endpoint"];
const glyphTypes: OpenLineEventGlyphType[] = ["application", "interview", "research", "scholarship", "experience", "skill", "completion"];
const galleryNames: Record<PathGeometryNodeKind, string> = {
  origin: "Origin",
  explored: "Explored",
  chosen: "Chosen",
  active: "Active",
  submitted: "Submitted",
  validated: "Validated",
  accepted: "Accepted",
  completed: "Completed",
  waypoint: "Waypoint",
  future: "Future",
  paused: "Paused",
  closed: "Closed",
  junction: "Rejoined",
  endpoint: "Open end",
};
const galleryMeanings: Record<PathGeometryNodeKind, string> = {
  origin: "Journey begins",
  explored: "Viewed or saved",
  chosen: "Added deliberately",
  active: "Work started",
  submitted: "Commitment made",
  validated: "Outside response",
  accepted: "Opportunity received",
  completed: "Experience gained",
  waypoint: "Recommended next",
  future: "Plausible direction",
  paused: "Intentionally paused",
  closed: "Direction ended",
  junction: "Paths came together",
  endpoint: "Journey stays open",
};

const monochromeTheme: OpenLineThemeTokens = {
  name: "light",
  paper: "#ffffff",
  ink: "#141414",
  forest: "#202020",
  deepForest: "#000000",
  gold: "#4a4a4a",
  mineral: "#666666",
  clay: "#777777",
  neutral: "#888888",
  border: "#b8b8b8",
  dark: false,
};

function galleryNode(kind: PathGeometryNodeKind, x: number, y: number, id: string, cluster?: PathGeometryNode["cluster"]): PathGeometryNode {
  return {
    id,
    sourceEventIds: [],
    branchKey: "gallery",
    kind,
    point: { x, y },
    bounds: { x: x - 22, y: y - 22, width: 44, height: 44 },
    labelBounds: { x: x - 60, y: y + 28, width: 120, height: 48 },
    chronologicalIndex: 0,
    importance: 0,
    labelSide: "right",
    visualPriority: kind === "validated" || kind === "accepted" || kind === "completed" ? "validation" : kind === "waypoint" ? "meaningful" : kind === "explored" || kind === "future" ? "quiet" : "normal",
    cluster,
  };
}

function ThemeGallery({ theme, y, prefix, apertureHref }: { theme: OpenLineThemeTokens; y: number; prefix: string; apertureHref: string }) {
  return <g data-gallery-theme={theme.dark ? "dark" : "light"}>
    <rect x="24" y={y} width="1152" height="330" rx="8" fill={theme.paper} stroke={theme.border} strokeWidth="1" />
    <text x="54" y={y + 38} fill={theme.ink} fontFamily="system-ui, sans-serif" fontSize="18" fontWeight="650">{theme.dark ? "Dark theme" : "Light theme"}</text>
    <text x="54" y={y + 62} fill={theme.neutral} fontFamily="system-ui, sans-serif" fontSize="12">Canonical progress states at production size</text>
    {markerKinds.map((kind, index) => {
      const column = index % 7;
      const row = Math.floor(index / 7);
      const x = 102 + column * 161;
      const markerY = y + 126 + row * 124;
      const node = galleryNode(kind, x, markerY, `${prefix}-${kind}`);
      return <g key={kind}>
        <OpenLineMarker id={`${prefix}-marker-${kind}`} node={node} theme={theme} apertureHref={apertureHref} />
        <text x={x} y={markerY + 34} fill={theme.ink} fontFamily="system-ui, sans-serif" fontSize="11" fontWeight="650" textAnchor="middle">{galleryNames[kind]}</text>
        <text x={x} y={markerY + 50} fill={theme.neutral} fontFamily="system-ui, sans-serif" fontSize="9" textAnchor="middle">{galleryMeanings[kind]}</text>
        <text x={x} y={markerY + 65} fill={theme.neutral} fontFamily="system-ui, sans-serif" fontSize="8" textAnchor="middle">{openLineMarkerSizes[openLineMarkerDefinitions[kind].size]}px</text>
      </g>;
    })}
  </g>;
}

export function OpenLineMarkerGallery() {
  const apertureId = "open-line-marker-gallery-aperture";
  const apertureHref = `#${apertureId}`;
  const monoKinds: PathGeometryNodeKind[] = ["explored", "chosen", "active", "submitted", "validated", "completed"];
  const sizeTokens: OpenLineMarkerSize[] = ["trace", "small", "origin", "standard", "waypoint"];
  return <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1200 1260"
    width="100%"
    height="auto"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-labelledby="open-line-marker-gallery-title open-line-marker-gallery-description"
    data-open-line-marker-gallery=""
  >
    <title id="open-line-marker-gallery-title">UnlockED Open Line marker system</title>
    <desc id="open-line-marker-gallery-description">A developer gallery of progress markers, interaction states, event glyphs, themes, and accessibility variants.</desc>
    <defs><path id={apertureId} d={openLineAperturePath} data-canonical-marker-aperture="" /></defs>
    <rect x="0" y="0" width="1200" height="1260" fill={openLineLightTheme.paper} />
    <text x="24" y="38" fill={openLineLightTheme.ink} fontFamily="Georgia, serif" fontSize="28" fontWeight="700">Open Line marker language</text>
    <text x="24" y="64" fill={openLineLightTheme.neutral} fontFamily="system-ui, sans-serif" fontSize="13">Progress state lives in the marker. Event type lives beside the label.</text>
    <ThemeGallery theme={openLineLightTheme} y={88} prefix="gallery-light" apertureHref={apertureHref} />
    <ThemeGallery theme={openLineDarkTheme} y={438} prefix="gallery-dark" apertureHref={apertureHref} />

    <g data-gallery-section="monochrome">
      <rect x="24" y="788" width="748" height="206" rx="8" fill={monochromeTheme.paper} stroke={openLineLightTheme.border} />
      <text x="48" y="822" fill={monochromeTheme.ink} fontFamily="system-ui, sans-serif" fontSize="16" fontWeight="650">Monochrome hierarchy</text>
      <text x="48" y="844" fill={monochromeTheme.neutral} fontFamily="system-ui, sans-serif" fontSize="11">Construction, not color, carries progress.</text>
      {monoKinds.map((kind, index) => {
        const x = 92 + index * 124;
        const node = galleryNode(kind, x, 900, `mono-${kind}`);
        return <g key={kind}>
          <OpenLineMarker id={`gallery-mono-${kind}`} node={node} theme={monochromeTheme} apertureHref={apertureHref} />
          <text x={x} y="940" fill={monochromeTheme.ink} fontFamily="system-ui, sans-serif" fontSize="10" textAnchor="middle">{kind}</text>
        </g>;
      })}
    </g>

    <g data-gallery-section="interaction">
      <rect x="792" y="788" width="384" height="206" rx="8" fill={openLineLightTheme.paper} stroke={openLineLightTheme.border} />
      <text x="816" y="822" fill={openLineLightTheme.ink} fontFamily="system-ui, sans-serif" fontSize="16" fontWeight="650">Interaction infrastructure</text>
      {(["hover", "focus-visible", "selected", "disabled"] as const).map((state, index) => {
        const x = 840 + index * 96;
        const node = galleryNode("chosen", x, 900, `interaction-${state}`);
        return <g key={state}>
          <OpenLineMarker id={`gallery-interaction-${state}`} node={node} theme={openLineLightTheme} apertureHref={apertureHref} interactionState={state} interactive />
          <text x={x} y="940" fill={openLineLightTheme.ink} fontFamily="system-ui, sans-serif" fontSize="9" textAnchor="middle">{state}</text>
        </g>;
      })}
    </g>

    <g data-gallery-section="details">
      <rect x="24" y="1014" width="1152" height="222" rx="8" fill={openLineLightTheme.paper} stroke={openLineLightTheme.border} />
      <text x="48" y="1048" fill={openLineLightTheme.ink} fontFamily="system-ui, sans-serif" fontSize="16" fontWeight="650">Sizes, clusters, rejoin, and event glyphs</text>
      {sizeTokens.map((token, index) => {
        const x = 72 + index * 72;
        return <g key={token} transform={`translate(${x} 1108)`}>
          <MarkerAperture size={token} stroke={openLineLightTheme.forest} strokeWidth={openLineMarkerStrokes[token]} apertureHref={apertureHref} />
          <text x="0" y="42" fill={openLineLightTheme.neutral} fontFamily="system-ui, sans-serif" fontSize="9" textAnchor="middle">{token}</text>
        </g>;
      })}
      <line x1="424" y1="1074" x2="424" y2="1204" stroke={openLineLightTheme.border} />
      <OpenLineMarker id="gallery-cluster-public" node={galleryNode("explored", 474, 1104, "cluster-public", { count: 7, category: "Research" })} theme={openLineLightTheme} apertureHref={apertureHref} />
      <OpenLineMarker id="gallery-cluster-private" node={galleryNode("explored", 548, 1104, "cluster-private", { count: 7, category: "Research" })} theme={openLineLightTheme} apertureHref={apertureHref} clusterDetail="private" showClusterCount />
      <text x="474" y="1150" fill={openLineLightTheme.neutral} fontFamily="system-ui, sans-serif" fontSize="9" textAnchor="middle">public cluster</text>
      <text x="548" y="1150" fill={openLineLightTheme.neutral} fontFamily="system-ui, sans-serif" fontSize="9" textAnchor="middle">private detail</text>
      <path d="M610 1070C632 1085 630 1122 654 1140M698 1070C676 1085 678 1122 654 1140" fill="none" stroke={openLineLightTheme.mineral} strokeWidth="2" strokeLinecap="round" />
      <OpenLineMarker id="gallery-rejoin" node={galleryNode("junction", 654, 1140, "rejoin-example")} theme={openLineLightTheme} apertureHref={apertureHref} />
      <text x="654" y="1174" fill={openLineLightTheme.neutral} fontFamily="system-ui, sans-serif" fontSize="9" textAnchor="middle">woven rejoin</text>
      <line x1="728" y1="1074" x2="728" y2="1204" stroke={openLineLightTheme.border} />
      {glyphTypes.map((type, index) => {
        const x = 774 + index * 55;
        return <g key={type} transform={`translate(${x} 1090)`}>
          <OpenLineEventGlyph id={`gallery-glyph-${type}`} type={type} theme={openLineLightTheme} size={22} decorative />
          <text x="11" y="52" fill={openLineLightTheme.neutral} fontFamily="system-ui, sans-serif" fontSize="8" textAnchor="middle">{type}</text>
        </g>;
      })}
    </g>
  </svg>;
}
