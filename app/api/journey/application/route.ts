import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { syncUserNotificationSchedules } from "@/lib/notification-service";
import { updateApplicationWorkspace, type ApplicationWorkspaceMutation } from "@/lib/application-workspace-service";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "Cache-Control": "no-store, max-age=0" };
const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const safeRequestId = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}
function draftText(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").slice(0, max) : "";
}
function positiveLimit(value: unknown, maximum: number) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maximum) throw new SecurityError("Add a valid response limit.", 400, "invalid_limit");
  return parsed;
}

function cleanDate(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new SecurityError("Choose a valid task due date.", 400, "invalid_task_date");
  const parsed = Date.parse(`${value}T12:00:00.000Z`);
  if (!Number.isFinite(parsed) || parsed < Date.UTC(2000, 0, 1) || parsed > Date.now() + 5 * 365 * 86_400_000) throw new SecurityError("Choose a valid task due date.", 400, "invalid_task_date");
  return value;
}

function parseMutation(value: unknown): ApplicationWorkspaceMutation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SecurityError("Invalid application task request.", 400, "invalid_request");
  const body = value as Record<string, unknown>;
  const opportunityId = cleanText(body.opportunityId, 160);
  const expectedVersion = Number(body.expectedVersion);
  if (!safeId.test(opportunityId) || !Number.isInteger(expectedVersion) || expectedVersion < 0) throw new SecurityError("Invalid application workspace state.", 400, "invalid_request");
  if (body.action === "add_task") {
    const title = cleanText(body.title, 120);
    const idempotencyKey = cleanText(body.idempotencyKey, 128);
    if (!title) throw new SecurityError("Add a task name.", 400, "invalid_task");
    if (!safeRequestId.test(idempotencyKey)) throw new SecurityError("Invalid request identifier.", 400, "invalid_request");
    return { action: "add_task", opportunityId, expectedVersion, idempotencyKey, title, dueDate: cleanDate(body.dueDate) };
  }
  if (body.action === "add_prompt") {
    const prompt = cleanText(body.prompt, 2_000); const idempotencyKey = cleanText(body.idempotencyKey, 128);
    if (!prompt || !safeRequestId.test(idempotencyKey) || (body.source !== "verified" && body.source !== "student")) throw new SecurityError("Add a valid written prompt.", 400, "invalid_prompt");
    return { action: "add_prompt", opportunityId, expectedVersion, idempotencyKey, prompt, source: body.source, sourceUrl: cleanText(body.sourceUrl, 500) || undefined, required: Boolean(body.required), wordLimit: positiveLimit(body.wordLimit, 10_000), characterLimit: positiveLimit(body.characterLimit, 100_000) };
  }
  if (body.action === "save_response") {
    const responseId = cleanText(body.responseId, 160); const expectedResponseVersion = Number(body.expectedResponseVersion);
    if (!safeRequestId.test(responseId) || !Number.isInteger(expectedResponseVersion) || expectedResponseVersion < 0 || (body.status !== "draft" && body.status !== "ready")) throw new SecurityError("Update a valid written response.", 400, "invalid_response");
    return { action: "save_response", opportunityId, expectedVersion, responseId, expectedResponseVersion, draft: draftText(body.draft, 100_000), status: body.status };
  }
  if (body.action === "add_recommender") {
    const name = cleanText(body.name, 120); const idempotencyKey = cleanText(body.idempotencyKey, 128); const statuses = ["not_requested", "planning", "requested", "confirmed", "submitted", "unknown", "declined"] as const;
    if (!name || !safeRequestId.test(idempotencyKey) || !statuses.includes(body.status as never)) throw new SecurityError("Add a valid recommender.", 400, "invalid_recommender");
    return { action: "add_recommender", opportunityId, expectedVersion, idempotencyKey, name, role: cleanText(body.role, 120) || undefined, organization: cleanText(body.organization, 160) || undefined, email: cleanText(body.email, 160) || undefined, relationship: cleanText(body.relationship, 300) || undefined, requestedDate: cleanDate(body.requestedDate), deadline: cleanDate(body.deadline), status: body.status as typeof statuses[number], notes: draftText(body.notes, 2_000).trim() || undefined };
  }
  if (body.action === "save_notes") return { action: "save_notes", opportunityId, expectedVersion, notes: draftText(body.notes, 4_000) };
  if (body.action === "save_answer_story") {
    const title = cleanText(body.title, 120); const idempotencyKey = cleanText(body.idempotencyKey, 128); if (!title || !safeRequestId.test(idempotencyKey)) throw new SecurityError("Add a valid Answer Bank story.", 400, "invalid_story");
    return { action: "save_answer_story", opportunityId, expectedVersion, idempotencyKey, title, category: cleanText(body.category, 80) || "custom", experienceIds: Array.isArray(body.experienceIds) ? [...new Set(body.experienceIds.filter((item): item is string => typeof item === "string" && safeId.test(item)))].slice(0, 20) : [], situation: draftText(body.situation, 4_000).trim() || undefined, actionText: draftText(body.actionText, 4_000).trim() || undefined, challenge: draftText(body.challenge, 4_000).trim() || undefined, result: draftText(body.result, 4_000).trim() || undefined, learning: draftText(body.learning, 4_000).trim() || undefined, notes: draftText(body.notes, 4_000).trim() || undefined };
  }
  if (body.action === "capture_submission") { const idempotencyKey = cleanText(body.idempotencyKey, 128); if (!safeRequestId.test(idempotencyKey)) throw new SecurityError("Invalid submission snapshot.", 400, "invalid_request"); return { action: "capture_submission", opportunityId, expectedVersion, idempotencyKey }; }
  const taskId = cleanText(body.taskId, 128);
  if (!safeRequestId.test(taskId)) throw new SecurityError("Invalid application task.", 400, "invalid_request");
  if (body.action === "set_completion" && typeof body.completed === "boolean") return { action: "set_completion", opportunityId, expectedVersion, taskId, completed: body.completed };
  if (body.action === "delete_task" || body.action === "restore_task") return { action: body.action, opportunityId, expectedVersion, taskId };
  throw new SecurityError("Invalid application task action.", 400, "invalid_request");
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Your session ended. Sign in again to update this application.", code: "not_authenticated" }, { status: 401, headers: noStore });
    await enforceRateLimit(request, "journey-application", 90, 60, session.user.id);
    const result = await updateApplicationWorkspace(session.user, parseMutation(await readBoundedJson(request, 128 * 1024)));
    after(async () => { await syncUserNotificationSchedules(session.user.id).catch(() => undefined); });
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    if (error instanceof Error && error.name === "ApplicationWorkspaceConflictError") return NextResponse.json({ error: error.message, code: "stale_workspace" }, { status: 409, headers: noStore });
    if (error instanceof Error && /already in progress/i.test(error.message)) return NextResponse.json({ error: "Another application update is still saving. Try again in a moment.", code: "operation_locked" }, { status: 423, headers: noStore });
    if (error instanceof Error && error.name === "ApplicationWorkspaceOwnershipError") return NextResponse.json({ error: "This application workspace is not available.", code: "unowned_opportunity" }, { status: 403, headers: noStore });
    if (error instanceof Error && error.name === "ApplicationWorkspaceUnavailableError") return NextResponse.json({ error: error.message, code: "opportunity_unavailable" }, { status: 404, headers: noStore });
    if (error instanceof Error && ["ApplicationTaskNotFoundError", "ApplicationTaskProtectedError", "ApplicationWorkspaceLimitError", "ApplicationWorkspaceIneligibleError"].includes(error.name)) return NextResponse.json({ error: error.message, code: "invalid_task_operation" }, { status: 422, headers: noStore });
    return securityErrorResponse(error, "This application could not be updated.");
  }
}
