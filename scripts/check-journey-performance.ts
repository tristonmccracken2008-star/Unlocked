import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { opportunities } from "../data/opportunities";
import { schools } from "../data/seed";
import type { TrackedOpportunity } from "../data/student-activity";
import type { AccountData, AuthUser } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";
import { buildJourneyTimelineModel } from "../lib/journey-timeline";

const read = (file: string) => readFileSync(file, "utf8");
const timeline = read("components/journey-timeline.tsx");
const timelineServer = read("lib/journey-timeline.ts");
const entry = read("components/journey-card-entry.tsx");
const creator = read("components/journey-card-creator.tsx");
const packageJson = JSON.parse(read("package.json"));

assert.match(timeline, /data-journey-timeline/);
assert.doesNotMatch(timeline, /journey-editorial|OpenLine|Pathprint|Advisor|Roadmap|Recommendation/,
  "The unified Journey surface cannot import retired coaching or geometry systems.");
assert.doesNotMatch(timelineServer, /buildJourneyEditorial|createPathGeometry|recommend|roadmap|advisor/i,
  "Journey timeline projection must remain independent from coaching and geometry work.");
assert.match(timelineServer, /const opportunityById = new Map/);
assert.match(timelineServer, /const recordsById =/);
assert.match(entry, /import\("@\/components\/journey-card-creator"\)/);
assert.match(entry, /onPointerEnter=\{preload\}/);
assert.match(entry, /onFocus=\{preload\}/);
assert.doesNotMatch(entry, /JourneyCardArtwork|XMLSerializer|canvas\.toBlob|ClipboardItem|navigator\.share/,
  "Export dependencies cannot enter the initial Journey client boundary.");
assert.match(creator, /XMLSerializer/);
assert.match(creator, /canvas\.toBlob/);
assert.match(creator, /navigator\.share/);

for (const dependency of ["three", "html2canvas", "dom-to-image", "framer-motion"]) {
  assert.equal(packageJson.dependencies?.[dependency], undefined, `Journey performance cannot add the heavy ${dependency} dependency.`);
}

const now = "2026-07-16T12:00:00.000Z";
const school = schools.find((item) => item.slug === "university-of-chicago") ?? schools[0];
const selected = opportunities.slice(0, 200);
const statuses = ["Saved", "Interested", "Applying", "Submitted", "Interview", "Accepted", "Completed", "Paused", "Rejected"] as const;
const records = selected.map((opportunity, index): TrackedOpportunity => ({
  id: opportunity.id,
  status: statuses[index % statuses.length],
  savedAt: `2025-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 27) + 1).padStart(2, "0")}T12:00:00.000Z`,
  updatedAt: `2026-${String((index % 7) + 1).padStart(2, "0")}-${String((index % 27) + 1).padStart(2, "0")}T12:00:00.000Z`,
  version: 0,
  history: [],
}));
const tracker = Object.fromEntries(records.map((record) => [record.id, record]));
const account: AccountData = {
  profile: { firstName: "Jordan", lastName: "Rivera", schoolSlug: school.slug, major: "Mathematics", graduationYear: "2030", year: "First year", interests: "Finance, Research", careerGoal: "Quantitative Finance", onboardingCompletedAt: now, updatedAt: now },
  onboardingComplete: true,
  billing: defaultBillingRecord(),
  activity: { viewed: selected.map((item) => item.id), saved: selected.map((item) => item.id), claimed: [], tracked: tracker },
  savedOpportunities: records.map((record) => ({ opportunityId: record.id, savedAt: record.savedAt })),
  tracker,
  preferences: { appearance: "light", updatedAt: now },
  journeyProgress: Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`milestone-${index + 1}`, true])),
  advisor: null,
  referrals: null,
  updatedAt: now,
};
const user: AuthUser = { id: "journey-performance-student", email: "journey-performance@example.test", name: "Jordan Rivera" };
const build = () => buildJourneyTimelineModel({ user, account, opportunities: selected, resolvedTheme: "light" });

for (let index = 0; index < 12; index += 1) build();
const durations: number[] = [];
for (let index = 0; index < 80; index += 1) {
  const started = performance.now();
  build();
  durations.push(performance.now() - started);
}
durations.sort((left, right) => left - right);
const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
const p95 = durations[Math.floor(durations.length * .95)];
const maximum = durations.at(-1) ?? 0;

assert.ok(average < 25, `Journey timeline average exceeded 25ms: ${average.toFixed(2)}ms.`);
assert.ok(p95 < 50, `Journey timeline p95 exceeded 50ms: ${p95.toFixed(2)}ms.`);
assert.ok(maximum < 150, `Journey timeline maximum exceeded the catastrophic 150ms ceiling: ${maximum.toFixed(2)}ms.`);

const model = build();
const expectedEventCount = records.length + records.filter((record) => record.status !== "Saved").length + 30;
assert.equal(model.events.length, expectedEventCount, "Large histories must preserve all canonical timeline events.");
assert.ok(model.card.highlights.length <= 4);
assert.ok(model.card.stats.length <= 6);

console.log(JSON.stringify({
  message: "Unified Journey performance checks passed.",
  input: { opportunities: selected.length, timelineEvents: model.events.length, milestones: 30 },
  timelineProjection: { averageMs: Number(average.toFixed(2)), p95Ms: Number(p95.toFixed(2)), maximumMs: Number(maximum.toFixed(2)) },
  initialClientBoundary: ["journey-card-entry", "per-record-status-control"],
  lazyModules: ["journey-card-creator", "journey-card-artwork", "png-export", "clipboard", "native-share"],
}, null, 2));
