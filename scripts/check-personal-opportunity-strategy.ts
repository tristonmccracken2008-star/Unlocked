import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import type { Opportunity } from "../data/opportunities";
import { opportunities } from "../data/opportunities";
import type { OpportunityTrackerStatus, TrackedOpportunity } from "../data/student-activity";
import type { AccountData } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";
import { buildCalendarIntelligenceModel } from "../lib/calendar-intelligence";
import { buildJourneyCalendarModel } from "../lib/journey-calendar";
import { buildPersonalOpportunityStrategy, createOpportunityStrategyContext, projectOpportunityStrategyContribution, strategyOpportunityIds } from "../lib/personal-opportunity-strategy";

const now = new Date("2026-08-20T12:00:00.000Z");
const base = opportunities.find((item) => item.type === "Research") ?? opportunities[0]!;

function opportunity(id: string, values: Partial<Opportunity> & { type: Opportunity["type"]; category: string; organization: string; career: string; deadline?: string }): Opportunity {
  const { career, deadline, ...overrides } = values;
  return {
    ...base, id, title: `${overrides.organization} ${career} Program`, description: `Verified ${career.toLowerCase()} opportunity.`,
    majors: ["Computer Science"], tags: [career, "Undergraduate"], application_deadline: deadline ?? null, deadline: deadline ?? null,
    verification_status: "verified", last_verified: "2026-08-15", ...overrides,
    metadata: { ...base.metadata, careerPaths: [career], applicationRequirements: ["Resume", "Transcript", "Recommendation"], deadlineType: deadline ? "fixed" : "not_announced", lifecycle: undefined,
      verification: { status: "verified", lastVerifiedAt: "2026-08-15", officialSourceUrl: base.official_source_url, applicationUrlVerified: true, deadlineVerified: Boolean(deadline), eligibilityVerified: true, sourceReachable: true } },
  };
}

const researchA = opportunity("strategy-research-a", { type: "Research", category: "Research", organization: "National Lab A", career: "Research", deadline: "2026-09-01" });
const researchB = opportunity("strategy-research-b", { type: "Research", category: "Research", organization: "National Lab B", career: "Research", deadline: "2026-09-04" });
const researchC = opportunity("strategy-research-c", { type: "Research", category: "Research", organization: "National Lab C", career: "Research", deadline: "2026-09-06" });
const internship = opportunity("strategy-internship", { type: "Career", category: "Internships", organization: "Software Company", career: "Software Engineering", deadline: "2026-10-15" });
const competition = opportunity("strategy-competition", { type: "Career", category: "Competitions", organization: "Data Foundation", career: "Data Science", deadline: "2026-09-03" });
const source = [researchA, researchB, researchC, internship, competition];

