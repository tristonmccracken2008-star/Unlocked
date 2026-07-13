import { NextResponse } from "next/server";
import { emptyAdvisorData, requireAdvisorSession, unauthorizedAdvisorResponse } from "@/lib/advisor/api";
import { redactInternalIdentifiers } from "@/lib/public-account";
import { enforceRateLimit, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const session = await requireAdvisorSession();
    if (!session) return unauthorizedAdvisorResponse();
    await enforceRateLimit(request, "advisor-history", 60, 60, session.user.id);
    return NextResponse.json({ ok: true, advisor: redactInternalIdentifiers(session.data.advisor ?? emptyAdvisorData()) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return securityErrorResponse(error, "Advisor history could not be loaded.");
  }
}
