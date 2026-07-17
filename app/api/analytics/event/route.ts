import { NextResponse } from "next/server";
import {
  analyticsEvents,
  analyticsSchemaVersion,
  sanitizeAnalyticsProperties,
  type AnalyticsEnvelope,
} from "@/lib/analytics-types";
import { recordAnalyticsEnvelope } from "@/lib/analytics-store";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, securityErrorResponse } from "@/lib/security";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };
const identifier = /^[A-Za-z0-9._:-]{8,80}$/;
const eventId = /^[A-Za-z0-9._:-]{8,120}$/;

function validEnvelope(value: unknown): AnalyticsEnvelope | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<AnalyticsEnvelope>;
  if (!eventId.test(candidate.id ?? "")
    || candidate.version !== analyticsSchemaVersion
    || !analyticsEvents.includes(candidate.name as never)
    || !identifier.test(candidate.visitorId ?? "")
    || typeof candidate.occurredAt !== "string") return null;
  const occurredAt = Date.parse(candidate.occurredAt);
  if (!Number.isFinite(occurredAt) || occurredAt < Date.now() - 25 * 60 * 60 * 1_000 || occurredAt > Date.now() + 5 * 60 * 1_000) return null;
  return {
    id: candidate.id!,
    version: analyticsSchemaVersion,
    name: candidate.name!,
    visitorId: candidate.visitorId!,
    occurredAt: new Date(occurredAt).toISOString(),
    properties: sanitizeAnalyticsProperties(candidate.name!, candidate.properties),
  };
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "analytics-event", 120, 60);
    const body = await readBoundedJson<{ events?: unknown; name?: unknown; visitorId?: unknown; properties?: unknown }>(request, 32 * 1024);
    const legacyEnvelope = body.name && body.visitorId ? {
      id: crypto.randomUUID(),
      version: analyticsSchemaVersion,
      name: body.name,
      visitorId: body.visitorId,
      occurredAt: new Date().toISOString(),
      properties: body.properties,
    } : null;
    const values = Array.isArray(body.events) ? body.events.slice(0, 20) : legacyEnvelope ? [legacyEnvelope] : [];
    if (!values.length) return NextResponse.json({ error: "Invalid analytics batch" }, { status: 400, headers: noStoreHeaders });
    const envelopes = values.map(validEnvelope);
    if (envelopes.some((event) => !event)) return NextResponse.json({ error: "Invalid analytics event" }, { status: 400, headers: noStoreHeaders });
    const accepted = envelopes as AnalyticsEnvelope[];
    await Promise.all(accepted.map((event) => recordAnalyticsEnvelope(event)));
    return NextResponse.json({ ok: true, acceptedIds: accepted.map((event) => event.id) }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[UnlockED analytics] event batch failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Analytics unavailable.");
  }
}
