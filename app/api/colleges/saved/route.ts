import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName, updateSavedCollege } from "@/lib/auth-store";
import { getCollege } from "@/lib/colleges";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, securityErrorResponse } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (session.data.educationalStage !== "high_school") return NextResponse.json({ error: "College Explorer is available in High School UnlockED." }, { status: 403 });
    await enforceRateLimit(request, "saved-college", 60, 60, session.user.id);
    const body = await readBoundedJson<Record<string, unknown>>(request, 2_048);
    const collegeId = typeof body.collegeId === "string" ? body.collegeId : "";
    const college = getCollege(collegeId);
    if (!college || typeof body.saved !== "boolean") return NextResponse.json({ error: "Invalid college save request." }, { status: 400 });
    const result = await updateSavedCollege(session.user.id, college.id, body.saved);
    return NextResponse.json({ ok: true, saved: body.saved, changed: result.changed }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return securityErrorResponse(error, "College could not be saved.");
  }
}
