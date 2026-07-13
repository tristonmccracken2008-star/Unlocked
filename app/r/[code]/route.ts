import { NextRequest, NextResponse } from "next/server";
import { getReferralCodeOwner } from "@/lib/auth-store";
import { referralCookieName, sanitizeReferralCode } from "@/lib/referrals";
import { recordAnalyticsEvent } from "@/lib/analytics-store";
import { appOrigin, enforceRateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const destination = new URL("/", appOrigin());
  try {
    await enforceRateLimit(request, "referral-capture", 60, 10 * 60);
    const { code: rawCode } = await params;
    const code = sanitizeReferralCode(rawCode);
    if (!/^U[A-Z0-9]{7,15}$/.test(code)) return NextResponse.redirect(destination);
    const owner = await getReferralCodeOwner(code);
    const response = NextResponse.redirect(destination);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    if (owner) {
      response.cookies.set(referralCookieName, code, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
        priority: "high",
      });
      await recordAnalyticsEvent("referral_link_opened", `referral:${code}`, { referralCode: code }).catch((error) => console.warn("[UnlockED referrals] link-open analytics failed", { errorCategory: error instanceof Error ? error.name : "unknown" }));
    }
    return response;
  } catch (error) {
    console.error("[UnlockED referrals] link capture failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return NextResponse.redirect(destination);
  }
}
