import { NextResponse } from "next/server";
import { findUserIdByStripeCustomerId, updateAccountBilling } from "@/lib/auth-store";
import { billingStatusFromStripe, periodEndFromStripe, stripeConfig, type StripeCheckoutSession, type StripeSubscription, verifyStripeWebhookPayload } from "@/lib/stripe";

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
        await updateAccountBilling(userId, {
          tier: "pro",
          status: "active",
          stripeCustomerId: customerId,
          stripeSubscriptionId: stringValue(session.subscription),
          stripePriceId: stripeConfig().proPriceId,
        });
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as StripeSubscription;
      const customerId = stringValue(subscription.customer);
      const userId = await userIdFor(customerId, subscription.metadata?.userId);
      if (userId) {
        const status = billingStatusFromStripe(subscription.status, event.type === "customer.subscription.deleted");
        await updateAccountBilling(userId, {
          tier: status === "active" || status === "past_due" ? "pro" : "free",
          status,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items?.data?.[0]?.price?.id ?? stripeConfig().proPriceId,
          currentPeriodEnd: periodEndFromStripe(subscription.current_period_end),
        });
      }
    }
  } catch (error) {
    console.error("[UnlockED billing] Stripe webhook processing failed", { eventId: event.id, type: event.type, error });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
