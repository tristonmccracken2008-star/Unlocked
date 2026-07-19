import assert from "node:assert/strict";
import { createCustomerPortalSession, createProCheckoutSession, stripeCheckoutConfigured } from "../lib/stripe";
import { validatedRedirectUrl } from "../lib/security";

const previous = {
  secret: process.env.STRIPE_SECRET_KEY,
  monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
  annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
};
process.env.STRIPE_SECRET_KEY = "sk_test_checkout_regression";
process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_monthly_regression";
process.env.STRIPE_PRO_ANNUAL_PRICE_ID = "price_annual_regression";

const requests: Array<{ url: string; body: URLSearchParams }> = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  requests.push({ url: String(input), body: new URLSearchParams(String(init?.body ?? "")) });
  return new Response(JSON.stringify({ id: "cs_test_checkout123", url: "https://checkout.stripe.com/c/pay/cs_test_checkout123", customer: "cus_test123" }), { status: 200, headers: { "Content-Type": "application/json" } });
};

try {
  const user = { id: "checkout-user", email: "student@example.test", name: "Student" };
  assert.equal(stripeCheckoutConfigured("pro_monthly"), true);
  assert.equal(stripeCheckoutConfigured("pro_annual"), true);
  const monthly = await createProCheckoutSession(user, "pro_monthly", undefined, "https://www.unlockededu.com");
  const annual = await createProCheckoutSession(user, "pro_annual", "cus_test123", "https://www.unlockededu.com");
  assert.match(monthly.url ?? "", /^https:\/\/checkout\.stripe\.com\//);
  assert.match(annual.url ?? "", /^https:\/\/checkout\.stripe\.com\//);
  assert.equal(requests[0].body.get("line_items[0][price]"), "price_monthly_regression");
  assert.equal(requests[1].body.get("line_items[0][price]"), "price_annual_regression");
  assert.equal(requests[0].body.get("success_url"), "https://www.unlockededu.com/billing/success?session_id={CHECKOUT_SESSION_ID}");
  assert.equal(requests[0].body.get("cancel_url"), "https://www.unlockededu.com/billing/cancel");
  assert.equal(requests[0].body.get("customer_email"), user.email);
  assert.equal(requests[1].body.get("customer"), "cus_test123");
  await createCustomerPortalSession("cus_test123", "https://www.unlockededu.com");
  assert.equal(requests[2].body.get("customer"), "cus_test123");
  assert.equal(requests[2].body.get("return_url"), "https://www.unlockededu.com/profile?billing=returned");
  assert.ok(validatedRedirectUrl(monthly.url, ["stripe.com"]));
  assert.equal(validatedRedirectUrl("https://stripe.example.test/checkout", ["stripe.com"]), null);

  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "test failure" } }), { status: 500, headers: { "Content-Type": "application/json" } });
  await assert.rejects(() => createProCheckoutSession(user, "pro_monthly", undefined, "https://www.unlockededu.com"), /test failure/);

  delete process.env.STRIPE_PRO_ANNUAL_PRICE_ID;
  assert.equal(stripeCheckoutConfigured("pro_monthly"), true, "Monthly checkout must remain independently configurable.");
  assert.equal(stripeCheckoutConfigured("pro_annual"), false, "Missing annual pricing must be reported for that plan only.");
} finally {
  globalThis.fetch = originalFetch;
  if (previous.secret === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previous.secret;
  if (previous.monthly === undefined) delete process.env.STRIPE_PRO_MONTHLY_PRICE_ID; else process.env.STRIPE_PRO_MONTHLY_PRICE_ID = previous.monthly;
  if (previous.annual === undefined) delete process.env.STRIPE_PRO_ANNUAL_PRICE_ID; else process.env.STRIPE_PRO_ANNUAL_PRICE_ID = previous.annual;
}

console.log("Stripe checkout flow checks passed.");
