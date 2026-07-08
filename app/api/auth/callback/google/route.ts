import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createSession, oauthStateCookieName, sessionCookieName, upsertUser } from "@/lib/auth-store";
import { appUrl, exchangeGoogleCode } from "@/lib/google-oauth";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(oauthStateCookieName)?.value;
  if (!code || !state || !expectedState || state !== expectedState) return NextResponse.redirect(`${appUrl()}/profile?auth=failed`);
  try {
    const googleUser = await exchangeGoogleCode(code);
    const user = await upsertUser({ googleSub: googleUser.sub, email: googleUser.email, name: googleUser.name, image: googleUser.picture });
    const session = await createSession(user.id);
    const response = NextResponse.redirect(`${appUrl()}/profile?auth=signed-in`);
    response.cookies.delete(oauthStateCookieName);
    response.cookies.set(sessionCookieName, session.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: session.expires, path: "/" });
    return response;
  } catch {
    return NextResponse.redirect(`${appUrl()}/profile?auth=failed`);
  }
}
