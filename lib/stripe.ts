import crypto from "node:crypto";
import type { AuthUser } from "./account-types";
import { normalizeProPlanId, proPricing, type BillingInterval, type BillingStatus, type ProPlanId } from "./billing";
import { appOrigin } from "./security";

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

export function stripeCheckoutConfigured(planId?: ProPlanId) {
  const config = stripeConfig();
  if (planId) return Boolean(config.secretKey && priceIdForPlan(planId));
  return Boolean(config.secretKey && config.proMonthlyPriceId && config.proAnnualPriceId);
}

export function stripePortalConfigured() {
  return Boolean(stripeConfig().secretKey);
}

function appUrl() {
  return appOrigin();
}

async function stripeFetch(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Stripe request timed out.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function stripeRequest<T>(path: string, params: URLSearchParams, idempotencyKey?: string) {
  const secretKey = stripeConfig().secretKey;
  if (!secretKey) throw new Error("Stripe is not configured.");
  const response = await stripeFetch(`${stripeApiBase}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: params,
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
  const response = await stripeFetch(`${stripeApiBase}${path}`, { headers: { Authorization: `Bearer ${secretKey}` } });
  const parsed = await response.json().catch(() => null) as T | { error?: { message?: string } } | null;
  if (!response.ok) {
    const message = parsed && typeof parsed === "object" && "error" in parsed ? parsed.error?.message : undefined;
    throw new Error(message ?? `Stripe request failed: ${response.status}`);
  }
  return parsed as T;
}

export type StripeCheckoutSession = { id: string; url?: string | null; customer?: string | null; subscription?: string | null; client_reference_id?: string | null; metadata?: Record<string, string | undefined> };
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

export function isConfiguredProPriceId(priceId: string | undefined | null) {
  if (!priceId) return false;
  const config = stripeConfig();
  return priceId === config.proMonthlyPriceId || priceId === config.proAnnualPriceId;
}

export async function createProCheckoutSession(user: AuthUser, planId: ProPlanId, stripeCustomerId?: string, returnOrigin = appUrl()) {
  const priceId = priceIdForPlan(planId);
  if (!priceId) throw new Error(`Stripe price is not configured for ${planId}.`);
  const params = new URLSearchParams({
    mode: "subscription",
    success_url: `${returnOrigin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnOrigin}/billing/cancel`,
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
  const windowBucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const idempotencyKey = crypto.createHash("sha256").update(`checkout:${user.id}:${planId}:${windowBucket}`).digest("hex");
  return await stripeRequest<StripeCheckoutSession>("/checkout/sessions", params, idempotencyKey);
}

export async function createCustomerPortalSession(stripeCustomerId: string, returnOrigin = appUrl()) {
  return await stripeRequest<StripePortalSession>("/billing_portal/sessions", new URLSearchParams({
    customer: stripeCustomerId,
    return_url: `${returnOrigin}/profile?billing=returned`,
  }));
}

export async function retrieveCheckoutSession(sessionId: string) {
  if (!/^cs_(test_|live_)?[A-Za-z0-9_]{8,}$/.test(sessionId)) throw new Error("Checkout session ID is invalid.");
  return await stripeGet<StripeCheckoutSession & { metadata?: Record<string, string | undefined>; payment_status?: string | null }>(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
}

export async function retrieveSubscription(subscriptionId: string) {
  if (!/^sub_[A-Za-z0-9]{8,}$/.test(subscriptionId)) throw new Error("Subscription ID is invalid.");
  return await stripeGet<StripeSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export function verifyStripeWebhookPayload(payload: string, signature: string | null) {
  const secret = stripeConfig().webhookSecret;
  if (!secret || !signature) throw new Error("Stripe webhook verification is not configured.");
  const parts = signature.split(",").map((part) => part.trim()).filter(Boolean);
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const candidates = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  const numericTimestamp = Number(timestamp);
  if (!timestamp || !Number.isFinite(numericTimestamp) || !candidates.length) throw new Error("Stripe webhook signature is malformed.");
  if (Math.abs(Date.now() / 1000 - numericTimestamp) > 300) throw new Error("Stripe webhook signature timestamp is outside tolerance.");
  const digest = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const digestBytes = Buffer.from(digest, "hex");
  if (!candidates.some((candidate) => {
    if (!/^[a-f0-9]{64}$/i.test(candidate)) return false;
    const candidateBytes = Buffer.from(candidate, "hex");
    return candidateBytes.length === digestBytes.length && crypto.timingSafeEqual(digestBytes, candidateBytes);
  })) {
    throw new Error("Stripe webhook signature verification failed.");
  }
  const event = JSON.parse(payload) as StripeEvent;
  if (!event || typeof event !== "object" || !/^evt_[A-Za-z0-9]{8,}$/.test(event.id) || typeof event.type !== "string" || !event.data?.object
    || !Number.isInteger(event.created) || Number(event.created) <= 0 || typeof event.livemode !== "boolean") {
    throw new Error("Stripe webhook event is malformed.");
  }
  return event;
}

export type StripeEvent = {
  id: string;
  created?: number;
  livemode?: boolean;
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

export function stripeEventMatchesEnvironment(event: StripeEvent) {
  const secretKey = stripeConfig().secretKey ?? "";
  if (secretKey.startsWith("sk_live_")) return event.livemode === true;
  if (secretKey.startsWith("sk_test_")) return event.livemode === false;
  return process.env.NODE_ENV !== "production";
}

export function checkoutSessionBelongsToUser(session: StripeCheckoutSession, userId: string) {
  return session.client_reference_id === userId && session.metadata?.userId === userId;
}
