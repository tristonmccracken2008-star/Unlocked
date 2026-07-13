import { NextResponse } from "next/server";
import {
  claimStripeWebhookEvent,
  completeStripeWebhookEvent,
  accountUserExists,
  findUserIdByStripeCustomerId,
  readAccountData,
  releaseStripeWebhookEvent,
  updateAccountBilling,
  withSecurityLock,
} from "@/lib/auth-store";
import {
  billingStatusFromStripe,
  intervalForPriceId,
  isConfiguredProPriceId,
  retrieveSubscription,
  stripeEventMatchesEnvironment,
  timestampFromStripe,
  type StripeCheckoutSession,
  type StripeEvent,
  type StripeInvoice,
  type StripeSubscription,
  verifyStripeWebhookPayload,
} from "@/lib/stripe";
import { readBoundedText } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

function stringValue(value: unknown, pattern: RegExp) {
  return typeof value === "string" && pattern.test(value) ? value : undefined;
}

function eventCreatedAt(event: StripeEvent) {
  return timestampFromStripe(event.created) ?? new Date().toISOString();
}

async function mappedUserId(customerId: string | undefined, metadataUserId?: string) {
  if (!customerId) return undefined;
  const mapped = await findUserIdByStripeCustomerId(customerId);
  if (mapped && metadataUserId && mapped !== metadataUserId) throw new Error("Stripe customer ownership mismatch.");
  return mapped;
}

async function eventIsNewEnough(userId: string, event: StripeEvent) {
  const account = await readAccountData(userId);
  const previous = account.billing.stripeEventCreatedAt;
  return !previous || previous <= eventCreatedAt(event);
}

async function persistSubscription(subscription: StripeSubscription, event: StripeEvent, deleted = false, userIdOverride?: string) {
  const customerId = stringValue(subscription.customer, /^cus_[A-Za-z0-9]{8,}$/);
  const userId = userIdOverride ?? await mappedUserId(customerId, subscription.metadata?.userId);
  if (!userId || !customerId || !await eventIsNewEnough(userId, event)) return;
  if (subscription.metadata?.userId && subscription.metadata.userId !== userId) throw new Error("Stripe subscription ownership mismatch.");

  const current = await readAccountData(userId);
  if (deleted && current.billing.stripeSubscriptionId && current.billing.stripeSubscriptionId !== subscription.id) return;
  const priceId = subscription.items?.data?.[0]?.price?.id;
  if (!isConfiguredProPriceId(priceId)) {
    console.warn("[UnlockED billing] Ignored subscription with an unconfigured price", { eventId: event.id, type: event.type });
    return;
  }

  const status = billingStatusFromStripe(subscription.status, deleted);
  await updateAccountBilling(userId, {
    tier: status === "active" || status === "trialing" || status === "past_due" ? "pro" : "free",
    status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    billingInterval: intervalForPriceId(priceId),
    currentPeriodStart: timestampFromStripe(subscription.current_period_start),
    currentPeriodEnd: timestampFromStripe(subscription.current_period_end),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    stripeEventId: event.id,
    stripeEventCreatedAt: eventCreatedAt(event),
  });
}

async function processCheckout(event: StripeEvent) {
  const session = event.data.object as StripeCheckoutSession;
  const customerId = stringValue(session.customer, /^cus_[A-Za-z0-9]{8,}$/);
  const metadataUserId = session.metadata?.userId;
  const referenceUserId = session.client_reference_id ?? undefined;
  if (!customerId || !metadataUserId || metadataUserId !== referenceUserId) throw new Error("Stripe checkout ownership metadata is invalid.");
  const mapped = await mappedUserId(customerId, metadataUserId);
  const userId = mapped ?? metadataUserId;
  if (!mapped && !await accountUserExists(userId)) throw new Error("Stripe checkout user does not exist.");
  if (!await eventIsNewEnough(userId, event)) return;

  const subscriptionId = stringValue(session.subscription, /^sub_[A-Za-z0-9]{8,}$/);
  if (!subscriptionId) {
    await updateAccountBilling(userId, {
      tier: "free",
      status: "incomplete",
      stripeCustomerId: customerId,
      stripeEventId: event.id,
      stripeEventCreatedAt: eventCreatedAt(event),
    });
    return;
  }
  const subscription = await retrieveSubscription(subscriptionId);
  await persistSubscription(subscription, event, false, userId);
}

async function processEvent(event: StripeEvent) {
  if (event.type === "checkout.session.completed") {
    await processCheckout(event);
    return;
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as StripeSubscription;
    const latest = event.type === "customer.subscription.deleted" ? subscription : await retrieveSubscription(subscription.id).catch(() => subscription);
    await persistSubscription(latest, event, event.type === "customer.subscription.deleted");
    return;
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as StripeInvoice;
    const subscriptionId = stringValue(invoice.subscription, /^sub_[A-Za-z0-9]{8,}$/);
    if (subscriptionId) {
      await persistSubscription(await retrieveSubscription(subscriptionId), event);
      return;
    }
    if (event.type === "invoice.payment_failed") {
      const customerId = stringValue(invoice.customer, /^cus_[A-Za-z0-9]{8,}$/);
      const userId = await mappedUserId(customerId);
      if (userId && await eventIsNewEnough(userId, event)) {
        await updateAccountBilling(userId, {
          status: "past_due",
          stripeCustomerId: customerId,
          stripeEventId: event.id,
          stripeEventCreatedAt: eventCreatedAt(event),
        });
      }
    }
  }
}

function billingLockIdentity(event: StripeEvent) {
  const object = event.data.object as { customer?: unknown };
  return stringValue(object.customer, /^cus_[A-Za-z0-9]{8,}$/) ?? event.id;
}

export async function POST(request: Request) {
  let event: StripeEvent;
  try {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json")) return NextResponse.json({ error: "Unsupported content type" }, { status: 415, headers: noStoreHeaders });
    const payload = await readBoundedText(request, 512 * 1024);
    event = verifyStripeWebhookPayload(payload, request.headers.get("stripe-signature"));
    if (!stripeEventMatchesEnvironment(event)) throw new Error("Stripe event environment does not match the configured key.");
  } catch (error) {
    console.error("[UnlockED billing] Stripe webhook verification failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400, headers: noStoreHeaders });
  }

  let claimed = false;
  try {
    claimed = await claimStripeWebhookEvent(event.id);
    if (!claimed) return NextResponse.json({ received: true, duplicate: true }, { headers: noStoreHeaders });
    await withSecurityLock("stripe-customer", billingLockIdentity(event), () => processEvent(event));
    await completeStripeWebhookEvent(event.id);
    return NextResponse.json({ received: true }, { headers: noStoreHeaders });
  } catch (error) {
    if (claimed) await releaseStripeWebhookEvent(event.id).catch(() => undefined);
    console.error("[UnlockED billing] Stripe webhook processing failed", { eventId: event.id, type: event.type, errorCategory: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500, headers: noStoreHeaders });
  }
}
