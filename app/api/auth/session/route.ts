import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import type { AccountSession } from "@/lib/account-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(sessionCookieName)?.value;
  console.info("[UnlockED auth] Session endpoint cookie check", { cookieName: sessionCookieName, found: Boolean(cookie) });
  const session = await getSession(cookie);
  console.info("[UnlockED auth] Session endpoint result", { authenticated: Boolean(session), userId: session?.user.id ?? null });
  const body: AccountSession = session ? { authenticated: true, user: session.user, data: session.data } : { authenticated: false, user: null, data: null };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
