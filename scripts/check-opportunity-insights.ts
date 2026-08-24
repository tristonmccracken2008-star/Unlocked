import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import type { ApplicationMaterialStore } from "../data/application-materials";
import type { Opportunity } from "../data/opportunities";
import type { TrackedOpportunity } from "../data/student-activity";
import type { StudentProfile } from "../data/student-profile";
import type { AccountData } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";

Reflect.set(process.env, "NODE_ENV", "test");
const { opportunities } = await import("../data/opportunities");
const { buildOpportunityInsights } = await import("../lib/opportunity-insights");
const { buildRecommendationService } = await import("../data/recommendation-service");
const { schools } = await import("../data/seed");

const now = "2026-08-24T12:00:00.000Z";
const sourceOpportunity = opportunities.find((item) => item.type === "Career") ?? opportunities[0]!;
const makeOpportunity = (index: number, type: Opportunity["type"] = "Career"): Opportunity => ({ ...sourceOpportunity, id: `insights-${index}`, title: `Opportunity ${index}`, type, category: type === "Research" ? "Research" : type === "Scholarship" ? "Scholarships" : "Internships" });
const event = (id: string, transition: "submit" | "accept" | "complete" | "close", occurredAt: string, professionalStageId?: string): NonNullable<TrackedOpportunity["history"]>[number] => ({ id, transition, priorStatus: transition === "submit" ? "Applying" : "Submitted", resultingStatus: transition === "accept" ? "Accepted" : transition === "complete" ? "Completed" : transition === "close" ? "Rejected" : "Submitted", occurredAt, professionalStageId });
function record(opportunity: Opportunity, index: number, state: "saved" | "pending" | "accepted" | "rejected" | "completed" | "archived"): TrackedOpportunity {
  const savedAt = `202${3 + index % 4}-0${index % 8 + 1}-02T12:00:00.000Z`;
  const submittedAt = `202${3 + index % 4}-0${index % 8 + 1}-10T12:00:00.000Z`;
  const history: NonNullable<TrackedOpportunity["history"]> = [];
  if (state !== "saved" && state !== "archived") history.push(event(`submit-${index}`, "submit", submittedAt, "application_submitted"));
  if (state === "accepted" || state === "completed") history.push(event(`accept-${index}`, "accept", submittedAt.replace("10T", "18T"), "accepted"));
  if (state === "completed") history.push(event(`complete-${index}`, "complete", submittedAt.replace("10T", "24T"), "completed_program"));
  if (state === "rejected") history.push(event(`close-${index}`, "close", submittedAt.replace("10T", "20T"), "not_selected"));
  if (state === "archived") history.push(event(`archive-${index}`, "close", savedAt.replace("02T", "20T"), "archived"));
  const status: TrackedOpportunity["status"] = state === "saved" ? "Saved" : state === "pending" ? "Submitted" : state === "accepted" ? "Accepted" : state === "completed" ? "Completed" : "Rejected";
  return { id: opportunity.id, status, professionalStageId: state === "rejected" ? "not_selected" : state === "archived" ? "archived" : state === "completed" ? "completed_program" : state === "accepted" ? "accepted" : state === "pending" ? "application_submitted" : "saved", savedAt, updatedAt: history.at(-1)?.occurredAt ?? savedAt, version: 1, history };
}
function account(records: TrackedOpportunity[], extras: Partial<AccountData> = {}): AccountData {
  const tracker = Object.fromEntries(records.map((item) => [item.id, item]));
  return { profile: null, onboardingComplete: true, firstLaunchComplete: true, billing: defaultBillingRecord(), activity: { viewed: [], saved: records.map((item) => item.id), claimed: [], tracked: tracker }, savedOpportunities: records.map((item) => ({ opportunityId: item.id, savedAt: item.savedAt })), watchedOpportunities: [], tracker, preferences: null, journeyProgress: {}, calendarEvents: {}, applicationWorkspaces: {}, accomplishments: {}, pathPreferences: {}, guidance: {}, advisor: null, referrals: null, updatedAt: now, ...extras };
}

