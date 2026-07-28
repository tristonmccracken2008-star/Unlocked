import { NextResponse } from "next/server";
import { processDueNotificationBatch } from "@/lib/notification-service";
import { processOpportunityLifecycleBatch } from "@/lib/opportunity-lifecycle-service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const noStore = { "Cache-Control": "no-store, max-age=0" };

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Not authorized" }, { status: 401, headers: noStore });
  const started = performance.now();
  try {
    const now = new Date();
    const lifecycle = await processOpportunityLifecycleBatch(now, 100);
    const result = await processDueNotificationBatch(now, 100);
    console.info("[UnlockED notifications] Scheduler complete", { ...result, lifecycle, durationMs: Math.round(performance.now() - started) });
    return NextResponse.json({ ok: true, ...result, lifecycle }, { headers: noStore });
  } catch (error) {
    console.error("[UnlockED notifications] Scheduler failed", { errorCategory: error instanceof Error ? error.name : "unknown", durationMs: Math.round(performance.now() - started) });
    return NextResponse.json({ error: "Scheduler failed safely." }, { status: 500, headers: noStore });
  }
}
