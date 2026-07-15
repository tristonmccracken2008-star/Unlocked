import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { journeyProgressTransitions, opportunityTrackerStatuses, type JourneyProgressTransition, type OpportunityTrackerStatus } from "@/data/student-activity";
import { JourneyTransitionError } from "@/data/journey-transformations";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { transformJourneyProgress } from "@/lib/journey-transition-service";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SecurityError("Invalid transition request.", 400, "invalid_request");
  const body = value as Record<string, unknown>;
  if (typeof body.opportunityId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(body.opportunityId)) throw new SecurityError("Invalid opportunity.", 400, "invalid_request");
  if (!journeyProgressTransitions.includes(body.transition as JourneyProgressTransition)) throw new SecurityError("Invalid transition.", 422, "invalid_transition");
  if (!opportunityTrackerStatuses.includes(body.expectedStatus as OpportunityTrackerStatus)) throw new SecurityError("Invalid current status.", 400, "invalid_request");
  if (!Number.isInteger(body.expectedVersion) || Number(body.expectedVersion) < 0) throw new SecurityError("Invalid record version.", 400, "invalid_request");
  if (typeof body.idempotencyKey !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(body.idempotencyKey)) throw new SecurityError("Invalid request identifier.", 400, "invalid_request");
  return {
    opportunityId: body.opportunityId,
    transition: body.transition as JourneyProgressTransition,
    expectedStatus: body.expectedStatus as OpportunityTrackerStatus,
    expectedVersion: Number(body.expectedVersion),
    idempotencyKey: body.idempotencyKey,
  };
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Your session has ended. Sign in again to update your Journey.", code: "not_authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    await enforceRateLimit(request, "journey-transition", 60, 60, session.user.id);
    const mutation = parseBody(await readBoundedJson(request, 8 * 1024));
    const result = await transformJourneyProgress(session.user, mutation);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    if (error instanceof JourneyTransitionError) {
      const status = error.code === "stale_state" ? 409 : error.code === "invalid_transition" ? 422 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    if (error instanceof SecurityError) return securityErrorResponse(error, "Journey progress could not be updated.");
    const lockConflict = error instanceof Error && /already in progress/i.test(error.message);
    if (lockConflict) return NextResponse.json({ error: "Another Journey update is still being saved. Try again in a moment.", code: "operation_locked" }, { status: 423, headers: { "Cache-Control": "no-store, max-age=0" } });
    console.error("[UnlockED Journey] Transition failed", {
      errorCategory: error instanceof Error ? error.name : "unknown",
      ...(process.env.NODE_ENV !== "production" && error instanceof Error ? { diagnostic: error.message } : {}),
    });
    return NextResponse.json({ error: "We couldn’t save this update. Your previous status is unchanged.", code: "transition_failed" }, { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
