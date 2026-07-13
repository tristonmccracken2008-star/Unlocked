import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getAnalyticsSummary } from "@/lib/analytics-store";
import { enforceRateLimit, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Administrator access required" }, { status: 403, headers: { "Cache-Control": "no-store, max-age=0" } });
    try { await enforceRateLimit(request, "admin-analytics", 30, 60, session.user.id); return NextResponse.json(await getAnalyticsSummary(), { headers: { "Cache-Control": "no-store, max-age=0" } }); }
    catch (error) { console.error("[UnlockED analytics] summary failed", { errorCategory: error instanceof Error ? error.name : "unknown" }); return securityErrorResponse(error, "Analytics summary unavailable."); }
}
