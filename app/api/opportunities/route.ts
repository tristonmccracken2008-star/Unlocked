import { NextResponse } from "next/server";
import { listPublishedOpportunities } from "@/lib/content-store";
import { enforceRateLimit, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "opportunity-catalog", 180, 60);
    const opportunities = await listPublishedOpportunities();
    const rawIds = new URL(request.url).searchParams.get("ids");
    const ids = rawIds?.split(",").map((item) => item.trim()).filter(Boolean);
    if (ids && (ids.length > 100 || ids.some((id) => !idPattern.test(id)))) {
      return NextResponse.json({ error: "Invalid opportunity IDs" }, { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const requested = ids ? new Set(ids) : null;
    const result = requested ? opportunities.filter((item) => requested.has(item.id)) : opportunities;
    return NextResponse.json({ opportunities: result }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("[UnlockED content] public catalog failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Opportunity catalog unavailable.");
  }
}
