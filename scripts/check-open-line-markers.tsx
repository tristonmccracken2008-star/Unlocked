import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { renderToStaticMarkup } from "react-dom/server";
import type { PathGeometryNode, PathGeometryNodeKind } from "../data/open-line";
import {
  OpenLineEventGlyph,
  OpenLineMarker,
  OpenLineMarkerGallery,
  OpenLineRenderer,
  openLineAperturePath,
  openLineLightTheme,
  openLineMarkerDefinitions,
  openLineMarkerInteractionSize,
  openLineMarkerSizeByKind,
  openLineMarkerSizes,
  type OpenLineEventGlyphType,
  type OpenLineMarkerInteractionState,
  type OpenLineThemeTokens,
} from "../components/open-line";
import { createLargeRendererGeometry, createRendererFixtureGeometry } from "./open-line-renderer-fixtures";

const strictBenchmark = process.argv.includes("--strict-benchmark");

const kinds: PathGeometryNodeKind[] = ["origin", "explored", "chosen", "active", "waypoint", "submitted", "validated", "accepted", "completed", "paused", "closed", "future", "junction", "endpoint"];
const glyphs: OpenLineEventGlyphType[] = ["application", "interview", "research", "scholarship", "experience", "skill", "completion"];

const tokenTheme: OpenLineThemeTokens = {
  name: "light",
  paper: "PAPER_TOKEN",
  ink: "INK_TOKEN",
  forest: "FOREST_TOKEN",
  deepForest: "DEEP_FOREST_TOKEN",
  gold: "GOLD_TOKEN",
  mineral: "MINERAL_TOKEN",
  clay: "CLAY_TOKEN",
  neutral: "NEUTRAL_TOKEN",
  border: "BORDER_TOKEN",
  dark: false,
};

function markerNode(kind: PathGeometryNodeKind, options: { cluster?: number; id?: string } = {}): PathGeometryNode {
  return {
    id: options.id ?? `marker-${kind}`,
    sourceEventIds: [],
    branchKey: "marker-check",
    kind,
    point: { x: 24, y: 24 },
    bounds: { x: 2, y: 2, width: 44, height: 44 },
    labelBounds: { x: 48, y: 0, width: 120, height: 48 },
    chronologicalIndex: 0,
    importance: 0,
    labelSide: "right",
    visualPriority: kind === "validated" || kind === "accepted" || kind === "completed" ? "validation" : kind === "waypoint" ? "meaningful" : kind === "explored" || kind === "future" ? "quiet" : "normal",
    cluster: options.cluster ? { count: options.cluster, category: "Research" } : undefined,
  };
}

function renderMarker(kind: PathGeometryNodeKind, options: { theme?: OpenLineThemeTokens; interactionState?: OpenLineMarkerInteractionState; decorative?: boolean; cluster?: number; clusterDetail?: "public" | "private"; showClusterCount?: boolean } = {}) {
  const apertureId = `aperture-${kind}`;
  return renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <defs><path id={apertureId} d={openLineAperturePath} data-canonical-marker-aperture="" /></defs>
    <OpenLineMarker
      id={`check-${kind}`}
      node={markerNode(kind, { cluster: options.cluster })}
      theme={options.theme ?? openLineLightTheme}
      apertureHref={`#${apertureId}`}
      interactionState={options.interactionState}
      decorative={options.decorative}
      clusterDetail={options.clusterDetail}
      showClusterCount={options.showClusterCount}
    />
  </svg>);
}

