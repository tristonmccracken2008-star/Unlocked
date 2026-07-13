import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, mergeAccountData, readAccountData, sessionCookieName } from "@/lib/auth-store";
import { isProUser } from "@/lib/billing";
import { cleanAccountDataInput } from "@/lib/account-input";
import { publicAccountData } from "@/lib/public-account";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "account-read", 180, 60);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    const data = await readAccountData(session.user.id);
    return NextResponse.json({ ok: true, data: publicAccountData(data) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[UnlockED account] Failed to load account data", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Account data could not be loaded.");
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    await enforceRateLimit(request, "account-write", 120, 60, session.user.id);
    const body = cleanAccountDataInput(await readBoundedJson(request, 256 * 1024));
    if (!Object.values(body).some((value) => value !== undefined)) return NextResponse.json({ error: "No valid account fields were provided" }, { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } });
    if (body.preferences?.appearance && body.preferences.appearance !== "light" && !isProUser(session.data.billing)) body.preferences.appearance = "light";
    const data = await mergeAccountData(session.user.id, body);
    return NextResponse.json({ ok: true, data: publicAccountData(data) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[UnlockED account] Failed to save account data", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Account data could not be saved.");
  }
}
