import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { createCustomerPortalSession, stripePortalConfigured } from "@/lib/stripe";
import { appOrigin, assertSameOrigin, enforceRateLimit, SecurityError, securityErrorResponse, validatedRedirectUrl } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.redirect(new URL("/", appOrigin()), 303);
    await enforceRateLimit(request, "billing-portal", 10, 10 * 60, session.user.id);
    const customerId = session.data.billing.stripeCustomerId;
    if (!stripePortalConfigured() || !customerId) return NextResponse.redirect(new URL("/profile?billing=portal-unavailable", appOrigin()), 303);
    const portal = await createCustomerPortalSession(customerId);
    const portalUrl = validatedRedirectUrl(portal.url, ["stripe.com"]);
    if (!portalUrl) throw new Error("Stripe portal did not return a trusted URL.");
    return NextResponse.redirect(portalUrl, 303);
  } catch (error) {
    console.error("[UnlockED billing] Portal session failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    if (error instanceof SecurityError) return securityErrorResponse(error, "Billing portal could not be opened.");
    return NextResponse.redirect(new URL("/profile?billing=portal-failed", appOrigin()), 303);
  }
}
