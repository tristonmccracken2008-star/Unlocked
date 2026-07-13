import { NextResponse } from "next/server";
import { recommendationFor, requireAdvisorSession, saveAdvisorData, unauthorizedAdvisorResponse } from "@/lib/advisor/api";
import { redactInternalIdentifiers } from "@/lib/public-account";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const session = await requireAdvisorSession();
  if (!session) return unauthorizedAdvisorResponse();
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "advisor-recommend", 30, 60, session.user.id);
    const body = await readBoundedJson(request, 32 * 1024);
    const { normalizedProfile, output } = recommendationFor(session.user, session.data, body);
    await saveAdvisorData(session.user.id, session.data, { normalizedProfiles: [normalizedProfile], recommendationSnapshots: [output], auditRecords: [output.auditRecord] });
    return NextResponse.json({ ok: true, normalizedProfile: redactInternalIdentifiers(normalizedProfile), recommendation: redactInternalIdentifiers(output) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[UnlockED advisor] recommendation failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Advisor recommendation could not be generated.");
  }
}