const activeItems = Array.from({ length: 10 }, (_, index) => makeOpportunity(index, index % 3 === 0 ? "Research" : index % 3 === 1 ? "Scholarship" : "Career"));
const states = ["pending", "pending", "accepted", "accepted", "rejected", "rejected", "saved", "saved", "saved", "saved"] as const;
const active = buildOpportunityInsights({ account: account(activeItems.map((item, index) => record(item, index, states[index]!))), opportunities: activeItems, now: new Date(now) });
assert.equal(active.applications.submitted, 6);
assert.equal(active.applications.awaiting, 2);
assert.equal(active.applications.accepted, 2);
assert.equal(active.applications.notSelected, 2);
assert.equal(active.overview.outcomesRecorded, 4);
assert.equal(active.progression[0]?.count, 10, "Lifecycle stages must not multiply pursued opportunities.");

const school = schools.find((item) => item.slug === "university-of-chicago")!;
const profile: StudentProfile = { firstName: "Avery", schoolSlug: school.slug, major: "Mathematics", graduationYear: "2030", year: "First year", careerGoal: "Quantitative Finance", interests: "Finance, Research", goals: ["Find internship"], topics: ["Finance", "Research"], currentPriority: "Finding an internship", preferredOpportunityTypes: [], gpaStatus: "none_yet", institutionType: "university", enrollmentStatus: "enrolled", degreeLevel: "undergraduate", citizenshipStatus: "us_citizen", workAuthorization: "us_authorized", transferStatus: "not_transfer", financialNeedStatus: "unknown", meritStatus: "unknown" };
const recommendationBaseline = buildRecommendationService({ profile, school, activity: { viewed: [], saved: [], claimed: [], tracked: {} }, progress: { milestones: {}, applications: {} }, source: opportunities }).recommendations;
const rejectedFinance = opportunities.filter((item) => /finance|bank|quant/i.test(`${item.category} ${item.title} ${(item.metadata.careerPaths ?? []).join(" ")}`)).slice(0, 5);
const rejectedTracked = Object.fromEntries(rejectedFinance.map((item, index) => [item.id, record(item, 700 + index, "rejected")]));
const recommendationAfterRejections = buildRecommendationService({ profile, school, activity: { viewed: [], saved: [], claimed: [], tracked: rejectedTracked }, progress: { milestones: {}, applications: {} }, source: opportunities }).recommendations;
const baselineById = new Map(recommendationBaseline.map((item) => [item.opportunity?.id, item.recommendation.score]));
const commonAfterRejection = recommendationAfterRejections.filter((item) => item.opportunity && baselineById.has(item.opportunity.id));
assert.ok(commonAfterRejection.length > 0, "Rejection safety fixture requires recommendations shared across both runs.");
assert.ok(commonAfterRejection.every((item) => item.opportunity && item.recommendation.score >= baselineById.get(item.opportunity.id)!), "External rejection must not reduce affinity for otherwise unchanged recommendations.");

const missingItems = Array.from({ length: 20 }, (_, index) => makeOpportunity(100 + index));
const missing = buildOpportunityInsights({ account: account(missingItems.map((item, index) => record(item, 100 + index, index < 8 ? "accepted" : "pending"))), opportunities: missingItems, now: new Date(now) });
assert.equal(missing.applications.submitted, 20);
assert.equal(missing.applications.accepted, 8);
assert.equal(missing.applications.awaiting, 12, "Missing outcomes must never become rejections.");
assert.equal(missing.applications.notSelected, 0);

const archivedOpportunity = makeOpportunity(500);
const archived = buildOpportunityInsights({ account: account([record(archivedOpportunity, 500, "archived")]), opportunities: [archivedOpportunity], now: new Date(now) });
assert.equal(archived.overview.outcomesRecorded, 0, "Archiving must not become an outcome.");
assert.equal(archived.annual.reduce((sum, year) => sum + year.outcomes, 0), 0);

const sparseOpportunity = makeOpportunity(600);
assert.equal(buildOpportunityInsights({ account: account([record(sparseOpportunity, 600, "saved")]), opportunities: [sparseOpportunity] }).sparse, true);

