import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import type { AccountData } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";

Reflect.set(process.env, "NODE_ENV", "test");
const { opportunities } = await import("../data/opportunities");
const { auditRecommendationSafety } = await import("../data/recommendation-safe-catalog");
const { explorerAreas, explorerExperienceTypes } = await import("../data/opportunity-explorer");
const { buildOpportunityExplorerArea, buildOpportunityExplorerIndex, buildOpportunityExplorerLanding, opportunityExplorerCoverage } = await import("../lib/opportunity-explorer");

const now = "2026-08-24T12:00:00.000Z";
function account(overrides: Partial<AccountData> = {}): AccountData {
  return {
    profile: {
      firstName: "Avery", schoolSlug: "university-of-chicago", schoolName: "University of Chicago", major: "Mathematics", secondaryMajor: "Computer Science", graduationYear: "2030", year: "First year", careerGoal: "Quantitative Finance", interests: "Data Science, Research", fieldInterests: ["Data Science", "Research"], specificCareerInterests: ["Quantitative Finance"], goals: ["Find internship"], topics: ["Data Science", "Research"], onboardingCompletedAt: now,
      institutionType: "university", enrollmentStatus: "enrolled", degreeLevel: "undergraduate", citizenshipStatus: "us_citizen", workAuthorization: "us_authorized", transferStatus: "not_transfer", financialNeedStatus: "unknown", meritStatus: "unknown",
    },
    onboardingComplete: true, firstLaunchComplete: true, billing: defaultBillingRecord(), activity: { viewed: [], saved: [], claimed: [], tracked: {} }, savedOpportunities: [], watchedOpportunities: [], tracker: {}, preferences: null, journeyProgress: {}, calendarEvents: {}, applicationWorkspaces: {}, accomplishments: {}, pathPreferences: {}, guidance: {}, advisor: null, referrals: null, updatedAt: now, ...overrides,
  };
}

assert.equal(new Set(explorerAreas.map((area) => area.id)).size, explorerAreas.length);
assert.equal(new Set(explorerExperienceTypes.map((type) => type.id)).size, explorerExperienceTypes.length);
assert.ok(explorerAreas.length >= 7 && explorerAreas.length <= 9, "Explorer must launch with a small, intentional field set.");
for (const area of explorerAreas) {
  assert.ok(area.landscapes.length >= 4 && area.landscapes.length <= 6, `${area.name} must remain a concise landscape.`);
  assert.ok(area.landscapes.every((landscape) => landscape.discoverHref.startsWith("/opportunities?")), `${area.name} must hand deeper browsing to Discover.`);
}

const index = buildOpportunityExplorerIndex(opportunities);
for (const opportunity of index.safe) assert.equal(auditRecommendationSafety(opportunity).safe, true, `${opportunity.id} bypassed catalog safety.`);
const coverage = opportunityExplorerCoverage(opportunities);
for (const area of coverage.areas) {
  assert.ok(area.count >= 3, `${area.id} is too sparse to launch truthfully.`);
  assert.ok(area.organizations >= 2, `${area.id} lacks organization diversity.`);
  assert.ok(area.landscapes.filter((landscape) => landscape.count > 0).length >= 4, `${area.id} lacks a meaningful landscape.`);
}
for (const experience of coverage.experiences) assert.ok(experience.count > 0, `${experience.id} must have current safe inventory.`);

const free = buildOpportunityExplorerLanding({ account: account(), opportunities, pro: false });
const pro = buildOpportunityExplorerLanding({ account: account({ billing: { ...defaultBillingRecord(), tier: "pro", status: "active" } }), opportunities, pro: true });
const researchSpotlight = buildOpportunityExplorerLanding({ account: account(), opportunities, pro: false, experienceId: "research" });
assert.ok(free.related.some((area) => area.id === "mathematics-data"));
assert.ok(free.related.some((area) => area.id === "computer-science"));
assert.ok(free.serendipity && !free.serendipity.profileRelated, "Controlled serendipity must broaden rather than repeat explicit interests.");
assert.ok(pro.serendipity?.reason.startsWith("Related to "), "Pro serendipity may explain supported adjacency without becoming For You.");
assert.equal(researchSpotlight.experienceSpotlight?.name, "Research");
assert.ok(researchSpotlight.experienceSpotlight?.opportunities.length, "Experience education must lead to safe current examples before Discover.");
assert.ok(researchSpotlight.experienceSpotlight!.opportunities.length <= 2, "Free experience examples must remain bounded.");
assert.ok(free.firstYear.length > 0, "A fully specified first-year profile should receive supported first-year exploration.");
assert.ok(free.firstYear.flatMap((section) => section.opportunities).every((item) => item.eligibility === "eligible" && item.eligibilityLabel === "First-year eligibility supported"));

