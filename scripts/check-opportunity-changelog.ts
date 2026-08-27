import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import { opportunities, type Opportunity } from "../data/opportunities";
import { normalizeOpportunityDate, type OpportunityLifecycleMetadata } from "../data/opportunity-lifecycle";
import { appendOpportunityChanges, detectMeaningfulOpportunityChanges, opportunityWithDetectedChanges, recentOpportunityChanges } from "../data/opportunity-changelog";
import { detectMaterialOpportunityChanges } from "../lib/notification-engine";
import { projectApplicationWorkspace } from "../lib/application-workspace";
import { buildJourneyCalendarModel } from "../lib/journey-calendar";
import type { AccountData } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";

const now = new Date("2027-05-15T16:00:00.000Z");
const seed = opportunities.find((item) => item.verification_status === "verified")!;

function fixture(overrides: Partial<Opportunity> = {}, lifecycleOverrides: Partial<OpportunityLifecycleMetadata> = {}): Opportunity {
  const lifecycle: OpportunityLifecycleMetadata = {
    schemaVersion: 1,
    identity: { identityId: "change-fixture" },
    cycle: { cycleId: "change-fixture:2027" },
    state: "open",
    confidence: "confirmed",
    reason: "official_status_open",
    effectiveAt: "2027-05-15T12:00:00.000Z",
    finalDeadline: normalizeOpportunityDate("final_deadline", "2027-06-15", { verifiedAt: "2027-05-15", sourceUrl: "https://example.edu/apply" }),
    evidence: [{ id: "change-evidence", source: "manual_review", observedAt: "2027-05-15T12:00:00.000Z", value: "Official application page reviewed", sourceUrl: "https://example.edu/apply", confidence: "confirmed" }],
    events: [],
    fieldVerifiedAt: { state: "2027-05-15", deadline: "2027-05-15", applicationUrl: "2027-05-15", eligibility: "2027-05-15" },
    ...lifecycleOverrides,
  };
  return {
    ...seed,
    id: "change-fixture",
    title: "Verified Change Fixture",
    organization: "Official Organization",
    type: "Career",
    category: "Internship",
    official_source: "https://example.edu/apply",
    official_source_url: "https://example.edu/apply",
    application_deadline: "2027-06-15",
    deadline: "2027-06-15",
    eligibility: "Undergraduate students",
    verification_status: "verified",
    last_verified: "2027-05-15",
    metadata: {
      ...seed.metadata,
      deadlineType: "fixed",
      applicationRequirements: ["Resume"],
      eligibilityRules: { ...(seed.metadata.eligibilityRules ?? {}), availability: "open" },
      verification: { status: "verified", deadlineVerified: true, eligibilityVerified: true, applicationUrlVerified: true, sourceReachable: true },
      lifecycle,
    },
    ...overrides,
  };
}

function withDeadline(item: Opportunity, deadline: string): Opportunity {
  return {
    ...item,
    application_deadline: deadline,
    deadline,
    metadata: { ...item.metadata, lifecycle: { ...item.metadata.lifecycle!, finalDeadline: normalizeOpportunityDate("final_deadline", deadline, { verifiedAt: "2027-05-15", sourceUrl: item.official_source_url }) } },
  };
}

const before = fixture();
const extended = withDeadline(before, "2027-07-01");
const extension = detectMeaningfulOpportunityChanges(before, extended, now);
assert.equal(extension.some((event) => event.changeType === "deadline_extended" && event.calendarImpact), true);
assert.equal(extension[0]?.source, "manual_review");
assert.equal(extension[0]?.confidence, "confirmed");

const earlier = detectMeaningfulOpportunityChanges(before, withDeadline(before, "2027-05-25"), now);
assert.equal(earlier.find((event) => event.field === "deadline")?.importance, "critical");
assert.equal(detectMeaningfulOpportunityChanges(before, { ...before, eligibility: `${before.eligibility}.  ` }, now).length, 0, "Punctuation and whitespace are not material");
assert.equal(detectMeaningfulOpportunityChanges(before, { ...before, official_source_url: `${before.official_source_url}?utm_source=catalog` }, now).length, 0, "Tracking parameters are not material");

const requirements = fixture({ metadata: { ...before.metadata, applicationRequirements: ["Resume", "Transcript"] } });
const requirementEvents = detectMeaningfulOpportunityChanges(before, requirements, now);
assert.equal(requirementEvents.some((event) => event.changeType === "requirements_changed" && event.workspaceImpact), true);

