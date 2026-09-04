import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { completeFirstLaunch } from "@/lib/first-launch";
import { publicAccountData } from "@/lib/public-account";
import { assertSameOrigin, enforceRateLimit, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    await enforceRateLimit(request, "first-launch-completion", 12, 60, session.user.id);
    const result = await completeFirstLaunch(session.user.id);
    const pendingReturn = cookieStore.get("unlocked_return_to")?.value;
    const safeReturn = /^\/(?:opportunities|discover|p|c)\/[A-Za-z0-9._:%-]+(?:\?[A-Za-z0-9._~!$&'()*+,;=:@%/?-]*)?$/;
    const response = NextResponse.json({ ok: true, duplicate: result.duplicate, data: publicAccountData(result.data), returnTo: pendingReturn && safeReturn.test(pendingReturn) ? pendingReturn : "/opportunities" }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    response.cookies.delete("unlocked_return_to");
    return response;
  } catch (error) {
    console.error("[UnlockED first launch] Completion failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "The walkthrough could not be completed.");
  }
}
