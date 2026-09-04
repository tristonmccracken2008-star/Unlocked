import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteAccount, getSession, sessionCookieName } from "@/lib/auth-store";
import { deleteUserNotificationData } from "@/lib/notification-store";
import { cancelStripeSubscription } from "@/lib/stripe";
import { recordAnalyticsEvent } from "@/lib/analytics-store";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";
import { normalizeOpportunityPassport } from "@/data/passport";
import { revokeCollection, revokePassport } from "@/lib/passport-public-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  let subscriptionCanceled = false;
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const token = cookieStore.get(sessionCookieName)?.value;
    const session = await getSession(token);
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    await enforceRateLimit(request, "account-deletion", 3, 24 * 60 * 60, session.user.id);
    const body = await readBoundedJson<Record<string, unknown>>(request, 2 * 1024);
    if (body.confirmation !== "DELETE") throw new SecurityError("Type DELETE to confirm account deletion.", 400, "confirmation_required");
    if (session.data.billing.stripeSubscriptionId) {
      await cancelStripeSubscription(session.data.billing.stripeSubscriptionId, session.user.id);
      subscriptionCanceled = true;
    }
    const passport = normalizeOpportunityPassport(session.data.passport);
    await Promise.all([revokePassport(passport.shareToken), ...passport.collections.map((collection) => revokeCollection(collection.shareToken))]);
    await deleteUserNotificationData(session.user.id);
    const result = await deleteAccount(session.user.id);
    await recordAnalyticsEvent("account_deletion_completed", session.user.id, { action: "confirmed" }).catch(() => undefined);
    const response = NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    response.cookies.set(sessionCookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: new Date(0),
      maxAge: 0,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("[UnlockED account] Deletion failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, subscriptionCanceled
      ? "Your subscription was canceled, but account deletion did not finish. Your account remains available; retry deletion."
      : "Your account could not be deleted. Your account remains available.");
  }
}
