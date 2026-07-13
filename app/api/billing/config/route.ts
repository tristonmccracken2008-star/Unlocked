import { NextResponse } from "next/server";
import { stripeBillingConfigured, stripeCheckoutConfigured, stripePortalConfigured } from "@/lib/stripe";
import { cookies } from "next/headers";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { enforceRateLimit, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    await enforceRateLimit(request, "billing-config", 60, 60, session.user.id);
    const checkoutConfigured = stripeCheckoutConfigured();
    const portalConfigured = stripePortalConfigured();
    return NextResponse.json({
      checkoutConfigured,
      portalConfigured,
      webhookConfigured: stripeBillingConfigured(),
      developmentWarning: process.env.NODE_ENV !== "production" && !stripeBillingConfigured()
        ? "Stripe billing is not fully configured. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_PRO_MONTHLY_PRICE_ID, STRIPE_PRO_ANNUAL_PRICE_ID, and NEXT_PUBLIC_APP_URL."
        : "",
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return securityErrorResponse(error, "Billing configuration could not be loaded.");
  }
}
