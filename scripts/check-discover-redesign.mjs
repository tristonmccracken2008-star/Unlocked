import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const filter = read("components/opportunity-filter.tsx");
const card = read("components/opportunity-card.tsx");
const page = read("app/opportunities/page.tsx");
const api = read("app/api/opportunities/route.ts");
const catalog = read("lib/discover-catalog.ts");
const pkg = read("package.json");

for (const label of ["Discover opportunities", "Find what’s out there.", "Search results", "Opportunities", "Browse all opportunities"]) {
  assert.ok(filter.includes(label), `Discover must render ${label}.`);
}
assert.doesNotMatch(filter, /Recommended for you|Personalized by search/, "Discover must not present the generic directory as the personalized For You experience.");
assert.doesNotMatch(filter, /summaryStatuses|statusCounts|Journey summary/, "Discover must not duplicate Journey progress.");

for (const token of ["sessionStorage.setItem(storageKey", "filtersFromLocation", "window.history.replaceState", "FilterPanel", "SchoolFilter", "ResultSkeleton", "EmptyResults"]) {
  assert.ok(filter.includes(token), `Discover must preserve ${token}.`);
}

for (const token of ["sm:grid-cols-2", "xl:grid-cols-3", "role=\"dialog\"", "aria-modal=\"true\"", "event.key === \"Escape\"", "document.body.style.overflow"]) {
  assert.ok(filter.includes(token), `Discover must include responsive behavior: ${token}.`);
}

for (const option of ["Relevant", "Newest", "Deadline", "Alphabetical"]) {
  assert.ok(filter.includes(`"${option}"`), `Discover sorting must support ${option}.`);
}

for (const label of ["Opportunity", "Eligibility", "Details", "Freshman-friendly", "Remote", "Paid"]) {
  assert.ok(filter.includes(label), `Discover sidebar must include ${label}.`);
}

for (const token of ["AddToJourneyButton", "Open Opportunity", "StatusBadge", "line-clamp-2", "Deadline", "Eligibility", "Format"]) {
  assert.ok(card.includes(token) || card.includes(token.replace("Official source", "Source")), `Opportunity cards must include ${token}.`);
}
assert.doesNotMatch(card, /SaveOpportunityButton|>Save<|Save opportunity|Track this|Official source/, "Discover cards must use only Open Opportunity and Add to Journey actions.");

assert.ok(page.includes("OpportunityFilter"), "Discover page must render the redesigned filter experience.");
assert.ok(filter.includes('params.set("view", "discover")') && filter.includes('params.set("limit", String(visibleCount))'), "Discover must request bounded result windows instead of the full catalog.");
assert.ok(filter.includes("AbortController"), "Discover must cancel stale search and filter requests.");
assert.ok(filter.includes("catalogError"), "Discover must preserve a recoverable catalog error state.");
assert.ok(filter.includes("recovery.resultCount"), "Discover must offer evidence-backed zero-result recovery.");
assert.doesNotMatch(filter, /searchValue:\s*filters\.query|filterValue:\s*JSON\.stringify\(filters\)/, "Discover analytics must not record raw search or filter state.");
assert.ok(api.includes("buildDiscoverCatalog"), "The opportunity API must provide the server-side Discover projection.");
assert.ok(catalog.includes("sorted.slice(0, query.limit)"), "The Discover projection must enforce its visible result limit.");
for (const token of ["prepareSearchQuery", "searchScore", "synonymGroups", "editDistanceWithin", "zeroResultRecovery", "isCanonicalCatalogOpportunity"]) {
  assert.ok(catalog.includes(token), `Discover search must preserve ${token}.`);
}
assert.ok(pkg.includes("check:discover"), "Package scripts must include the Discover regression check.");
assert.doesNotMatch(filter, /Advanced filters|Best matches|divide-y divide-ink\/10/, "Discover must not use the old advanced-filter/list-row layout.");

console.log("Discover redesign checks passed.");
