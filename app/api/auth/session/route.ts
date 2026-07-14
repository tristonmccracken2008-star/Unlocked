import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import type { AccountSession } from "@/lib/account-types";
import { publicAccountSession } from "@/lib/public-account";
import { enforceRateLimit, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  try {
    await enforceRateLimit(request, "auth-session", 180, 60);
    console.info("[UnlockED auth] Session protection complete", { requestId, durationMs: Math.round(performance.now() - startedAt) });
    const cookieStore = await cookies();
    const cookie = cookieStore.get(sessionCookieName)?.value;
    const session = await getSession(cookie);
    console.info("[UnlockED auth] Session lookup complete", { requestId, authenticated: Boolean(session), durationMs: Math.round(performance.now() - startedAt) });
    const body: AccountSession = session ? publicAccountSession(session) : { authenticated: false, user: null, data: null };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store, max-age=0", "X-Request-ID": requestId } });
  } catch (error) {
    return securityErrorResponse(error, "Session could not be loaded.");
  } finally {
    console.info("[UnlockED auth] Session request complete", { requestId, durationMs: Math.round(performance.now() - startedAt) });
  }
}
