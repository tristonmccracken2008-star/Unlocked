import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { oauthCodeVerifierCookieName, oauthStateCookieName, revokeCurrentSession, sessionCookieName } from "@/lib/auth-store";
import { referralCookieName } from "@/lib/referrals";
import { assertSameOrigin, enforceRateLimit, SecurityError, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const cookieSecurity = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", expires: new Date(0), maxAge: 0, path: "/" };

function clearAuthenticationCookies(response: NextResponse) {
  response.cookies.set(sessionCookieName, "", { ...cookieSecurity, priority: "high" });
  response.cookies.set(oauthStateCookieName, "", { ...cookieSecurity, priority: "high" });
  response.cookies.set(oauthCodeVerifierCookieName, "", { ...cookieSecurity, priority: "high" });
  response.cookies.set(referralCookieName, "", { ...cookieSecurity, priority: "high" });
  return response;
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  try {
    assertSameOrigin(request);
    console.info("[UnlockED auth] Logout origin verified", { requestId, durationMs: Math.round(performance.now() - startedAt) });
    await enforceRateLimit(request, "auth-logout", 20, 10 * 60);
    console.info("[UnlockED auth] Logout rate limit complete", { requestId, durationMs: Math.round(performance.now() - startedAt) });
    const cookieStore = await cookies();
    const cookie = cookieStore.get(sessionCookieName)?.value;
    const result = await revokeCurrentSession(cookie);
    console.info("[UnlockED auth] Logout session revocation complete", { requestId, result, durationMs: Math.round(performance.now() - startedAt) });
    if (result === "invalid_session") {
      return clearAuthenticationCookies(NextResponse.json({ error: "Session is not valid." }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0", "X-Request-ID": requestId } }));
    }
    return clearAuthenticationCookies(NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store, max-age=0", "X-Request-ID": requestId } }));
  } catch (error) {
    const response = securityErrorResponse(error, "Sign out could not be completed.");
    if (error instanceof SecurityError) console.warn("[UnlockED auth] Logout rejected", { requestId, code: error.code, durationMs: Math.round(performance.now() - startedAt) });
    else console.error("[UnlockED auth] Logout failed", { requestId, errorCategory: error instanceof Error ? error.name : "unknown", durationMs: Math.round(performance.now() - startedAt) });
    return response;
  } finally {
    console.info("[UnlockED auth] Logout request complete", { requestId, durationMs: Math.round(performance.now() - startedAt) });
  }
}
