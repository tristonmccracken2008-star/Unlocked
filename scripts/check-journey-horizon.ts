import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { buildJourneyEditorialModel } from "../lib/journey-editorial";
import { defaultBillingRecord } from "../lib/billing";
import type { AccountData, AuthUser } from "../lib/account-types";
import { opportunities } from "../data/opportunities";
import { schools } from "../data/seed";

const read = (path: string) => readFileSync(path, "utf8");
const now = "2026-07-15T12:00:00.000Z";
const school = schools.find((item) => item.name.includes("University")) ?? schools[0];
const opportunity = opportunities.find((item) => item.type === "Career") ?? opportunities[0];
const user: AuthUser = { id: "journey-horizon-student", email: "student@example.test", name: "Jordan Rivera" };

function account(status?: "Saved" | "Applying", dark = false): AccountData {
  const tracker = status ? {
    [opportunity.id]: { id: opportunity.id, status, savedAt: now, updatedAt: now },
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
    activity: status ? { viewed: [opportunity.id], saved: [opportunity.id], claimed: [], tracked: tracker } : { viewed: [], saved: [], claimed: [], tracked: {} },
    savedOpportunities: status ? [{ opportunityId: opportunity.id, savedAt: now }] : [],
    tracker,
    preferences: { appearance: dark ? "midnight" : "light", updatedAt: now },
    journeyProgress: {},
    advisor: null,
    referrals: null,
    updatedAt: now,
  };
}

const empty = buildJourneyEditorialModel({ user, account: account(), opportunities: [opportunity] });
assert.equal(empty.horizon.state, "empty");
assert.deepEqual(empty.horizon.items, []);
assert.equal(empty.horizon.geometries.desktop.geometry.diagnostics.horizonVisibleCount, 0);

const sparse = buildJourneyEditorialModel({ user, account: account("Saved"), opportunities: [opportunity] });
assert.equal(sparse.horizon.state, "sparse");
assert.equal(sparse.horizon.items.length, 1, "Saved-only evidence must reveal one gentle future direction.");

const populated = buildJourneyEditorialModel({ user, account: account("Applying"), opportunities: [opportunity] });
assert.equal(populated.horizon.state, "populated");
assert.ok(populated.horizon.items.length >= 1 && populated.horizon.items.length <= 2, "An active Journey must retain at most two supported future directions.");
assert.ok(populated.horizon.items.every((item) => item.title && item.explanation && item.whyAvailable && item.effort && item.cta.href));
assert.ok(populated.horizon.items.every((item) => !/will guarantee|will get you|ensures/i.test(`${item.explanation} ${item.whyAvailable}`)), "Horizon language must communicate possibility rather than certainty.");
assert.ok(populated.horizon.items.some((item) => item.source === "recommendation" && item.sourceRecommendationId?.startsWith("recommendation-milestone-")), "Horizon must reuse Recommendation Engine milestone objects.");
assert.ok(populated.horizon.items.every((item) => item.sourceRoadmapId || item.sourceRecommendationId), "Every future direction must retain a structured reasoning source.");
assert.ok(populated.horizon.items.every((item) => populated.diagnostics.horizonEvidenceSource.includes("roadmap_metadata") || item.source === "recommendation"));
assert.ok(populated.horizon.geometries.desktop.geometry.diagnostics.horizonVisibleCount <= 2);
assert.ok(populated.horizon.geometries.tablet.geometry.diagnostics.horizonVisibleCount <= 2);
assert.ok(populated.horizon.geometries.mobile.geometry.diagnostics.horizonVisibleCount <= 2);
assert.ok(populated.horizon.geometries.desktop.geometry.segments.some((segment) => segment.state === "future"), "Open Line geometry must continue into neutral future segments.");
assert.deepEqual(
  populated.horizon,
  buildJourneyEditorialModel({ user, account: account("Applying"), opportunities: [opportunity] }).horizon,
  "Horizon reasoning and geometry must remain deterministic.",
);
assert.equal(buildJourneyEditorialModel({ user, account: account("Applying", true), opportunities: [opportunity] }).theme, "dark");

const component = read("components/journey-editorial.tsx");
const styles = read("components/journey-editorial.module.css");
const model = read("lib/journey-editorial.ts");
const liveLine = read("components/journey-live-line.tsx");
for (const copy of ["What may open next.", "A direction taking shape", "See why this may fit", "Approximate effort", "Expected impact", "Preparation that helps", "Skills involved", "Expected preparation", "Explore another direction"]) {
  assert.ok(component.includes(copy), `Horizon must render ${copy}.`);
}
assert.ok(component.includes("JourneyResponsiveLine") && liveLine.includes("OpenLineMotionRenderer"), "Journey must keep one responsive Open Line renderer.");
assert.ok(!component.includes("journey-horizon-desktop"), "Horizon must not mount a duplicate Open Line renderer.");
assert.ok(component.includes("<details") && component.includes("<summary"), "Horizon detail must use keyboard-native inline disclosure.");
assert.ok(component.includes('aria-label="Plausible future directions"'), "Horizon possibilities need a screen-reader label.");
assert.ok(!component.includes("useState") && !component.includes("useMemo"), "Horizon must remain server-first without client recomputation.");
assert.ok(model.includes("rankMilestoneRecommendations"), "Horizon must consume the existing Recommendation Engine.");
assert.ok(model.includes("narrative.horizon"), "Horizon explanations must come from the existing Narrative Engine.");
assert.ok(model.includes("horizonGeometryPresentation"), "Horizon must reuse precomputed Open Line geometry.");
assert.ok(styles.includes(".additionalDirection"), "Additional Horizon directions must remain behind progressive disclosure.");
assert.ok(styles.includes("prefers-reduced-motion"), "Horizon must preserve reduced-motion behavior.");
assert.ok(styles.includes("prefers-contrast: more"), "Horizon must preserve high-contrast behavior.");
assert.ok(styles.includes("var(--journey-canvas)") && styles.includes("var(--journey-text-primary)"), "Horizon must inherit the canonical Journey theme tokens.");

const durations: number[] = [];
for (let index = 0; index < 60; index += 1) {
  const started = performance.now();
  buildJourneyEditorialModel({ user, account: account("Applying"), opportunities: [opportunity] });
  durations.push(performance.now() - started);
}
durations.sort((left, right) => left - right);
const average = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
const p95 = durations[Math.floor(durations.length * .95)];
assert.ok(average < 30, `Horizon server composition average must remain under 30ms; received ${average.toFixed(2)}ms.`);
assert.ok(p95 < 80, `Horizon server composition p95 must remain under 80ms; received ${p95.toFixed(2)}ms.`);

console.log(`Journey Horizon checks passed. Server composition average ${average.toFixed(2)}ms, p95 ${p95.toFixed(2)}ms.`);
