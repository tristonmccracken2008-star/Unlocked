import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName, updateAccountBilling } from "@/lib/auth-store";
import { isProUser } from "@/lib/billing";
import { createProCheckoutSession, planIdFromRequest, priceIdForPlan, stripeCheckoutConfigured } from "@/lib/stripe";
import { appOrigin, assertSameOrigin, enforceRateLimit, readBoundedForm, readBoundedJson, SecurityError, securityErrorResponse, validatedRedirectUrl } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const wantsJson = request.headers.get("content-type")?.toLowerCase().includes("application/json") ?? false;
  const respond = (path: string, status: number, error: string, code: string) => wantsJson
    ? NextResponse.json({ error, code }, { status, headers: { "Cache-Control": "no-store, max-age=0" } })
    : NextResponse.redirect(new URL(path, appOrigin()), 303);
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return respond("/", 401, "Sign in to upgrade to UnlockED Pro.", "not_authenticated");
    await enforceRateLimit(request, "billing-checkout", 10, 10 * 60, session.user.id);
    if (isProUser(session.data.billing)) return respond("/profile?billing=already-pro", 409, "UnlockED Pro is already active on this account.", "already_pro");
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    const body = contentType.includes("application/json")
      ? await readBoundedJson<Record<string, unknown>>(request, 8 * 1024)
      : Object.fromEntries(await readBoundedForm(request, 8 * 1024));
    const planId = planIdFromRequest(body.planId);
    if (!planId) return respond("/pricing?billing=invalid-plan", 400, "Choose a valid Pro plan.", "invalid_plan");
    if (!stripeCheckoutConfigured(planId)) return respond("/profile?billing=not-configured", 503, "Checkout is temporarily unavailable. Please try again later.", "checkout_unavailable");
    const requestOrigin = new URL(request.url).origin;
    const checkout = await createProCheckoutSession(session.user, planId, session.data.billing.stripeCustomerId, requestOrigin);
    if (checkout.customer && typeof checkout.customer === "string") {
      await updateAccountBilling(session.user.id, { tier: "free", status: "incomplete", stripeCustomerId: checkout.customer, stripePriceId: priceIdForPlan(planId), billingInterval: planId === "pro_monthly" ? "month" : "year" });
    }
    const checkoutUrl = validatedRedirectUrl(checkout.url, ["stripe.com"]);
    if (!checkoutUrl) throw new Error("Stripe checkout did not return a trusted URL.");
    return wantsJson
      ? NextResponse.json({ url: checkoutUrl }, { headers: { "Cache-Control": "no-store, max-age=0" } })
      : NextResponse.redirect(checkoutUrl, 303);
  } catch (error) {
    console.error("[UnlockED billing] Checkout session failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    if (error instanceof SecurityError) return securityErrorResponse(error, "Checkout could not be started.");
    return respond("/profile?billing=checkout-failed", 502, "We couldn’t start checkout. Please try again.", "checkout_failed");
  }
}
