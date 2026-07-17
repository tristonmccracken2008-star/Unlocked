import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { opportunities } from "../data/opportunities";
import type { TrackedOpportunity } from "../data/student-activity";
import { schools } from "../data/seed";
import type { AccountData, AuthUser } from "../lib/account-types";
import { defaultBillingRecord } from "../lib/billing";
import { journeyClarityLimits, journeyElementAudit, journeyEditorialAuditVersion } from "../lib/journey-clarity";
import { buildJourneyEditorialModel } from "../lib/journey-editorial";

const read = (file: string) => readFileSync(file, "utf8");
const now = "2026-07-16T12:00:00.000Z";
const school = schools.find((item) => item.name.includes("University")) ?? schools[0];
const careerOpportunities = opportunities.filter((item) => item.type === "Career");
const careerOpportunity = careerOpportunities[0];
const benefitOpportunity = opportunities.find((item) => item.type === "Benefit") ?? opportunities[0];
const user: AuthUser = { id: "journey-clarity-student", email: "clarity@example.test", name: "Jordan Rivera" };

function account(records: readonly TrackedOpportunity[] = [], careerGoal = "Quantitative Finance"): AccountData {
  const tracker = Object.fromEntries(records.map((record) => [record.id, record]));
  return {
    profile: {
      firstName: "Jordan",
      lastName: "Rivera",
      schoolSlug: school.slug,
      major: "Mathematics",
      graduationYear: "2030",
      year: "First year",
      interests: "Finance, Research",
      careerGoal,
      onboardingCompletedAt: now,
      updatedAt: now,
    },
    onboardingComplete: true,
    billing: defaultBillingRecord(),
    activity: { viewed: records.map((record) => record.id), saved: records.map((record) => record.id), claimed: [], tracked: tracker },
    savedOpportunities: records.map((record) => ({ opportunityId: record.id, savedAt: record.savedAt })),
    tracker,
    preferences: { appearance: "light", updatedAt: now },
    journeyProgress: {},
    advisor: null,
    referrals: null,
    updatedAt: now,
  };
}

function record(id: string, status: TrackedOpportunity["status"], index = 0): TrackedOpportunity {
  const day = String(index + 1).padStart(2, "0");
  return { id, status, savedAt: `2026-01-${day}T12:00:00.000Z`, updatedAt: `2026-02-${day}T12:00:00.000Z`, version: 0, history: [] };
}

assert.ok(journeyElementAudit.length >= 15, "The deployed Journey audit must classify every major visible element.");
assert.ok(journeyElementAudit.every((item) => item.userQuestion && item.confusionRisk), "Every audit decision needs a user question and confusion assessment.");
assert.ok(journeyElementAudit.some((item) => item.decision === "remove") && journeyElementAudit.some((item) => item.decision === "application_management"), "The audit must remove clutter and separate operational management.");

const empty = buildJourneyEditorialModel({ user, account: account(), opportunities: [] });
assert.equal(empty.state, "empty");
assert.equal(empty.story.text, "Every path begins with one meaningful choice.");
assert.equal(empty.history.totalMomentCount, 0);
assert.equal(empty.horizon.items.length, 0);
assert.equal(empty.transitionControl, undefined);

