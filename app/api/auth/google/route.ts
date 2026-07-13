import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createOAuthCodeVerifier, createOAuthState, googleAuthUrl, oauthCodeChallenge } from "@/lib/google-oauth";
import { deleteSession, oauthCodeVerifierCookieName, oauthStateCookieName, sessionCookieName } from "@/lib/auth-store";
import { appOrigin, enforceRateLimit, safeLogText } from "@/lib/security";

export async function GET(request: Request) {
  try {
    if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") return NextResponse.redirect(new URL("/", appOrigin()));
    await enforceRateLimit(request, "auth-start", 20, 10 * 60);
    const cookieStore = await cookies();
    await deleteSession(cookieStore.get(sessionCookieName)?.value);
    const state = createOAuthState();
    const verifier = createOAuthCodeVerifier();
    const response = NextResponse.redirect(googleAuthUrl(state, oauthCodeChallenge(verifier)));
    response.cookies.set(sessionCookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: new Date(0), maxAge: 0, path: "/" });
    response.cookies.set(oauthStateCookieName, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 10 * 60, path: "/", priority: "high" });
    response.cookies.set(oauthCodeVerifierCookieName, verifier, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 10 * 60, path: "/", priority: "high" });
    return response;
  } catch (error) {
    console.error("[UnlockED auth] Google sign-in unavailable", { errorCategory: error instanceof Error ? error.name : "unknown", reason: safeLogText(error instanceof Error ? error.message : undefined) });
    return NextResponse.redirect(new URL("/?auth=unavailable", appOrigin()));
  }
}
