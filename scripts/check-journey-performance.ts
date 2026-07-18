import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { opportunities } from "../data/opportunities";
import { schools } from "../data/seed";
import type { TrackedOpportunity } from "../data/student-activity";
import type { AccountData, AuthUser } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";
import { buildJourneyEditorialProjection } from "../lib/journey-editorial";

const read = (file: string) => readFileSync(file, "utf8");
const journey = read("components/journey-editorial.tsx");
const journeyServer = read("lib/journey-editorial.ts");
const liveLine = read("components/journey-live-line.tsx");
const renderer = read("components/open-line/open-line-renderer.tsx");
const pathEntry = read("components/path-moment-entry.tsx");
const pathCreator = read("components/path-moment-creator.tsx");
const semesterEntry = read("components/semester-story-entry.tsx");
const packageJson = JSON.parse(read("package.json"));

const projectionSource = journeyServer.slice(journeyServer.indexOf("export function buildJourneyEditorialProjection"));
assert.equal((projectionSource.match(/openLineInputFromAccount\(/g) ?? []).length, 1, "Journey must adapt account data once per server projection.");
assert.match(projectionSource, /const trackedValues = Object\.values\(trackedRecords\)/, "Tracked records must be projected once and reused.");
assert.match(projectionSource, /const identity = pathMomentIdentity\(/, "Path Moment and Semester Story exports must reuse one identity projection.");
assert.doesNotMatch(projectionSource, /\[\.\.\.pathEvents\]\.sort/, "Moment selection cannot sort an event collection just to find one maximum.");

assert.equal((journey.match(/<JourneyResponsiveLine/g) ?? []).length, 0, "Journey must not hydrate an SVG renderer when the text path already communicates orientation.");
assert.match(journey, /data-journey-living-path/);
assert.doesNotMatch(journey, /path-moment-creator|path-moment-artwork/, "Heavy Path Moment modules cannot enter the initial Journey component graph.");
assert.match(pathEntry, /import\("@\/components\/path-moment-creator"\)/);
assert.match(pathEntry, /onPointerEnter=\{preload\}/);
assert.match(pathEntry, /onFocus=\{preload\}/);
assert.doesNotMatch(pathEntry, /PathMomentArtwork|XMLSerializer|canvas\.toBlob|ClipboardItem|navigator\.share/);
assert.doesNotMatch(pathCreator, /const \[open, setOpen\]/, "A closed Path Moment cannot retain a hidden dialog or artwork tree.");
assert.match(semesterEntry, /import\("@\/components\/semester-story-creator"\)/);
assert.match(semesterEntry, /onPointerEnter=\{preload\}/);
assert.match(semesterEntry, /onFocus=\{preload\}/);

assert.match(renderer, /geometryProjectionCache = new WeakMap/, "Renderer projections must be reused without retaining dead geometry.");
assert.match(renderer, /function renderProjection\(/);
assert.match(liveLine, /removeEventListener\(journeyTransformationEvent, update\)/, "Journey transition listeners must be released on unmount.");
assert.match(liveLine, /desktop\.removeEventListener\("change", update\)/);
assert.match(liveLine, /tablet\.removeEventListener\("change", update\)/);
assert.doesNotMatch(`${journey}\n${liveLine}`, /createPathGeometry|ResizeObserver|IntersectionObserver|getBoundingClientRect/, "Journey hydration cannot perform geometry or layout measurement.");

for (const dependency of ["three", "html2canvas", "dom-to-image", "framer-motion"]) {
  assert.equal(packageJson.dependencies?.[dependency], undefined, `Journey performance cannot add the heavy ${dependency} dependency.`);
}

const now = "2026-07-16T12:00:00.000Z";
const school = schools.find((item) => item.slug === "university-of-chicago") ?? schools[0];
const selected = opportunities.filter((item) => item.type === "Career").slice(0, 12);
const statuses = ["Applying", "Submitted", "Interview", "Accepted", "Completed"] as const;
const records = selected.map((opportunity, index): TrackedOpportunity => ({
  id: opportunity.id,
  status: statuses[index % statuses.length],
  savedAt: `2026-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
  updatedAt: `2026-02-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
  version: 0,
  history: [],
}));
const tracker = Object.fromEntries(records.map((record) => [record.id, record]));
const account: AccountData = {
  profile: {
    firstName: "Jordan",
    lastName: "Rivera",
    schoolSlug: school.slug,
    major: "Mathematics",
    graduationYear: "2030",
    year: "First year",
    interests: "Finance, Research",
    careerGoal: "Quantitative Finance",
    onboardingCompletedAt: now,
    updatedAt: now,
  },
  onboardingComplete: true,
  billing: defaultBillingRecord(),
  activity: { viewed: selected.map((item) => item.id), saved: selected.map((item) => item.id), claimed: [], tracked: tracker },
  savedOpportunities: records.map((record) => ({ opportunityId: record.id, savedAt: record.savedAt })),
  tracker,
  preferences: { appearance: "light", updatedAt: now },
  journeyProgress: {},
  advisor: null,
  referrals: null,
  updatedAt: now,
};
const user: AuthUser = { id: "journey-performance-student", email: "journey-performance@example.test", name: "Jordan Rivera" };
const build = () => buildJourneyEditorialProjection({ user, account, opportunities: selected, resolvedTheme: "light" });

for (let index = 0; index < 8; index += 1) build();
const durations: number[] = [];
for (let index = 0; index < 40; index += 1) {
  const started = performance.now();
  build();
  durations.push(performance.now() - started);
}
durations.sort((left, right) => left - right);
const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
const p95 = durations[Math.floor(durations.length * .95)];
const maximum = durations.at(-1) ?? 0;

// This build check catches algorithmic collapse. Strict subsystem timing remains in benchmark:open-line.
assert.ok(average < 100, `Journey projection average exceeded the catastrophic 100ms ceiling: ${average.toFixed(2)}ms.`);
assert.ok(p95 < 200, `Journey projection p95 exceeded the catastrophic 200ms ceiling: ${p95.toFixed(2)}ms.`);
assert.ok(maximum < 400, `Journey projection maximum exceeded the catastrophic 400ms ceiling: ${maximum.toFixed(2)}ms.`);

const projection = build();
assert.equal(projection.model.geometries.desktop.geometry.diagnostics.deterministicSignature.length > 0, true);
assert.equal(projection.model.pathMoments.moments.length > 0, true);
assert.equal(projection.model.semesterStories.stories.length > 0, true);

console.log(JSON.stringify({
  message: "Journey performance checks passed.",
  serverProjection: { averageMs: Number(average.toFixed(2)), p95Ms: Number(p95.toFixed(2)), maximumMs: Number(maximum.toFixed(2)) },
  initialClientBoundary: ["transition-control", "path-moment-entry", "semester-story-entry"],
  lazyModules: ["path-moment-creator", "path-moment-artwork", "semester-story-creator", "semester-story-artwork", "png-export", "clipboard", "native-share"],
  renderer: { visibleSvgCount: 0, retainedForExportsAndDiagnostics: true, cache: "weak-map-by-geometry-and-options" },
}, null, 2));
