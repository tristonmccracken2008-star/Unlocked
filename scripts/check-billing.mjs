import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const billing = read("lib/billing.ts");
const stripe = read("lib/stripe.ts");
const checkout = read("app/api/billing/checkout/route.ts");
const webhook = read("app/api/billing/webhook/route.ts");
const portal = read("app/api/billing/portal/route.ts");
const forYouApi = read("app/api/advisor/for-you/route.ts");
const forYouSnapshot = read("lib/for-you-snapshot.ts");
const forYou = read("components/advisor-page.tsx");
const profile = read("components/profile-page.tsx");
const journey = read("components/my-opportunities-page.tsx");
const accountApi = read("app/api/account/data/route.ts");
const analytics = read("lib/analytics-types.ts");
const pkg = read("package.json");
const docs = read("docs/STRIPE_BILLING_SETUP.md");

assert.ok(existsSync(".env.example"), ".env.example must exist.");

for (const token of [
  "SubscriptionStatus",
  "BillingInterval",
  "cancelAtPeriodEnd",
  "currentPeriodStart",
  "getEntitlementsForBilling",
  "canUseFullForYou",
  "canUseDarkMode",
  "canUsePremiumThemes",
  "canCustomizeJourneyCard",
  "pro_monthly",
  "pro_annual",
]) assert.ok(billing.includes(token), `Billing model must include ${token}.`);

for (const token of [
  "STRIPE_PRO_MONTHLY_PRICE_ID",
  "STRIPE_PRO_ANNUAL_PRICE_ID",
  "priceIdForPlan",
  "createProCheckoutSession",
  "retrieveCheckoutSession",
  "retrieveSubscription",
  "verifyStripeWebhookPayload",
  "timingSafeEqual",
]) assert.ok(stripe.includes(token), `Stripe adapter must include ${token}.`);

for (const token of [
  "getSession",
  "planIdFromRequest",
  "isProUser",
  "priceIdForPlan",
  "already-pro",
]) assert.ok(checkout.includes(token), `Checkout route must enforce ${token}.`);

assert.doesNotMatch(checkout, /priceId\s*=.*body|STRIPE_PRICE_ID/i, "Checkout must not accept arbitrary client Price IDs.");

for (const event of [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]) assert.ok(webhook.includes(event), `Webhook must handle ${event}.`);

for (const token of ["verifyStripeWebhookPayload", "retrieveSubscription", "persistSubscription", "cancelAtPeriodEnd"]) {
  assert.ok(webhook.includes(token), `Webhook must include ${token}.`);
}

for (const token of ["getSession", "session.data.billing.stripeCustomerId", "createCustomerPortalSession"]) {
  assert.ok(portal.includes(token), `Portal route must include ${token}.`);
}

assert.ok(forYouApi.includes("resolveForYouState"), "For You API must use the server-gated snapshot resolver.");
for (const token of ["getEntitlementsForBilling", "slice(0, 8)", "canViewRecommendationExplanations"]) {
  assert.ok(forYouSnapshot.includes(token), `For You snapshot resolver must server-gate ${token}.`);
}
assert.ok(forYouSnapshot.includes("const allowed = pro ? service.recommendations.slice(0, 8) : []"), "Free For You must not require paid recommendation generation.");

assert.ok(forYou.includes("pro_gate_viewed"), "For You must show a Pro gate for Free preview.");
assert.ok(forYou.includes("Keep the full shortlist working for you"), "For You must explain the preview gate.");
assert.ok(!forYou.includes("buildRecommendationService"), "For You client must not build the full recommendation feed.");

for (const token of ["UnlockED Free", "UnlockED Pro", "Manage subscription", "past_due", "Appearance", "Premium appearance"]) {
  assert.ok(profile.includes(token), `Profile billing/appearance must include ${token}.`);
}

assert.ok(!journey.includes("journeyCardSvg"), "Billing must not preserve the retired Journey Card dashboard exporter.");
assert.ok(read("components/path-moment-creator.tsx").includes("Download PNG"), "Path Moment export must remain available without weakening core Free access.");

assert.ok(accountApi.includes("!isProUser(session.data.billing)"), "Account API must enforce premium appearance server-side.");

for (const event of [
  "pricing_viewed",
  "pro_plan_selected",
  "checkout_started",
  "checkout_redirected",
  "checkout_completed",
  "checkout_canceled",
  "subscription_activated",
  "subscription_renewed",
  "subscription_payment_failed",
  "subscription_canceled",
  "customer_portal_opened",
  "pro_gate_viewed",
  "pro_upgrade_clicked",
  "premium_theme_previewed",
  "premium_theme_upgrade_clicked",
  "premium_journey_theme_selected",
]) assert.ok(analytics.includes(`"${event}"`), `Analytics must declare ${event}.`);

for (const token of ["STRIPE_PRO_MONTHLY_PRICE_ID", "STRIPE_PRO_ANNUAL_PRICE_ID", "Webhook", "Customer Portal", "Entitlement Policy", "Live Launch Checklist"]) {
  assert.ok(docs.includes(token), `Stripe docs must cover ${token}.`);
}

assert.ok(pkg.includes("check:billing"), "Package scripts must include check:billing.");

console.log("Billing checks passed.");
