import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, mergeAccountData, sessionCookieName } from "@/lib/auth-store";
import type { AccountData } from "@/lib/account-types";
import { isStudentProfile } from "@/data/student-profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function cleanData(value: unknown): Partial<AccountData> {
  if (!value || typeof value !== "object") return {};
  const input = value as Partial<AccountData>;
  const profile = input.profile && isStudentProfile(input.profile) ? input.profile : undefined;
  const activity = input.activity && typeof input.activity === "object" ? input.activity : undefined;
  const journeyProgress = input.journeyProgress && typeof input.journeyProgress === "object" ? Object.fromEntries(Object.entries(input.journeyProgress).filter(([, item]) => typeof item === "boolean")) : undefined;
  return { profile, activity, journeyProgress };
}

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(sessionCookieName)?.value);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = cleanData(await request.json().catch(() => null));
  const data = await mergeAccountData(session.user.id, body);
  return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
