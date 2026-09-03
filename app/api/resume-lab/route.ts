import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";
import { updateResumeLab, type ResumeLabMutation } from "@/lib/resume-lab-service";
import { resumeExperienceKinds, resumeFactKinds, resumeSectionKinds, resumeTemplates, type ResumeFactSource, type ResumeSection } from "@/data/resume-lab";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const noStore = { "Cache-Control": "private, no-store, max-age=0" };
const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const requestId = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const clean = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const id = (value: unknown) => { const result = clean(value, 160); return safeId.test(result) ? result : ""; };
const number = (value: unknown) => Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : -1;
const strings = (value: unknown, maxItems: number, maxLength: number) => Array.isArray(value) ? [...new Set(value.map((item) => clean(item, maxLength)).filter(Boolean))].slice(0, maxItems) : [];

function target(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { type: "general" as const };
  const input = value as Record<string, unknown>; const type: "general" | "opportunity" | "path" = input.type === "opportunity" || input.type === "path" ? input.type : "general";
  return { type, id: id(input.id) || undefined, label: clean(input.label, 180) || undefined };
}
function sections(value: unknown): ResumeSection[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((candidate): ResumeSection[] => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const input = candidate as Record<string, unknown>; const sectionId = id(input.id); const title = clean(input.title, 80);
    if (!sectionId || !title || !resumeSectionKinds.includes(input.kind as ResumeSection["kind"])) return [];
    const entries = Array.isArray(input.entries) ? input.entries.slice(0, 40).flatMap((raw): ResumeSection["entries"] => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
      const entry = raw as Record<string, unknown>; const experienceId = id(entry.experienceId); if (!experienceId) return [];
      const bulletIds = strings(entry.bulletIds, 12, 160).filter((item) => safeId.test(item));
      const overrides = entry.bulletOverrides && typeof entry.bulletOverrides === "object" && !Array.isArray(entry.bulletOverrides) ? Object.fromEntries(Object.entries(entry.bulletOverrides).flatMap(([key, text]) => safeId.test(key) && clean(text, 500) ? [[key, clean(text, 500)]] : [])) : undefined;
      return [{ experienceId, bulletIds, bulletOverrides: overrides && Object.keys(overrides).length ? overrides : undefined }];
    }) : [];
    return [{ id: sectionId, kind: input.kind as ResumeSection["kind"], title, visible: input.visible !== false, entries }];
  });
}
function parseMutation(value: unknown): ResumeLabMutation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SecurityError("Invalid Resume Lab request.", 400, "invalid_request");
  const body = value as Record<string, unknown>; const expectedVersion = number(body.expectedVersion); const action = body.action;
  if (expectedVersion < 0) throw new SecurityError("Invalid Resume Lab state.", 400, "invalid_request");
  if (action === "create_resume") { const title = clean(body.title, 120); const key = clean(body.idempotencyKey, 128); if (!title || !requestId.test(key) || (body.kind !== "master" && body.kind !== "targeted")) throw new SecurityError("Add a valid resume version.", 400, "invalid_resume"); return { action, expectedVersion, idempotencyKey: key, title, kind: body.kind, target: target(body.target), baseResumeId: id(body.baseResumeId) || undefined }; }
  if (action === "duplicate_resume") { const resumeId = id(body.resumeId); const title = clean(body.title, 120); const key = clean(body.idempotencyKey, 128); if (!resumeId || !title || !requestId.test(key)) throw new SecurityError("Choose a valid resume to duplicate.", 400, "invalid_resume"); return { action, expectedVersion, idempotencyKey: key, resumeId, title, target: target(body.target) }; }
  if (action === "save_resume") { const resumeId = id(body.resumeId); const expectedRecordVersion = number(body.expectedRecordVersion); const title = clean(body.title, 120); const contactInput = body.contact && typeof body.contact === "object" && !Array.isArray(body.contact) ? body.contact as Record<string, unknown> : {}; if (!resumeId || expectedRecordVersion < 0 || !title || (body.materialStatus !== "draft" && body.materialStatus !== "ready" && body.materialStatus !== "needs_update")) throw new SecurityError("Update the required resume fields.", 400, "invalid_resume"); return { action, expectedVersion, resumeId, expectedRecordVersion, title, contact: { email: clean(contactInput.email, 160) || undefined, phone: clean(contactInput.phone, 40) || undefined, city: clean(contactInput.city, 100) || undefined, linkedIn: clean(contactInput.linkedIn, 240) || undefined, portfolio: clean(contactInput.portfolio, 240) || undefined }, summary: clean(body.summary, 800) || undefined, skills: strings(body.skills, 60, 80), sections: sections(body.sections), template: resumeTemplates.includes(body.template as never) ? body.template as typeof resumeTemplates[number] : "classic", materialStatus: body.materialStatus }; }
  if (action === "archive_resume") { const resumeId = id(body.resumeId); const expectedRecordVersion = number(body.expectedRecordVersion); if (!resumeId || expectedRecordVersion < 0) throw new SecurityError("Invalid resume state.", 400, "invalid_request"); return { action, expectedVersion, resumeId, expectedRecordVersion }; }
  if (action === "import_accomplishment") { const accomplishmentId = id(body.accomplishmentId); const key = clean(body.idempotencyKey, 128); if (!accomplishmentId || !requestId.test(key)) throw new SecurityError("Choose a valid accomplishment.", 400, "invalid_evidence"); return { action, expectedVersion, idempotencyKey: key, accomplishmentId }; }
  if (action === "delete_experience") { const experienceId = id(body.experienceId); const expectedRecordVersion = number(body.expectedRecordVersion); if (!experienceId || expectedRecordVersion < 0) throw new SecurityError("Invalid experience state.", 400, "invalid_request"); return { action, expectedVersion, experienceId, expectedRecordVersion }; }
  if (action === "save_experience") {
    const experienceId = id(body.experienceId) || undefined; const expectedRecordVersion = body.expectedRecordVersion === undefined ? undefined : number(body.expectedRecordVersion); const key = clean(body.idempotencyKey, 128) || undefined;
    if (!resumeExperienceKinds.includes(body.kind as never) || (!experienceId && (!key || !requestId.test(key))) || (experienceId && (expectedRecordVersion ?? -1) < 0)) throw new SecurityError("Add a valid experience.", 400, "invalid_experience");
    const facts = Array.isArray(body.facts) ? body.facts.slice(0, 80).flatMap((raw): Array<{ id?: string; kind: typeof resumeFactKinds[number]; text: string; confirmed: boolean; source?: ResumeFactSource; sourceLabel?: string }> => { if (!raw || typeof raw !== "object" || Array.isArray(raw)) return []; const fact = raw as Record<string, unknown>; const text = clean(fact.text, 300); const source = ["user", "accomplishment", "profile", "journey", "import"].includes(String(fact.source)) ? fact.source as ResumeFactSource : undefined; return text && resumeFactKinds.includes(fact.kind as never) ? [{ id: id(fact.id) || undefined, kind: fact.kind as typeof resumeFactKinds[number], text, confirmed: Boolean(fact.confirmed), source, sourceLabel: clean(fact.sourceLabel, 120) || undefined }] : []; }) : [];
    const bullets = Array.isArray(body.bullets) ? body.bullets.slice(0, 100).flatMap((raw): Array<{ id?: string; text?: string; factIds: string[]; confirmedClaims?: string[]; reviewState?: "draft" | "reviewed" }> => { if (!raw || typeof raw !== "object" || Array.isArray(raw)) return []; const bullet = raw as Record<string, unknown>; return [{ id: id(bullet.id) || undefined, text: clean(bullet.text, 500) || undefined, factIds: strings(bullet.factIds, 12, 160).filter((item) => safeId.test(item)), confirmedClaims: strings(bullet.confirmedClaims, 20, 80), reviewState: bullet.reviewState === "reviewed" ? "reviewed" : "draft" }]; }) : [];
    return { action, expectedVersion, idempotencyKey: key, experienceId, expectedRecordVersion, kind: body.kind as typeof resumeExperienceKinds[number], organization: clean(body.organization, 180), title: clean(body.title, 180), location: clean(body.location, 160) || undefined, startDate: clean(body.startDate, 10) || undefined, endDate: clean(body.endDate, 10) || undefined, current: Boolean(body.current), skills: strings(body.skills, 40, 80), facts, bullets };
  }
  throw new SecurityError("Unknown Resume Lab action.", 400, "invalid_request");
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const session = await getSession((await cookies()).get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Your session ended. Sign in again to update Resume Lab.", code: "not_authenticated" }, { status: 401, headers: noStore });
    await enforceRateLimit(request, "resume-lab", 90, 60, session.user.id);
    return NextResponse.json(await updateResumeLab(session.user, parseMutation(await readBoundedJson(request, 64 * 1024))), { headers: noStore });
  } catch (error) {
    if (error instanceof Error && ["ResumeLabConflictError", "ResumeLabRecordConflictError"].includes(error.name)) return NextResponse.json({ error: error.message, code: "stale_resume" }, { status: 409, headers: noStore });
    if (error instanceof Error && /already in progress/i.test(error.message)) return NextResponse.json({ error: "Another resume update is still saving. Try again in a moment.", code: "operation_locked" }, { status: 423, headers: noStore });
    if (error instanceof Error && ["ResumeLabNotFoundError", "ResumeLabLimitError", "ResumeLabEvidenceError", "ResumeLabInUseError"].includes(error.name)) return NextResponse.json({ error: error.message, code: "invalid_resume_operation" }, { status: 422, headers: noStore });
    return securityErrorResponse(error, "Resume Lab could not be updated.");
  }
}
