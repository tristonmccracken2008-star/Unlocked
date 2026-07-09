import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName, updateAccountBilling } from "@/lib/auth-store";
import { createProCheckoutSession, stripeCheckoutConfigured, stripeConfig } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(sessionCookieName)?.value);
  if (!session) return NextResponse.redirect(new URL("/", request.url), 303);
  if (!stripeCheckoutConfigured()) return NextResponse.redirect(new URL("/profile?billing=not-configured", request.url), 303);
  try {
    const checkout = await createProCheckoutSession(session.user, session.data.billing.stripeCustomerId);
    if (checkout.customer && typeof checkout.customer === "string") {
      await updateAccountBilling(session.user.id, { stripeCustomerId: checkout.customer, stripePriceId: stripeConfig().proPriceId });
    }
    if (!checkout.url) throw new Error("Stripe checkout did not return a URL.");
    return NextResponse.redirect(checkout.url, 303);
  } catch (error) {
    console.error("[UnlockED billing] Checkout session failed", error);
    return NextResponse.redirect(new URL("/profile?billing=checkout-failed", request.url), 303);
  }
}
