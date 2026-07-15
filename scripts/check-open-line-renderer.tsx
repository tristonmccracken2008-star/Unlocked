import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { renderToStaticMarkup } from "react-dom/server";
import { createPathGeometry, type PathGeometryNode, type PathGeometryNodeKind } from "../data/open-line";
import { OpenLineMarker, OpenLineRenderer, openLineLightTheme, type OpenLineThemeTokens } from "../components/open-line";
import { createLargeRendererGeometry, createRendererFixtureGeometry, rendererEvent, rendererPathprint } from "./open-line-renderer-fixtures";

const strictBenchmark = process.argv.includes("--strict-benchmark");

function render(geometry = createRendererFixtureGeometry(), props: Partial<Parameters<typeof OpenLineRenderer>[0]> = {}) {
  return renderToStaticMarkup(<OpenLineRenderer geometry={geometry} idPrefix="renderer-check" background="paper" {...props} />);
}

function ids(markup: string) {
  return [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
}

function assertSvg(markup: string) {
  assert.match(markup, /^<svg\b/);
  assert.match(markup, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(markup, /viewBox="0 0 \d+ \d+"/);
  assert.match(markup, /preserveAspectRatio="xMidYMid meet"/);
  assert.equal(markup.includes("NaN"), false);
  assert.equal(markup.includes("Infinity"), false);
  assert.equal((markup.match(/<svg\b/g) ?? []).length, (markup.match(/<\/svg>/g) ?? []).length);
}

const empty = createPathGeometry(rendererPathprint());
const emptyMarkup = render(empty);
assertSvg(emptyMarkup);
assert.match(emptyMarkup, /data-marker-kind="origin"/);
assert.match(emptyMarkup, /data-marker-kind="endpoint"/);

const single = createPathGeometry(rendererPathprint([rendererEvent("single", 0, "explored", "main")], []));
const singleMarkup = render(single);
assert.equal((singleMarkup.match(/data-open-line-marker=""/g) ?? []).length, single.nodes.length);

const desktop = createRendererFixtureGeometry("desktop");
const desktopMarkup = render(desktop, { interactive: true, showDiagnostics: true });
assertSvg(desktopMarkup);
for (const layer of ["background", "paths", "branches", "validation", "intersections", "markers", "labels", "interaction", "diagnostics"]) {
  assert.match(desktopMarkup, new RegExp(`data-layer="${layer}"`), `Missing ${layer} layer.`);
}
const layerOrder = ["background", "paths", "branches", "validation", "intersections", "markers", "labels", "interaction", "diagnostics"].map((layer) => desktopMarkup.indexOf(`data-layer="${layer}"`));
assert.deepEqual([...layerOrder].sort((a, b) => a - b), layerOrder, "SVG layers must preserve canonical paint order.");
assert.match(desktopMarkup, /<path[^>]+d="M[^" ]+ [^" ]+C/);
assert.equal((desktopMarkup.match(/data-open-line-curve=""/g) ?? []).length, desktop.segments.length, "Every geometry segment needs exactly one reusable curve definition.");
const curveDefinitions = [...desktopMarkup.matchAll(/data-open-line-curve=""[^>]*d="([^"]+)"|d="([^"]+)"[^>]*data-open-line-curve=""/g)].map((match) => match[1] ?? match[2]);
assert.equal(new Set(curveDefinitions).size, curveDefinitions.length, "Segment curve strings must not be duplicated.");
assert.match(desktopMarkup, /data-state="future"[^>]+stroke-dasharray="6 8"|stroke-dasharray="6 8"[^>]+data-state="future"/);
assert.match(desktopMarkup, /data-state="closed"[^>]+data-terminal-fade-length="48"/);
assert.match(desktopMarkup, /mask-type:alpha/);
assert.match(desktopMarkup, /data-intersection-kind="rejoin"/);
assert.match(desktopMarkup, /data-validation-axis=""/);
assert.match(desktopMarkup, /data-diagnostic="control-points"/);
assert.match(desktopMarkup, /data-diagnostic="lane"/);
assert.match(desktopMarkup, /data-label-anchor=""/);
assert.match(desktopMarkup, /data-anchor="headline"/);
assert.match(desktopMarkup, /data-anchor="body"/);
assert.match(desktopMarkup, /data-anchor="metadata"/);

const pausedEvent = rendererEvent("paused-only", 0, "paused", "career:medicine", "Medicine");
const paused = createPathGeometry(rendererPathprint([pausedEvent], [{ key: "career:medicine", label: "Medicine", eventIds: [pausedEvent.id], startedAt: pausedEvent.occurredAt!, endedAt: pausedEvent.occurredAt!, state: "paused" }]));
assert.match(render(paused), /data-state="paused"[^>]+stroke-linecap="butt"|stroke-linecap="butt"[^>]+data-state="paused"/);

const mobileMarkup = render(createRendererFixtureGeometry("mobile"));
assert.match(mobileMarkup, /data-layout-mode="mobile"/);
assert.match(mobileMarkup, /viewBox="0 0 390 /);

const darkMarkup = render(desktop, { theme: "dark" });
const lightMarkup = render(desktop, { theme: "light" });
assert.match(darkMarkup, /data-theme="dark"/);
assert.match(lightMarkup, /data-theme="light"/);
assert.notEqual(darkMarkup, lightMarkup);

const customTheme: OpenLineThemeTokens = {
  name: "light",
  paper: "var(--preview-paper)",
  ink: "var(--preview-ink)",
  forest: "var(--preview-forest)",
  deepForest: "var(--preview-deep-forest)",
  gold: "var(--preview-gold)",
  mineral: "var(--preview-mineral)",
  clay: "var(--preview-clay)",
  neutral: "var(--preview-neutral)",
  border: "var(--preview-border)",
  dark: false,
};
const customMarkup = render(desktop, { theme: customTheme, showDiagnostics: true });
for (const token of ["paper", "ink", "forest", "deep-forest", "gold", "mineral", "clay", "neutral", "border"]) assert.match(customMarkup, new RegExp(`var\\(--preview-${token}\\)`));

const semanticKinds: PathGeometryNodeKind[] = ["origin", "explored", "chosen", "active", "waypoint", "submitted", "validated", "accepted", "completed", "paused", "closed", "future", "junction", "endpoint"];
const markerNode = (kind: PathGeometryNodeKind): PathGeometryNode => ({
  id: `marker-${kind}`,
  sourceEventIds: [],
  branchKey: "main",
  kind,
  point: { x: 22, y: 22 },
  bounds: { x: 0, y: 0, width: 44, height: 44 },
  labelBounds: { x: 44, y: 0, width: 120, height: 52 },
  chronologicalIndex: 0,
  importance: 0,
  labelSide: "right",
  visualPriority: kind === "validated" || kind === "accepted" || kind === "completed" ? "validation" : kind === "waypoint" ? "meaningful" : "normal",
});
for (const kind of semanticKinds) {
  const marker = renderToStaticMarkup(<svg><OpenLineMarker id={`marker-${kind}`} node={markerNode(kind)} theme={openLineLightTheme} /></svg>);
  assert.match(marker, new RegExp(`data-marker-kind="${kind}"`));
  assert.match(marker, /<path\b/, `${kind} must be vector path artwork.`);
}

const noFuture = render(desktop, { showFuture: false });
assert.doesNotMatch(noFuture, /data-marker-kind="future"/);
const noWaypoint = render(desktop, { showWaypoint: false });
assert.doesNotMatch(noWaypoint, /data-marker-kind="waypoint"/);
const noLabels = render(desktop, { showLabels: false });
assert.doesNotMatch(noLabels, /data-label-anchor=""/);
const noBranches = render(desktop, { showBranches: false });
assert.doesNotMatch(noBranches, /data-state="alternate"|data-state="paused"|data-state="closed"/);

assert.match(desktopMarkup, /role="img"/);
assert.match(desktopMarkup, /aria-labelledby="renderer-check-title renderer-check-description"/);
assert.match(desktopMarkup, /<title id="renderer-check-title">/);
assert.match(desktopMarkup, /<desc id="renderer-check-description">/);
assert.match(desktopMarkup, /data-interaction-target=""/);
assert.match(desktopMarkup, /width="44" height="44"/);
assert.match(desktopMarkup, /tabindex="0"/i);
assert.match(desktopMarkup, /role="button"/);

const twoInstances = renderToStaticMarkup(<>
  <OpenLineRenderer geometry={desktop} background="paper" />
  <OpenLineRenderer geometry={desktop} background="paper" />
</>);
const instanceIds = ids(twoInstances);
assert.equal(new Set(instanceIds).size, instanceIds.length, "Multiple renderer instances must never duplicate SVG IDs.");

const stableA = render(desktop, { quality: "print", interactive: false });
const stableB = render(desktop, { quality: "print", interactive: false });
assert.equal(stableA, stableB, "Equivalent renderer inputs must serialize identically.");
const uniqueIds = ids(stableA);
assert.equal(new Set(uniqueIds).size, uniqueIds.length, "A renderer must not contain duplicate IDs.");
assert.equal((stableA.match(/data-segment-id="/g) ?? []).length >= desktop.segments.length, true);
assert.doesNotMatch(stableA, /style="[^";]*(?:left|top|position)/i, "Renderer cannot use HTML positioning.");
for (const coordinateMatch of stableA.matchAll(/(?:d|x|y|x1|x2|y1|y2|cx|cy)="([^"]+)"/g)) {
  assert.doesNotMatch(coordinateMatch[1], /\.\d{4,}/, "Renderer coordinates must be aligned to at most one-thousandth of a logical pixel.");
}

const large = createLargeRendererGeometry();
render(large, { showLabels: true });
const samples: number[] = [];
for (let index = 0; index < 24; index += 1) {
  const started = performance.now();
  const markup = render(large, { showLabels: true });
  samples.push(performance.now() - started);
  assert.match(markup, /data-open-line-renderer=""/);
}
samples.sort((a, b) => a - b);
const p95 = samples[Math.ceil(samples.length * 0.95) - 1];
const maximum = samples.at(-1) ?? 0;
if (strictBenchmark) {
  assert.ok(p95 < 120, `Large SVG render p95 must remain under 120ms; received ${p95.toFixed(2)}ms.`);
} else {
  assert.ok(maximum < 500, `Large SVG render exceeded the deployment catastrophic ceiling of 500ms; received ${maximum.toFixed(2)}ms.`);
}

console.log(`Open Line renderer checks passed (${strictBenchmark ? "strict benchmark" : "build-safe"}). Nodes: ${large.nodes.length}. Render p95: ${p95.toFixed(2)}ms.`);
