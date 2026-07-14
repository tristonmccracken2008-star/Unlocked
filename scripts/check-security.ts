import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanAccountDataInput } from "../lib/account-input";
import { validateOpportunityInput } from "../lib/content-validation";
import {
  appOrigin,
  assertSameOrigin,
  constantTimeEqual,
  readBoundedJson,
  requiredAuthSecret,
  SecurityError,
} from "../lib/security";
import {
  checkoutSessionBelongsToUser,
  isConfiguredProPriceId,
  verifyStripeWebhookPayload,
} from "../lib/stripe";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { serializeJsonLd } from "../lib/json-ld";

process.env.AUTH_SECRET = "security-regression-secret-with-sufficient-length";
process.env.NEXT_PUBLIC_APP_URL = "https://security.unlocked.test";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_security_regression";
process.env.STRIPE_SECRET_KEY = "sk_test_security_regression";
process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_monthly_allowed";
process.env.STRIPE_PRO_ANNUAL_PRICE_ID = "price_annual_allowed";
const testRunId = crypto.randomUUID().replaceAll("-", "");

assert.equal(appOrigin(), "https://security.unlocked.test");
assert.equal(constantTimeEqual("same-value", "same-value"), true);
assert.equal(constantTimeEqual("same-value", "different-value"), false);

assert.doesNotThrow(() => assertSameOrigin(new Request("https://security.unlocked.test/api/account/data", {
  method: "PUT",
  headers: { Origin: "https://security.unlocked.test", "Sec-Fetch-Site": "same-origin" },
})));
assert.doesNotThrow(() => assertSameOrigin(new Request("https://security.unlocked.test/api/account/data", {
  method: "PUT",
  headers: { "Sec-Fetch-Site": "same-origin" },
})), "Browser same-origin authenticated mutations must not require Origin or Referer when Fetch Metadata proves same-origin.");
assert.doesNotThrow(() => assertSameOrigin(new Request("https://www.security.unlocked.test/api/account/data", {
  method: "PUT",
  headers: { Origin: "https://www.security.unlocked.test", Referer: "https://www.security.unlocked.test/profile", "Sec-Fetch-Site": "same-origin" },
})), "Same-origin writes on a production hostname alias must validate against the actual request target.");
assert.throws(() => assertSameOrigin(new Request("https://security.unlocked.test/api/account/data", {
  method: "PUT",
  headers: { Origin: "https://attacker.example", "Sec-Fetch-Site": "cross-site" },
})), (error: unknown) => error instanceof SecurityError && error.status === 403);
const previousNodeEnv = process.env.NODE_ENV;
Reflect.set(process.env, "NODE_ENV", "production");
assert.doesNotThrow(() => assertSameOrigin(new Request("https://security.unlocked.test/api/account/data", {
  method: "PUT",
  headers: { "Sec-Fetch-Site": "same-origin" },
})), "Production first-party writes with same-origin Fetch Metadata must be accepted.");
assert.throws(() => assertSameOrigin(new Request("https://security.unlocked.test/api/account/data", {
  method: "PUT",
  headers: { "Sec-Fetch-Site": "same-site" },
})), (error: unknown) => error instanceof SecurityError && error.code === "missing_origin", "Same-site requests without Origin or Referer must not be treated as same-origin.");
assert.throws(() => assertSameOrigin(new Request("https://security.unlocked.test/api/account/data", { method: "PUT" })), (error: unknown) => error instanceof SecurityError && error.code === "missing_origin");
const validAuthSecret = process.env.AUTH_SECRET;
process.env.AUTH_SECRET = "short";
assert.throws(() => requiredAuthSecret(), /at least 32 bytes/);
process.env.AUTH_SECRET = validAuthSecret;
if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
else Reflect.set(process.env, "NODE_ENV", previousNodeEnv);

const bounded = await readBoundedJson<{ ok: boolean }>(new Request("https://security.unlocked.test/api/test", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ok: true }),
}), 64);
assert.deepEqual(bounded, { ok: true });
await assert.rejects(() => readBoundedJson(new Request("https://security.unlocked.test/api/test", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ value: "x".repeat(100) }),
}), 32), (error: unknown) => error instanceof SecurityError && error.status === 413);

