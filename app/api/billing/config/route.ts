import { NextResponse } from "next/server";
import { stripeBillingConfigured, stripeCheckoutConfigured, stripePortalConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const checkoutConfigured = stripeCheckoutConfigured();
  const portalConfigured = stripePortalConfigured();
  return NextResponse.json({
    checkoutConfigured,
    portalConfigured,
    webhookConfigured: stripeBillingConfigured(),
    developmentWarning: process.env.NODE_ENV !== "production" && !stripeBillingConfigured()
      ? "Stripe billing is not fully configured. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, and STRIPE_PRO_PRICE_ID."
      : "",
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
