import fs from "node:fs";
import assert from "node:assert/strict";

const read = (file) => fs.readFileSync(file, "utf8");

const referrals = read("lib/referrals.ts");
const authStore = read("lib/auth-store.ts");
const callback = read("app/api/auth/callback/google/route.ts");
const captureRoute = read("app/r/[code]/route.ts");
const accountRoute = read("app/api/account/data/route.ts");
const referralPage = read("components/referral-page.tsx");
const journey = read("components/my-opportunities-page.tsx");
const billing = read("lib/billing.ts");
const analytics = read("lib/analytics-types.ts");
const adminPage = read("app/admin/referrals/page.tsx");
const docs = read("docs/REFERRALS.md");

for (const token of ["journey_theme", "founder_badge", "one_month_pro", "premium_theme_pack", "campus_ambassador"]) {
  assert.ok(referrals.includes(token), `Referral reward ${token} must be configured.`);
}
for (const threshold of ["threshold: 1", "threshold: 3", "threshold: 5", "threshold: 15", "threshold: 50"]) {
  assert.ok(referrals.includes(threshold), `Referral threshold ${threshold} must exist.`);
}

assert.ok(authStore.includes("generateReferralCode"), "Accounts must generate a permanent referral code.");
assert.ok(authStore.includes("referralCodeKey"), "Referral codes must be indexed to owners.");
assert.ok(authStore.includes("attachReferralToUser"), "OAuth must attach referral attribution server-side.");
assert.ok(authStore.includes("completeReferralOnboarding"), "Onboarding completion must credit referrals server-side.");
assert.ok(authStore.includes("accountHasCompletedOnboarding(next)"), "Referral credit must require completed onboarding.");
assert.ok(authStore.includes("referrerUserId === userId"), "Self-referrals must be rejected.");
assert.ok(authStore.includes("already_referred"), "Users must not be able to change referrers.");
assert.ok(authStore.includes("duplicate_completion"), "Duplicate completion credit must be prevented.");
assert.ok(authStore.includes("referral_loop"), "Referral loops must be rejected.");
assert.ok(authStore.includes("applyReferralProGrant"), "Five-referral reward must grant Pro time.");

assert.ok(callback.includes("referralCookieName"), "OAuth callback must consume the referral cookie.");
assert.ok(callback.includes("attachReferralToUser"), "OAuth callback must attach referral attribution.");
assert.ok(callback.includes("response.cookies.delete(referralCookieName)"), "Referral cookie must be cleared after OAuth processing.");
assert.ok(captureRoute.includes("httpOnly: true"), "Referral cookie must be HTTP-only.");
assert.ok(captureRoute.includes("sameSite: \"lax\""), "Referral cookie must use SameSite=Lax.");

assert.ok(!accountRoute.includes("referrals,"), "Client account save route must not accept arbitrary referral data.");
assert.ok(billing.includes("referralProGrantedUntil"), "Billing must represent referral-earned Pro time.");
assert.ok(billing.includes("record.referralProGrantedUntil"), "Pro entitlement must consider referral-earned Pro time.");

for (const event of ["referral_link_opened", "referral_link_copied", "referral_code_copied", "referral_share_started", "referral_completed", "referral_reward_unlocked"]) {
  assert.ok(analytics.includes(`"${event}"`), `Analytics event ${event} must be registered.`);
}

assert.ok(referralPage.includes("ReferralPage"), "Referral page component must exist.");
assert.ok(referralPage.includes("Copy link"), "Referral page must support copying the referral link.");
assert.ok(referralPage.includes("Share"), "Referral page must support sharing.");
assert.ok(journey.includes("canUseReferralJourneyThemes"), "Journey Card themes must honor referral rewards.");
assert.ok(journey.includes("canShowFounderBadge"), "Journey Card must display Founder badge when unlocked.");
assert.ok(journey.includes("FOUNDER"), "Founder badge must be present in the Journey Card SVG.");
assert.ok(adminPage.includes("getAdminSession"), "Admin referral page must be protected server-side.");
assert.ok(adminPage.includes("getReferralAdminSummary"), "Admin referral page must use referral admin summary data.");

for (const token of ["Self-referrals are rejected", "Completion credit requires", "referralProGrantedUntil", "ADMIN_EMAILS"]) {
  assert.ok(docs.includes(token), `Referral docs must include ${token}.`);
}

console.log("Referral system checks passed.");