const now = new Date().toISOString();
const cleaned = cleanAccountDataInput({
  profile: {
    firstName: "  Student  ", schoolSlug: "school", major: "Mathematics", year: "First year",
    graduationYear: "2030", careerGoal: "Research", interests: "Statistics", gpaStatus: "reported", gpa: 8,
    unknownAdminField: "must be removed",
  },
  tracker: {
    valid: { id: "attacker-controlled", status: "Saved", savedAt: now, updatedAt: now },
    invalid: { id: "invalid", status: "Administrator", savedAt: now, updatedAt: now },
    "__proto__": { id: "__proto__", status: "Saved", savedAt: now, updatedAt: now },
  },
  preferences: { appearance: "forest", updatedAt: now, arbitrary: "removed" },
  billing: { tier: "pro", status: "active", stripeCustomerId: "cus_attacker" },
  referrals: { code: "ATTACKER" },
});
assert.equal(cleaned.profile?.firstName, "Student");
assert.equal(cleaned.profile?.gpa, 4);
assert.equal("unknownAdminField" in (cleaned.profile as object), false);
assert.deepEqual(Object.keys(cleaned.tracker ?? {}), ["valid"]);
assert.equal(cleaned.tracker?.valid.id, "valid", "Tracker IDs must come from validated record keys.");
assert.equal("arbitrary" in (cleaned.preferences as object), false);
assert.equal("billing" in cleaned, false, "Clients must not mutate billing.");
assert.equal("referrals" in cleaned, false, "Clients must not mutate referrals.");

const validOpportunity = {
  title: "Verified opportunity", organization: "Official Organization", type: "Scholarship", category: "Scholarships",
  description: "Official description", eligibility: "Current students", school_scope: "National", schools: [],
  verification_status: "verified", last_verified: "2026-07-13", tags: ["verified"],
  official_source_url: "https://example.edu/opportunity", deadline: "2026-12-01", estimated_value: 1000,
};
assert.ok(validateOpportunityInput(validOpportunity).data);
assert.ok(validateOpportunityInput({ ...validOpportunity, official_source_url: "javascript:alert(1)" }).errors.length);
assert.ok(validateOpportunityInput({ ...validOpportunity, deadline: "2026-02-31" }).errors.length);
assert.ok(validateOpportunityInput({ ...validOpportunity, description: "x".repeat(6_000) }).errors.length);

const hostileJsonLd = serializeJsonLd({ title: "</script><script>globalThis.compromised=true</script>" });
assert.doesNotMatch(hostileJsonLd, /<\/script/i, "Structured data must not permit a script-closing sequence.");
assert.match(hostileJsonLd, /\\u003c\/script/, "Structured data must escape HTML-significant characters.");

const timestamp = Math.floor(Date.now() / 1000);
const eventPayload = JSON.stringify({ id: "evt_security123456", type: "invoice.paid", created: timestamp, livemode: false, data: { object: { id: "in_security123", customer: "cus_security123" } } });
const validSignature = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET!).update(`${timestamp}.${eventPayload}`).digest("hex");
const event = verifyStripeWebhookPayload(eventPayload, `t=${timestamp},v1=${"0".repeat(64)},v1=${validSignature}`);
assert.equal(event.id, "evt_security123456", "Any valid v1 signature should be accepted during secret rotation.");
assert.throws(() => verifyStripeWebhookPayload(eventPayload, `t=${timestamp},v1=${"0".repeat(64)}`));
assert.throws(() => verifyStripeWebhookPayload(eventPayload, `t=${timestamp - 1000},v1=${validSignature}`));
const malformedEventPayload = JSON.stringify({ id: "evt_security123456", type: "invoice.paid", data: { object: { id: "in_security123" } } });
const malformedSignature = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET!).update(`${timestamp}.${malformedEventPayload}`).digest("hex");
assert.throws(() => verifyStripeWebhookPayload(malformedEventPayload, `t=${timestamp},v1=${malformedSignature}`), "Stripe events must declare created and livemode fields.");
assert.equal(isConfiguredProPriceId("price_monthly_allowed"), true);
assert.equal(isConfiguredProPriceId("price_attacker"), false);
assert.equal(checkoutSessionBelongsToUser({ id: "cs_test_security123", client_reference_id: "user-1", metadata: { userId: "user-1" } }, "user-1"), true);
assert.equal(checkoutSessionBelongsToUser({ id: "cs_test_security123", client_reference_id: "user-2", metadata: { userId: "user-1" } }, "user-1"), false);

