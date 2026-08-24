import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { opportunityPathIds, type OpportunityPathId } from "@/data/opportunity-paths";
import { recordAnalyticsEvent } from "@/lib/analytics-store";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { getSession, sessionCookieName, updateFollowedOpportunityPath } from "@/lib/auth-store";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Your session has ended. Sign in again to update Paths." }, { status: 401, headers: noStore });
    await enforceRateLimit(request, "opportunity-path-follow", 40, 60, session.user.id);
    const body = await readBoundedJson<Record<string, unknown>>(request, 2 * 1024);
    const pathId = typeof body.pathId === "string" && opportunityPathIds.includes(body.pathId as OpportunityPathId) ? body.pathId as OpportunityPathId : null;
    if (!pathId || typeof body.following !== "boolean") throw new SecurityError("Invalid Path update.", 400, "invalid_path_update");
    const result = await updateFollowedOpportunityPath(session.user.id, pathId, body.following);
    if (result.changed) await recordAnalyticsEvent(body.following ? productIntelligenceEvents.pathFollowed : productIntelligenceEvents.pathUnfollowed, session.user.id, { pathId });
    return NextResponse.json({ ok: true, changed: result.changed, following: Boolean(result.record), followedPathIds: Object.keys(result.account.pathPreferences ?? {}) }, { headers: noStore });
  } catch (error) {
    if (error instanceof Error && /already in progress/i.test(error.message)) return securityErrorResponse(new SecurityError("Another Path update is still saving.", 423, "path_locked", 1), "Path could not be updated.");
    if (!(error instanceof SecurityError)) console.error("[UnlockED Paths] Follow update failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Path could not be updated.");
  }
}
