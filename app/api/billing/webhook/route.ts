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
import { queueAccountNotification } from "@/lib/notification-service";

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
  const nextTier = status === "active" || status === "trialing" || status === "past_due" ? "pro" : "free";
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  await updateAccountBilling(userId, {
    tier: nextTier,
    status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    billingInterval: intervalForPriceId(priceId),
    currentPeriodStart: timestampFromStripe(subscription.current_period_start),
    currentPeriodEnd: timestampFromStripe(subscription.current_period_end),
    cancelAtPeriodEnd,
    stripeEventId: event.id,
    stripeEventCreatedAt: eventCreatedAt(event),
  });
  if (current.billing.status !== status || current.billing.tier !== nextTier || current.billing.cancelAtPeriodEnd !== cancelAtPeriodEnd) {
    const message = status === "past_due"
      ? { title: "Billing needs attention", body: "Your latest Pro payment was not completed. Review billing to keep your plan current.", priority: "high" as const }
      : cancelAtPeriodEnd
        ? { title: "Your Pro plan is set to end", body: "Your Pro access remains available through the current billing period.", priority: "normal" as const }
        : nextTier === "pro"
          ? { title: "Your Pro plan is active", body: "Your subscription is active and your account has been updated.", priority: "normal" as const }
          : { title: "Your account is now on Free", body: "Your subscription changed, and the core UnlockED experience remains available.", priority: "normal" as const };
    await queueAccountNotification({
      userId,
      eventId: event.id,
      title: message.title,
      body: message.body,
      actionLabel: "Manage billing",
      actionHref: "/profile#billing",
      priority: message.priority,
      now: new Date(eventCreatedAt(event)),
    }).catch((error) => {
      console.warn("[UnlockED billing] Account notification failed", { eventId: event.id, type: event.type, errorCategory: error instanceof Error ? error.name : "unknown" });
    });
  }
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
    const current = await readAccountData(userId);
    await updateAccountBilling(userId, {
      tier: "free",
      status: "incomplete",
      stripeCustomerId: customerId,
      stripeEventId: event.id,
      stripeEventCreatedAt: eventCreatedAt(event),
    });
    if (current.billing.status !== "incomplete") {
      await queueAccountNotification({
        userId,
        eventId: event.id,
        title: "Your Pro setup needs attention",
        body: "Checkout finished without an active subscription. Review billing before trying again.",
        actionLabel: "Review billing",
        actionHref: "/profile#billing",
        priority: "high",
        now: new Date(eventCreatedAt(event)),
      }).catch((error) => {
        console.warn("[UnlockED billing] Account notification failed", { eventId: event.id, type: event.type, errorCategory: error instanceof Error ? error.name : "unknown" });
      });
    }
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
