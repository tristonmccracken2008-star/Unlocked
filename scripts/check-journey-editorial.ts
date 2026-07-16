import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { buildJourneyEditorialModel } from "../lib/journey-editorial";
import { defaultBillingRecord } from "../lib/billing";
import type { AccountData, AuthUser } from "../lib/account-types";
import { opportunities } from "../data/opportunities";
import { schools } from "../data/seed";

const read = (path: string) => readFileSync(path, "utf8");
const now = "2026-07-14T12:00:00.000Z";
const school = schools.find((item) => item.name.includes("University")) ?? schools[0];
const opportunity = opportunities.find((item) => item.type === "Career") ?? opportunities[0];
const user: AuthUser = { id: "journey-editorial-student", email: "student@example.test", name: "Jordan Rivera" };

function account(populated: boolean, dark = false): AccountData {
  const tracker = populated ? {
    [opportunity.id]: { id: opportunity.id, status: "Applying" as const, savedAt: now, updatedAt: now },
  } : {};
  return {
    profile: {
      firstName: "Jordan",
      lastName: "Rivera",
      schoolSlug: school.slug,
      major: "Mathematics",
      graduationYear: "2030",
      year: "First year",
      interests: "Finance, Research",
      careerGoal: "Quantitative Finance",
      onboardingCompletedAt: now,
      updatedAt: now,
    },
    onboardingComplete: true,
    billing: dark ? { ...defaultBillingRecord(), tier: "pro", status: "active" } : defaultBillingRecord(),
    activity: populated ? { viewed: [opportunity.id], saved: [opportunity.id], claimed: [], tracked: tracker } : { viewed: [], saved: [], claimed: [], tracked: {} },
    savedOpportunities: populated ? [{ opportunityId: opportunity.id, savedAt: now }] : [],
    tracker,
    preferences: { appearance: dark ? "midnight" : "light", updatedAt: now },
    journeyProgress: {},
    advisor: null,
    referrals: null,
    updatedAt: now,
  };
}

const emptyModel = buildJourneyEditorialModel({ user, account: account(false), opportunities: [opportunity] });
assert.equal(emptyModel.empty, true);
assert.equal(emptyModel.story.text, "Every path begins with one meaningful choice.");
assert.equal(emptyModel.story.source, "canonical_profile");
assert.equal(emptyModel.waypoint, undefined);
assert.equal(emptyModel.geometries.mobile.geometry.currentWaypointNodeId, undefined);
assert.equal(emptyModel.geometries.mobile.geometry.nodes[0]?.kind, "origin");

const populatedModel = buildJourneyEditorialModel({ user, account: account(true), opportunities: [opportunity] });
assert.equal(populatedModel.empty, false);
assert.match(populatedModel.story.text, /Quantitative Finance/i);
assert.equal(populatedModel.story.source, "canonical_profile");
assert.ok(populatedModel.waypoint?.title);
assert.ok(populatedModel.waypoint?.whyItMatters);
assert.ok(["roadmap_metadata", "opportunity_metadata", "event_type"].includes(populatedModel.waypoint?.explanationSource ?? ""));
assert.equal(populatedModel.geometries.desktop.geometry.layoutMode, "desktop");
assert.equal(populatedModel.geometries.tablet.geometry.layoutMode, "tablet");
assert.equal(populatedModel.geometries.mobile.geometry.layoutMode, "mobile");
assert.equal(populatedModel.geometries.mobile.geometry.nodes.find((node) => node.branchKey === "main")?.point.x, 40);
assert.ok(populatedModel.geometries.mobile.waypointPosition?.yPercent && populatedModel.geometries.mobile.waypointPosition.yPercent > 0);
assert.equal(populatedModel.theme, "light");
assert.equal(buildJourneyEditorialModel({ user, account: account(true, true), opportunities: [opportunity] }).theme, "dark");
assert.ok(populatedModel.history.totalMomentCount > 0);
assert.ok(populatedModel.history.recentChapters.length > 0);
assert.ok(populatedModel.history.recentChapters.flatMap((chapter) => chapter.moments).every((moment) => moment.detail.whyItMattered && moment.detail.whatChanged && moment.detail.nextConsequence));
assert.ok(populatedModel.history.recentChapters.flatMap((chapter) => chapter.moments).some((moment) => moment.detail.relatedOpportunity?.id === opportunity.id));

const longHistoryOpportunities = opportunities.filter((item) => ["Career", "Research", "Scholarship"].includes(item.type)).slice(0, 8);
const longHistoryTracker = Object.fromEntries(longHistoryOpportunities.map((item, index) => {
  const day = String(index + 1).padStart(2, "0");
  const statuses = ["Applying", "Submitted", "Interview", "Accepted", "Completed"] as const;
  return [item.id, { id: item.id, status: statuses[index % statuses.length], savedAt: `2026-01-${day}T12:00:00.000Z`, updatedAt: `2026-02-${day}T12:00:00.000Z` }];
}));
const longHistoryAccount: AccountData = {
  ...account(false),
  activity: { viewed: [], saved: longHistoryOpportunities.map((item) => item.id), claimed: [], tracked: longHistoryTracker },
  savedOpportunities: longHistoryOpportunities.map((item, index) => ({ opportunityId: item.id, savedAt: `2026-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z` })),
  tracker: longHistoryTracker,
};
const longHistoryModel = buildJourneyEditorialModel({ user, account: longHistoryAccount, opportunities: longHistoryOpportunities });
const recentMoments = longHistoryModel.history.recentChapters.flatMap((chapter) => chapter.moments);
const earlierMoments = longHistoryModel.history.earlierChapters.flatMap((chapter) => chapter.moments);
assert.equal(recentMoments.length, 4, "Long histories must initially expose exactly four meaningful moments.");
assert.ok(earlierMoments.length > 0, "Long histories must preserve earlier chapters behind disclosure.");
assert.deepEqual([...earlierMoments, ...recentMoments].map((moment) => moment.occurredAt), [...earlierMoments, ...recentMoments].map((moment) => moment.occurredAt).sort(), "Journey moments must remain in chronological DOM order.");

