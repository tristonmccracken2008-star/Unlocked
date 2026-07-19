import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const filter = read("components/opportunity-filter.tsx");
const card = read("components/opportunity-card.tsx");
const page = read("app/opportunities/page.tsx");
const api = read("app/api/opportunities/route.ts");
const catalog = read("lib/discover-catalog.ts");
const pkg = read("package.json");

for (const label of ["Discover opportunities", "Find the right opportunity.", "Search results", "Opportunities", "Browse all opportunities"]) {
  assert.ok(filter.includes(label), `Discover must render ${label}.`);
}
assert.doesNotMatch(filter, /Recommended for you|Personalized by search/, "Discover must not present the generic directory as the personalized For You experience.");

for (const token of ["sessionStorage.setItem(storageKey", "readStoredFilters", "FilterPanel", "SchoolFilter", "ResultSkeleton", "EmptyResults"]) {
  assert.ok(filter.includes(token), `Discover must preserve ${token}.`);
}

for (const token of ["sm:grid-cols-2", "xl:grid-cols-3", "2xl:grid-cols-4", "role=\"dialog\"", "aria-modal=\"true\""]) {
  assert.ok(filter.includes(token), `Discover must include responsive behavior: ${token}.`);
}

for (const option of ["Relevant", "Newest", "Deadline", "Alphabetical"]) {
  assert.ok(filter.includes(`"${option}"`), `Discover sorting must support ${option}.`);
}

for (const label of ["Category", "Fit", "Details", "Freshman-friendly", "Remote", "Paid"]) {
  assert.ok(filter.includes(label), `Discover sidebar must include ${label}.`);
}

for (const token of ["AddToJourneyButton", "Open Opportunity", "StatusBadge", "line-clamp-3"]) {
  assert.ok(card.includes(token) || card.includes(token.replace("Official source", "Source")), `Opportunity cards must include ${token}.`);
}
assert.doesNotMatch(card, /SaveOpportunityButton|>Save<|Save opportunity|Track this|Official source/, "Discover cards must use only Open Opportunity and Add to Journey actions.");

assert.ok(page.includes("OpportunityFilter"), "Discover page must render the redesigned filter experience.");
assert.ok(filter.includes('view: "discover"'), "Discover must request bounded result windows instead of the full catalog.");
assert.ok(filter.includes("AbortController"), "Discover must cancel stale search and filter requests.");
assert.ok(filter.includes("catalogError"), "Discover must preserve a recoverable catalog error state.");
assert.ok(api.includes("buildDiscoverCatalog"), "The opportunity API must provide the server-side Discover projection.");
assert.ok(catalog.includes("sorted.slice(0, query.limit)"), "The Discover projection must enforce its visible result limit.");
assert.ok(pkg.includes("check:discover"), "Package scripts must include the Discover regression check.");
assert.doesNotMatch(filter, /Advanced filters|Best matches|divide-y divide-ink\/10/, "Discover must not use the old advanced-filter/list-row layout.");

console.log("Discover redesign checks passed.");
