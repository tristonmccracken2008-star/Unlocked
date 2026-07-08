import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSession, sessionCookieName } from "@/lib/auth-store";

export async function POST() {
  const cookieStore = await cookies();
  await deleteSession(cookieStore.get(sessionCookieName)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(sessionCookieName);
  return response;
}
