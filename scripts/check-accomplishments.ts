import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import type { Opportunity } from "../data/opportunities";
import type { AccountData } from "../lib/account-types";
import type { AccomplishmentRecord } from "../data/accomplishments";
import type { TrackedOpportunity } from "../data/student-activity";
import { defaultBillingRecord } from "../lib/billing";

Reflect.set(process.env, "NODE_ENV", "test");
process.env.AUTH_SECRET = "accomplishments-regression-secret-with-sufficient-length";
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { opportunities } = await import("../data/opportunities");
const { buildAccomplishmentsModel, journeyAccomplishmentOutcome, reconcileJourneyAccomplishment } = await import("../lib/accomplishments");
const auth = await import("../lib/auth-store");
const { mutateAccomplishment, AccomplishmentMutationError } = await import("../lib/accomplishment-service");

const now = "2026-08-23T12:00:00.000Z";
const source = (path: string) => readFileSync(path, "utf8");
const find = (predicate: (opportunity: Opportunity) => boolean) => opportunities.find(predicate) ?? opportunities[0];
const career = find((item) => item.type === "Career");
const scholarship = find((item) => item.type === "Scholarship");
const research = find((item) => item.type === "Research");
const competition = find((item) => /competition|challenge|hackathon/i.test(`${item.type} ${item.category}`));

function tracked(opportunity: Opportunity, status: TrackedOpportunity["status"], professionalStageId: string): TrackedOpportunity {
  return { id: opportunity.id, status, professionalStageId, savedAt: "2026-01-02T12:00:00.000Z", updatedAt: now, version: 1, history: [{ id: `event:${professionalStageId}`, transition: status === "Completed" ? "complete" : status === "Accepted" ? "accept" : status === "Interview" ? "interview" : status === "Submitted" ? "submit" : "close", priorStatus: "Submitted", resultingStatus: status, professionalStageId, occurredAt: now, details: { source: "student_reported", milestoneDate: "2026-08-23" } }] };
}

const baseAccount = (records: TrackedOpportunity[] = [], accomplishments: AccountData["accomplishments"] = {}): AccountData => ({
  profile: null, onboardingComplete: true, firstLaunchComplete: true, billing: { ...defaultBillingRecord(), updatedAt: now }, activity: { viewed: [], saved: records.map((record) => record.id), claimed: [], tracked: Object.fromEntries(records.map((record) => [record.id, record])) }, savedOpportunities: records.map((record) => ({ opportunityId: record.id, savedAt: record.savedAt })), watchedOpportunities: [], tracker: Object.fromEntries(records.map((record) => [record.id, record])), preferences: null, journeyProgress: {}, calendarEvents: {}, applicationWorkspaces: {}, accomplishments, guidance: {}, advisor: null, referrals: null, updatedAt: now,
});

assert.equal(journeyAccomplishmentOutcome(career, tracked(career, "Accepted", "accepted")), null, "Acceptance alone must not become a career accomplishment.");
assert.equal(journeyAccomplishmentOutcome(career, tracked(career, "Completed", "completed_program")), "completed");
assert.equal(journeyAccomplishmentOutcome(scholarship, tracked(scholarship, "Accepted", "awarded")), "awarded", "Scholarship awards must not require a participation stage.");
assert.equal(journeyAccomplishmentOutcome(scholarship, tracked(scholarship, "Rejected", "not_selected")), null);
assert.equal(journeyAccomplishmentOutcome(research, tracked(research, "Completed", "research_completed")), "completed");
assert.equal(journeyAccomplishmentOutcome(competition, tracked(competition, "Submitted", "participated")), "participated");
assert.equal(journeyAccomplishmentOutcome(competition, tracked(competition, "Interview", "competition_finalist")), "finalist");
assert.equal(journeyAccomplishmentOutcome(competition, tracked(competition, "Accepted", "winner")), "won");

