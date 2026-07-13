import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName, updateAccountBilling } from "@/lib/auth-store";
import { isProUser } from "@/lib/billing";
import { createProCheckoutSession, planIdFromRequest, priceIdForPlan, stripeCheckoutConfigured } from "@/lib/stripe";
import { appOrigin, assertSameOrigin, enforceRateLimit, readBoundedForm, readBoundedJson, SecurityError, securityErrorResponse, validatedRedirectUrl } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.redirect(new URL("/", appOrigin()), 303);
    await enforceRateLimit(request, "billing-checkout", 10, 10 * 60, session.user.id);
    if (!stripeCheckoutConfigured()) return NextResponse.redirect(new URL("/profile?billing=not-configured", appOrigin()), 303);
    if (isProUser(session.data.billing)) return NextResponse.redirect(new URL("/profile?billing=already-pro", appOrigin()), 303);
    const pendingCheckout = session.data.billing.status === "incomplete"
      && Date.now() - new Date(session.data.billing.updatedAt).getTime() < 30 * 60 * 1000;
    if (pendingCheckout) return NextResponse.redirect(new URL("/profile?billing=pending", appOrigin()), 303);
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    const body = contentType.includes("application/json")
      ? await readBoundedJson<Record<string, unknown>>(request, 8 * 1024)
      : Object.fromEntries(await readBoundedForm(request, 8 * 1024));
    const planId = planIdFromRequest(body.planId);
    if (!planId) return NextResponse.redirect(new URL("/pricing?billing=invalid-plan", appOrigin()), 303);
    const checkout = await createProCheckoutSession(session.user, planId, session.data.billing.stripeCustomerId);
    if (checkout.customer && typeof checkout.customer === "string") {
      await updateAccountBilling(session.user.id, { tier: "free", status: "incomplete", stripeCustomerId: checkout.customer, stripePriceId: priceIdForPlan(planId), billingInterval: planId === "pro_monthly" ? "month" : "year" });
    }
    const checkoutUrl = validatedRedirectUrl(checkout.url, ["stripe.com"]);
    if (!checkoutUrl) throw new Error("Stripe checkout did not return a trusted URL.");
    return NextResponse.redirect(checkoutUrl, 303);
  } catch (error) {
    console.error("[UnlockED billing] Checkout session failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    if (error instanceof SecurityError) return securityErrorResponse(error, "Checkout could not be started.");
    return NextResponse.redirect(new URL("/profile?billing=checkout-failed", appOrigin()), 303);
  }
}
