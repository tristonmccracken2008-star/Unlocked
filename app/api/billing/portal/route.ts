import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { createCustomerPortalSession, stripePortalConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(sessionCookieName)?.value);
  if (!session) return NextResponse.redirect(new URL("/", request.url), 303);
  const customerId = session.data.billing.stripeCustomerId;
  if (!stripePortalConfigured() || !customerId) return NextResponse.redirect(new URL("/profile?billing=portal-unavailable", request.url), 303);
  try {
    const portal = await createCustomerPortalSession(customerId);
    return NextResponse.redirect(portal.url, 303);
  } catch (error) {
    console.error("[UnlockED billing] Portal session failed", error);
    return NextResponse.redirect(new URL("/profile?billing=portal-failed", request.url), 303);
  }
}