const {
  claimStripeWebhookEvent,
  completeStripeWebhookEvent,
  attachReferralToUser,
  createSession,
  deleteSession,
  getSession,
  mergeAccountData,
  readAccountData,
  releaseStripeWebhookEvent,
  updateAccountBilling,
  upsertUser,
  withSecurityLock,
} = await import("../lib/auth-store");

let signalLockAcquired!: () => void;
let releaseCriticalSection!: () => void;
const lockAcquired = new Promise<void>((resolve) => { signalLockAcquired = resolve; });
const lockIdentity = `shared-account-${testRunId}`;
const firstLock = withSecurityLock("security-test", lockIdentity, async () => {
  signalLockAcquired();
  await new Promise<void>((resolve) => { releaseCriticalSection = resolve; });
});
await lockAcquired;
await assert.rejects(withSecurityLock("security-test", lockIdentity, async () => undefined), /already in progress/, "Concurrent protected writes must be rejected.");
releaseCriticalSection();
await firstLock;
await withSecurityLock("security-test", lockIdentity, async () => undefined);

const failureLockIdentity = `failure-release-${testRunId}`;
await assert.rejects(withSecurityLock("security-test", failureLockIdentity, async () => {
  throw new Error("intentional protected operation failure");
}), /intentional protected operation failure/, "Protected operation failures must propagate.");
await withSecurityLock("security-test", failureLockIdentity, async () => undefined);

const user = await upsertUser({ googleSub: `security-user-${testRunId}`, email: `security-user-${testRunId}@example.edu`, name: "Security User" });
const session = await createSession(user);
const sessionPayload = JSON.parse(Buffer.from(session.token.split(".")[0]!, "base64url").toString("utf8")) as Record<string, unknown>;
assert.equal(sessionPayload.v, 2);
assert.equal("user" in sessionPayload, false, "Signed session cookies must not embed account PII.");
assert.ok(await getSession(session.token), "A newly issued server-backed session must resolve.");
const idempotencyEventId = `evt_idempotency_${testRunId}`;
assert.equal(await claimStripeWebhookEvent(idempotencyEventId), true);
assert.equal(await claimStripeWebhookEvent(idempotencyEventId), false, "The same webhook event must not be claimed twice.");
await releaseStripeWebhookEvent(idempotencyEventId);
assert.equal(await claimStripeWebhookEvent(idempotencyEventId), true, "Failed webhook claims must be releasable for Stripe retries.");
await completeStripeWebhookEvent(idempotencyEventId);
assert.equal(await claimStripeWebhookEvent(idempotencyEventId), false, "Completed webhook events must remain idempotent.");

await updateAccountBilling(user.id, { tier: "pro", status: "active", stripeCustomerId: "cus_security123", stripeSubscriptionId: "sub_security123" });
await mergeAccountData(user.id, { journeyProgress: { "profile-saved": true } });
const afterProfileWrite = await readAccountData(user.id);
assert.equal(afterProfileWrite.billing.stripeCustomerId, "cus_security123", "Profile writes must not overwrite canonical billing state.");
await deleteSession(session.token);
assert.equal(await getSession(session.token), null, "Logout must revoke the server-side session immediately.");

const referrer = await upsertUser({ googleSub: `security-referrer-${testRunId}`, email: `security-referrer-${testRunId}@example.edu`, name: "Security Referrer" });
const referred = await upsertUser({ googleSub: `security-referred-${testRunId}`, email: `security-referred-${testRunId}@example.edu`, name: "Security Referred" });
const referralCode = (await readAccountData(referrer.id)).referrals?.code;
assert.ok(referralCode);
assert.equal((await attachReferralToUser(referred.id, referralCode!)).attached, true);
const completedProfile = {
  firstName: "Student", schoolSlug: "security-school", major: "Mathematics", graduationYear: "2030",
  year: "First year", careerGoal: "Research", interests: "Statistics", goals: ["Research"], topics: ["Statistics"],
};
await Promise.allSettled([
  mergeAccountData(referred.id, { profile: completedProfile, onboardingComplete: true }),
  mergeAccountData(referred.id, { profile: completedProfile, onboardingComplete: true }),
]);
const referralAfterRace = await readAccountData(referrer.id);
assert.equal(referralAfterRace.referrals?.completed.filter((item) => item.userId === referred.id).length, 1, "Concurrent onboarding must credit a referral only once.");
assert.equal(new Set(referralAfterRace.referrals?.rewardHistory.map((item) => item.rewardKey)).size, referralAfterRace.referrals?.rewardHistory.length, "Referral rewards must remain idempotent.");

