import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accomplishmentKinds, accomplishmentOutcomes, type AccomplishmentKind, type AccomplishmentOutcome } from "@/data/accomplishments";
import { mutateAccomplishment, AccomplishmentMutationError, type AccomplishmentFields, type AccomplishmentMutation } from "@/lib/accomplishment-service";
import { getSession, readAccountData, sessionCookieName } from "@/lib/auth-store";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "Cache-Control": "private, no-store, max-age=0" };
const idPattern = /^(?:manual|journey):[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const mutationPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

function text(value: unknown, maximum: number, required = false) {
  const result = typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maximum) : "";
  if (required && !result) throw new SecurityError("Complete the required accomplishment fields.", 400, "invalid_accomplishment");
  return result;
}

function date(value: unknown, required = false) {
  const result = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  if (required && !result) throw new SecurityError("Choose a valid date.", 400, "invalid_accomplishment");
  return result;
}

function fields(value: unknown, required: boolean): Partial<AccomplishmentFields> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SecurityError("Invalid accomplishment fields.", 400, "invalid_accomplishment");
  const input = value as Record<string, unknown>;
  const kind = accomplishmentKinds.includes(input.kind as AccomplishmentKind) ? input.kind as AccomplishmentKind : undefined;
  const outcome = accomplishmentOutcomes.includes(input.outcome as AccomplishmentOutcome) ? input.outcome as AccomplishmentOutcome : undefined;
  if (required && (!kind || !outcome)) throw new SecurityError("Choose an accomplishment type and outcome.", 400, "invalid_accomplishment");
  const startDate = date(input.startDate);
  const endDate = date(input.endDate);
  if (startDate && endDate && startDate > endDate) throw new SecurityError("The end date must be after the start date.", 400, "invalid_accomplishment");
  const result: Partial<AccomplishmentFields> = {};
  if (required || "title" in input) result.title = text(input.title, 180, required);
  if (required || "organization" in input) result.organization = text(input.organization, 180, required);
  if (kind) result.kind = kind;
  if (outcome) result.outcome = outcome;
  if (required || "outcomeDate" in input) result.outcomeDate = date(input.outcomeDate, required);
  if ("startDate" in input) result.startDate = startDate;
  if ("endDate" in input) result.endDate = endDate;
  const textFields = {
    roleTitle: 160, team: 160, location: 160, projectTitle: 180, mentor: 160, labOrGroup: 180,
    researchArea: 180, placement: 100, awardAmount: 100, description: 1_500, notes: 2_000,
  } as const;
  for (const [key, maximum] of Object.entries(textFields) as Array<[keyof typeof textFields, number]>) {
    if (key in input) result[key] = text(input[key], maximum);
  }
  if ("skills" in input) result.skills = Array.isArray(input.skills) ? [...new Set(input.skills.map((item) => text(item, 80)).filter(Boolean))].slice(0, 20) : [];
  return result;
}

function parseMutation(value: unknown): AccomplishmentMutation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SecurityError("Invalid accomplishment request.", 400, "invalid_accomplishment");
  const body = value as Record<string, unknown>;
  const idempotencyKey = typeof body.idempotencyKey === "string" && mutationPattern.test(body.idempotencyKey) ? body.idempotencyKey : undefined;
  if (!idempotencyKey) throw new SecurityError("Invalid request identifier.", 400, "invalid_accomplishment");
  if (body.action === "create") return { action: "create", idempotencyKey, fields: fields(body.fields, true) as AccomplishmentFields };
  const id = typeof body.id === "string" && idPattern.test(body.id) ? body.id : undefined;
  const expectedVersion = Number.isInteger(body.expectedVersion) && Number(body.expectedVersion) >= 0 ? Number(body.expectedVersion) : undefined;
  if (!id || expectedVersion === undefined) throw new SecurityError("Invalid accomplishment record.", 400, "invalid_accomplishment");
  if (body.action === "update") return { action: "update", id, expectedVersion, idempotencyKey, fields: fields(body.fields, false) };
  if (body.action === "remove") return { action: "remove", id, expectedVersion, idempotencyKey };
  throw new SecurityError("Invalid accomplishment action.", 400, "invalid_accomplishment");
}

async function authenticatedUser() {
  const cookieStore = await cookies();
  return await getSession(cookieStore.get(sessionCookieName)?.value);
}

export async function GET(request: Request) {
  try {
    const session = await authenticatedUser();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });
    await enforceRateLimit(request, "accomplishment-read", 120, 60, session.user.id);
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !idPattern.test(id)) throw new SecurityError("Invalid accomplishment record.", 400, "invalid_accomplishment");
    const record = (await readAccountData(session.user.id)).accomplishments?.[id];
    if (!record || record.hidden || record.inactiveAt) return NextResponse.json({ error: "Accomplishment not found." }, { status: 404, headers: noStore });
    return NextResponse.json({ ok: true, record }, { headers: noStore });
  } catch (error) {
    return securityErrorResponse(error, "The accomplishment could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await authenticatedUser();
    if (!session) return NextResponse.json({ error: "Your session has ended. Sign in again to update your record." }, { status: 401, headers: noStore });
    await enforceRateLimit(request, "accomplishment-write", 30, 60, session.user.id);
    const result = await mutateAccomplishment(session.user.id, parseMutation(await readBoundedJson(request, 20 * 1024)));
    return NextResponse.json({ ok: true, ...result }, { headers: noStore });
  } catch (error) {
    if (error instanceof AccomplishmentMutationError) {
      const status = error.code === "conflict" ? 409 : error.code === "not_found" ? 404 : error.code === "duplicate" ? 409 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status, headers: noStore });
    }
    if (!(error instanceof SecurityError)) console.error("[UnlockED accomplishments] Mutation failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "The accomplishment could not be saved.");
  }
}
