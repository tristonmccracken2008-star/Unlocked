import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { inferApplicationsFromActivity } from "../data/student-progress";
import type { Opportunity } from "../data/opportunities";

const read = (path: string) => readFileSync(path, "utf8");
const detail = read("app/opportunities/[id]/page.tsx");
const contentStore = read("lib/content-store.ts");
const header = read("components/header.tsx");
const loading = read("components/loading-system.tsx");

assert.match(detail, /const getOpportunity = cache\(/, "Metadata and page rendering must share a request-local opportunity lookup.");
assert.doesNotMatch(detail, /listPublishedOpportunities\(\)/, "Opportunity details must not load the full catalog.");
assert.match(detail, /listPublishedOpportunitiesByIds\(relatedIds/, "Personal detail context must load only the student’s related opportunities.");
assert.equal((detail.match(/requireCompletedOnboarding\(\)/g) ?? []).length, 1, "Opportunity details must reuse one authorized session lookup.");
assert.match(contentStore, /seedOpportunityById = new Map/, "Single-record reads must use an indexed seed catalog fallback.");
assert.doesNotMatch(contentStore.match(/export async function getManagedOpportunity[\s\S]*?export async function getManagedRecord/)?.[0] ?? "", /listManagedRecords\(/, "Single opportunity reads must not scan all managed records.");
for (const route of ["app/opportunities/loading.tsx", "app/opportunities/[id]/loading.tsx", "app/notifications/loading.tsx", "app/profile/loading.tsx"]) assert.ok(read(route).includes("Loading"), `${route} must preserve a route-specific loading boundary.`);
for (const component of ["DiscoverPageLoading", "OpportunityDetailLoading", "NotificationsPageLoading"]) assert.ok(loading.includes(`export function ${component}`), `${component} must remain part of the loading system.`);
assert.match(header, /loadUniversalCommandCenter/);
assert.match(header, /requestIdleCallback/);
assert.match(header, /connection\?\.saveData/);
assert.match(header, /router\.prefetch\(href\)/);

const opportunities = Array.from({ length: 6_000 }, (_, index) => ({ id: `opportunity-${index}`, application_deadline: "2027-01-01" })) as Opportunity[];
const saved = Array.from({ length: 1_000 }, (_, index) => `opportunity-${index * 3}`);
for (let index = 0; index < 5; index += 1) inferApplicationsFromActivity({ viewed: [], claimed: [], tracked: {}, saved }, opportunities);
const samples: number[] = [];
for (let index = 0; index < 30; index += 1) {
  const start = performance.now();
  inferApplicationsFromActivity({ viewed: [], claimed: [], tracked: {}, saved }, opportunities);
  samples.push(performance.now() - start);
}
const sorted = [...samples].sort((left, right) => left - right);
const average = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
const p95 = sorted[Math.ceil(sorted.length * .95) - 1];
assert.ok(p95 < 25, `Indexed application inference must remain under a broad 25ms p95 ceiling; received ${p95.toFixed(2)}ms.`);

console.log("Instant-feeling UX checks passed", {
  routeSpecificLoadingBoundaries: 4,
  fullCatalogDetailScan: false,
  duplicateDetailSessionLookup: false,
  universalSearchWarmup: true,
  applicationInferenceMs: { average: Number(average.toFixed(2)), p95: Number(p95.toFixed(2)) },
});
