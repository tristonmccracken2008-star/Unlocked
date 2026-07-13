import { NextResponse } from "next/server";
import { cleanFeedback, requireAdvisorSession, saveAdvisorData, unauthorizedAdvisorResponse } from "@/lib/advisor/api";
import { redactInternalIdentifiers } from "@/lib/public-account";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const session = await requireAdvisorSession();
  if (!session) return unauthorizedAdvisorResponse();
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "advisor-feedback", 60, 60, session.user.id);
    const feedback = cleanFeedback(await readBoundedJson(request, 32 * 1024), session.user.id);
    if (!feedback) return NextResponse.json({ error: "Invalid feedback" }, { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } });
    const completedActionEvidence = feedback.feedbackType === "completed" || feedback.feedbackType === "already-completed" || feedback.feedbackType === "already-applied" ? [feedback] : [];
    const advisor = await saveAdvisorData(session.user.id, session.data, { feedbackRecords: [feedback], completedActionEvidence });
    return NextResponse.json({ ok: true, feedback: redactInternalIdentifiers(feedback), advisor: redactInternalIdentifiers(advisor) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[UnlockED advisor] feedback failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Advisor feedback could not be saved.");
  }
}
