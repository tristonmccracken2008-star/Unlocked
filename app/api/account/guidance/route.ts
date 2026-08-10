import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName, updateGuidanceState } from "@/lib/auth-store";
import { guidanceVersions, isGuidanceId, type GuidanceStatus } from "@/lib/guidance";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Your session ended. Sign in again to save this preference." }, { status: 401, headers: noStore });
    await enforceRateLimit(request, "guidance-state", 30, 60, session.user.id);
    const body = await readBoundedJson<Record<string, unknown>>(request, 2 * 1024);
    const status = body.status;
    if (!isGuidanceId(body.id) || !["completed", "dismissed"].includes(String(status))) {
      throw new SecurityError("Invalid guide update.", 400, "invalid_guidance_update");
    }
    const data = await updateGuidanceState(session.user.id, { id: body.id, status: status as GuidanceStatus });
    return NextResponse.json({ ok: true, record: data.guidance?.[body.id], guideVersion: guidanceVersions[body.id] }, { headers: noStore });
  } catch (error) {
    if (error instanceof Error && /already in progress/i.test(error.message)) {
      return NextResponse.json({ error: "Another preference is still saving. Try again in a moment.", code: "operation_locked" }, { status: 423, headers: noStore });
    }
    return securityErrorResponse(error, "This guide preference could not be saved.");
  }
}
