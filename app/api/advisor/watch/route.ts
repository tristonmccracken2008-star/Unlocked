import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { opportunities } from "@/data/opportunities";
import { getSession, sessionCookieName, updateWatchedOpportunity } from "@/lib/auth-store";
import { isProUser } from "@/lib/billing";
import { registerTrackedRecipient, unregisterTrackedRecipient } from "@/lib/notification-store";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const opportunityIds = new Set(opportunities.map((opportunity) => opportunity.id));

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    if (!isProUser(session.data.billing)) throw new SecurityError("Watching opportunities requires Pro.", 403, "pro_required");
    await enforceRateLimit(request, "advisor-watch", 90, 60, session.user.id);
    const body = await readBoundedJson<Record<string, unknown>>(request, 4 * 1024);
    const opportunityId = typeof body.opportunityId === "string" ? body.opportunityId : "";
    if (!opportunityIds.has(opportunityId) || typeof body.watching !== "boolean") {
      return NextResponse.json({ error: "Invalid watch request" }, { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const result = await updateWatchedOpportunity(session.user.id, opportunityId, body.watching);
    const stillInJourney = Boolean(result.account.tracker?.[opportunityId]
      || result.account.activity?.tracked?.[opportunityId]
      || result.account.savedOpportunities.some((item) => item.opportunityId === opportunityId));
    try {
      if (body.watching) await registerTrackedRecipient(session.user.id, opportunityId);
      else if (!stillInJourney) await unregisterTrackedRecipient(session.user.id, opportunityId);
    } catch (error) {
      console.warn("[UnlockED For You] Watch notification index update failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    }
    return NextResponse.json({
      ok: true,
      changed: result.changed,
      watched: Boolean(result.record),
      watchedOpportunityIds: (result.account.watchedOpportunities ?? []).map((item) => item.opportunityId),
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    if (error instanceof Error && error.message === "A protected account operation is already in progress.") {
      return securityErrorResponse(new SecurityError("A Watch update is already in progress.", 423, "watch_locked", 1), "Watch could not be updated.");
    }
    console.error("[UnlockED For You] Watch update failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Watch could not be updated.");
  }
}