const undecidedProfile = { ...account().profile!, major: "Undecided", secondaryMajor: undefined, careerGoal: "Undecided", interests: "Exploring", fieldInterests: [], specificCareerInterests: [], topics: [] };
const undecided = buildOpportunityExplorerLanding({ account: account({ profile: undecidedProfile }), opportunities, pro: false });
assert.ok(undecided.experiences.length >= 6, "Undecided students must receive a useful experience-first entry point.");
const humanitiesProfile = { ...account().profile!, major: "English", secondaryMajor: undefined, careerGoal: "Writing", interests: "Museums, Public Service", fieldInterests: ["Writing"] as never, specificCareerInterests: [], topics: ["Museums"] };
const humanities = buildOpportunityExplorerLanding({ account: account({ profile: humanitiesProfile }), opportunities, pro: false });
assert.ok(humanities.related.some((area) => area.id === "humanities-communication"), "Explorer must not silently become a STEM-only product.");

const mathArea = explorerAreas.find((area) => area.id === "mathematics-data")!;
const mathModel = buildOpportunityExplorerArea({ area: mathArea, account: account(), opportunities, pro: false });
assert.ok(mathModel.landscapes.some((landscape) => landscape.id === "quantitative-finance"));
assert.equal(mathModel.path?.href, "/paths/quantitative-data");
assert.ok(mathModel.landscapes.every((landscape) => landscape.opportunities.length <= 2), "Free examples must be useful but bounded.");

const active = mathModel.landscapes.flatMap((landscape) => landscape.opportunities)[0]!;
const tracked = { id: active.id, status: "Applying" as const, savedAt: now, updatedAt: now, version: 1, history: [] };
const duplicateState = buildOpportunityExplorerArea({ area: mathArea, account: account({ activity: { viewed: [], saved: [active.id], claimed: [], tracked: { [active.id]: tracked } }, savedOpportunities: [{ opportunityId: active.id, savedAt: now }], tracker: { [active.id]: tracked }, watchedOpportunities: [{ opportunityId: active.id, watchedAt: now, updatedAt: now, version: 1 }] }), opportunities, pro: true });
assert.equal(duplicateState.landscapes.flatMap((landscape) => landscape.opportunities).find((item) => item.id === active.id)?.state, "in_journey", "Journey state must take precedence over Watch without duplication.");

const signature = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
assert.equal(signature(coverage), signature(opportunityExplorerCoverage(opportunities)), "Coverage and ordering must remain deterministic.");
const samples: number[] = [];
for (let run = 0; run < 35; run += 1) {
  const started = performance.now();
  buildOpportunityExplorerLanding({ account: account(), opportunities, pro: true });
  if (run >= 5) samples.push(performance.now() - started);
}
samples.sort((left, right) => left - right);
const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
const p95Ms = samples[Math.ceil(samples.length * .95) - 1]!;
assert.ok(averageMs < 40, `Cached Explorer projection must remain under 40ms average; received ${averageMs.toFixed(2)}ms.`);
assert.ok(p95Ms < 80, `Cached Explorer projection must remain under 80ms p95; received ${p95Ms.toFixed(2)}ms.`);

const page = readFileSync("app/explore/page.tsx", "utf8");
const component = readFileSync("components/opportunity-explorer.tsx", "utf8");
const proxy = readFileSync("proxy.ts", "utf8");
const analytics = readFileSync("lib/analytics-types.ts", "utf8");
assert.match(page, /requireCompletedOnboarding/);
assert.match(page, /robots: \{ index: false, follow: false \}/);
assert.match(proxy, /"\/explore"/);
assert.doesNotMatch(component, /getBoundingClientRect|ResizeObserver|career gap|perfect for you/i);
assert.match(analytics, /explorer_opened_v1/);
assert.match(analytics, /explorer_opened_v1: action\("[^"]+"\)/, "Explorer-open analytics must not accept profile properties.");

console.log(JSON.stringify({ message: "Opportunity Explorer taxonomy, safety, eligibility, cohesion, and performance checks passed.", safeCatalogCount: coverage.safeCatalogCount, launchAreas: coverage.areas.length, experienceTypes: coverage.experiences.length, averageMs: Number(averageMs.toFixed(2)), p95Ms: Number(p95Ms.toFixed(2)), accountWrites: 0 }, null, 2));
