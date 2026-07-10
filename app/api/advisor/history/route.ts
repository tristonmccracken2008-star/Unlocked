import { NextResponse } from "next/server";
import { emptyAdvisorData, requireAdvisorSession, unauthorizedAdvisorResponse } from "@/lib/advisor/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await requireAdvisorSession();
  if (!session) return unauthorizedAdvisorResponse();
  return NextResponse.json({ ok: true, advisor: session.data.advisor ?? emptyAdvisorData() }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
