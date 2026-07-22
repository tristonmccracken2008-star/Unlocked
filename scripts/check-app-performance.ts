import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { isCanonicalCatalogOpportunity } from "@/data/opportunity-catalog-canonical";
import { opportunities } from "@/data/opportunities";
import { buildDiscoverCatalog, type DiscoverCatalogQuery } from "@/lib/discover-catalog";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const primaryClients = [
  "components/opportunity-filter.tsx",
  "components/advisor-page.tsx",
  "components/personalized-home.tsx",
  "components/journey-transition-control.tsx",
];

for (const path of primaryClients) {
  const source = read(path);
  assert.doesNotMatch(source, /import \{(?!\s*type\b)[^}]*\} from "@\/data\/opportunities"/, `${path} must not import the full catalog at runtime.`);
}

const query: DiscoverCatalogQuery = {
  query: "",
  type: "All",
  category: "All",
  major: "All",
  school: "All",
  paid: "All",
  remote: "All",
  difficulty: "All",
  freshmanFriendly: false,
  deadline: "All",
  sort: "Relevant",
  limit: 16,
};

for (let index = 0; index < 3; index += 1) buildDiscoverCatalog(opportunities, query);
const samples: number[] = [];
let result = buildDiscoverCatalog(opportunities, query);
for (let index = 0; index < 20; index += 1) {
  const startedAt = performance.now();
  result = buildDiscoverCatalog(opportunities, query);
  samples.push(performance.now() - startedAt);
}

const sortedSamples = [...samples].sort((left, right) => left - right);
const p95 = sortedSamples[Math.min(sortedSamples.length - 1, Math.ceil(sortedSamples.length * 0.95) - 1)];
const average = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
const searchQuery = { ...query, query: "engineering" };
for (let index = 0; index < 3; index += 1) buildDiscoverCatalog(opportunities, searchQuery);
const searchSamples: number[] = [];
for (let index = 0; index < 20; index += 1) {
  const startedAt = performance.now();
  buildDiscoverCatalog(opportunities, searchQuery);
  searchSamples.push(performance.now() - startedAt);
}
const searchAverage = searchSamples.reduce((sum, sample) => sum + sample, 0) / searchSamples.length;
const sortedSearchSamples = [...searchSamples].sort((left, right) => left - right);
const searchP95 = sortedSearchSamples[Math.min(sortedSearchSamples.length - 1, Math.ceil(sortedSearchSamples.length * 0.95) - 1)];
const fullPayloadBytes = Buffer.byteLength(JSON.stringify({ opportunities }));
const boundedPayloadBytes = Buffer.byteLength(JSON.stringify(result));
const canonicalCatalogCount = opportunities.filter((item) => isCanonicalCatalogOpportunity(item.id)).length;

assert.equal(result.opportunities.length, 16, "Discover should return only its visible first window.");
assert.equal(result.total, canonicalCatalogCount, "Discover must preserve the complete canonical result count without duplicate source records.");
assert.ok(boundedPayloadBytes < 1_000_000, `The first Discover payload must stay below 1 MB; received ${boundedPayloadBytes} bytes.`);
assert.ok(boundedPayloadBytes < fullPayloadBytes * 0.05, "The first Discover payload must be at least 95% smaller than the old full-catalog response.");
assert.ok(p95 < 500, `Discover server projection exceeded the catastrophic 500 ms p95 ceiling: ${p95.toFixed(2)} ms.`);
assert.ok(searchP95 < 500, `Discover text search exceeded the catastrophic 500 ms p95 ceiling: ${searchP95.toFixed(2)} ms.`);

const accountSync = read("data/account-sync.ts");
const dataIndex = read("data/index.ts");
const advisorRoute = read("app/advisor/page.tsx");
const opportunityApi = read("app/api/opportunities/route.ts");
assert.match(accountSync, /if \(sessionRequest\) return sessionRequest/, "All concurrent session readers must share one in-flight request.");
assert.match(accountSync, /const session = await readAccountSession\(true\)/, "Account hydration must reuse the shared session request path.");
assert.match(dataIndex, /schoolBenefitIds = new Map/, "School data initialization must pre-index benefit eligibility.");
assert.doesNotMatch(dataIndex, /rawSchools\.map\([\s\S]*filterOpportunities\(/, "School initialization must not rescan the opportunity catalog for every institution.");
for (const path of ["components/opportunity-filter.tsx", "components/personalized-home.tsx", "components/onboarding-flow.tsx"]) {
  assert.doesNotMatch(read(path), /from "@\/data\/seed"/, `${path} must use the lightweight school directory instead of importing benefits and opportunities.`);
}
assert.doesNotMatch(read("data/profile-options.ts"), /from "\.\/opportunities"/, "Profile controls must import client-safe taxonomy without loading the catalog.");
assert.match(advisorRoute, /allowGeneration: false/, "For You server rendering must never block on recommendation generation.");
assert.ok(opportunityApi.indexOf("listPublishedOpportunitiesByIds(ids)") < opportunityApi.indexOf("listPublishedOpportunities();"), "ID lookups must complete before any full-catalog read.");

console.log(JSON.stringify({
  message: "Full-app performance architecture checks passed.",
  catalogRecords: opportunities.length,
  canonicalCatalogRecords: canonicalCatalogCount,
  oldFullPayloadBytes: fullPayloadBytes,
  boundedFirstPayloadBytes: boundedPayloadBytes,
  payloadReductionPercent: Number(((1 - boundedPayloadBytes / fullPayloadBytes) * 100).toFixed(2)),
  discoverProjectionMs: { average: Number(average.toFixed(2)), p95: Number(p95.toFixed(2)) },
  discoverSearchMs: { average: Number(searchAverage.toFixed(2)), p95: Number(searchP95.toFixed(2)) },
  sharedSessionRequest: true,
  serverSnapshotReuse: true,
}, null, 2));
