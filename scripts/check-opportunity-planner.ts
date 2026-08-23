import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Opportunity } from "../data/opportunities";
import type { RecommendationViewModel } from "../data/recommendation-service";
import type { TrackedOpportunity } from "../data/student-activity";
import type { AccountData } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";
import { buildJourneyCommandCenterModel } from "../lib/journey-command-center";
import { buildOpportunityPlanner, strongestPlannerRelationship } from "../lib/opportunity-planner";

const now = new Date("2026-08-20T16:00:00.000Z");
function opportunity(id: string, patch: Partial<Opportunity> = {}): Opportunity {
  return {
    id, title: `${id} opportunity`, organization: `${id} organization`, type: "Career", category: "Internship",
    description: "A deterministic Planner fixture.", school_scope: "National", schools: [], majors: ["All Majors"], academic_years: ["All Years"], eligibility: "Undergraduates",
    estimated_value: null, application_deadline: null, deadline: null, recurring: false, location: "United States", remote: null, paid: null, tags: ["Internship"],
    official_source: "Official source", official_source_url: "https://example.edu/opportunity", verification_status: "verified", last_verified: "2026-08-01", reviewer_notes: "", estimated_value_note: "Unknown", date_added: "2026-08-01",
    difficulty: null, prestige: null, icon: null, featured: false, hidden_gem: false,
    metadata: { deadlineType: "unknown", verification: { status: "verified", officialSourceUrl: "https://example.edu/opportunity", applicationUrlVerified: true, sourceReachable: true } }, ...patch,
  };
}
function tracked(id: string, status: TrackedOpportunity["status"] = "Applying"): TrackedOpportunity {
  return { id, status, savedAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-18T12:00:00.000Z", version: 1, history: [] };
}
const journeyOpportunity = opportunity("journey-deadline", {
  title: "Journey Internship", application_deadline: "2026-09-04", deadline: "2026-09-04",
  metadata: { deadlineType: "fixed", applicationRequirements: ["Resume", "Transcript"], verification: { status: "verified", deadlineVerified: true, officialSourceUrl: "https://example.edu/opportunity", applicationUrlVerified: true, sourceReachable: true } },
});
const recurringWatch = opportunity("recurring-watch", {
  title: "Annual Research Program", type: "Research", category: "Research", recurring: true,
  metadata: { deadlineType: "unknown", applicationRequirements: ["Resume", "Transcript", "Two references"], verification: { status: "verified", eligibilityVerified: true, officialSourceUrl: "https://example.edu/opportunity", applicationUrlVerified: true, sourceReachable: true }, lifecycle: {
    schemaVersion: 1, identity: { identityId: "annual-research" }, cycle: { cycleId: "2026" }, state: "closed", confidence: "strong",
    recurrence: { type: "annual", confidence: "strong", typicalOpeningMonth: 10 },
    events: [{ id: "historical-open", opportunityIdentityId: "annual-research", cycleId: "2026", type: "application_opened", effectiveAt: "2025-10-15T12:00:00.000Z", detectedAt: "2025-10-15T12:00:00.000Z", evidenceSource: "official_application_page", confidence: "confirmed", idempotencyKey: "historical-open" }],
  } },
});
const scholarship = opportunity("scholarship-match", { title: "Verified Scholarship", type: "Scholarship", category: "Scholarship", application_deadline: "2026-11-01", deadline: "2026-11-01", metadata: { deadlineType: "fixed", verification: { status: "verified", deadlineVerified: true, officialSourceUrl: "https://example.edu/opportunity", applicationUrlVerified: true, sourceReachable: true } } });
const competition = opportunity("competition-match", { title: "Student Competition", type: "Career", category: "Competition" });
const records = { [journeyOpportunity.id]: tracked(journeyOpportunity.id) };
const account: AccountData = {
  profile: null, onboardingComplete: true, firstLaunchComplete: true, billing: { ...defaultBillingRecord(), tier: "pro", status: "active" },
  activity: { viewed: [], saved: [journeyOpportunity.id], claimed: [], tracked: records }, savedOpportunities: [{ opportunityId: journeyOpportunity.id, savedAt: "2026-08-01T12:00:00.000Z" }],
  watchedOpportunities: [{ opportunityId: recurringWatch.id, watchedAt: "2026-08-10T12:00:00.000Z", updatedAt: "2026-08-10T12:00:00.000Z", version: 0 }, { opportunityId: journeyOpportunity.id, watchedAt: "2026-08-10T12:00:00.000Z", updatedAt: "2026-08-10T12:00:00.000Z", version: 0 }],
  tracker: records, preferences: null, journeyProgress: {}, calendarEvents: {}, applicationWorkspaces: { [journeyOpportunity.id]: {
    opportunityId: journeyOpportunity.id, tasks: {
      tomorrow: { id: "tomorrow", title: "Submit transcript", dueDate: "2026-08-21", source: "user", completed: false, createdAt: "2026-08-10T12:00:00.000Z", updatedAt: "2026-08-10T12:00:00.000Z", version: 0 },
      later: { id: "later", title: "Review essay", dueDate: "2026-08-28", source: "user", completed: false, createdAt: "2026-08-10T12:00:00.000Z", updatedAt: "2026-08-10T12:00:00.000Z", version: 0 },
    }, createdAt: "2026-08-10T12:00:00.000Z", updatedAt: "2026-08-10T12:00:00.000Z", version: 0,
  } }, guidance: {}, advisor: null, referrals: null, updatedAt: now.toISOString(),
};
const source = [journeyOpportunity, recurringWatch, scholarship, competition];
const journey = buildJourneyCommandCenterModel({ user: { id: "planner-user", name: "Planner Student" }, account, opportunities: source, activeLimit: 100, historyLimit: 1, now });
const recommendations = [scholarship, competition, journeyOpportunity].map((item) => ({ opportunity: item, href: `/opportunities/${item.id}` } as RecommendationViewModel));
const planner = buildOpportunityPlanner({ account, journey, opportunities: source, recommendations, pro: true, now });

assert.equal(strongestPlannerRelationship("Recommended", "Pursuing"), "Pursuing");
assert.equal(planner.now[0]?.label, "Submit transcript", "The nearest application task must lead Now.");
assert.equal(planner.now.filter((item) => item.opportunityId === journeyOpportunity.id && item.kind === "task").length, 1, "Planner must surface only the next application task.");
assert.equal(planner.now.filter((item) => item.opportunityId === journeyOpportunity.id && item.kind === "match").length, 0, "Journey must override Watch and Recommendation.");
assert.equal(planner.months.find((month) => month.key === "2026-09")?.events.find((item) => item.opportunityId === journeyOpportunity.id)?.date, "2026-09-04", "Planner must reuse Calendar's authoritative date.");
assert.equal(planner.months.find((month) => month.key === "2026-10")?.events.some((item) => item.opportunityId === recurringWatch.id), false, "Historical recurrence must not create a future marker.");
assert.equal(planner.watchingNextCycle[0]?.opportunityId, recurringWatch.id);
assert.equal(planner.prepareAhead[0]?.requirements.length, 3);
assert.equal(planner.mix.find((item) => item.category === "Internships")?.pursuing, 1);
assert.equal(planner.mix.find((item) => item.category === "Research")?.watching, 1);
assert.equal(planner.mix.find((item) => item.category === "Scholarships")?.recommended, 1);
assert.equal(planner.areasToExplore[0]?.category, "Scholarships");
assert.ok(planner.months.every((month) => month.events.every((item) => Boolean(item.date))));

const free = buildOpportunityPlanner({ account: { ...account, billing: defaultBillingRecord() }, journey, opportunities: source, recommendations, pro: false, now });
assert.equal(free.access, "free"); assert.equal(free.summary.watching, 0); assert.equal(free.summary.matched, 0); assert.equal(free.watchingNextCycle.length, 0);
assert.ok(free.months.some((month) => month.events.some((item) => item.opportunityId === journeyOpportunity.id)), "Free Planner must retain useful Journey dates.");

const openedWatch = { ...recurringWatch, metadata: { ...recurringWatch.metadata, lifecycle: { ...recurringWatch.metadata.lifecycle!, state: "open" as const, events: [
  ...(recurringWatch.metadata.lifecycle?.events ?? []),
  { id: "current-open", opportunityIdentityId: "annual-research", cycleId: "2027", type: "application_opened" as const, effectiveAt: "2026-08-18T12:00:00.000Z", detectedAt: "2026-08-18T12:00:00.000Z", evidenceSource: "official_application_page" as const, confidence: "confirmed" as const, idempotencyKey: "current-open" },
] } } } satisfies Opportunity;
const opened = buildOpportunityPlanner({ account, journey, opportunities: [journeyOpportunity, openedWatch, scholarship, competition], recommendations, pro: true, now });
assert.equal(opened.now.find((item) => item.opportunityId === recurringWatch.id)?.label, "Applications opened", "An authoritative watched-cycle opening must move into Now without duplicating Watch state.");
assert.equal(planner.months.some((month) => month.events.some((item) => item.opportunityId === competition.id)), false, "A recommendation with an unknown deadline cannot enter Year Ahead.");

const route = readFileSync("app/planner/page.tsx", "utf8");
assert.match(route, /requireCompletedOnboarding/); assert.match(route, /allowGeneration: false/); assert.doesNotMatch(route, /listPublishedOpportunities\(/);
assert.match(readFileSync("proxy.ts", "utf8"), /"\/planner"/, "Planner must be protected before server rendering.");
assert.doesNotMatch(readFileSync("lib/opportunity-planner.ts", "utf8"), /typicalOpeningMonth[\s\S]{0,100}normalizedValue/i);
const runs = Array.from({ length: 50 }, () => { const start = performance.now(); buildOpportunityPlanner({ account, journey, opportunities: source, recommendations, pro: true, now }); return performance.now() - start; }).sort((a, b) => a - b);
const p95 = runs[Math.floor(runs.length * .95)] ?? 0;
assert.ok(p95 < 20, `Typical Planner projection must remain below 20ms p95; received ${p95.toFixed(2)}ms.`);
const heavyOpportunities = Array.from({ length: 500 }, (_, index) => opportunity(`heavy-${index}`));
const heavyStart = performance.now();
buildOpportunityPlanner({
  account: { ...account, watchedOpportunities: heavyOpportunities.map((item) => ({ opportunityId: item.id, watchedAt: now.toISOString(), updatedAt: now.toISOString(), version: 0 })) },
  journey,
  opportunities: [journeyOpportunity, ...heavyOpportunities],
  recommendations: [],
  pro: true,
  now,
});
const heavyMs = performance.now() - heavyStart;
assert.ok(heavyMs < 100, `A 500-record Watch stress projection must remain below 100ms; received ${heavyMs.toFixed(2)}ms.`);
console.log(JSON.stringify({ message: "Opportunity Planner checks passed.", now: planner.now.length, datedEvents: planner.summary.datedEvents, p95Ms: Number(p95.toFixed(2)), heavy500Ms: Number(heavyMs.toFixed(2)) }, null, 2));