assert.deepEqual(Object.keys(openLineMarkerDefinitions).sort(), [...kinds].sort(), "The marker mapping must exhaust every geometry node kind without a generic fallback.");
const accessibleLabels = new Set<string>();
for (const kind of kinds) {
  const markup = renderMarker(kind, { theme: tokenTheme });
  const expectedSize = openLineMarkerSizes[openLineMarkerSizeByKind[kind]];
  assert.match(markup, new RegExp(`data-marker-kind="${kind}"`));
  assert.match(markup, new RegExp(`data-visible-size="${expectedSize}"`));
  assert.match(markup, new RegExp(`data-marker-visible-bounds=""[^>]+width="${expectedSize}"[^>]+height="${expectedSize}"`));
  assert.equal((markup.match(/data-canonical-marker-aperture=""/g) ?? []).length, 1);
  assert.match(markup, new RegExp(`href="#aperture-${kind}"`), `${kind} must reuse the canonical aperture primitive.`);
  assert.match(markup, /role="img"/);
  assert.match(markup, new RegExp(`aria-labelledby="check-${kind}-title check-${kind}-description"`));
  const label = markup.match(new RegExp(`<title id="check-${kind}-title">([^<]+)</title>`))?.[1];
  assert.ok(label, `${kind} needs a deterministic accessible title.`);
  assert.equal(accessibleLabels.has(label), false, `${kind} needs a unique semantic label.`);
  accessibleLabels.add(label);
  if (kind !== "validated" && kind !== "accepted") assert.equal(markup.includes("GOLD_TOKEN"), false, `${kind} cannot consume scarce validation gold.`);
}

assert.equal(openLineMarkerSizes.trace, 8);
assert.equal(openLineMarkerSizes.small, 16);
assert.equal(openLineMarkerSizes.origin, 20);
assert.equal(openLineMarkerSizes.standard, 24);
assert.equal(openLineMarkerSizes.waypoint, 32);
assert.equal(openLineMarkerSizes.validation, 32);
assert.equal(openLineMarkerInteractionSize, 44);

