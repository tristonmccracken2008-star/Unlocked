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
const opportunity = opportunities[0];
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
assert.equal(emptyModel.story.source, "origin");
assert.equal(emptyModel.waypoint, undefined);
assert.equal(emptyModel.geometries.mobile.geometry.currentWaypointNodeId, undefined);
assert.equal(emptyModel.geometries.mobile.geometry.nodes[0]?.kind, "origin");

const populatedModel = buildJourneyEditorialModel({ user, account: account(true), opportunities: [opportunity] });
assert.equal(populatedModel.empty, false);
assert.match(populatedModel.story.text, /Quantitative Finance/i);
assert.equal(populatedModel.story.source, "branch_direction");
assert.ok(populatedModel.waypoint?.title);
assert.ok(populatedModel.waypoint?.whyItMatters);
assert.ok(populatedModel.waypoint?.explanationSource === "roadmap_metadata" || populatedModel.waypoint?.explanationSource === "opportunity_metadata");
assert.equal(populatedModel.geometries.desktop.geometry.layoutMode, "desktop");
assert.equal(populatedModel.geometries.tablet.geometry.layoutMode, "tablet");
assert.equal(populatedModel.geometries.mobile.geometry.layoutMode, "mobile");
assert.equal(populatedModel.geometries.mobile.geometry.nodes.find((node) => node.branchKey === "main")?.point.x, 40);
assert.ok(populatedModel.geometries.mobile.waypointPosition?.yPercent && populatedModel.geometries.mobile.waypointPosition.yPercent > 0);
assert.equal(populatedModel.theme, "light");
assert.equal(buildJourneyEditorialModel({ user, account: account(true, true), opportunities: [opportunity] }).theme, "dark");

const component = read("components/journey-editorial.tsx");
const styles = read("components/journey-editorial.module.css");
const page = read("app/page.tsx");
const loading = read("app/loading.tsx");
const model = read("lib/journey-editorial.ts");
const narrative = read("data/open-line/narrative.ts");

for (const required of ["Your Journey", "What matters now", "Estimated effort", "Expected impact", "Why this step", "The path behind you", "Journey tools"]) {
  assert.ok(component.includes(required), `Journey editorial view must render ${required}.`);
}
for (const required of ["Choose one opportunity worth pursuing.", "Find my first opportunity"]) {
  assert.ok(component.includes(required), `Empty Journey must render ${required}.`);
}
for (const retired of ["SummaryGrid", "Journey progress", "completion percentage", "activity counter", "KPI"]) {
  assert.ok(!component.includes(retired), `The first viewport must not include retired dashboard UI: ${retired}.`);
}
assert.ok(page.includes("getServerSessionForProduct"), "Journey must be composed from the server session.");
assert.ok(page.includes("buildJourneyEditorialModel"), "Journey route must use the shared server composition model.");
assert.ok(model.includes("createPathGeometry"), "The server model must precompute Prompt 2 geometry.");
assert.ok(!component.includes("createPathGeometry"), "React must not calculate Open Line geometry.");
assert.ok(model.includes("narrative.editorialStatement"), "The story must come from Prompt 7.");
assert.ok(narrative.includes("buildEditorialStatement"), "Narrative Engine must own editorial statement selection.");
assert.ok(component.includes("OpenLineMotionRenderer"), "Journey must reuse Prompt 6 motion.");
assert.ok(component.includes('preference: "system"'), "Journey motion must respect system reduced-motion preference.");
assert.ok(styles.includes("prefers-reduced-motion"), "Journey styles must explicitly preserve reduced motion.");
assert.ok(styles.includes("prefers-contrast: more"), "Journey must support high contrast.");
assert.ok(styles.includes(".desktopLine") && styles.includes(".tabletLine") && styles.includes(".mobileLine"), "All responsive layouts must be defined.");
assert.ok(styles.includes("left: 5.6rem"), "Mobile waypoint text must clear the 40px Open Line rail.");
assert.ok(styles.includes(".mobileLine { display: block; overflow: hidden; }"), "Mobile Open Line content must not paint into the narrative headline.");
assert.ok(component.includes("<ol") && component.includes("aria-labelledby"), "History must keep chronological and accessible structure.");
assert.ok(loading.includes("loadingNarrative") && loading.includes("loadingLine") && !loading.includes("grid-cols"), "Loading must resemble unfinished editorial print, not a dashboard.");
assert.ok(styles.includes("font-family: Iowan Old Style"), "Editorial serif must carry the student story.");
assert.ok(styles.includes("width: min(100% - 2.5rem, 75rem)"), "Desktop composition must be capped at 1200px.");
assert.ok(styles.includes("max-width: 45rem"), "Narrative column must be approximately 720px.");

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
