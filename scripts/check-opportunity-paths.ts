import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import type { AccountData } from "../lib/account-types";
import type { Opportunity } from "../data/opportunities";
import { defaultBillingRecord } from "../lib/billing";

Reflect.set(process.env, "NODE_ENV", "test");
process.env.AUTH_SECRET = "opportunity-paths-regression-secret-with-sufficient-length";
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { opportunities } = await import("../data/opportunities");
const { auditRecommendationSafety } = await import("../data/recommendation-safe-catalog");
const { opportunityPaths, opportunityPathIds } = await import("../data/opportunity-paths");
const {
  buildOpportunityPathIndex,
  buildOpportunityPathModel,
  buildOpportunityPathsLandingModel,
  opportunityMatchesPathStage,
  opportunityPathCoverage,
} = await import("../lib/opportunity-paths");
const auth = await import("../lib/auth-store");

const now = "2026-08-24T12:00:00.000Z";
const baseAccount = (overrides: Partial<AccountData> = {}): AccountData => ({
  profile: {
    firstName: "Taylor",
    schoolSlug: "university-of-chicago",
    schoolName: "University of Chicago",
    major: "Mathematics",
    graduationYear: "2030",
    year: "First year",
    interests: "Data Science, Research",
    careerGoal: "Quantitative Finance",
    goals: ["Find internships"],
    onboardingCompletedAt: now,
  },
  onboardingComplete: true,
  firstLaunchComplete: true,
  billing: defaultBillingRecord(),
  activity: { viewed: [], saved: [], claimed: [], tracked: {} },
  savedOpportunities: [],
  watchedOpportunities: [],
  tracker: {},
  preferences: null,
  journeyProgress: {},
  calendarEvents: {},
  applicationWorkspaces: {},
  accomplishments: {},
  pathPreferences: {},
  guidance: {},
  advisor: null,
  referrals: null,
  updatedAt: now,
  ...overrides,
});

assert.equal(opportunityPaths.length, 6, "The initial launch must remain a small, intentional Path set.");
assert.equal(new Set(opportunityPathIds).size, opportunityPathIds.length, "Path IDs must be unique.");
for (const path of opportunityPaths) {
  assert.ok(path.stages.length >= 4 && path.stages.length <= 5, `${path.name} must have a concise, path-specific structure.`);
  assert.equal(new Set(path.stages.map((stage) => stage.id)).size, path.stages.length, `${path.name} stage IDs must be unique.`);
  assert.ok(path.stages.every((stage) => stage.experienceTypes.length > 0 && stage.discoverHref.startsWith("/opportunities?")), `${path.name} must separate experience types from current Discover inventory.`);
}

const index = buildOpportunityPathIndex(opportunities);
for (const path of opportunityPaths) {
  const mapped = [...(index.get(path.id)?.values() ?? [])].flat();
  assert.equal(new Set(mapped.map((item) => item.id)).size, mapped.length, `${path.name} must assign an opportunity to only one stage within that Path.`);
  assert.ok(mapped.length >= 2, `${path.name} is too sparse to launch truthfully.`);
  for (const opportunity of mapped) assert.equal(auditRecommendationSafety(opportunity).safe, true, `${opportunity.id} must remain recommendation-safe.`);
}

const signature = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const firstCoverage = opportunityPathCoverage(opportunities);
assert.equal(signature(firstCoverage), signature(opportunityPathCoverage(opportunities)), "Path projection must be deterministic.");

const medicalBase = opportunities.find((item) => auditRecommendationSafety(item).safe) ?? opportunities[0]!;
const medicalFixture: Opportunity = {
  ...medicalBase,
  id: "fixture-medical-clinical-program",
  title: "Clinical medicine program",
  organization: "University Medical Center",
  type: "Career",
  category: "Healthcare",
  majors: ["Biology", "Pre-Med"],
  tags: ["Medicine", "Clinical"],
  metadata: { ...medicalBase.metadata, careerPaths: ["Medicine"] },
};
const quant = opportunityPaths.find((path) => path.id === "quantitative-data")!;
assert.equal(quant.stages.some((stage) => opportunityMatchesPathStage(medicalFixture, stage)), false, "A medical fixture must never enter the Quant & Data Path.");
const financeCompetition: Opportunity = {
  ...medicalFixture,
  id: "fixture-finance-competition",
  title: "Finance competition",
  category: "Competitions",
  majors: ["Finance", "Economics"],
  tags: ["Modeling", "Finance"],
  metadata: { ...medicalFixture.metadata, careerPaths: ["Finance"] },
};
assert.equal(quant.stages.some((stage) => opportunityMatchesPathStage(financeCompetition, stage)), true, "Structured finance competition metadata must enter the Quant & Data Path.");

