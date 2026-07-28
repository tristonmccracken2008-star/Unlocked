import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { cleanAccountDataInput, cleanStudentProfile } from "../lib/account-input";

Reflect.set(process.env, "NODE_ENV", "test");
process.env.AUTH_SECRET = "account-center-regression-secret-with-sufficient-length";
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const source = (file: string) => readFileSync(file, "utf8");
const now = new Date().toISOString();
const cleaned = cleanAccountDataInput({
  preferences: {
    preferredTypes: ["Internships", "Research", "Internships"],
    useActivityForRecommendations: false,
    appearance: "light",
    reducedMotion: "reduce",
    privacy: {
      journeyVisibility: "public",
      analyticsPersonalization: true,
      journeyCard: { format: "square", theme: "dark", nameMode: "anonymous", includeSchool: false, includeOrganization: false, includeDate: false, includeAward: false, includeBranding: false, visibility: "public" },
    },
    updatedAt: now,
    forgedUserId: "other-user",
  },
});
assert.deepEqual(cleaned.preferences?.preferredTypes, ["Internships", "Research"]);
assert.equal(cleaned.preferences?.useActivityForRecommendations, false);
assert.equal(cleaned.preferences?.privacy?.journeyVisibility, "private");
assert.equal(cleaned.preferences?.privacy?.journeyCard.visibility, "private");
assert.equal("forgedUserId" in (cleaned.preferences as object), false);

const profile = cleanStudentProfile({
  firstName: "Taylor",
  schoolSlug: "custom-city-college",
  schoolName: "City College",
  major: "Undeclared",
  secondaryMajor: "Public Policy",
  graduationYear: String(new Date().getUTCFullYear() + 4),
  year: "First year",
  careerGoal: "Explore careers",
  interests: "Research, Scholarships",
  gpaStatus: "reported",
  gpa: 92,
  gpaScale: "100",
});
assert.equal(profile?.schoolName, "City College");
assert.equal(profile?.secondaryMajor, "Public Policy");
assert.equal(profile?.gpa, 92);
assert.equal(profile?.gpaScale, "100");
assert.equal(cleanStudentProfile({ ...profile, graduationYear: "1900" }), undefined);

const auth = await import("../lib/auth-store");
const runId = crypto.randomUUID().replaceAll("-", "");
const user = await auth.upsertUser({ googleSub: `account-${runId}`, email: `account-${runId}@example.edu`, name: "Account Center Test" });
const firstSession = await auth.createSession(user);
const secondSession = await auth.createSession(user);
const seeded = await auth.mergeAccountData(user.id, {
  profile: profile!,
  onboardingComplete: true,
  activity: {
    viewed: ["viewed-1"],
    saved: ["saved-1"],
    claimed: [],
    tracked: { "saved-1": { id: "saved-1", status: "Saved", savedAt: now, updatedAt: now, version: 0, history: [] } },
  },
  preferences: { preferredTypes: ["Research"], hiddenDismissedIds: ["dismissed-1"], useActivityForRecommendations: true, appearance: "light", updatedAt: now },
});
assert.equal(seeded.onboardingComplete, true);
const reset = await auth.resetRecommendationSignals(user.id);
assert.deepEqual(reset.activity?.viewed, []);
assert.equal(reset.activity?.tracked?.["saved-1"]?.status, "Saved");
assert.deepEqual(reset.preferences?.preferredTypes, ["Research"]);
assert.deepEqual(reset.preferences?.hiddenDismissedIds, []);
assert.equal(reset.profile?.major, "Undeclared");
assert.equal(reset.savedOpportunities.some((item) => item.opportunityId === "saved-1"), true);

const deletion = await auth.deleteAccount(user.id);
assert.equal(deletion.deleted, true);
assert.equal(await auth.getSession(firstSession.token), null);
assert.equal(await auth.getSession(secondSession.token), null);
assert.equal((await auth.deleteAccount(user.id)).alreadyDeleted, true);

const center = source("components/profile-page.tsx");
for (const label of ["Profile", "Interests", "Notifications", "Privacy", "Appearance", "Plan and billing", "Data and account"]) assert.ok(center.includes(`"${label}"`));
for (const behavior of ["Reset For You learning", "Download your data", "Type DELETE to confirm", "Private by default", "Manage subscription in Stripe"]) assert.ok(center.includes(behavior));
assert.match(center, /NotificationSettings embedded/);
assert.match(center, /StudentProfileForm mode="edit"/);
assert.match(center, /session\.data\?\.updatedAt/);

const accountRoute = source("app/api/account/data/route.ts");
assert.match(accountRoute, /stale_profile/);
assert.match(accountRoute, /current\.updatedAt !== raw\.expectedUpdatedAt/);
for (const routePath of ["app/api/account/export/route.ts", "app/api/account/recommendation-reset/route.ts", "app/api/account/delete/route.ts"]) {
  const route = source(routePath);
  assert.match(route, /assertSameOrigin\(request\)/);
  assert.match(route, /getSession/);
  assert.match(route, /enforceRateLimit/);
  assert.doesNotMatch(route, /body\.(userId|accountId)|searchParams\.get\(["']user/);
}
assert.doesNotMatch(source("app/api/account/export/route.ts"), /stripeCustomerId|stripeSubscriptionId|providerAccountId/);
assert.match(source("app/api/account/delete/route.ts"), /confirmation !== "DELETE"/);
assert.match(source("app/api/account/delete/route.ts"), /cancelStripeSubscription/);
assert.match(source("components/journey-card-creator.tsx"), /preferences\?\.privacy\?\.journeyCard/);

const samples: number[] = [];
for (let run = 0; run < 500; run += 1) {
  const started = performance.now();
  cleanAccountDataInput({ preferences: { preferredTypes: ["Internships", "Research"], useActivityForRecommendations: run % 2 === 0, appearance: "light", privacy: cleaned.preferences?.privacy, updatedAt: now } });
  samples.push(performance.now() - started);
}
samples.sort((a, b) => a - b);
const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
const p95Ms = samples[Math.ceil(samples.length * 0.95) - 1]!;
const worstMs = samples.at(-1)!;
assert.ok(p95Ms < 2, `Account preference normalization p95 must remain under 2ms; received ${p95Ms.toFixed(3)}ms.`);
console.log("Account center ownership, normalization, reset, deletion, and performance checks passed", { averageMs: Number(averageMs.toFixed(3)), p95Ms: Number(p95Ms.toFixed(3)), worstMs: Number(worstMs.toFixed(3)) });
