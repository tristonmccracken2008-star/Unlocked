import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { accountHasCompletedOnboarding, attachReferralToUser, createSession, deleteSession, oauthCodeVerifierCookieName, oauthStateCookieName, readAccountData, sessionCookieName, upsertUser } from "@/lib/auth-store";
import { appUrl, exchangeGoogleCode } from "@/lib/google-oauth";
import { referralCookieName } from "@/lib/referrals";
import { constantTimeEqual, enforceRateLimit, safeLogText } from "@/lib/security";

function clearOAuthCookies(response: NextResponse) {
  response.cookies.set(oauthStateCookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: new Date(0), maxAge: 0, path: "/" });
  response.cookies.set(oauthCodeVerifierCookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: new Date(0), maxAge: 0, path: "/" });
  return response;
}

function failedAuthResponse() {
  return clearOAuthCookies(NextResponse.redirect(new URL("/?auth=failed", appUrl())));
}

export async function GET(request: NextRequest) {
  try {
    await enforceRateLimit(request, "auth-callback", 40, 10 * 60);
  } catch (error) {
    console.warn("[UnlockED auth] OAuth callback rate limited", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return failedAuthResponse();
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");
  const providerErrorDescription = url.searchParams.get("error_description");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(oauthStateCookieName)?.value;
  const codeVerifier = cookieStore.get(oauthCodeVerifierCookieName)?.value;
  if (!code || !state || !expectedState || !codeVerifier || !constantTimeEqual(state, expectedState)) {
    console.warn("[UnlockED auth] OAuth callback rejected because state/code was invalid", {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasExpectedState: Boolean(expectedState),
      hasCodeVerifier: Boolean(codeVerifier),
      providerError: safeLogText(providerError),
      providerErrorDescription: safeLogText(providerErrorDescription),
    });
    return failedAuthResponse();
  }
  try {
    const googleUser = await exchangeGoogleCode(code, codeVerifier);
    const user = await upsertUser({ googleSub: googleUser.sub, email: googleUser.email, name: googleUser.name, image: googleUser.picture });
    const referralCode = cookieStore.get(referralCookieName)?.value;
    if (referralCode) {
      const result = await attachReferralToUser(user.id, referralCode);
      console.info("[UnlockED referrals] OAuth referral attribution processed", { attached: result.attached, reason: result.reason });
    }
    const accountData = await readAccountData(user.id);
    console.info("[UnlockED auth] OAuth callback succeeded");
    await deleteSession(cookieStore.get(sessionCookieName)?.value);
    const session = await createSession(user);
    const response = NextResponse.redirect(new URL(accountHasCompletedOnboarding(accountData) ? "/advisor" : "/onboarding", appUrl()));
    clearOAuthCookies(response);
    response.cookies.delete(referralCookieName);
    response.cookies.set(sessionCookieName, session.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: session.expires, maxAge: 60 * 60 * 24 * 30, path: "/", priority: "high" });
    console.info("[UnlockED auth] Session cookie set", { cookieName: sessionCookieName, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch (error) {
    console.error("[UnlockED auth] OAuth callback failed", { errorCategory: error instanceof Error ? error.name : "unknown", reason: safeLogText(error instanceof Error ? error.message : undefined) });
    return failedAuthResponse();
  }
}
