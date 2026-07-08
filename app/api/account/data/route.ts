import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, mergeAccountData, readAccountData, sessionCookieName } from "@/lib/auth-store";
import type { AccountData } from "@/lib/account-types";
import { isStudentProfile } from "@/data/student-profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function cleanData(value: unknown): Partial<AccountData> {
  if (!value || typeof value !== "object") return {};
  const input = value as Partial<AccountData>;
  const profile = input.profile && isStudentProfile(input.profile) ? input.profile : undefined;
  const activity = input.activity && typeof input.activity === "object" ? input.activity : undefined;
  const savedOpportunities = Array.isArray(input.savedOpportunities) ? input.savedOpportunities.filter((item) => item && typeof item === "object" && typeof item.opportunityId === "string" && typeof item.savedAt === "string") : undefined;
  const tracker = input.tracker && typeof input.tracker === "object" ? Object.fromEntries(Object.entries(input.tracker).filter(([id, item]) => typeof id === "string" && item && typeof item === "object" && typeof item.status === "string" && typeof item.savedAt === "string" && typeof item.updatedAt === "string")) : undefined;
  const preferences = input.preferences && typeof input.preferences === "object" && typeof input.preferences.updatedAt === "string" ? input.preferences : undefined;
  const journeyProgress = input.journeyProgress && typeof input.journeyProgress === "object" ? Object.fromEntries(Object.entries(input.journeyProgress).filter(([, item]) => typeof item === "boolean")) : undefined;
  return { profile, activity, savedOpportunities, tracker, preferences, journeyProgress };
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    const data = await readAccountData(session.user.id);
    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[UnlockED account] Failed to load account data", error);
    return NextResponse.json({ error: "Account data could not be loaded" }, { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    const body = cleanData(await request.json().catch(() => null));
    const data = await mergeAccountData(session.user.id, body);
    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[UnlockED account] Failed to save account data", error);
    return NextResponse.json({ error: "Account data could not be saved" }, { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
