import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import type { AccountSession } from "@/lib/account-types";
import { publicAccountSession } from "@/lib/public-account";
import { enforceRateLimit, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "auth-session", 180, 60);
    const cookieStore = await cookies();
    const cookie = cookieStore.get(sessionCookieName)?.value;
    const session = await getSession(cookie);
    const body: AccountSession = session ? publicAccountSession(session) : { authenticated: false, user: null, data: null };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return securityErrorResponse(error, "Session could not be loaded.");
  }
}