const materialStore: ApplicationMaterialStore = { records: { "material:a": { id: "material:a", type: "resume", title: "Resume A", status: "ready", contexts: ["general"], preferred: true, createdAt: now, updatedAt: now, version: 0 } }, associations: Object.fromEntries(activeItems.slice(0, 3).map((item, index) => [`association:${index}`, { id: `association:${index}`, opportunityId: item.id, requirementType: "resume" as const, requirementTitle: "Resume", materialId: "material:a", materialSnapshot: { title: "Resume A", type: "resume" as const }, selectedAt: now, updatedAt: now, version: 0 }])), version: 3, updatedAt: now };
const withMaterials = buildOpportunityInsights({ account: account(activeItems.map((item, index) => record(item, index, states[index]!)), { applicationMaterials: materialStore }), opportunities: activeItems });
assert.deepEqual(withMaterials.materials.reuse[0] && { title: withMaterials.materials.reuse[0].title, applicationCount: withMaterials.materials.reuse[0].applicationCount }, { title: "Resume A", applicationCount: 3 });
assert.equal("performance" in (withMaterials.materials.reuse[0] ?? {}), false, "Material reuse must not imply outcome causality.");

const other = buildOpportunityInsights({ account: account([]), opportunities: activeItems });
assert.equal(other.overview.applicationsSubmitted, 0, "Projection must be account-isolated.");
const pro = buildOpportunityInsights({ account: account(activeItems.map((item, index) => record(item, index, states[index]!)), { billing: { ...defaultBillingRecord(), tier: "pro", status: "active" } }), opportunities: activeItems });
assert.deepEqual(pro.applications, active.applications, "Core personal history must remain identical across Free and Pro.");
assert.equal(active.coverage.watchHistory.level, "partially_supported");
assert.equal(active.coverage.recommendationAttribution.level, "unavailable");
assert.equal(active.coverage.discoverySource.level, "unavailable");
assert.equal(active.coverage.academicYear.level, "unavailable");

const largeOpportunities = Array.from({ length: 500 }, (_, index) => makeOpportunity(1_000 + index, index % 3 === 0 ? "Research" : index % 3 === 1 ? "Scholarship" : "Career"));
const largeAccount = account(largeOpportunities.map((item, index) => record(item, index, index % 5 === 0 ? "completed" : index % 5 === 1 ? "accepted" : index % 5 === 2 ? "rejected" : index % 5 === 3 ? "pending" : "saved")));
const samples: number[] = [];
for (let run = 0; run < 35; run += 1) { const started = performance.now(); buildOpportunityInsights({ account: largeAccount, opportunities: largeOpportunities, now: new Date(now) }); if (run >= 5) samples.push(performance.now() - started); }
samples.sort((left, right) => left - right);
const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
const p95Ms = samples[Math.ceil(samples.length * .95) - 1]!;
assert.ok(averageMs < 100, `500-record projection must remain under 100ms average; received ${averageMs.toFixed(2)}ms.`);
assert.ok(p95Ms < 200, `500-record projection must remain under a 200ms catastrophic p95 ceiling; received ${p95Ms.toFixed(2)}ms.`);

const page = readFileSync("app/insights/page.tsx", "utf8");
const proxy = readFileSync("proxy.ts", "utf8");
const analytics = readFileSync("lib/analytics-types.ts", "utf8");
assert.match(page, /requireCompletedOnboarding/);
assert.match(page, /robots: \{ index: false, follow: false \}/);
assert.match(proxy, /"\/insights"/);
assert.match(analytics, /opportunity_insights_opened_v1:[\s\S]*\["section"\]/);
assert.match(analytics, /opportunity_insights_opened_v1: action\([^\n]+\["section"\]\)/, "Insights analytics must allow only the fixed section token.");
assert.doesNotMatch(readFileSync("lib/opportunity-insights.ts", "utf8"), /acceptance rate|readiness score|peer|benchmark/i);

console.log(JSON.stringify({ message: "Opportunity Insights reconciliation, privacy, coverage, and performance checks passed.", activeApplicant: { submitted: 6, awaiting: 2, accepted: 2, notSelected: 2 }, missingOutcomes: 12, accountIsolation: true, freeProParity: true, records: 500, averageMs: Number(averageMs.toFixed(2)), p95Ms: Number(p95Ms.toFixed(2)) }, null, 2));
