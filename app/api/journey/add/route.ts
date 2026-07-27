import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { recordAnalyticsEvent } from "@/lib/analytics-store";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { addJourneyOpportunity } from "@/lib/journey-add-service";
import { syncUserNotificationSchedules } from "@/lib/notification-service";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const opportunityIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const validSources = new Set(["discover", "for_you", "opportunity"]);

function parseBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SecurityError("Invalid Journey request.", 400, "invalid_request");
  const body = value as Record<string, unknown>;
  if (typeof body.opportunityId !== "string" || !opportunityIdPattern.test(body.opportunityId)) throw new SecurityError("Invalid opportunity.", 400, "invalid_request");
  if (typeof body.idempotencyKey !== "string" || !requestIdPattern.test(body.idempotencyKey)) throw new SecurityError("Invalid request identifier.", 400, "invalid_request");
  const source = typeof body.source === "string" && validSources.has(body.source) ? body.source as "discover" | "for_you" | "opportunity" : "opportunity";
  return { opportunityId: body.opportunityId, idempotencyKey: body.idempotencyKey, source };
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Your session has ended. Sign in again to add this opportunity.", code: "not_authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    await enforceRateLimit(request, "journey-add", 40, 60, session.user.id);
    const mutation = parseBody(await readBoundedJson(request, 4 * 1024));
    const result = await addJourneyOpportunity(session.user, mutation);
    after(async () => {
      await syncUserNotificationSchedules(session.user.id).catch((error) => {
        console.warn("[UnlockED notifications] Journey schedule sync failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
      });
    });
    if (!result.duplicate) {
      const events = [
        recordAnalyticsEvent(productIntelligenceEvents.journeyOpportunityAdded, session.user.id, { opportunityId: mutation.opportunityId, source: mutation.source }),
        ...(result.firstSave ? [
          recordAnalyticsEvent(productIntelligenceEvents.firstOpportunitySaved, session.user.id, { source: mutation.source }),
          recordAnalyticsEvent(productIntelligenceEvents.activationAchieved, session.user.id, { source: mutation.source }),
        ] : []),
      ];
      await Promise.allSettled(events);
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    if (error instanceof SecurityError) return securityErrorResponse(error, "This opportunity could not be added.");
    if (error instanceof Error && error.name === "OnboardingRequiredError") return NextResponse.json({ error: error.message, code: "onboarding_required" }, { status: 409, headers: { "Cache-Control": "no-store, max-age=0" } });
    if (error instanceof Error && error.name === "OpportunityUnavailableError") return NextResponse.json({ error: error.message, code: "opportunity_unavailable" }, { status: 404, headers: { "Cache-Control": "no-store, max-age=0" } });
    if (error instanceof Error && /already in progress/i.test(error.message)) return NextResponse.json({ error: "Another Journey update is still saving. Try again in a moment.", code: "operation_locked" }, { status: 423, headers: { "Cache-Control": "no-store, max-age=0" } });
    console.error("[UnlockED Journey] Add failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "We couldn’t add this opportunity. Nothing changed.", code: "save_failed" }, { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
