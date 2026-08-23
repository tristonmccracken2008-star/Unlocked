import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

Reflect.set(process.env, "NODE_ENV", "test");
process.env.AUTH_SECRET = "contextual-guidance-regression-secret-with-sufficient-length";
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const source = (path: string) => readFileSync(path, "utf8");
const guidance = await import("../lib/guidance");
const auth = await import("../lib/auth-store");

assert.equal(guidance.guidanceHasBeenSeen({}, "journey_intro"), false);
assert.equal(guidance.guidanceHasBeenSeen({}, "planner_intro"), false);
assert.equal(guidance.guidanceHasBeenSeen({ journey_intro: { status: "completed", guideVersion: 1, updatedAt: new Date().toISOString() } }, "journey_intro"), true);
assert.deepEqual(guidance.normalizeGuidanceState({ unknown: { status: "completed", guideVersion: 99, updatedAt: new Date().toISOString() } } as never), {});

const emptyEligibility = guidance.journeyGuidanceEligibility({ onboardingComplete: true } as never, {
  hasRecords: false,
  hasCalendarContent: false,
  hasApplicationWorkspace: false,
  hasJourneyCard: false,
  hasOpportunityChange: false,
});
assert.equal(emptyEligibility.journey_intro, true);
assert.equal(emptyEligibility.journey_calendar, false);
assert.equal(emptyEligibility.journey_application_workspace, false);
assert.equal(emptyEligibility.journey_card, false);

const runId = crypto.randomUUID().replaceAll("-", "");
const first = await auth.upsertUser({ googleSub: `guide-a-${runId}`, email: `guide-a-${runId}@example.edu`, name: "Guide A" });
const second = await auth.upsertUser({ googleSub: `guide-b-${runId}`, email: `guide-b-${runId}@example.edu`, name: "Guide B" });
await auth.updateGuidanceState(first.id, { id: "journey_intro", status: "completed" });
await auth.updateGuidanceState(first.id, { id: "journey_calendar", status: "dismissed" });
const firstAccount = await auth.readAccountData(first.id);
const secondAccount = await auth.readAccountData(second.id);
assert.equal(firstAccount.guidance?.journey_intro?.status, "completed");
assert.equal(firstAccount.guidance?.journey_calendar?.status, "dismissed");
assert.deepEqual(secondAccount.guidance, {}, "Guidance state must remain isolated by account.");

const route = source("app/api/account/guidance/route.ts");
assert.match(route, /assertSameOrigin\(request\)/);
assert.match(route, /enforceRateLimit/);
assert.match(route, /readBoundedJson/);
assert.doesNotMatch(route, /email|profile|tracker|calendarEvents/);

const component = source("components/contextual-guidance.tsx");
assert.match(component, /JourneyGuidance/);
assert.match(component, /NotificationGuidance/);
assert.match(component, /PlannerGuidance/);
assert.match(component, /prefers-reduced-motion/);
assert.match(component, /scrollIntoView/);
assert.match(component, /\.find\(\(id\)[\s\S]*guidanceHasBeenSeen/, "Journey must select one eligible unseen contextual guide rather than rendering all tips.");
assert.doesNotMatch(component, /getBoundingClientRect|ResizeObserver/, "Guidance must not introduce client geometry work.");

const journey = source("components/journey-command-center.tsx");
for (const anchor of ["active-opportunities", "journey-history", "journey-cards", "application-workspace", "journey-changelog"]) assert.ok(journey.includes(anchor));
assert.ok(source("components/journey-command-actions.tsx").includes('data-guide-anchor="add-opportunity"'));
assert.ok(source("components/journey-deadline-calendar.tsx").includes('data-guide-anchor="journey-calendar"'));

const learn = source("components/learn-unlocked.tsx");
for (const section of ["Getting started", "Discover", "For You", "Planner", "Journey", "Applications", "Deadlines", "Notifications", "Profile and privacy"]) assert.ok(learn.includes(section));
assert.match(learn, /planner_intro/);
assert.match(learn, /\?guide=journey/);
assert.match(learn, /\?guide=journey_application_workspace/);
assert.match(learn, /\?guide=journey_calendar/);

console.log(JSON.stringify({ message: "Contextual guidance checks passed.", guideIds: guidance.guidanceIds.length, accountIsolation: true, evidenceGated: true, productionStoreUsed: false }, null, 2));
