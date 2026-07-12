import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName, updateAccountBilling } from "@/lib/auth-store";
import { isProUser } from "@/lib/billing";
import { createProCheckoutSession, planIdFromRequest, priceIdForPlan, stripeCheckoutConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(sessionCookieName)?.value);
  if (!session) return NextResponse.redirect(new URL("/", request.url), 303);
  if (!stripeCheckoutConfigured()) return NextResponse.redirect(new URL("/profile?billing=not-configured", request.url), 303);
  if (isProUser(session.data.billing)) return NextResponse.redirect(new URL("/profile?billing=already-pro", request.url), 303);
  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await request.json().catch(() => ({})) : Object.fromEntries((await request.formData().catch(() => new FormData())).entries());
  const planId = planIdFromRequest((body as Record<string, unknown>).planId);
  if (!planId) return NextResponse.redirect(new URL("/pricing?billing=invalid-plan", request.url), 303);
  try {
    const checkout = await createProCheckoutSession(session.user, planId, session.data.billing.stripeCustomerId);
    if (checkout.customer && typeof checkout.customer === "string") {
      await updateAccountBilling(session.user.id, { stripeCustomerId: checkout.customer, stripePriceId: priceIdForPlan(planId), billingInterval: planId === "pro_monthly" ? "month" : "year" });
    }
    if (!checkout.url) throw new Error("Stripe checkout did not return a URL.");
    return NextResponse.redirect(checkout.url, 303);
  } catch (error) {
    console.error("[UnlockED billing] Checkout session failed", error);
    return NextResponse.redirect(new URL("/profile?billing=checkout-failed", request.url), 303);
  }
}