function tracked(item: Opportunity, status: OpportunityTrackerStatus): TrackedOpportunity {
  return { id: item.id, status, savedAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-15T12:00:00.000Z", version: 1, history: [] };
}

function account(pro: boolean): AccountData {
  const records = [tracked(researchA, "Applying"), tracked(researchB, "Applying"), tracked(researchC, "Applying"), tracked(internship, "Rejected")];
  const tracker = Object.fromEntries(records.map((record) => [record.id, record]));
  return {
    profile: { firstName: "Sam", schoolSlug: "university-of-chicago", major: "Computer Science", graduationYear: "2030", year: "First year", careerGoal: "Research", interests: "Research, software", onboardingCompletedAt: now.toISOString() },
    onboardingComplete: true, firstLaunchComplete: true, billing: pro ? { ...defaultBillingRecord(), tier: "pro", status: "active" } : defaultBillingRecord(),
    activity: { viewed: [], saved: records.map((record) => record.id), claimed: [], tracked: tracker },
    savedOpportunities: records.map((record) => ({ opportunityId: record.id, savedAt: record.savedAt })),
    watchedOpportunities: [{ opportunityId: researchA.id, watchedAt: now.toISOString(), updatedAt: now.toISOString(), version: 1 }, { opportunityId: competition.id, watchedAt: now.toISOString(), updatedAt: now.toISOString(), version: 1 }],
    tracker, preferences: { updatedAt: now.toISOString() }, journeyProgress: {}, calendarEvents: {}, applicationWorkspaces: {},
    applicationMaterials: { records: {}, associations: {}, version: 0 }, resumeLab: { experiences: {}, resumes: {}, version: 0 }, accomplishments: {},
    pathPreferences: { "research-graduate-study": { pathId: "research-graduate-study", followedAt: now.toISOString(), updatedAt: now.toISOString(), version: 1 } },
    guidance: {}, advisor: null, referrals: null, updatedAt: now.toISOString(),
  };
}

const proAccount = account(true);
const before = JSON.stringify(proAccount);
const context = createOpportunityStrategyContext({ account: proAccount, opportunities: source, now });
const calendar = buildJourneyCalendarModel({ account: proAccount, opportunities: source, now });
const calendarIntelligence = buildCalendarIntelligenceModel({ account: proAccount, opportunities: source, calendar, now });
const strategy = buildPersonalOpportunityStrategy({ context, calendar: calendarIntelligence });

assert.equal(JSON.stringify(proAccount), before, "Strategy must be a pure projection over account state.");
assert.equal(strategy.currentCount, 4, "Watch, Journey, and Application must be deduplicated by canonical opportunity id.");
assert.equal(strategy.pursuingCount, 3); assert.equal(strategy.watchingCount, 1); assert.equal(strategy.activeApplicationCount, 3);
assert.equal(strategy.typeMix.find((item) => item.label === "Research")?.count, 3);
assert.ok(strategy.similarities.some((group) => group.opportunityIds.length === 3), "Similar research applications must form one group, not repeated pairs.");
assert.ok(strategy.similarities.every((group) => !JSON.stringify(group).match(/duplicate|too many|should|optimal/i)), "Similarity must stay factual and neutral.");
assert.ok(strategy.timing.featured && strategy.timing.featured.deadlineCount === 3, "Strategy must reuse Calendar Intelligence deadline clusters.");
assert.ok(strategy.goals.some((goal) => goal.id === "research-graduate-study" && goal.currentCount > 0), "Followed Paths must use existing deterministic stage rules.");
assert.ok(!strategy.typeMix.some((item) => item.label === internship.type), "Rejected history cannot become current Strategy state.");
assert.equal(strategyOpportunityIds(proAccount).filter((id) => id === researchA.id).length, 1, "Canonical source ids must be deduplicated.");

const contribution = projectOpportunityStrategyContribution(context, competition);
assert.match(contribution.line ?? "", /First competition among your current opportunities|Adds a new field/i);
assert.equal(contribution.deadlineOverlapCount, 3);
assert.ok(contribution.details.some((item) => /within a week/i.test(item)));
assert.doesNotMatch(JSON.stringify(contribution), /better|best strategy|optimal|acceptance|success score|prestige/i);

const freeContext = createOpportunityStrategyContext({ account: account(false), opportunities: source, now });
const freeStrategy = buildPersonalOpportunityStrategy({ context: freeContext, calendar: calendarIntelligence });
assert.equal(freeStrategy.pro, false); assert.ok(freeStrategy.typeMix.length > 0 && freeStrategy.timing.summary);
assert.deepEqual(freeStrategy.similarities, []); assert.deepEqual(freeStrategy.goals, []);

const emptyAccount = account(false);
emptyAccount.activity = { viewed: [], saved: [], claimed: [], tracked: {} }; emptyAccount.tracker = {}; emptyAccount.savedOpportunities = []; emptyAccount.watchedOpportunities = [];
const empty = buildPersonalOpportunityStrategy({ context: createOpportunityStrategyContext({ account: emptyAccount, opportunities: source, now }) });
assert.equal(empty.currentCount, 0); assert.equal(empty.timing.summary, "No verified application deadlines are currently recorded.");

const stressAccount = account(true); const stressSource = opportunities.slice(0, 30);
stressAccount.tracker = Object.fromEntries(stressSource.map((item) => [item.id, tracked(item, "Applying")]));
stressAccount.activity = { viewed: [], saved: stressSource.map((item) => item.id), claimed: [], tracked: stressAccount.tracker };
stressAccount.savedOpportunities = stressSource.map((item) => ({ opportunityId: item.id, savedAt: now.toISOString() })); stressAccount.watchedOpportunities = [];
const timings: number[] = [];
for (let run = 0; run < 30; run += 1) { const started = performance.now(); const stressContext = createOpportunityStrategyContext({ account: stressAccount, opportunities: stressSource, now }); buildPersonalOpportunityStrategy({ context: stressContext }); timings.push(performance.now() - started); }
const average = timings.reduce((sum, value) => sum + value, 0) / timings.length;
const p95 = [...timings].sort((left, right) => left - right)[Math.floor(timings.length * .95)]!;
assert.ok(average < 25, `30-item Strategy projection should remain fast; average ${average.toFixed(2)}ms.`);
assert.ok(p95 < 60, `30-item Strategy projection should remain bounded; p95 ${p95.toFixed(2)}ms.`);

const journeySource = readFileSync("components/journey-command-center.tsx", "utf8");
const detailSource = readFileSync("components/opportunity-detail-experience.tsx", "utf8");
const forYouSource = readFileSync("lib/for-you-decision-intelligence.ts", "utf8");
const rootSource = readFileSync("app/page.tsx", "utf8");
assert.match(journeySource, /How your current opportunities fit together/);
assert.match(journeySource, /Current mix/); assert.match(journeySource, /Similar opportunities/); assert.match(journeySource, /Your goals/);
assert.match(detailSource, /data-strategy-context/); assert.match(detailSource, /What this adds/);
assert.match(forYouSource, /projectOpportunityStrategyContribution/);
assert.match(rootSource, /listPublishedOpportunitiesByIds\(trackedIds/);
assert.doesNotMatch(`${journeySource}\n${detailSource}`, /success score|acceptance prediction|optimal portfolio|you should diversify/i);

console.log("Personal Opportunity Strategy checks passed", { current: strategy.currentCount, similarityGroups: strategy.similarities.length, deadlineClusters: strategy.timing.clusterCount, averageMs: Number(average.toFixed(2)), p95Ms: Number(p95.toFixed(2)) });
