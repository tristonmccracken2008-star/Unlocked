import { NextResponse } from "next/server";
import { analyticsEvents, type AnalyticsEventProperties } from "@/lib/analytics-types";
import { recordAnalyticsEvent } from "@/lib/analytics-store";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; visitorId?: string; properties?: AnalyticsEventProperties };
    if (!analyticsEvents.includes(body.name as never) || !body.visitorId || body.visitorId.length > 80) return NextResponse.json({ error: "Invalid analytics event" }, { status: 400 });
    await recordAnalyticsEvent(body.name as (typeof analyticsEvents)[number], body.visitorId, body.properties);
    return NextResponse.json({ ok: true });
  } catch (error) { console.error("[UnlockED analytics] event failed", error); return NextResponse.json({ error: "Analytics unavailable" }, { status: 503 }); }
}