const completedCareer = tracked(career, "Completed", "completed_program");
const firstStore = reconcileJourneyAccomplishment({ account: baseAccount([completedCareer]), opportunity: career, record: completedCareer, now });
assert.equal(firstStore[`journey:${career.id}`]?.snapshot.title, career.title);
const renamedCareer = { ...career, title: "Renamed future catalog title" };
const secondStore = reconcileJourneyAccomplishment({ account: baseAccount([completedCareer], firstStore), opportunity: renamedCareer, record: completedCareer, now: "2026-08-24T12:00:00.000Z" });
assert.equal(secondStore[`journey:${career.id}`]?.snapshot.title, career.title, "Catalog edits must not rewrite historical identity snapshots.");
const corrected = tracked(career, "Rejected", "withdrawn");
const correctedStore = reconcileJourneyAccomplishment({ account: baseAccount([corrected], secondStore), opportunity: career, record: corrected, now: "2026-08-25T12:00:00.000Z" });
assert.ok(correctedStore[`journey:${career.id}`]?.inactiveAt, "Corrected unsuccessful outcomes must deactivate the accomplishment.");
assert.equal(buildAccomplishmentsModel({ account: baseAccount([corrected], correctedStore), opportunities: [career] }).total, 0);

const runId = crypto.randomUUID().replaceAll("-", "");
const userA = await auth.upsertUser({ googleSub: `accomplishment-a-${runId}`, email: `accomplishment-a-${runId}@example.edu`, name: "Student A" });
const userB = await auth.upsertUser({ googleSub: `accomplishment-b-${runId}`, email: `accomplishment-b-${runId}@example.edu`, name: "Student B" });
await auth.mergeAccountData(userB.id, {
  activity: { viewed: [], saved: [career.id], claimed: [], tracked: { [career.id]: completedCareer } },
  savedOpportunities: [{ opportunityId: career.id, savedAt: completedCareer.savedAt }],
  tracker: { [career.id]: completedCareer },
});
await assert.rejects(
  () => mutateAccomplishment(userB.id, {
    action: "create",
    idempotencyKey: `accomplishment:${runId}:journey-duplicate`,
    fields: { title: career.title, organization: career.organization, kind: "internship", outcome: "completed", outcomeDate: "2026-08-23" },
  }),
  (error) => error instanceof AccomplishmentMutationError && error.code === "duplicate",
  "Manual entry must not duplicate an accomplishment already derived from Journey.",
);
const created = await mutateAccomplishment(userA.id, { action: "create", idempotencyKey: `accomplishment:${runId}:create`, fields: { title: "Research Assistant", organization: "University Lab", kind: "research", outcome: "completed", outcomeDate: "2027-05-10", startDate: "2026-09-01", endDate: "2027-05-01", roleTitle: "Research Assistant", description: "Supported a year-long campus research project.", notes: "Private reminder", skills: ["Data analysis"] } });
assert.equal(created.record.source, "manual");
assert.equal((await auth.readAccountData(userB.id)).accomplishments && Object.keys((await auth.readAccountData(userB.id)).accomplishments!).length, 0, "Manual records must remain account-isolated.");
await assert.rejects(
  () => mutateAccomplishment(userB.id, { action: "remove", id: created.record.id, expectedVersion: 0, idempotencyKey: `accomplishment:${runId}:cross-account` }),
  (error) => error instanceof AccomplishmentMutationError && error.code === "not_found",
  "An account must not mutate another account's accomplishment by ID.",
);
await assert.rejects(() => mutateAccomplishment(userA.id, { action: "create", idempotencyKey: `accomplishment:${runId}:duplicate`, fields: { title: "Research Assistant", organization: "University Lab", kind: "research", outcome: "completed", outcomeDate: "2027-05-10" } }), (error) => error instanceof AccomplishmentMutationError && error.code === "duplicate");
const updated = await mutateAccomplishment(userA.id, { action: "update", id: created.record.id, expectedVersion: 0, idempotencyKey: `accomplishment:${runId}:update`, fields: { mentor: "Faculty mentor", notes: "Updated private note" } });
assert.equal(updated.record.mentor, "Faculty mentor");
await auth.updateAccountBilling(userA.id, { tier: "pro", status: "active" });
await auth.updateAccountBilling(userA.id, { tier: "free", status: "free" });
assert.equal(buildAccomplishmentsModel({ account: await auth.readAccountData(userA.id), opportunities: [] }).total, 1, "Downgrading must not hide personal records.");
const removed = await mutateAccomplishment(userA.id, { action: "remove", id: created.record.id, expectedVersion: updated.record.version, idempotencyKey: `accomplishment:${runId}:remove` });
assert.equal(removed.removed, true);
const repeatedRemove = await mutateAccomplishment(userA.id, { action: "remove", id: created.record.id, expectedVersion: updated.record.version, idempotencyKey: `accomplishment:${runId}:remove` });
assert.equal(repeatedRemove.duplicate, true, "Repeated removal must be idempotent.");
assert.equal(buildAccomplishmentsModel({ account: await auth.readAccountData(userA.id), opportunities: [] }).total, 0);

