import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSession, oauthCodeVerifierCookieName, oauthStateCookieName, sessionCookieName } from "@/lib/auth-store";
import { referralCookieName } from "@/lib/referrals";
import { assertSameOrigin, enforceRateLimit, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "auth-logout", 20, 10 * 60);
    const cookieStore = await cookies();
    const cookie = cookieStore.get(sessionCookieName)?.value;
    console.info("[UnlockED auth] Logout requested", { cookieName: sessionCookieName, found: Boolean(cookie) });
    await deleteSession(cookie);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    response.cookies.set(sessionCookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: new Date(0), maxAge: 0, path: "/" });
    response.cookies.set(oauthStateCookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: new Date(0), maxAge: 0, path: "/" });
    response.cookies.set(oauthCodeVerifierCookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: new Date(0), maxAge: 0, path: "/" });
    response.cookies.set(referralCookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: new Date(0), maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    return securityErrorResponse(error, "Sign out could not be completed.");
  }
}
