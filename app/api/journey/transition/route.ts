import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { journeyProgressTransitions, opportunityTrackerStatuses, type JourneyMilestoneDetails, type JourneyProgressTransition, type OpportunityTrackerStatus } from "@/data/student-activity";
import { isJourneyProfessionalStageId } from "@/data/journey-professional";
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
  const professionalStageId = typeof body.professionalStageId === "string" && isJourneyProfessionalStageId(body.professionalStageId) ? body.professionalStageId : undefined;
  const transition = journeyProgressTransitions.includes(body.transition as JourneyProgressTransition) ? body.transition as JourneyProgressTransition : undefined;
  if (!professionalStageId && !transition) throw new SecurityError("Invalid transition.", 422, "invalid_transition");
  if (!opportunityTrackerStatuses.includes(body.expectedStatus as OpportunityTrackerStatus)) throw new SecurityError("Invalid current status.", 400, "invalid_request");
  if (!Number.isInteger(body.expectedVersion) || Number(body.expectedVersion) < 0) throw new SecurityError("Invalid record version.", 400, "invalid_request");
  if (typeof body.idempotencyKey !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(body.idempotencyKey)) throw new SecurityError("Invalid request identifier.", 400, "invalid_request");
  const details = cleanDetails(body.details);
  return {
    opportunityId: body.opportunityId,
    transition,
    professionalStageId,
    details,
    expectedStatus: body.expectedStatus as OpportunityTrackerStatus,
    expectedVersion: Number(body.expectedVersion),
    idempotencyKey: body.idempotencyKey,
  };
}

function cleanDetails(value: unknown): JourneyMilestoneDetails | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const notes = typeof input.notes === "string" ? input.notes.trim().slice(0, 1200) : undefined;
  const milestoneTime = typeof input.milestoneDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.milestoneDate) ? Date.parse(`${input.milestoneDate}T12:00:00.000Z`) : Number.NaN;
  const milestoneDate = Number.isFinite(milestoneTime) && milestoneTime >= Date.UTC(2000, 0, 1) && milestoneTime <= Date.now() + 86_400_000 ? input.milestoneDate as string : undefined;
  const reminderTime = typeof input.reminderAt === "string" ? Date.parse(input.reminderAt) : Number.NaN;
  const reminderAt = Number.isFinite(reminderTime) && reminderTime >= Date.now() - 86_400_000 && reminderTime <= Date.now() + 5 * 365 * 86_400_000 ? new Date(reminderTime).toISOString() : undefined;
  const documents = Array.isArray(input.documents) ? input.documents.slice(0, 3).flatMap((document) => {
    if (!document || typeof document !== "object" || Array.isArray(document)) return [];
    const candidate = document as Record<string, unknown>;
    const id = typeof candidate.id === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(candidate.id) ? candidate.id : undefined;
    const name = typeof candidate.name === "string" ? candidate.name.trim().slice(0, 120) : "";
    if (!id || !name) return [];
    return [{ id, name, mimeType: typeof candidate.mimeType === "string" ? candidate.mimeType.slice(0, 100) : undefined, size: typeof candidate.size === "number" && Number.isFinite(candidate.size) ? Math.max(0, Math.min(candidate.size, 25_000_000)) : undefined, stored: false as const }];
  }) : undefined;
  if (!notes && !milestoneDate && !reminderAt && !documents?.length) return undefined;
  return { notes, milestoneDate, reminderAt, documents, source: "student_reported" };
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