const quantIndex = index.get(quant.id)!;
const active = [...quantIndex.values()].flat()[0]!;
assert.ok(active, "The Quant & Data Path requires a deterministic activity fixture.");
const tracked = { id: active.id, status: "Applying" as const, savedAt: now, updatedAt: now, version: 1, history: [] };
const activeAccount = baseAccount({
  activity: { viewed: [], saved: [active.id], claimed: [], tracked: { [active.id]: tracked } },
  savedOpportunities: [{ opportunityId: active.id, savedAt: now }],
  tracker: { [active.id]: tracked },
  watchedOpportunities: [{ opportunityId: active.id, watchedAt: now, updatedAt: now, version: 1 }],
});
const freeModel = buildOpportunityPathModel({ path: quant, account: activeAccount, opportunities, pro: false });
const proModel = buildOpportunityPathModel({ path: quant, account: activeAccount, opportunities, pro: true });
assert.ok(freeModel.profileRelated, "A Quantitative Finance profile must map naturally to the Quant & Data Path.");
assert.ok(freeModel.stages.every((stage) => stage.opportunities.length <= 1), "Free Paths must remain useful without exposing the full projection.");
assert.ok(proModel.stages.every((stage) => stage.opportunities.length <= 3), "Pro Paths must remain curated rather than becoming a catalog dump.");
assert.ok(proModel.journeyCount >= 1, "Journey activity must be projected from the existing tracking source.");
assert.equal(Object.keys(activeAccount.tracker ?? {}).length, 1, "Building a Path must not mutate Journey.");
assert.equal(buildOpportunityPathsLandingModel({ account: activeAccount, opportunities, pro: false }).related[0]?.id, quant.id, "Profile-related Paths must be surfaced without creating a new goal record.");

const runId = randomUUID().replaceAll("-", "");
const userA = await auth.upsertUser({ googleSub: `path-a-${runId}`, email: `path-a-${runId}@example.test`, name: "Path A" });
const userB = await auth.upsertUser({ googleSub: `path-b-${runId}`, email: `path-b-${runId}@example.test`, name: "Path B" });
const followed = await auth.updateFollowedOpportunityPath(userA.id, quant.id, true);
assert.equal(followed.changed, true);
assert.equal(followed.record?.pathId, quant.id);
assert.equal((await auth.updateFollowedOpportunityPath(userA.id, quant.id, true)).changed, false, "Following must be idempotent.");
assert.equal(Boolean((await auth.readAccountData(userB.id)).pathPreferences?.[quant.id]), false, "Follow state must remain account-scoped.");
await auth.mergeAccountData(userA.id, { pathPreferences: {} });
assert.equal(Boolean((await auth.readAccountData(userA.id)).pathPreferences?.[quant.id]), true, "Generic account writes must not bypass the dedicated Path mutation.");
assert.equal((await auth.updateFollowedOpportunityPath(userA.id, quant.id, false)).record, null);
await auth.deleteAccount(userA.id);
await auth.deleteAccount(userB.id);
assert.deepEqual((await auth.readAccountData(userA.id)).pathPreferences, {}, "Account deletion must remove followed Path state.");

const samples: number[] = [];
for (let run = 0; run < 80; run += 1) {
  const started = performance.now();
  const model = buildOpportunityPathsLandingModel({ account: activeAccount, opportunities, pro: true });
  assert.equal(model.all.length, opportunityPaths.length);
  samples.push(performance.now() - started);
}
samples.sort((left, right) => left - right);
const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
const p95Ms = samples[Math.ceil(samples.length * .95) - 1]!;
assert.ok(p95Ms < 100, `Warm six-Path projection must remain under 100ms p95; received ${p95Ms.toFixed(2)}ms.`);

const source = (path: string) => readFileSync(path, "utf8");
const followRoute = source("app/api/paths/follow/route.ts");
for (const requirement of ["assertSameOrigin(request)", "getSession", "enforceRateLimit", "readBoundedJson", "updateFollowedOpportunityPath"]) assert.match(followRoute, new RegExp(requirement.replace(/[()]/g, "\\$&")));
assert.doesNotMatch(followRoute, /body\.(userId|accountId)|searchParams\.get\(["']user/);
assert.match(source("app/api/account/export/route.ts"), /followedPaths/);
assert.match(source("lib/account-input.ts"), /cleanAccountDataInput/);
assert.doesNotMatch(source("lib/account-input.ts"), /pathPreferences/, "Generic account input must not accept Path follow state.");
assert.match(source("components/header.tsx"), /Opportunity Paths/);
assert.match(source("components/learn-unlocked.tsx"), /How UnlockED fits together/);
assert.match(source("docs/UNLOCKED_PRODUCT_MODEL.md"), /Paths[\s\S]*How can opportunities connect to a goal/);
assert.doesNotMatch(source("data/opportunity-paths.ts"), /description\.includes|title\.includes|description\.match|title\.match/, "Path mapping must not use opportunity prose substring rules.");

console.log(JSON.stringify({
  message: "Opportunity Paths structure, safety, state reuse, account isolation, and performance checks passed.",
  coverage: firstCoverage,
  averageMs: Number(averageMs.toFixed(2)),
  p95Ms: Number(p95Ms.toFixed(2)),
  paths: opportunityPaths.length,
}, null, 2));
