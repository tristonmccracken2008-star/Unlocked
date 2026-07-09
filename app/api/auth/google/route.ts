import { NextResponse } from "next/server";
import { createOAuthState, googleAuthUrl } from "@/lib/google-oauth";
import { oauthStateCookieName } from "@/lib/auth-store";

export async function GET(request: Request) {
  try {
    const state = createOAuthState();
    const response = NextResponse.redirect(googleAuthUrl(state));
    response.cookies.set(oauthStateCookieName, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 10 * 60, path: "/" });
    return response;
  } catch (error) {
    console.error("[UnlockED auth] Google sign-in unavailable", error);
    return NextResponse.redirect(new URL("/?auth=unavailable", request.url));
  }
}