const mutationRoutes = [
  "app/api/account/data/route.ts",
  "app/api/admin/content/route.ts",
  "app/api/admin/content/[id]/route.ts",
  "app/api/advisor/feedback/route.ts",
  "app/api/advisor/recommend/route.ts",
  "app/api/analytics/event/route.ts",
  "app/api/auth/logout/route.ts",
  "app/api/billing/checkout/route.ts",
  "app/api/billing/portal/route.ts",
];
for (const route of mutationRoutes) {
  const source = readFileSync(route, "utf8");
  assert.match(source, /assertSameOrigin\(request\)/, `${route} must enforce same-origin mutation requests.`);
  assert.match(source, /enforceRateLimit\(/, `${route} must enforce an abuse limit.`);
}

for (const route of ["app/api/account/data/route.ts", "app/api/admin/content/route.ts", "app/api/admin/content/[id]/route.ts", "app/api/advisor/feedback/route.ts", "app/api/advisor/recommend/route.ts", "app/api/analytics/event/route.ts"]) {
  assert.ok(readFileSync(route, "utf8").includes("readBoundedJson"), `${route} must use bounded JSON parsing.`);
}

const webhookRoute = readFileSync("app/api/billing/webhook/route.ts", "utf8");
for (const control of ["verifyStripeWebhookPayload", "claimStripeWebhookEvent", "stripeEventMatchesEnvironment", "isConfiguredProPriceId", "mappedUserId", "readBoundedText", "withSecurityLock"]) {
  assert.ok(webhookRoute.includes(control), `Stripe webhook must enforce ${control}.`);
}
assert.doesNotMatch(webhookRoute, /metadataUserId\) return metadataUserId/, "Stripe metadata must never bypass customer ownership mapping.");

for (const route of ["app/api/billing/checkout/route.ts", "app/api/billing/portal/route.ts"]) {
  assert.ok(readFileSync(route, "utf8").includes("error instanceof SecurityError"), `${route} must preserve explicit CSRF and rate-limit errors.`);
}

for (const page of ["app/categories/[slug]/page.tsx", "app/schools/[slug]/page.tsx", "app/opportunities/[id]/page.tsx"]) {
  const source = readFileSync(page, "utf8");
  assert.ok(source.includes("serializeJsonLd"), `${page} must safely serialize structured data.`);
  assert.doesNotMatch(source, /__html:\s*JSON\.stringify/, `${page} must not inject raw JSON into a script element.`);
}

const publicAccount = readFileSync("lib/public-account.ts", "utf8");
for (const field of ["stripeCustomerId: undefined", "stripeSubscriptionId: undefined", "stripePriceId: undefined", "referrerUserId: \"self\"", "abuseFlags: []"]) {
  assert.ok(publicAccount.includes(field), `Browser account data must redact ${field}.`);
}

const nextConfig = readFileSync("next.config.mjs", "utf8");
for (const header of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"]) {
  assert.ok(nextConfig.includes(header), `Global response headers must include ${header}.`);
}

const authStartRoute = readFileSync("app/api/auth/google/route.ts", "utf8");
assert.ok(authStartRoute.includes("deleteSession(cookieStore.get(sessionCookieName)?.value)"), "Starting OAuth must revoke the session before clearing its cookie.");
assert.ok(authStartRoute.includes('sec-fetch-site') && authStartRoute.includes('cross-site'), "Starting OAuth must reject cross-site forced logout requests.");
const authCallbackRoute = readFileSync("app/api/auth/callback/google/route.ts", "utf8");
assert.ok(authCallbackRoute.includes("deleteSession(cookieStore.get(sessionCookieName)?.value)"), "A successful OAuth callback must revoke the session it replaces.");

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
const secretPattern = /(sk_live_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{24,}|GOCSPX-[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AIza[A-Za-z0-9_-]{30,})/;
const secretLeaks = trackedFiles.filter((file) => {
  try { return secretPattern.test(readFileSync(file, "utf8")); } catch { return false; }
});
assert.deepEqual(secretLeaks, [], `Tracked files contain credential-like values: ${secretLeaks.join(", ")}`);

console.log("Production security regression checks passed.");
