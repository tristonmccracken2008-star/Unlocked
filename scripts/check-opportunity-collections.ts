import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import type { AccountData } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";

Reflect.set(process.env, "NODE_ENV", "test");
const { opportunities } = await import("../data/opportunities");
const { opportunityCollections, opportunityCollectionById } = await import("../data/opportunity-collections");
const { normalizeOpportunityEligibility } = await import("../data/opportunity-eligibility-model");
const { resolveOpportunityLifecycle } = await import("../data/opportunity-lifecycle");
const { auditRecommendationSafety } = await import("../data/recommendation-safe-catalog");
const { buildCollectionDetail, buildCollectionsLanding, buildOpportunityCollectionIndex, opportunityCollectionCoverage } = await import("../lib/opportunity-collections");

const nowIso = "2026-08-24T12:00:00.000Z";
const now = new Date(nowIso);
function account(overrides: Partial<AccountData> = {}): AccountData {
  return {
    profile: {
      firstName: "Avery", schoolSlug: "university-of-chicago", schoolName: "University of Chicago", major: "Mathematics", secondaryMajor: "Computer Science", graduationYear: "2030", year: "First year", careerGoal: "Quantitative Finance", interests: "Data Science, Research", fieldInterests: ["Data Science", "Research"], specificCareerInterests: ["Quantitative Finance"], goals: ["Find internship"], topics: ["Data Science", "Research"], onboardingCompletedAt: nowIso,
      institutionType: "university", enrollmentStatus: "enrolled", degreeLevel: "undergraduate", citizenshipStatus: "us_citizen", workAuthorization: "us_authorized", transferStatus: "not_transfer", financialNeedStatus: "unknown", meritStatus: "unknown",
    },
    onboardingComplete: true, firstLaunchComplete: true, billing: defaultBillingRecord(), activity: { viewed: [], saved: [], claimed: [], tracked: {} }, savedOpportunities: [], watchedOpportunities: [], tracker: {}, preferences: null, journeyProgress: {}, calendarEvents: {}, applicationWorkspaces: {}, accomplishments: {}, pathPreferences: {}, guidance: {}, advisor: null, referrals: null, updatedAt: nowIso, ...overrides,
  };
}

assert.equal(new Set(opportunityCollections.map((item) => item.id)).size, opportunityCollections.length, "Collection IDs must be unique.");
assert.ok(opportunityCollections.every((item) => item.discoverHref.startsWith("/opportunities")), "Every collection must hand deeper browsing to Discover.");
assert.ok(opportunityCollections.every((item) => item.profileAliases !== undefined && item.factualLabel.length > 3), "Every collection requires deterministic profile aliases and factual copy.");

const index = buildOpportunityCollectionIndex(opportunities, now);
for (const member of index.safe) assert.equal(auditRecommendationSafety(member).safe, true, `${member.id} bypassed catalog safety.`);
const coverage = opportunityCollectionCoverage(opportunities, now);
const launched = coverage.filter((item) => item.readiness === "launched").map((item) => item.id);
const deferred = coverage.filter((item) => item.readiness === "deferred").map((item) => item.id);
assert.deepEqual(launched, ["first-year", "research-starter", "scholarships", "finance-quant", "computer-science", "public-service", "humanities", "international-friendly", "open-now", "deadlines-coming-up", "unexpected"]);
assert.deepEqual(deferred, ["summer", "competitions", "transfer-friendly", "next-cycle"]);
for (const item of coverage.filter((candidate) => candidate.readiness === "deferred")) assert.ok(item.blockers.length, `${item.id} must remain hidden for an explicit quality reason.`);

const members = (id: string) => index.members.get(id) ?? [];
assert.ok(members("first-year").every((item) => normalizeOpportunityEligibility(item).classYears.some((year) => year === "First year" || year === "Any Year")), "First-year membership must be positively supported.");
assert.ok(members("international-friendly").every((item) => normalizeOpportunityEligibility(item).citizenship.some((status) => status === "international_allowed" || status === "unrestricted")), "Unknown citizenship eligibility must not enter the international collection.");
assert.ok(members("transfer-friendly").every((item) => ["transfer_specific", "explicitly_eligible"].includes(normalizeOpportunityEligibility(item).transferEligibility)), "Unknown transfer eligibility must not enter the transfer candidate.");
assert.ok(members("open-now").every((item) => resolveOpportunityLifecycle(item, now).actionable), "Open Now must contain only actionable opportunities.");
assert.ok(members("deadlines-coming-up").every((item) => item.metadata.verification?.deadlineVerified === true && Boolean(item.application_deadline)), "Deadline collections require verified dates.");
assert.ok(members("deadlines-coming-up").every((item) => {
  const days = Math.ceil((Date.parse(`${item.application_deadline}T23:59:59.999Z`) - now.getTime()) / 86_400_000);
  return days >= 0 && days <= 60;
}), "Deadline collection dates must remain inside the declared window.");

const freeLanding = buildCollectionsLanding({ account: account(), opportunities, pro: false, now });
const proLanding = buildCollectionsLanding({ account: account({ billing: { ...defaultBillingRecord(), tier: "pro", status: "active" } }), opportunities, pro: true, now });
assert.equal(freeLanding.featured.length, 4);
assert.equal(proLanding.featured.length, 5);
assert.equal(freeLanding.launched.length, launched.length);
assert.equal(freeLanding.launched.some((item) => deferred.includes(item.id)), false, "Deferred candidates must never reach the UI.");
assert.equal(freeLanding.featured[0]?.profileRelated, true, "A first-year quantitative student should receive a relevant starting point first.");

