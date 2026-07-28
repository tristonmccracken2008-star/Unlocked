import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, resetRecommendationSignals, sessionCookieName } from "@/lib/auth-store";
import { publicAccountData } from "@/lib/public-account";
import { assertSameOrigin, enforceRateLimit, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    await enforceRateLimit(request, "recommendation-reset", 3, 60 * 60, session.user.id);
    const data = await resetRecommendationSignals(session.user.id);
    return NextResponse.json({ ok: true, data: publicAccountData(data) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return securityErrorResponse(error, "Recommendation learning could not be reset.");
  }
}