const largeRecords: Record<string, AccomplishmentRecord> = {};
for (let index = 0; index < 500; index += 1) {
  const id = `manual:performance-${index}`;
  largeRecords[id] = { id, source: "manual", snapshot: { title: `Accomplishment ${index}`, organization: `Organization ${index % 30}`, capturedAt: now }, kind: index % 2 ? "internship" : "research", outcome: "completed", outcomeDate: `${2022 + index % 5}-05-10`, hidden: false, createdAt: now, updatedAt: now, version: 0 };
}
const samples: number[] = [];
for (let run = 0; run < 40; run += 1) {
  const started = performance.now();
  const model = buildAccomplishmentsModel({ account: baseAccount([], largeRecords), opportunities: [] });
  assert.equal(model.total, 500);
  samples.push(performance.now() - started);
}
samples.sort((left, right) => left - right);
const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
const p95Ms = samples[Math.ceil(samples.length * .95) - 1]!;
assert.ok(p95Ms < 25, `500-record accomplishment projection must remain under 25ms p95; received ${p95Ms.toFixed(2)}ms.`);

const route = source("app/api/accomplishments/route.ts");
for (const requirement of ["assertSameOrigin(request)", "getSession", "enforceRateLimit", "readBoundedJson", "withSecurityLock"]) assert.ok(route.includes(requirement) || source("lib/accomplishment-service.ts").includes(requirement));
assert.doesNotMatch(route, /body\.(userId|accountId)|searchParams\.get\(["']user/);
assert.match(source("lib/public-account.ts"), /accomplishments: undefined/, "Private accomplishment notes must not enter generic client account sync.");
assert.doesNotMatch(source("lib/account-input.ts").match(/export function cleanAccountDataInput[\s\S]*$/)?.[0] ?? "", /accomplishments/, "Generic account writes must not bypass the dedicated accomplishment mutation service.");
assert.match(source("app/api/account/export/route.ts"), /accomplishments/);
assert.match(source("components/accomplishments.tsx"), /visible only to you|Private notes|View Journey history/);
assert.doesNotMatch(source("components/accomplishments.tsx"), /followers|likes|leaderboard|Experience Score/i);

await auth.deleteAccount(userA.id);
await auth.deleteAccount(userB.id);
assert.equal(Object.keys((await auth.readAccountData(userA.id)).accomplishments ?? {}).length, 0, "Account deletion must remove accomplishment data.");
console.log(JSON.stringify({ message: "Accomplishments lifecycle, privacy, account isolation, downgrade, and performance checks passed.", lifecycleCases: 11, manualCrud: true, accountIsolation: true, records: 500, averageMs: Number(averageMs.toFixed(2)), p95Ms: Number(p95Ms.toFixed(2)) }, null, 2));
