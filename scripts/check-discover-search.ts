import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { opportunities } from "../data/opportunities";
import { buildDiscoverCatalog, type DiscoverCatalogQuery } from "../lib/discover-catalog";

const baseQuery: DiscoverCatalogQuery = {
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

const exact = buildDiscoverCatalog(opportunities, { ...baseQuery, query: "ASA DataFest" });
assert.equal(exact.opportunities[0]?.title, "ASA DataFest", "An exact title match must rank first.");

const acronym = buildDiscoverCatalog(opportunities, { ...baseQuery, query: "cs internship" });
assert.ok(acronym.total > 0, "A common major acronym must resolve to relevant opportunities.");
assert.ok(acronym.opportunities.some((item) => /software|science|computer/i.test(`${item.title} ${item.description} ${item.majors.join(" ")}`)), "CS search must return a computer-science-related result.");

const typo = buildDiscoverCatalog(opportunities, { ...baseQuery, query: "scholrship" });
assert.ok(typo.total > 0, "A one-character scholarship typo must still return results.");
assert.ok(typo.opportunities.slice(0, 5).every((item) => item.type === "Scholarship" || /scholar/i.test(`${item.title} ${item.category}`)), "Typo tolerance must remain relevant.");

const natural = buildDiscoverCatalog(opportunities, { ...baseQuery, query: "first generation scholarship" });
assert.ok(natural.total > 0 && natural.total < typo.total, "Multi-term intent must narrow rather than broaden the catalog.");
assert.match(natural.opportunities[0]?.title ?? "", /generation|scholar|cooke|alger/i, "Natural-language intent must prioritize a relevant result.");

const collegeFunding = buildDiscoverCatalog(opportunities, { ...baseQuery, query: "money for college" });
assert.ok(collegeFunding.total > 0, "Goal-based funding language must resolve to scholarships.");
assert.ok(collegeFunding.opportunities.slice(0, 8).every((item) => item.type === "Scholarship"), "Money-for-college intent must not broaden into unrelated catalog records.");

const reu = buildDiscoverCatalog(opportunities, { ...baseQuery, query: "REU" });
assert.ok(reu.total > 0, "The common REU acronym must find undergraduate research programs.");
assert.ok(reu.opportunities.slice(0, 5).some((item) => /REU|Research Experiences for Undergraduates/i.test(`${item.title} ${item.description}`)), "REU results must preserve precise acronym relevance.");

const fixtures: [string, RegExp][] = [
  ["Google internship", /Google/i],
  ["freshman finance", /Trading|Citadel|finance|street|Invest/i],
  ["quant", /Trading|IMC|Citadel|Jane Street|Modeling/i],
  ["full scholarship", /Scholarship/i],
  ["biology research", /Research|Science|Laboratory/i],
  ["remote software engineering", /Software|Engineering|Developer|STEM/i],
  ["Chicago summer program", /Chicago|Data Science/i],
  ["competition cash prize", /Competition|Prize|Kaggle/i],
  ["Googel internship", /Google/i],
  ["no GPA requirement", /Internship|Scholarship|Fellowship/i],
  ["women in STEM scholarships", /Women|Scholarship|STEM/i],
  ["paid summer research", /Research|Laborator|Science|NIST|MIT|Stanford|Naval/i],
  ["economics research", /Research|Economics|Economic|Elicit|Data/i],
  ["clinical research", /Research|Clinical|Health|Medical|Science/i],
];
for (const [query, expected] of fixtures) {
  const result = buildDiscoverCatalog(opportunities, { ...baseQuery, query });
  assert.ok(result.total > 0, `${query} must return at least one useful result.`);
  assert.match(result.opportunities.slice(0, 3).map((item) => item.title).join(" "), expected, `${query} must prioritize a clearly relevant result.`);
}

const zero = buildDiscoverCatalog(opportunities, { ...baseQuery, type: "AI", category: "Scholarships" });
assert.equal(zero.total, 0, "The conflict fixture must remain a true zero-result state.");
assert.ok(zero.recovery && zero.recovery.resultCount > 0, "Zero-result recovery must be backed by a real result count.");

const repeated = buildDiscoverCatalog(opportunities, { ...baseQuery, query: "quant internship" });
const repeatedAgain = buildDiscoverCatalog(opportunities, { ...baseQuery, query: "quant internship" });
assert.deepEqual(repeated.opportunities.map((item) => item.id), repeatedAgain.opportunities.map((item) => item.id), "Search ordering must be deterministic.");
assert.equal(new Set(repeated.opportunities.map((item) => item.id)).size, repeated.opportunities.length, "Canonical results must not contain duplicates.");
const newest = buildDiscoverCatalog(opportunities, { ...baseQuery, sort: "Newest", limit: 64 });
assert.ok(newest.opportunities.every((item) => !["archived", "broken_source"].includes(item.verification_status)), "Archived and broken-source records must never enter the public Discover projection.");
const defaultResults = buildDiscoverCatalog(opportunities, { ...baseQuery, limit: 64 });
assert.ok(defaultResults.opportunities.slice(0, 16).every((item) => !["expired", "temporarily_closed"].includes(item.verification_status)), "Closed opportunities must not dominate default results.");
assert.ok(defaultResults.opportunities.slice(0, 16).filter((item) => item.verification_status === "verified").length >= 12, "Trusted records must dominate the default first page.");
assert.ok(Object.values(defaultResults.facets.explorationCounts).some((count) => count > 0), "Blank exploration must expose evidence-backed catalog paths.");

const deadlineSorted = buildDiscoverCatalog(opportunities, { ...baseQuery, sort: "Deadline", limit: 64 });
const datedDeadlineResults = deadlineSorted.opportunities.filter((item) => item.application_deadline);
assert.ok(datedDeadlineResults.every((item) => item.metadata.verification?.deadlineVerified === true), "Deadline sort must not elevate unconfirmed dates.");

for (let index = 0; index < 4; index += 1) buildDiscoverCatalog(opportunities, { ...baseQuery, query: "software internship" });
const durations = Array.from({ length: 20 }, (_, index) => {
  const startedAt = performance.now();
  buildDiscoverCatalog(opportunities, { ...baseQuery, query: index % 2 ? "quant internship" : "scholrship" });
  return performance.now() - startedAt;
});
const average = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
const maximum = Math.max(...durations);
const p95 = [...durations].sort((left, right) => left - right)[Math.ceil(durations.length * 0.95) - 1];
assert.ok(average < 80, `Full-catalog search average must stay under 80ms; received ${average.toFixed(2)}ms.`);
assert.ok(p95 < 120, `Full-catalog search p95 must stay under 120ms; received ${p95.toFixed(2)}ms.`);
assert.ok(maximum < 180, `Full-catalog search must stay under 180ms; received ${maximum.toFixed(2)}ms.`);

console.log(`Discover search checks passed (average ${average.toFixed(2)}ms, p95 ${p95.toFixed(2)}ms, max ${maximum.toFixed(2)}ms).`);
