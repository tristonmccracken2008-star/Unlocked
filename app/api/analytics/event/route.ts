import { NextResponse } from "next/server";
import { analyticsEvents, type AnalyticsEventProperties } from "@/lib/analytics-types";
import { recordAnalyticsEvent } from "@/lib/analytics-store";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, securityErrorResponse } from "@/lib/security";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };
const propertyKeys = new Set(["opportunityId", "recommendationId", "milestoneId", "status", "section", "searchType", "searchValue", "filterName", "filterValue", "milestoneTitle", "stepId", "stepIndex", "stepCount", "reason", "referralCode", "referralReward"]);

function cleanProperties(value: unknown): AnalyticsEventProperties {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value).slice(0, 20)) {
    if (!propertyKeys.has(key) || typeof raw !== "string") continue;
    const cleaned = raw.trim().slice(0, 120);
    if (cleaned) result[key] = cleaned;
  }
  if (result.searchType && !["school", "major", "global", "opportunity"].includes(result.searchType)) delete result.searchType;
  return result as AnalyticsEventProperties;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "analytics-event", 120, 60);
    const body = await readBoundedJson<{ name?: unknown; visitorId?: unknown; properties?: unknown }>(request, 8 * 1024);
    const visitorId = typeof body.visitorId === "string" ? body.visitorId.trim() : "";
    if (!analyticsEvents.includes(body.name as never) || !/^[A-Za-z0-9._:-]{8,80}$/.test(visitorId)) {
      return NextResponse.json({ error: "Invalid analytics event" }, { status: 400, headers: noStoreHeaders });
    }
    await recordAnalyticsEvent(body.name as (typeof analyticsEvents)[number], visitorId, cleanProperties(body.properties));
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[UnlockED analytics] event failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Analytics unavailable.");
  }
}
