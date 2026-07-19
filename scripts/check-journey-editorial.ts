import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { opportunities } from "../data/opportunities";
import { schools } from "../data/seed";
import { defaultBillingRecord } from "../lib/billing";
import type { AccountData, AuthUser } from "../lib/account-types";
import { buildJourneyTimelineModel } from "../lib/journey-timeline";

const read = (path: string) => readFileSync(path, "utf8");
const now = "2026-07-14T12:00:00.000Z";
const school = schools.find((item) => item.name.includes("University")) ?? schools[0];
const selected = opportunities.filter((item) => ["Career", "Scholarship", "Research"].includes(item.type)).slice(0, 8);
const user: AuthUser = { id: "journey-timeline-student", email: "student@example.test", name: "Jordan Rivera" };

function account(populated: boolean): AccountData {
  const tracker = populated ? Object.fromEntries(selected.map((opportunity, index) => [opportunity.id, {
    id: opportunity.id,
    status: (["Saved", "Applying", "Submitted", "Interview", "Accepted", "Completed"] as const)[index % 6],
    savedAt: `2026-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
    updatedAt: `2026-02-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
    version: 0,
    history: [],
  }])) : {};
  return {
    profile: { firstName: "Jordan", lastName: "Rivera", schoolSlug: school.slug, major: "Mathematics", graduationYear: "2030", year: "First year", interests: "Finance, Research", careerGoal: "Quantitative Finance", onboardingCompletedAt: now, updatedAt: now },
    onboardingComplete: true,
    billing: defaultBillingRecord(),
    activity: { viewed: [], saved: Object.keys(tracker), claimed: [], tracked: tracker },
    savedOpportunities: Object.values(tracker).map((record) => ({ opportunityId: record.id, savedAt: record.savedAt })),
    tracker,
    preferences: { appearance: "light", updatedAt: now },
    journeyProgress: populated ? { "first-resume": true } : {},
    advisor: null,
    referrals: null,
    updatedAt: now,
  };
}

const empty = buildJourneyTimelineModel({ user, account: account(false), opportunities: [] });
assert.equal(empty.events.length, 0);
assert.equal(empty.card.headline, "My Journey starts here.");

const populated = buildJourneyTimelineModel({ user, account: account(true), opportunities: selected });
assert.ok(populated.events.length >= selected.length, "Every tracked opportunity must remain represented.");
assert.deepEqual(populated.events.map((event) => event.occurredAt), populated.events.map((event) => event.occurredAt).toSorted(), "Timeline events must remain chronological.");
assert.ok(populated.events.some((event) => event.type === "saved"));
assert.ok(populated.events.some((event) => event.type === "milestone"));
assert.ok(populated.events.some((event) => event.control), "Current records with valid transitions must remain editable.");
assert.ok(populated.card.stats.some((stat) => stat.id === "saved" && stat.value === selected.length));
assert.ok(populated.card.highlights.length > 0 && populated.card.highlights.length <= 4);
assert.equal(populated.card.identity.firstName, "Jordan");

const component = read("components/journey-timeline.tsx");
const styles = read("components/journey-timeline.module.css");
const page = read("app/page.tsx");
const loading = read("app/loading.tsx");
for (const required of ["<h1>Journey</h1>", "A timeline of the opportunities and milestones that have shaped your progress.", "Your Journey starts here", "JourneyCardEntry"]) assert.ok(component.includes(required), `Unified Journey must render ${required}.`);
for (const retired of ["Your next step", "Horizon", "Journey Board", "Move to...", "Right now", "recommendation"]) assert.ok(!component.includes(retired), `Unified Journey must retire ${retired}.`);
assert.ok(page.includes("buildJourneyTimelineModel") && page.includes("JourneyTimeline"), "The signed-in home must use the server-built timeline.");
assert.ok(styles.includes("grid-template-columns") && styles.includes("prefers-reduced-motion") && styles.includes("prefers-contrast: more"));
assert.ok(loading.includes("Loading your saved opportunities and progress."), "Loading copy must match the final timeline.");

const durations: number[] = [];
for (let index = 0; index < 80; index += 1) {
  const started = performance.now();
  buildJourneyTimelineModel({ user, account: account(true), opportunities: selected });
  durations.push(performance.now() - started);
}
durations.sort((left, right) => left - right);
const p95 = durations[Math.floor(durations.length * .95)];
assert.ok(p95 < 20, `Journey timeline projection p95 must remain under 20ms; received ${p95.toFixed(2)}ms.`);

console.log(`Unified Journey editorial checks passed. Timeline projection p95 ${p95.toFixed(2)}ms.`);
