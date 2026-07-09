import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getAnalyticsSummary } from "@/lib/analytics-store";

export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  try { return NextResponse.json(await getAnalyticsSummary(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { console.error("[UnlockED analytics] summary failed", error); return NextResponse.json({ error: "Analytics summary unavailable" }, { status: 503 }); }
}