const explored = renderMarker("explored");
const chosen = renderMarker("chosen");
const active = renderMarker("active");
const submitted = renderMarker("submitted");
const validated = renderMarker("validated");
const accepted = renderMarker("accepted");
const completed = renderMarker("completed");
const waypoint = renderMarker("waypoint");
const future = renderMarker("future");
const paused = renderMarker("paused");
const closed = renderMarker("closed");
assert.doesNotMatch(explored, /data-marker-center/);
assert.doesNotMatch(chosen, /data-marker-center/);
assert.match(active, /data-marker-center=""[^>]+r="3"/);
assert.match(submitted, /data-marker-center=""/);
assert.match(validated, /class="marker-validation-ring"/);
assert.match(accepted, /class="marker-validation-ring"/);
assert.match(completed, /data-marker-cross-strand=""/);
assert.equal((waypoint.match(/data-marker-aperture=""/g) ?? []).length, 2, "Waypoint needs a double aperture without a target-ring metaphor.");
assert.match(future, /stroke-dasharray=/);
assert.match(paused, /data-marker-terminal-cap="paused"/);
assert.doesNotMatch(paused, /M-2\.5-2v7/, "Paused marker cannot use a media-pause glyph.");
assert.doesNotMatch(closed, /data-marker-cross-strand|data-marker-terminal-cap|GOLD_TOKEN|#f00|red/i);

const constructions = kinds.map((kind) => openLineMarkerDefinitions[kind].construction);
assert.equal(new Set(constructions).size, constructions.length, "Marker states must retain distinct structural constructions in monochrome.");
const monochromeTheme: OpenLineThemeTokens = { ...tokenTheme, paper: "WHITE", ink: "BLACK", forest: "BLACK", deepForest: "BLACK", gold: "GRAY", mineral: "GRAY", clay: "GRAY", neutral: "GRAY", border: "GRAY" };
for (const kind of kinds) assert.match(renderMarker(kind, { theme: monochromeTheme }), new RegExp(`data-marker-construction="${openLineMarkerDefinitions[kind].construction}"`));

for (const state of ["default", "hover", "focus-visible", "selected", "disabled"] as const) {
  const markup = renderMarker("chosen", { interactionState: state });
  assert.match(markup, new RegExp(`data-interaction-state="${state}"`));
  if (state === "focus-visible") assert.match(markup, /class="marker-focus-target"[^>]*>[\s\S]*stroke-dasharray="3 2"/);
  if (state === "selected") assert.match(markup, /M-18-12v-5h5/);
  if (state === "disabled") assert.match(markup, /opacity="0\.46"/);
}

const decorative = renderMarker("submitted", { decorative: true });
assert.match(decorative, /aria-hidden="true"/);
assert.doesNotMatch(decorative, /role="img"|<title|<desc/);

const publicCluster = renderMarker("explored", { cluster: 9, clusterDetail: "public", showClusterCount: true });
assert.match(publicCluster, /data-cluster-marker=""/);
assert.match(publicCluster, />Grouped exploration activity</);
assert.doesNotMatch(publicCluster, /data-private-cluster-count|9 traces/);
const privateCluster = renderMarker("explored", { cluster: 9, clusterDetail: "private", showClusterCount: true });
assert.match(privateCluster, /Grouped exploration activity, 9 traces/);
assert.match(privateCluster, /data-private-cluster-count="">9</);

for (const type of glyphs) {
  const markup = renderToStaticMarkup(<OpenLineEventGlyph type={type} id={`glyph-${type}`} />);
  assert.match(markup, new RegExp(`data-open-line-event-glyph="${type}"`));
  assert.match(markup, /stroke-width="1\.5"/);
  assert.doesNotMatch(markup, /<img|emoji|lucide|material/i);
}

const geometry = createRendererFixtureGeometry();
const renderer = renderToStaticMarkup(<OpenLineRenderer geometry={geometry} idPrefix="marker-integration" interactive background="paper" markerStates={{ [geometry.currentWaypointNodeId!]: "focus-visible" }} />);
assert.equal((renderer.match(/data-canonical-marker-aperture=""/g) ?? []).length, 1, "Production renderer must define the canonical aperture only once.");
assert.equal((renderer.match(/data-open-line-marker=""/g) ?? []).length, geometry.nodes.length);
assert.equal((renderer.match(/data-interaction-target=""/g) ?? []).length, geometry.nodes.length);
assert.equal((renderer.match(/width="44" height="44"/g) ?? []).length, geometry.nodes.length);
assert.match(renderer, /data-marker-kind="waypoint"[^>]+data-visible-size="32"/);
assert.match(renderer, /data-marker-kind="validated"[^>]+data-visible-size="32"/);
assert.doesNotMatch(renderer, /data-open-line-event-glyph/, "Event glyphs remain opt-in and outside core markers.");
assert.doesNotMatch(renderer, /data-private-cluster-count/, "Renderer defaults must remain public-safe.");

const stableA = renderToStaticMarkup(<OpenLineRenderer geometry={geometry} idPrefix="marker-stable" background="paper" />);
const stableB = renderToStaticMarkup(<OpenLineRenderer geometry={geometry} idPrefix="marker-stable" background="paper" />);
assert.equal(stableA, stableB);
const ids = [...stableA.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "Marker title and description IDs must remain unique.");

const rendererSource = readFileSync(new URL("../components/open-line/open-line-renderer.tsx", import.meta.url), "utf8");
assert.doesNotMatch(rendererSource, /createPathGeometry|buildPathprint|normalizeJourneyEvents/, "Marker integration cannot recalculate geometry or Journey state.");

const gallery = renderToStaticMarkup(<OpenLineMarkerGallery />);
assert.match(gallery, /data-open-line-marker-gallery=""/);
for (const section of ["monochrome", "interaction", "details"]) assert.match(gallery, new RegExp(`data-gallery-section="${section}"`));
for (const type of glyphs) assert.match(gallery, new RegExp(`data-open-line-event-glyph="${type}"`));

const large = createLargeRendererGeometry(220);
renderToStaticMarkup(<OpenLineRenderer geometry={large} idPrefix="marker-performance-warmup" />);
const samples: number[] = [];
for (let index = 0; index < 20; index += 1) {
  const started = performance.now();
  renderToStaticMarkup(<OpenLineRenderer geometry={large} idPrefix="marker-performance" />);
  samples.push(performance.now() - started);
}
samples.sort((a, b) => a - b);
const p95 = samples[Math.ceil(samples.length * 0.95) - 1];
const maximum = samples.at(-1) ?? 0;
if (strictBenchmark) {
  assert.ok(p95 < 120, `220-node marker renderer p95 must remain under 120ms; received ${p95.toFixed(2)}ms.`);
} else {
  assert.ok(maximum < 500, `220-node marker renderer exceeded the deployment catastrophic ceiling of 500ms; received ${maximum.toFixed(2)}ms.`);
}

console.log(`Open Line marker checks passed (${strictBenchmark ? "strict benchmark" : "build-safe"}). States: ${kinds.length}. Glyphs: ${glyphs.length}. Render p95: ${p95.toFixed(2)}ms.`);
