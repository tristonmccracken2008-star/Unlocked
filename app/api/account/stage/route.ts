import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName, updateEducationalStage } from "@/lib/auth-store";
import { normalizeEducationalStage } from "@/lib/education-stages";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, securityErrorResponse } from "@/lib/security";
import { publicAccountData } from "@/lib/public-account";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    await enforceRateLimit(request, "educational-stage", 20, 60, session.user.id);
    const body = await readBoundedJson<Record<string, unknown>>(request, 2_048);
    const stage = normalizeEducationalStage(body.stage);
    if (!stage) return NextResponse.json({ error: "Choose a valid educational stage." }, { status: 400 });
    const data = await updateEducationalStage(session.user.id, stage);
    return NextResponse.json({ ok: true, data: publicAccountData(data) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return securityErrorResponse(error, "Educational stage could not be saved.");
  }
}
