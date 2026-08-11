import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerSessionForProduct } from "@/lib/onboarding";
import { createReturnExperienceReceipt, returnExperienceCookieName } from "@/lib/return-experience-receipt";
import { assertSameOrigin, enforceRateLimit, securityErrorResponse } from "@/lib/security";

const noStore = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getServerSessionForProduct();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: noStore });
    await enforceRateLimit(request, "return-experience", 30, 60, session.user.id);
    const now = new Date();
    const response = NextResponse.json({ ok: true }, { headers: noStore });
    response.cookies.set(returnExperienceCookieName, createReturnExperienceReceipt(session.user.id, now), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
    return response;
  } catch (error) {
    return securityErrorResponse(error, "Return activity could not be recorded.");
  }
}