const weak = fixture({ verification_status: "needs_review", metadata: { ...before.metadata, lifecycle: { ...before.metadata.lifecycle!, confidence: "limited" } } });
assert.equal(detectMeaningfulOpportunityChanges(before, withDeadline(weak, "2027-07-01"), now).length, 0, "Uncertain evidence must fail closed");

const persisted = opportunityWithDetectedChanges(before, extended, now).opportunity;
const repeated = opportunityWithDetectedChanges(persisted, extended, new Date("2027-05-16T12:00:00.000Z")).opportunity;
assert.equal(recentOpportunityChanges(repeated).length, 1, "Repeated imports must not duplicate events");
assert.equal(appendOpportunityChanges(extension, extension).length, extension.length, "Append is idempotent");
assert.equal(detectMaterialOpportunityChanges(before, extended, now)[0]?.eventId, extension[0]?.id, "Notifications consume canonical events");

const record = { id: before.id, status: "Applying" as const, savedAt: "2027-05-01T12:00:00.000Z", updatedAt: now.toISOString(), version: 1, history: [] };
const workspace = projectApplicationWorkspace({
  opportunity: opportunityWithDetectedChanges(before, requirements, now).opportunity,
  record,
  workspace: {
    opportunityId: before.id,
    tasks: { custom: { id: "custom", title: "Ask mentor to review", source: "user", completed: false, createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 0 } },
    createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 0,
  },
  now,
});
assert.equal(workspace.tasks.some((task) => task.id === "custom"), true, "Provider changes must preserve private user tasks");
assert.equal(workspace.tasks.find((task) => task.title === "Transcript")?.recentlyUpdated, true);
assert.equal(workspace.recentProviderUpdate?.label, "Application materials updated");

const personalEvent = { id: "calendar:personal", type: "personal_target" as const, title: "Personal draft target", date: "2027-05-20", opportunityId: before.id, source: "user" as const, completed: false, dismissed: false, createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 0 };
const account: AccountData = {
  profile: null, onboardingComplete: true, firstLaunchComplete: true, billing: defaultBillingRecord(),
  activity: { viewed: [], saved: [before.id], claimed: [], tracked: { [before.id]: record } },
  savedOpportunities: [{ opportunityId: before.id, savedAt: record.savedAt }], tracker: { [before.id]: record }, preferences: null,
  journeyProgress: {}, calendarEvents: { [personalEvent.id]: personalEvent }, advisor: null, referrals: null, updatedAt: now.toISOString(),
};
const calendar = buildJourneyCalendarModel({ account, opportunities: [extended], now });
assert.equal(calendar.items.find((item) => item.source === "official")?.date, "2027-07-01", "Official deadline follows the current catalog value");
assert.equal(calendar.items.find((item) => item.source === "user")?.date, personalEvent.date, "Personal dates remain untouched");

const nextCycle = fixture({}, { cycle: { cycleId: "change-fixture:2028" } });
assert.equal(detectMeaningfulOpportunityChanges(before, nextCycle, now).some((event) => event.changeType === "cycle_updated"), true);

const detailSource = await readFile(new URL("../app/opportunities/[id]/page.tsx", import.meta.url), "utf8");
const detailExperienceSource = await readFile(new URL("../components/opportunity-detail-experience.tsx", import.meta.url), "utf8");
const detailProjectionSource = await readFile(new URL("../lib/opportunity-detail-projection.ts", import.meta.url), "utf8");
const journeySource = await readFile(new URL("../components/journey-command-center.tsx", import.meta.url), "utf8");
const workspaceSource = await readFile(new URL("../components/application-workspace.tsx", import.meta.url), "utf8");
const adminRoute = await readFile(new URL("../app/api/admin/content/route.ts", import.meta.url), "utf8");
assert.match(detailSource, /buildOpportunityDetailProjection/);
assert.match(detailExperienceSource, /What changed/);
assert.match(detailProjectionSource, /recentOpportunityChanges/);
assert.match(journeySource, /record\.recentChange/);
assert.match(workspaceSource, /Updated by the provider/);
assert.match(adminRoute, /changeDiagnostics/);

const runs: number[] = [];
for (let run = 0; run < 8; run += 1) {
  const started = performance.now();
  for (let index = 0; index < 1_000; index += 1) detectMeaningfulOpportunityChanges(before, index % 2 ? extended : before, now);
  runs.push(performance.now() - started);
}
const samples = runs.slice(2).sort((left, right) => left - right);
const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
assert.ok(average < 500, `1,000 changelog comparisons must average under 500ms; received ${average.toFixed(2)}ms.`);

console.log(JSON.stringify({ checks: 25, averagePerThousandMs: Number(average.toFixed(2)) }, null, 2));
