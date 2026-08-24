import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";
import { updateApplicationMaterials, validMaterialContexts, validMaterialStatus, validMaterialType, type ApplicationMaterialMutation } from "@/lib/application-material-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const noStore = { "Cache-Control": "private, no-store, max-age=0" };
const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const requestId = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const clean = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const id = (value: unknown) => { const result = clean(value, 160); return safeId.test(result) ? result : ""; };

function parseMutation(value: unknown): ApplicationMaterialMutation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SecurityError("Invalid materials request.", 400, "invalid_request");
  const body = value as Record<string, unknown>;
  const expectedVersion = Number(body.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new SecurityError("Invalid materials state.", 400, "invalid_request");
  const action = body.action;
  if (action === "create") {
    const title = clean(body.title, 120);
    const idempotencyKey = clean(body.idempotencyKey, 128);
    if (!title || !requestId.test(idempotencyKey) || !validMaterialType(body.type) || !validMaterialStatus(body.status) || body.status === "archived") throw new SecurityError("Add a valid material.", 400, "invalid_material");
    return { action, expectedVersion, idempotencyKey, type: body.type, title, versionLabel: clean(body.versionLabel, 60) || undefined, status: body.status, contexts: validMaterialContexts(body.contexts), notes: clean(body.notes, 800) || undefined };
  }
  if (action === "associate" || action === "dissociate") {
    const opportunityId = id(body.opportunityId);
    if (!opportunityId || !validMaterialType(body.requirementType)) throw new SecurityError("Invalid material selection.", 400, "invalid_request");
    if (action === "dissociate") return { action, expectedVersion, opportunityId, requirementType: body.requirementType };
    const materialId = id(body.materialId);
    if (!materialId) throw new SecurityError("Choose a material.", 400, "invalid_request");
    return { action, expectedVersion, opportunityId, requirementType: body.requirementType, materialId };
  }
  const materialId = id(body.materialId);
  const expectedMaterialVersion = Number(body.expectedMaterialVersion);
  if (!materialId || !Number.isInteger(expectedMaterialVersion) || expectedMaterialVersion < 0) throw new SecurityError("Invalid material state.", 400, "invalid_request");
  if (action === "update") {
    const title = clean(body.title, 120);
    if (!title || !validMaterialStatus(body.status)) throw new SecurityError("Update the required material fields.", 400, "invalid_material");
    return { action, expectedVersion, materialId, expectedMaterialVersion, title, versionLabel: clean(body.versionLabel, 60) || undefined, status: body.status, contexts: validMaterialContexts(body.contexts), notes: clean(body.notes, 800) || undefined };
  }
  if (action === "set_preferred" || action === "archive" || action === "restore") return { action, expectedVersion, materialId, expectedMaterialVersion };
  if (action === "delete") {
    const expectedUsageCount = Number(body.expectedUsageCount);
    if (!Number.isInteger(expectedUsageCount) || expectedUsageCount < 0) throw new SecurityError("Review where this material is used before deleting it.", 400, "invalid_request");
    return { action, expectedVersion, materialId, expectedMaterialVersion, expectedUsageCount };
  }
  throw new SecurityError("Unknown materials action.", 400, "invalid_request");
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession((await cookies()).get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Your session ended. Sign in again to update Materials.", code: "not_authenticated" }, { status: 401, headers: noStore });
    await enforceRateLimit(request, "application-materials", 90, 60, session.user.id);
    const result = await updateApplicationMaterials(session.user, parseMutation(await readBoundedJson(request, 12 * 1024)));
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    if (error instanceof Error && ["ApplicationMaterialsConflictError", "ApplicationMaterialRecordConflictError", "ApplicationMaterialUsageConflictError"].includes(error.name)) return NextResponse.json({ error: error.message, code: "stale_materials" }, { status: 409, headers: noStore });
    if (error instanceof Error && /already in progress/i.test(error.message)) return NextResponse.json({ error: "Another materials update is still saving. Try again in a moment.", code: "operation_locked" }, { status: 423, headers: noStore });
    if (error instanceof Error && error.name === "ApplicationMaterialOwnershipError") return NextResponse.json({ error: error.message, code: "unowned_opportunity" }, { status: 403, headers: noStore });
    if (error instanceof Error && ["ApplicationMaterialNotFoundError", "ApplicationMaterialRequirementError", "ApplicationMaterialSelectionError", "ApplicationMaterialOpportunityError", "ApplicationMaterialLimitError"].includes(error.name)) return NextResponse.json({ error: error.message, code: "invalid_material_operation" }, { status: 422, headers: noStore });
    return securityErrorResponse(error, "Materials could not be updated.");
  }
}
