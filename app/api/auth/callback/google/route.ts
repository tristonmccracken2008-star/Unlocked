import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { accountHasCompletedOnboarding, attachReferralToUser, createSession, oauthStateCookieName, readAccountData, sessionCookieName, upsertUser } from "@/lib/auth-store";
import { appUrl, exchangeGoogleCode } from "@/lib/google-oauth";
import { referralCookieName } from "@/lib/referrals";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");
  const providerErrorDescription = url.searchParams.get("error_description");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(oauthStateCookieName)?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    console.warn("[UnlockED auth] OAuth callback rejected because state/code was invalid", { hasCode: Boolean(code), hasState: Boolean(state), hasExpectedState: Boolean(expectedState), providerError, providerErrorDescription });
    return NextResponse.redirect(new URL("/?auth=failed", request.url));
  }
  try {
    const googleUser = await exchangeGoogleCode(code);
    const user = await upsertUser({ googleSub: googleUser.sub, email: googleUser.email, name: googleUser.name, image: googleUser.picture });
    const referralCode = cookieStore.get(referralCookieName)?.value;
    if (referralCode) {
      const result = await attachReferralToUser(user.id, referralCode);
      console.info("[UnlockED referrals] OAuth referral attribution processed", { attached: result.attached, reason: result.reason });
    }
    const accountData = await readAccountData(user.id);
    console.info("[UnlockED auth] OAuth callback succeeded");
    const session = await createSession(user);
    const response = NextResponse.redirect(new URL(accountHasCompletedOnboarding(accountData) ? "/advisor" : "/onboarding", appUrl()));
    response.cookies.delete(oauthStateCookieName);
    response.cookies.delete(referralCookieName);
    response.cookies.set(sessionCookieName, session.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: session.expires, maxAge: 60 * 60 * 24 * 30, path: "/" });
    console.info("[UnlockED auth] Session cookie set", { cookieName: sessionCookieName, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch (error) {
    console.error("[UnlockED auth] OAuth callback failed", error);
    return NextResponse.redirect(new URL("/?auth=failed", request.url));
  }
}
