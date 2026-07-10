import { NextResponse } from "next/server";
import { recommendationFor, requireAdvisorSession, saveAdvisorData, unauthorizedAdvisorResponse } from "@/lib/advisor/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const session = await requireAdvisorSession();
  if (!session) return unauthorizedAdvisorResponse();
  try {
    const body = await request.json().catch(() => null);
    const { normalizedProfile, output } = recommendationFor(session.user, session.data, body);
    await saveAdvisorData(session.user.id, session.data, { normalizedProfiles: [normalizedProfile], recommendationSnapshots: [output], auditRecords: [output.auditRecord] });
    return NextResponse.json({ ok: true, normalizedProfile, recommendation: output }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[UnlockED advisor] recommendation failed", error);
    return NextResponse.json({ error: "Advisor recommendation could not be generated" }, { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
