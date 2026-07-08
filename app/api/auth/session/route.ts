import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import type { AccountSession } from "@/lib/account-types";

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(sessionCookieName)?.value);
  const body: AccountSession = session ? { authenticated: true, user: session.user, data: session.data } : { authenticated: false, user: null, data: null };
  return NextResponse.json(body);
}
