import { NextResponse } from "next/server";
import { cleanFeedback, requireAdvisorSession, saveAdvisorData, unauthorizedAdvisorResponse } from "@/lib/advisor/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const session = await requireAdvisorSession();
  if (!session) return unauthorizedAdvisorResponse();
  try {
    const feedback = cleanFeedback(await request.json().catch(() => null), session.user.id);
    if (!feedback) return NextResponse.json({ error: "Invalid feedback" }, { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } });
    const completedActionEvidence = feedback.feedbackType === "completed" || feedback.feedbackType === "already-completed" || feedback.feedbackType === "already-applied" ? [feedback] : [];
    const advisor = await saveAdvisorData(session.user.id, session.data, { feedbackRecords: [feedback], completedActionEvidence });
    return NextResponse.json({ ok: true, feedback, advisor }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[UnlockED advisor] feedback failed", error);
    return NextResponse.json({ error: "Advisor feedback could not be saved" }, { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
