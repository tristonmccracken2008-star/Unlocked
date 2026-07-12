import { NextResponse } from "next/server";
import { findUserIdByStripeCustomerId, updateAccountBilling } from "@/lib/auth-store";
import { billingStatusFromStripe, intervalForPriceId, retrieveSubscription, timestampFromStripe, type StripeCheckoutSession, type StripeInvoice, type StripeSubscription, verifyStripeWebhookPayload } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

async function userIdFor(customerId: string | undefined, metadataUserId: string | undefined) {
  if (metadataUserId) return metadataUserId;
  if (!customerId) return undefined;
  return await findUserIdByStripeCustomerId(customerId);
}

async function persistSubscription(subscription: StripeSubscription, deleted = false) {
  const customerId = stringValue(subscription.customer);
  const userId = await userIdFor(customerId, subscription.metadata?.userId);
  if (!userId) return;
  const status = billingStatusFromStripe(subscription.status, deleted);
  const priceId = subscription.items?.data?.[0]?.price?.id;
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
  });
}

export async function POST(request: Request) {
  const payload = await request.text();
  let event;
  try {
    event = verifyStripeWebhookPayload(payload, request.headers.get("stripe-signature"));
  } catch (error) {
    console.error("[UnlockED billing] Stripe webhook verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as StripeCheckoutSession & { metadata?: Record<string, string | undefined> };
      const customerId = stringValue(session.customer);
      const userId = await userIdFor(customerId, session.metadata?.userId);
      if (userId) {
        const subscriptionId = stringValue(session.subscription);
        if (subscriptionId) {
          await persistSubscription(await retrieveSubscription(subscriptionId));
        } else {
        await updateAccountBilling(userId, {
          tier: "pro",
          status: "incomplete",
          stripeCustomerId: customerId,
        });
        }
      }
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as StripeSubscription;
      const latest = event.type === "customer.subscription.deleted" ? subscription : await retrieveSubscription(subscription.id).catch(() => subscription);
      await persistSubscription(latest, event.type === "customer.subscription.deleted");
    }

    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as StripeInvoice;
      if (invoice.subscription) {
        const subscription = await retrieveSubscription(invoice.subscription);
        await persistSubscription(subscription);
      } else if (event.type === "invoice.payment_failed") {
        const customerId = stringValue(invoice.customer);
        const userId = await userIdFor(customerId, invoice.metadata?.userId);
        if (userId) await updateAccountBilling(userId, { status: "past_due", stripeCustomerId: customerId });
      }
    }
  } catch (error) {
    console.error("[UnlockED billing] Stripe webhook processing failed", { eventId: event.id, type: event.type, error });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
