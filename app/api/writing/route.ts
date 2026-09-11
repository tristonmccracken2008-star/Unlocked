import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { writingStatuses, type WritingIdea } from "@/data/writing";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";
import { updateWriting, type WritingMutation } from "@/lib/writing-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const noStore = { "Cache-Control": "private, no-store, max-age=0" };
const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const clean = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const content = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\r\n?/g, "\n").slice(0, max) : "";
const id = (value: unknown) => { const result = clean(value, 160); return safeId.test(result) ? result : ""; };
const number = (value: unknown) => Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : -1;
const date = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  const result = clean(value, 10);
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result + "T12:00:00Z"))) throw new SecurityError("Choose a valid planning date.", 400, "invalid_date");
  return result;
};
const storyNotes = (value: unknown): WritingIdea["storyNotes"] => {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    happened: content(input.happened, 4_000).trim() || undefined,
    remember: content(input.remember, 4_000).trim() || undefined,
    thinking: content(input.thinking, 4_000).trim() || undefined,
    changed: content(input.changed, 4_000).trim() || undefined,
    detail: content(input.detail, 4_000).trim() || undefined,
    whyRemember: content(input.whyRemember, 4_000).trim() || undefined,
  };
};

function parseMutation(value: unknown): WritingMutation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SecurityError("Invalid writing request.", 400, "invalid_request");
  const body = value as Record<string, unknown>;
  const expectedVersion = number(body.expectedVersion);
  if (expectedVersion < 0) throw new SecurityError("Invalid writing state.", 400, "invalid_request");
  if (body.action === "create_document") {
    const promptId = id(body.promptId);
    const idempotencyKey = id(body.idempotencyKey);
    if (!promptId || !idempotencyKey) throw new SecurityError("Choose a valid writing prompt.", 400, "invalid_prompt");
    return { action: "create_document", expectedVersion, idempotencyKey, promptId, title: clean(body.title, 160) || undefined, planningDate: date(body.planningDate) };
  }
  if (body.action === "save_document") {
    const documentId = id(body.documentId);
    const expectedDocumentVersion = number(body.expectedDocumentVersion);
    const title = clean(body.title, 160);
    if (!documentId || expectedDocumentVersion < 0 || !title || !writingStatuses.includes(body.status as never)) throw new SecurityError("This draft is missing required fields.", 400, "invalid_document");
    return { action: "save_document", expectedVersion, documentId, expectedDocumentVersion, title, content: content(body.content, 100_000), status: body.status as typeof writingStatuses[number], privateNotes: content(body.privateNotes, 10_000).trim() || undefined, planningDate: date(body.planningDate), checkpoint: body.checkpoint === true };
  }
  if (body.action === "restore_version") {
    const documentId = id(body.documentId);
    const versionId = id(body.versionId);
    const expectedDocumentVersion = number(body.expectedDocumentVersion);
    if (!documentId || !versionId || expectedDocumentVersion < 0) throw new SecurityError("Choose a valid version.", 400, "invalid_version");
    return { action: "restore_version", expectedVersion, documentId, expectedDocumentVersion, versionId };
  }
  if (body.action === "create_idea") {
    const idempotencyKey = id(body.idempotencyKey);
    const title = clean(body.title, 160);
    if (!idempotencyKey || !title) throw new SecurityError("Give this idea a short title.", 400, "invalid_idea");
    return { action: "create_idea", expectedVersion, idempotencyKey, title, category: clean(body.category, 60) || "Something ordinary but meaningful", notes: content(body.notes, 10_000).trim() || undefined, experienceId: id(body.experienceId) || undefined };
  }
  if (body.action === "save_idea") {
    const ideaId = id(body.ideaId);
    const expectedIdeaVersion = number(body.expectedIdeaVersion);
    const title = clean(body.title, 160);
    if (!ideaId || expectedIdeaVersion < 0 || !title) throw new SecurityError("This idea is missing required fields.", 400, "invalid_idea");
    return { action: "save_idea", expectedVersion, ideaId, expectedIdeaVersion, title, category: clean(body.category, 60) || "Something ordinary but meaningful", notes: content(body.notes, 10_000).trim() || undefined, storyNotes: storyNotes(body.storyNotes) };
  }
  if (body.action === "attach_idea") {
    const documentId = id(body.documentId);
    const ideaId = id(body.ideaId);
    const expectedDocumentVersion = number(body.expectedDocumentVersion);
    if (!documentId || !ideaId || expectedDocumentVersion < 0) throw new SecurityError("Choose a valid idea.", 400, "invalid_idea");
    return { action: "attach_idea", expectedVersion, documentId, expectedDocumentVersion, ideaId };
  }
  throw new SecurityError("Unknown writing action.", 400, "invalid_request");
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession((await cookies()).get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Your session ended. Sign in again to save writing.", code: "not_authenticated" }, { status: 401, headers: noStore });
    if (session.data.educationalStage !== "high_school") return NextResponse.json({ error: "Writing is available in High School UnlockED." }, { status: 403, headers: noStore });
    await enforceRateLimit(request, "writing", 180, 60, session.user.id);
    const mutation = parseMutation(await readBoundedJson(request, 128 * 1024));
    const result = await updateWriting(session.user.id, mutation);
    const documentId = "documentId" in mutation ? mutation.documentId : mutation.action === "create_document"
      ? result.store.assignments["writing-assignment:" + mutation.idempotencyKey]?.documentId
      : undefined;
    const ideaId = "ideaId" in mutation ? mutation.ideaId : mutation.action === "create_idea"
      ? "writing-idea:" + mutation.idempotencyKey
      : undefined;
    return NextResponse.json({
      ok: true,
      storeVersion: result.store.version,
      document: documentId ? result.store.documents[documentId] : undefined,
      idea: ideaId ? result.store.ideas[ideaId] : undefined,
    }, { headers: noStore });
  } catch (error) {
    if (error instanceof Error && error.name === "WritingConflictError") return NextResponse.json({ error: error.message, code: "stale_writing" }, { status: 409, headers: noStore });
    if (error instanceof Error && /already in progress/i.test(error.message)) return NextResponse.json({ error: "Another writing update is still saving. Try again in a moment.", code: "operation_locked" }, { status: 423, headers: noStore });
    return securityErrorResponse(error, "Your writing could not be saved.");
  }
}
