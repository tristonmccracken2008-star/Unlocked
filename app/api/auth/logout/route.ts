import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSession, oauthStateCookieName, sessionCookieName } from "@/lib/auth-store";
import { referralCookieName } from "@/lib/referrals";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(sessionCookieName)?.value;
  console.info("[UnlockED auth] Logout requested", { cookieName: sessionCookieName, found: Boolean(cookie) });
  await deleteSession(cookie);
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  response.cookies.set(sessionCookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: new Date(0), maxAge: 0, path: "/" });
  response.cookies.set(oauthStateCookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: new Date(0), maxAge: 0, path: "/" });
  response.cookies.set(referralCookieName, "", { sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: new Date(0), maxAge: 0, path: "/" });
  return response;
}
