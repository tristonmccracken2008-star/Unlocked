import { NextResponse } from "next/server";
import { processDueNotificationBatch } from "@/lib/notification-service";

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
    const result = await processDueNotificationBatch(new Date(), 100);
    console.info("[UnlockED notifications] Scheduler complete", { ...result, durationMs: Math.round(performance.now() - started) });
    return NextResponse.json({ ok: true, ...result }, { headers: noStore });
  } catch (error) {
    console.error("[UnlockED notifications] Scheduler failed", { errorCategory: error instanceof Error ? error.name : "unknown", durationMs: Math.round(performance.now() - started) });
    return NextResponse.json({ error: "Scheduler failed safely." }, { status: 500, headers: noStore });
  }
}