const firstYear = opportunityCollectionById("first-year")!;
const freeDetail = buildCollectionDetail({ collection: firstYear, account: account(), opportunities, pro: false, now })!;
const proDetail = buildCollectionDetail({ collection: firstYear, account: account(), opportunities, pro: true, now })!;
assert.equal(freeDetail.startHere.length, 4, "Free Collections must be useful and bounded.");
assert.equal(proDetail.startHere.length, 5, "Pro adds one useful starting example without hiding the core collection.");
assert.equal(new Set(proDetail.startHere.map((item) => item.organization)).size, proDetail.startHere.length, "Start Here should prefer organization diversity.");
assert.equal(buildCollectionDetail({ collection: opportunityCollectionById("transfer-friendly")!, account: account(), opportunities, pro: true, now }), null, "Weak candidates must return no detail projection.");

const active = freeDetail.startHere[0]!;
const tracked = { id: active.id, status: "Applying" as const, savedAt: nowIso, updatedAt: nowIso, version: 1, history: [] };
const stateModel = buildCollectionDetail({
  collection: firstYear,
  account: account({ activity: { viewed: [], saved: [active.id], claimed: [], tracked: { [active.id]: tracked } }, savedOpportunities: [{ opportunityId: active.id, savedAt: nowIso }], tracker: { [active.id]: tracked }, watchedOpportunities: [{ opportunityId: active.id, watchedAt: nowIso, updatedAt: nowIso, version: 1 }] }),
  opportunities, pro: true, now,
  })!;
assert.equal([...stateModel.startHere, ...stateModel.more].find((item) => item.id === active.id)?.state, "in_journey", "Journey state must take precedence over Watch without duplication.");

const undecidedProfile = { ...account().profile!, major: "Undecided", secondaryMajor: undefined, careerGoal: "Undecided", interests: "Exploring", fieldInterests: [], specificCareerInterests: [], topics: [] };
const undecided = buildCollectionsLanding({ account: account({ profile: undecidedProfile }), opportunities, pro: false, now });
assert.ok(undecided.launched.length >= 10 && undecided.featured.every((item) => item.safe >= item.blockers.length), "Undecided students still need broad useful starting points.");
const humanitiesProfile = { ...account().profile!, major: "English", secondaryMajor: undefined, careerGoal: "Writing", interests: "Museums, Public Service", fieldInterests: ["Writing"] as never, specificCareerInterests: [], topics: ["Museums"] };
assert.ok(buildCollectionsLanding({ account: account({ profile: humanitiesProfile }), opportunities, pro: false, now }).featured.some((item) => item.id === "humanities"), "Collections must not silently become STEM-only.");
const internationalProfile = { ...account().profile!, citizenshipStatus: "international" as const };
assert.ok(buildCollectionsLanding({ account: account({ profile: internationalProfile }), opportunities, pro: true, now }).featured.some((item) => item.id === "international-friendly"), "Explicit international context should surface the strictly gated collection.");

const signature = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
assert.equal(signature(coverage), signature(opportunityCollectionCoverage(opportunities, now)), "Coverage and ordering must remain deterministic.");
assert.equal(signature(freeDetail), signature(buildCollectionDetail({ collection: firstYear, account: account(), opportunities, pro: false, now })), "Collection detail must remain deterministic.");
const samples: number[] = [];
for (let run = 0; run < 40; run += 1) {
  const started = performance.now();
  buildCollectionsLanding({ account: account(), opportunities, pro: true, now });
  buildCollectionDetail({ collection: firstYear, account: account(), opportunities, pro: true, now });
  if (run >= 5) samples.push(performance.now() - started);
}
samples.sort((left, right) => left - right);
const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
const p95Ms = samples[Math.ceil(samples.length * .95) - 1]!;
assert.ok(averageMs < 50, `Warm collection composition must remain under 50ms average; received ${averageMs.toFixed(2)}ms.`);
assert.ok(p95Ms < 100, `Warm collection composition must remain under 100ms p95; received ${p95Ms.toFixed(2)}ms.`);

const source = (path: string) => readFileSync(path, "utf8");
assert.match(source("app/collections/page.tsx"), /requireCompletedOnboarding/);
assert.match(source("app/collections/page.tsx"), /robots: \{ index: false, follow: false \}/);
assert.match(source("proxy.ts"), /"\/collections"/);
assert.doesNotMatch(source("components/opportunity-collections.tsx"), /getBoundingClientRect|ResizeObserver|perfect for you|guaranteed eligible/i);
assert.doesNotMatch(source("components/opportunity-collections.tsx"), /from "@\/data\/opportunities"|opportunities\.json/, "The collection client must never hydrate the catalog.");
assert.match(source("components/opportunity-activity.tsx"), /origin\?: "discover" \| "path" \| "explorer" \| "collection"/);
assert.match(source("app/api/journey/add/route.ts"), /"collection"/);
assert.match(source("docs/UNLOCKED_PRODUCT_MODEL.md"), /Collections[\s\S]*Where should someone in my situation start/);

console.log(JSON.stringify({ message: "Opportunity Collections safety, launch quality, state reuse, determinism, and performance checks passed.", launched, deferred: coverage.filter((item) => item.readiness === "deferred").map((item) => ({ id: item.id, blockers: item.blockers })), averageMs: Number(averageMs.toFixed(2)), p95Ms: Number(p95Ms.toFixed(2)) }, null, 2));
