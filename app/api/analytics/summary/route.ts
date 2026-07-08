import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { getAnalyticsSummary } from "@/lib/analytics-store";

export const dynamic = "force-dynamic";
export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(sessionCookieName)?.value);
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((email)=>email.trim().toLowerCase()).filter(Boolean);
  const permitted = Boolean(session?.user.email && (admins.includes(session.user.email.toLowerCase()) || process.env.NODE_ENV !== "production" && admins.length === 0));
  if (!permitted) return NextResponse.json({ error: admins.length ? "Administrator access required" : "Set ADMIN_EMAILS to enable production analytics access" }, { status: 403 });
  try { return NextResponse.json(await getAnalyticsSummary(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { console.error("[UnlockED analytics] summary failed", error); return NextResponse.json({ error: "Analytics summary unavailable" }, { status: 503 }); }
}