const component = read("components/journey-editorial.tsx");
const styles = read("components/journey-editorial.module.css");
const page = read("app/page.tsx");
const loading = read("app/loading.tsx");
const model = read("lib/journey-editorial.ts");
const narrative = read("data/open-line/narrative.ts");
const liveLine = read("components/journey-live-line.tsx");

for (const required of ["Your Journey", "What matters now", "Estimated effort", "Expected impact", "See why this matters", "Story so far", "The moments that shaped your path.", "See earlier moments", "Why it mattered", "What changed", "What this opens next", "Manage applications"]) {
  assert.ok(component.includes(required), `Journey editorial view must render ${required}.`);
}
for (const required of ["Find one opportunity worth pursuing.", "Find my first opportunity"]) {
  assert.ok(component.includes(required), `Empty Journey must render ${required}.`);
}
for (const retired of ["SummaryGrid", "Journey progress", "completion percentage", "activity counter", "KPI"]) {
  assert.ok(!component.includes(retired), `The first viewport must not include retired dashboard UI: ${retired}.`);
}
assert.ok(page.includes("getServerSessionForProduct"), "Journey must be composed from the server session.");
assert.ok(page.includes("buildJourneyEditorialModel"), "Journey route must use the shared server composition model.");
assert.ok(model.includes("createPathGeometry"), "The server model must precompute Prompt 2 geometry.");
assert.ok(!component.includes("createPathGeometry"), "React must not calculate Open Line geometry.");
assert.ok(model.includes("canonicalJourneyStatement"), "The identity statement must be audited against canonical profile and progress data.");
assert.ok(model.includes("narrative.moments"), "Historical meaning must continue to come from Prompt 7.");
assert.ok(narrative.includes("buildEditorialStatement"), "Narrative Engine must own editorial statement selection.");
assert.ok(component.includes("JourneyResponsiveLine") && liveLine.includes("OpenLineMotionRenderer"), "Journey must reuse Prompt 6 motion through one responsive live-line boundary.");
assert.ok(component.includes("OPEN_LINE_MOTION.disclosure"), "Moment disclosure must reuse Prompt 6 timing tokens.");
assert.ok(liveLine.includes('preference: "system"'), "Journey motion must respect system reduced-motion preference.");
assert.ok(styles.includes("prefers-reduced-motion"), "Journey styles must explicitly preserve reduced motion.");
assert.ok(styles.includes("prefers-contrast: more"), "Journey must support high contrast.");
assert.ok(liveLine.includes("responsiveMode") && liveLine.includes("data-open-line-mode"), "One responsive renderer must select the active geometry.");
assert.ok(styles.includes("left: 4.4rem"), "Mobile waypoint text must clear the 40px Open Line rail.");
assert.ok(styles.includes(".storyFlow::before") && styles.includes("left: 1.25rem"), "Mobile history must reserve a 40px Open Line rail.");
assert.ok(styles.includes(".lineField { inset: 0 auto 0 0; width: 3.4rem;"), "Mobile Open Line content must remain clipped to its rail.");
assert.ok(component.includes("<ol") && component.includes("aria-labelledby"), "History must keep chronological and accessible structure.");
assert.ok(component.includes("<details") && component.includes("<summary"), "Moment and chapter disclosures must remain keyboard-native.");
assert.ok(!component.includes("useState") && !component.includes("useMemo"), "Journey history must remain server-first without client recomputation.");
assert.ok(loading.includes("loadingNarrative") && loading.includes("loadingLine") && !loading.includes("grid-cols"), "Loading must resemble unfinished editorial print, not a dashboard.");
assert.ok(styles.includes("font-family: Iowan Old Style"), "Editorial serif must carry the student story.");
assert.ok(styles.includes("width: min(100% - 2.5rem, 72rem)"), "Desktop composition must keep a calm editorial width.");
assert.ok(styles.includes("max-width: 50rem"), "Narrative column must remain intentionally bounded.");

const durations: number[] = [];
for (let index = 0; index < 40; index += 1) {
  const started = performance.now();
  buildJourneyEditorialModel({ user, account: account(true), opportunities: [opportunity] });
  durations.push(performance.now() - started);
}
durations.sort((a, b) => a - b);
const p95 = durations[Math.floor(durations.length * .95)];
assert.ok(p95 < 80, `Journey editorial server composition p95 must remain under 80ms; received ${p95.toFixed(2)}ms.`);

console.log(`Journey editorial checks passed. Server composition p95 ${p95.toFixed(2)}ms.`);
