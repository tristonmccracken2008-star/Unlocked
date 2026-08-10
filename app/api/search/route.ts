import { NextResponse } from "next/server";
import { accountHasCompletedOnboarding } from "@/lib/auth-store";
import { listPublishedOpportunities } from "@/lib/content-store";
import { getServerSessionForProduct } from "@/lib/onboarding";
import { enforceRateLimit, securityErrorResponse } from "@/lib/security";
import { buildUniversalSearch } from "@/lib/universal-search";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const startedAt = performance.now();
  try {
    await enforceRateLimit(request, "universal-search", 120, 60);
    const session = await getServerSessionForProduct();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    if (!accountHasCompletedOnboarding(session.data) || !session.data.profile) {
      return NextResponse.json({ error: "Complete onboarding to search UnlockED." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120) ?? "";
    if (query.length < 2) return NextResponse.json({ query, results: [], totalOpportunityMatches: 0 }, { headers: { "Cache-Control": "no-store" } });
    const opportunities = await listPublishedOpportunities();
    const body = buildUniversalSearch({ user: session.user, account: session.data, opportunities, query });
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Server-Timing": `search;dur=${(performance.now() - startedAt).toFixed(1)}`,
      },
    });
  } catch (error) {
    console.error("[UnlockED search] request failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Search is temporarily unavailable.");
  }
}