const saved = record(careerOpportunity.id, "Saved");
const sparse = buildJourneyEditorialModel({ user, account: account([saved]), opportunities: [careerOpportunity] });
assert.equal(sparse.state, "sparse");
assert.equal(sparse.history.totalMomentCount, 0, "Saved opportunities must not become historical accomplishments.");
assert.equal(sparse.transitionControl?.opportunityId, careerOpportunity.id);
assert.equal(sparse.waypoint?.source, "journey");
assert.match(sparse.waypoint?.title ?? "", new RegExp(careerOpportunity.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

const applying = record(careerOpportunity.id, "Applying");
const active = buildJourneyEditorialModel({ user, account: account([applying]), opportunities: [careerOpportunity] });
assert.equal(active.state, "active");
assert.equal(active.transitionControl?.opportunityId, careerOpportunity.id);
assert.equal(active.transitionControl?.actions.find((action) => action.primary)?.transition, "submit");
assert.match(active.waypoint?.title ?? "", /finish and submit/i);
const activeMoments = [...active.history.earlierChapters, ...active.history.recentChapters].flatMap((chapter) => chapter.moments);
assert.ok(activeMoments.every((moment) => !["direction", "exploration", "expansion"].includes(moment.storyType)), "Profile interests and exploration must not appear as accomplishments.");
assert.ok(activeMoments.every((moment) => moment.detail.skillsGained.length === 0), "An active application must not claim skills were gained.");

const unsupported = buildJourneyEditorialModel({ user, account: account([record(benefitOpportunity.id, "Applying")]), opportunities: [benefitOpportunity] });
assert.equal(unsupported.transitionControl, undefined, "A non-application benefit must not receive application status actions on the editorial page.");
assert.equal(unsupported.history.totalMomentCount, 0, "Unsupported legacy application semantics must be omitted rather than narrated confidently.");
assert.ok(unsupported.diagnostics.suppressedClaimCount > 0);

const completed = buildJourneyEditorialModel({ user, account: account([record(careerOpportunity.id, "Completed")]), opportunities: [careerOpportunity] });
assert.equal(completed.state, "validated");
assert.ok(completed.history.totalMomentCount > 0);
assert.match(completed.story.text, /real experience/i);

const longRecords = careerOpportunities.slice(0, 14).map((opportunity, index) => record(opportunity.id, ["Applying", "Submitted", "Interview", "Accepted", "Completed"][index % 5] as TrackedOpportunity["status"], index));
const longHistory = buildJourneyEditorialModel({ user, account: account(longRecords), opportunities: careerOpportunities.slice(0, 14) });
const recentCount = longHistory.history.recentChapters.flatMap((chapter) => chapter.moments).length;
const earlierCount = longHistory.history.earlierChapters.flatMap((chapter) => chapter.moments).length;
assert.equal(recentCount, journeyClarityLimits.visibleHistoryMoments);
assert.ok(earlierCount <= journeyClarityLimits.retainedEarlierMoments);
assert.ok(longHistory.history.omittedMomentCount > 0, "Older history must be bounded instead of creating a large hidden DOM tree.");
assert.ok(longHistory.horizon.items.length <= journeyClarityLimits.retainedHorizonItems);

const changedProfile = buildJourneyEditorialModel({ user, account: account([applying], "Public Policy"), opportunities: [careerOpportunity] });
assert.match(changedProfile.story.text, /Public Policy/);
assert.doesNotMatch(changedProfile.story.text, /Quantitative Finance/, "A current profile change must invalidate stale editorial identity copy.");
assert.equal(changedProfile.diagnostics.editorialAuditVersion, journeyEditorialAuditVersion);

const component = read("components/journey-editorial.tsx");
const liveLine = read("components/journey-live-line.tsx");
const styles = read("components/journey-editorial.module.css");
const modelSource = read("lib/journey-editorial.ts");
for (const retired of ["Journey tools", "Your living story", "After this…", "Why it becomes possible", "Skills gained", "Journey progress", "completion percentage"]) {
  assert.ok(!component.includes(retired), `Journey clarity must retire duplicated or technical copy: ${retired}.`);
}
for (const required of ["Your Journey", "What matters now", "See why this matters", "Story so far", "What may open next.", "Explore another direction", "Manage applications"]) {
  assert.ok(component.includes(required), `Journey clarity must preserve the focused hierarchy: ${required}.`);
}
assert.equal((component.match(/<JourneyResponsiveLine/g) ?? []).length, 1, "Journey must render one responsive Open Line component.");
assert.ok(!component.includes("journey-horizon-desktop"), "Horizon must not mount a duplicate Open Line visualization.");
assert.ok(liveLine.includes("data-responsive-open-line") && liveLine.includes("responsiveMode"), "The active viewport must select one geometry.");
assert.ok(!styles.includes("contain-intrinsic-size"), "Journey sections must not reserve synthetic height that creates dead space before offscreen content paints.");
assert.ok(modelSource.includes("visibleHistoryMoments") && modelSource.includes("retainedHorizonItems"), "Below-the-fold work must remain bounded through server-side progressive disclosure.");
assert.ok(styles.includes("var(--journey-canvas)") && styles.includes("var(--journey-text-primary)"), "Journey must inherit canonical light/dark contrast roles without component-specific override patches.");
assert.ok(modelSource.includes("recordSupportsEditorialAction") && modelSource.includes("suppressedClaimCount"), "A server-side editorial trust audit must run before rendering.");
assert.ok(!modelSource.includes("forYouSnapshot"), "Journey must not load or trust stale recommendation snapshots in its request path.");

const durations: number[] = [];
for (let index = 0; index < 60; index += 1) {
  const started = performance.now();
  buildJourneyEditorialModel({ user, account: account([applying]), opportunities: [careerOpportunity] });
  durations.push(performance.now() - started);
}
durations.sort((left, right) => left - right);
const average = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
const p95 = durations[Math.floor(durations.length * .95)];
assert.ok(average < 15, `Journey clarity composition average must remain under 15ms; received ${average.toFixed(2)}ms.`);
assert.ok(p95 < 40, `Journey clarity composition p95 must remain under 40ms; received ${p95.toFixed(2)}ms.`);

console.log(JSON.stringify({ message: "Journey clarity checks passed.", auditElements: journeyElementAudit.length, visibleHistoryLimit: journeyClarityLimits.visibleHistoryMoments, retainedHorizonLimit: journeyClarityLimits.retainedHorizonItems, averageMs: Number(average.toFixed(2)), p95Ms: Number(p95.toFixed(2)) }, null, 2));
