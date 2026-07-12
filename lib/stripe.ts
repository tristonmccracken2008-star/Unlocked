import crypto from "node:crypto";
import type { AuthUser } from "./account-types";
import { normalizeProPlanId, proPricing, type BillingInterval, type BillingStatus, type ProPlanId } from "./billing";

const stripeApiBase = "https://api.stripe.com/v1";

export function stripeConfig() {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    proPriceId: process.env.STRIPE_PRO_PRICE_ID,
    proMonthlyPriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? process.env.STRIPE_PRO_PRICE_ID,
    proAnnualPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
  };
}

export function stripeBillingConfigured() {
  const config = stripeConfig();
  return Boolean(config.secretKey && config.webhookSecret && config.publishableKey && config.proMonthlyPriceId && config.proAnnualPriceId);
}

export function stripeCheckoutConfigured() {
  const config = stripeConfig();
  return Boolean(config.secretKey && config.proMonthlyPriceId && config.proAnnualPriceId);
}

export function stripePortalConfigured() {
  return Boolean(stripeConfig().secretKey);
}

function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function stripeRequest<T>(path: string, params: URLSearchParams) {
  const secretKey = stripeConfig().secretKey;
  if (!secretKey) throw new Error("Stripe is not configured.");
  const response = await fetch(`${stripeApiBase}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    cache: "no-store",
  });
  const parsed = await response.json().catch(() => null) as T | { error?: { message?: string } } | null;
  if (!response.ok) {
    const message = parsed && typeof parsed === "object" && "error" in parsed ? parsed.error?.message : undefined;
    throw new Error(message ?? `Stripe request failed: ${response.status}`);
  }
  return parsed as T;
}

async function stripeGet<T>(path: string) {
  const secretKey = stripeConfig().secretKey;
  if (!secretKey) throw new Error("Stripe is not configured.");
  const response = await fetch(`${stripeApiBase}${path}`, { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store" });
  const parsed = await response.json().catch(() => null) as T | { error?: { message?: string } } | null;
  if (!response.ok) {
    const message = parsed && typeof parsed === "object" && "error" in parsed ? parsed.error?.message : undefined;
    throw new Error(message ?? `Stripe request failed: ${response.status}`);
  }
  return parsed as T;
}

export type StripeCheckoutSession = { id: string; url?: string | null; customer?: string | null; subscription?: string | null };
export type StripePortalSession = { id: string; url: string };

export function priceIdForPlan(planId: ProPlanId) {
  const config = stripeConfig();
  return planId === "pro_monthly" ? config.proMonthlyPriceId : config.proAnnualPriceId;
}

export function intervalForPriceId(priceId: string | undefined | null): BillingInterval {
  const config = stripeConfig();
  if (priceId && priceId === config.proMonthlyPriceId) return "month";
  if (priceId && priceId === config.proAnnualPriceId) return "year";
  return null;
}

export async function createProCheckoutSession(user: AuthUser, planId: ProPlanId, stripeCustomerId?: string) {
  const priceId = priceIdForPlan(planId);
  if (!priceId) throw new Error(`Stripe price is not configured for ${planId}.`);
  const params = new URLSearchParams({
    mode: "subscription",
    success_url: `${appUrl()}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/billing/cancel`,
    client_reference_id: user.id,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    "metadata[userId]": user.id,
    "metadata[planId]": planId,
    "subscription_data[metadata][userId]": user.id,
    "subscription_data[metadata][planId]": planId,
    allow_promotion_codes: "true",
  });
  if (stripeCustomerId) params.set("customer", stripeCustomerId);
  else params.set("customer_email", user.email);
  return await stripeRequest<StripeCheckoutSession>("/checkout/sessions", params);
}

export async function createCustomerPortalSession(stripeCustomerId: string) {
  return await stripeRequest<StripePortalSession>("/billing_portal/sessions", new URLSearchParams({
    customer: stripeCustomerId,
    return_url: `${appUrl()}/profile?billing=returned`,
  }));
}

export async function retrieveCheckoutSession(sessionId: string) {
  return await stripeGet<StripeCheckoutSession & { metadata?: Record<string, string | undefined>; payment_status?: string | null }>(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
}

export async function retrieveSubscription(subscriptionId: string) {
  return await stripeGet<StripeSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export function verifyStripeWebhookPayload(payload: string, signature: string | null) {
  const secret = stripeConfig().webhookSecret;
  if (!secret || !signature) throw new Error("Stripe webhook verification is not configured.");
  const entries = Object.fromEntries(signature.split(",").map((part) => {
    const [key, value] = part.split("=");
    return [key, value];
  }));
  const timestamp = entries.t;
  const expected = entries.v1;
  if (!timestamp || !expected) throw new Error("Stripe webhook signature is malformed.");
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error("Stripe webhook signature timestamp is outside tolerance.");
  const digest = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const left = Buffer.from(digest, "hex");
  const right = Buffer.from(expected, "hex");
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) throw new Error("Stripe webhook signature verification failed.");
  return JSON.parse(payload) as StripeEvent;
}

export type StripeEvent = {
  id: string;
  type: "checkout.session.completed" | "customer.subscription.created" | "customer.subscription.updated" | "customer.subscription.deleted" | "invoice.paid" | "invoice.payment_failed" | string;
  data: { object: StripeCheckoutSession | StripeSubscription | StripeInvoice };
};

export type StripeSubscription = {
  id: string;
  customer?: string | null;
  status?: string;
  cancel_at_period_end?: boolean;
  current_period_start?: number | null;
  current_period_end?: number | null;
  metadata?: Record<string, string | undefined>;
  items?: { data?: Array<{ price?: { id?: string } }> };
};

export type StripeInvoice = {
  id: string;
  customer?: string | null;
  subscription?: string | null;
  status?: string | null;
  metadata?: Record<string, string | undefined>;
};

export function billingStatusFromStripe(status: string | undefined, deleted = false): BillingStatus {
  if (deleted) return "canceled";
  if (status === "trialing") return "trialing";
  if (status === "active") return "active";
  if (status === "past_due") return "past_due";
  if (status === "unpaid") return "unpaid";
  if (status === "incomplete") return "incomplete";
  if (status === "incomplete_expired") return "incomplete_expired";
  if (status === "paused") return "paused";
  if (status === "canceled") return "canceled";
  return "free";
}

export function timestampFromStripe(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : undefined;
}

export const periodEndFromStripe = timestampFromStripe;

export function planIdFromRequest(value: unknown) {
  return normalizeProPlanId(value);
}

export function pricingForPlan(planId: ProPlanId) {
  return proPricing[planId];
}
