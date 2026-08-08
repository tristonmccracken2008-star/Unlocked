import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { journeyCalendarEventTypes, type JourneyCalendarEventRecord, type JourneyCalendarEventType } from "@/lib/account-types";
import { getSession, mutateJourneyCalendarEvent, readAccountData, sessionCookieName } from "@/lib/auth-store";
import { syncUserNotificationSchedules } from "@/lib/notification-service";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "Cache-Control": "no-store, max-age=0" };
const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const reminderOptions = new Set([0, 60, 1_440, 10_080]);

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function cleanDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T12:00:00.000Z`);
  return Number.isFinite(timestamp) && timestamp >= Date.UTC(2000, 0, 1) && timestamp <= Date.now() + 5 * 365 * 86_400_000 ? value : null;
}

function cleanTime(value: unknown) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : undefined;
}

async function authenticated() {
  const cookieStore = await cookies();
  return await getSession(cookieStore.get(sessionCookieName)?.value);
}

async function parseEvent(value: unknown, userId: string, existing?: JourneyCalendarEventRecord) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SecurityError("Invalid calendar request.", 400, "invalid_request");
  const body = value as Record<string, unknown>;
  const idempotencyKey = cleanText(body.idempotencyKey, 96);
  const id = existing?.id ?? (safeId.test(idempotencyKey) ? `calendar:${idempotencyKey}`.slice(0, 127) : "");
  if (!safeId.test(id)) throw new SecurityError("Invalid request identifier.", 400, "invalid_request");
  const title = cleanText(body.title, 120);
  const date = cleanDate(body.date);
  const type = journeyCalendarEventTypes.includes(body.type as JourneyCalendarEventType) ? body.type as JourneyCalendarEventType : null;
  if (!title || !date || !type) throw new SecurityError("Add a title, date, and date type.", 400, "invalid_calendar_event");
  const opportunityId = cleanText(body.opportunityId, 160) || undefined;
  if (opportunityId) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(opportunityId)) throw new SecurityError("Invalid linked opportunity.", 400, "invalid_request");
    const account = await readAccountData(userId);
    const tracked = account.tracker?.[opportunityId] ?? account.activity?.tracked?.[opportunityId];
    if (!tracked) throw new SecurityError("Only opportunities in your Journey can be linked.", 403, "unowned_opportunity");
  }
  const reminder = Number(body.reminderMinutesBefore);
  const reminderMinutesBefore = reminderOptions.has(reminder) ? reminder : undefined;
  const now = new Date().toISOString();
  return {
    id,
    type,
    title,
    date,
    time: cleanTime(body.time),
    opportunityId,
    source: "user" as const,
    reminderMinutesBefore,
    completed: existing?.completed ?? false,
    dismissed: false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    version: existing?.version ?? 0,
  } satisfies JourneyCalendarEventRecord;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await authenticated();
    if (!session) return NextResponse.json({ error: "Your session ended. Sign in again to add this date." }, { status: 401, headers: noStore });
    await enforceRateLimit(request, "journey-calendar-write", 45, 60, session.user.id);
    const body = await readBoundedJson<Record<string, unknown>>(request, 8 * 1024);
    const event = await parseEvent(body, session.user.id);
    const result = await mutateJourneyCalendarEvent(session.user.id, { action: "create", event });
    after(async () => { await syncUserNotificationSchedules(session.user.id, result.account).catch(() => undefined); });
    return NextResponse.json({ ok: true, event: result.event, duplicate: result.duplicate }, { headers: noStore });
  } catch (error) {
    if (error instanceof Error && /already in progress/i.test(error.message)) return NextResponse.json({ error: "Another calendar update is still saving. Try again in a moment.", code: "operation_locked" }, { status: 423, headers: noStore });
    return securityErrorResponse(error, "This date could not be saved.");
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await authenticated();
    if (!session) return NextResponse.json({ error: "Your session ended. Sign in again to update this date." }, { status: 401, headers: noStore });
    await enforceRateLimit(request, "journey-calendar-write", 60, 60, session.user.id);
    const body = await readBoundedJson<Record<string, unknown>>(request, 8 * 1024);
    const id = cleanText(body.id, 127);
    const expectedVersion = Number(body.expectedVersion);
    const action = body.action;
    if (!safeId.test(id) || !Number.isInteger(expectedVersion) || expectedVersion < 0 || !["update", "complete", "dismiss"].includes(String(action))) throw new SecurityError("Invalid calendar update.", 400, "invalid_request");
    const account = await readAccountData(session.user.id);
    const existing = account.calendarEvents?.[id];
    if (!existing) throw new SecurityError("Calendar item not found.", 404, "calendar_event_not_found");
    const event = action === "update" ? await parseEvent({ ...body, idempotencyKey: id.replace(/^calendar:/, "") }, session.user.id, existing) : { ...existing, updatedAt: new Date().toISOString() };
    const result = await mutateJourneyCalendarEvent(session.user.id, { action: action as "update" | "complete" | "dismiss", event, expectedVersion });
    after(async () => { await syncUserNotificationSchedules(session.user.id, result.account).catch(() => undefined); });
    return NextResponse.json({ ok: true, event: result.event }, { headers: noStore });
  } catch (error) {
    if (error instanceof Error && error.name === "CalendarEventConflictError") return NextResponse.json({ error: error.message, code: "stale_event" }, { status: 409, headers: noStore });
    if (error instanceof Error && /already in progress/i.test(error.message)) return NextResponse.json({ error: "Another calendar update is still saving. Try again in a moment.", code: "operation_locked" }, { status: 423, headers: noStore });
    return securityErrorResponse(error, "This date could not be updated.");
  }
}
