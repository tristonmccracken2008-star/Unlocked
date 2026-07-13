import { NextRequest, NextResponse } from "next/server";
import { getReferralCodeOwner } from "@/lib/auth-store";
import { referralCookieName, sanitizeReferralCode } from "@/lib/referrals";
import { recordAnalyticsEvent } from "@/lib/analytics-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = sanitizeReferralCode(rawCode);
  const destination = new URL("/", request.url);
  if (!code) return NextResponse.redirect(destination);
  const owner = await getReferralCodeOwner(code);
  const response = NextResponse.redirect(destination);
  if (owner) {
    response.cookies.set(referralCookieName, code, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    await recordAnalyticsEvent("referral_link_opened", `referral:${code}`, { referralCode: code }).catch((error) => console.warn("[UnlockED referrals] link-open analytics failed", error));
  }
  return response;
}
