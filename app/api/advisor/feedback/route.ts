import { NextResponse } from "next/server";
import { opportunities } from "@/data/opportunities";
import { cleanFeedback, requireAdvisorSession, saveAdvisorData, unauthorizedAdvisorResponse } from "@/lib/advisor/api";
import { canUndoRecommendationFeedback, findFeedbackRequest } from "@/lib/advisor/feedback";
import { readAccountData, withSecurityLock } from "@/lib/auth-store";
import { redactInternalIdentifiers } from "@/lib/public-account";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const opportunityIds = new Set(opportunities.map((opportunity) => opportunity.id));

function validOpportunityFeedbackTarget(recommendationId: string, actionId: string) {
  if (!actionId.startsWith("opportunity:")) return true;
  const opportunityId = actionId.slice("opportunity:".length);
  return opportunityIds.has(opportunityId) && recommendationId === `recommendation-opportunity-${opportunityId}`;
}

export async function POST(request: Request) {
  const session = await requireAdvisorSession();
  if (!session) return unauthorizedAdvisorResponse();
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "advisor-feedback", 60, 60, session.user.id);
    const feedback = cleanFeedback(await readBoundedJson(request, 32 * 1024), session.user.id);
    if (!feedback) return NextResponse.json({ error: "Invalid feedback" }, { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } });
    if (!validOpportunityFeedbackTarget(feedback.recommendationId, feedback.actionId)) {
      return NextResponse.json({ error: "Invalid recommendation target" }, { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    try {
      return await withSecurityLock("advisor-feedback", session.user.id, async () => {
        const current = await readAccountData(session.user.id);
        const existing = findFeedbackRequest(current.advisor?.feedbackRecords ?? [], feedback.requestId);
        if (existing) {
          return NextResponse.json({ ok: true, deduplicated: true, feedback: redactInternalIdentifiers(existing) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
        }
        if (feedback.feedbackType === "undo" && !canUndoRecommendationFeedback(current.advisor?.feedbackRecords ?? [], feedback)) {
          return NextResponse.json({ error: "No active feedback to undo" }, { status: 409, headers: { "Cache-Control": "no-store, max-age=0" } });
        }
        const completedActionEvidence = feedback.feedbackType === "completed" || feedback.feedbackType === "already-completed" || feedback.feedbackType === "already-applied" ? [feedback] : [];
        const advisor = await saveAdvisorData(session.user.id, current, { feedbackRecords: [feedback], completedActionEvidence });
        return NextResponse.json({ ok: true, feedback: redactInternalIdentifiers(feedback), advisor: redactInternalIdentifiers(advisor) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "A protected account operation is already in progress.") {
        throw new SecurityError("Recommendation feedback is already being saved.", 423, "feedback_locked", 1);
      }
      throw error;
    }
  } catch (error) {
    console.error("[UnlockED advisor] feedback failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Advisor feedback could not be saved.");
  }
}
