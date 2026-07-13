import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { validateOpportunityInput } from "@/lib/content-validation";
import { deleteManagedOpportunity, getManagedRecord, saveManagedOpportunity, setManagedArchive } from "@/lib/content-store";
import type { Opportunity } from "@/data/opportunities";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

async function authorizedMutation(request: Request, params: Promise<{ id: string }>) {
  assertSameOrigin(request);
  const session = await getAdminSession();
  if (!session) return { response: NextResponse.json({ error: "Administrator access required" }, { status: 403, headers: noStoreHeaders }) };
  await enforceRateLimit(request, "admin-content-write", 30, 60, session.user.id);
  const id = (await params).id;
  if (!idPattern.test(id)) return { response: NextResponse.json({ error: "Invalid opportunity ID" }, { status: 400, headers: noStoreHeaders }) };
  return { session, id };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authorizedMutation(request, params);
    if (auth.response) return auth.response;
    const current = await getManagedRecord(auth.id!);
    if (!current || current.deleted) return NextResponse.json({ error: "Opportunity not found" }, { status: 404, headers: noStoreHeaders });
    const result = validateOpportunityInput(await readBoundedJson(request, 32 * 1024));
    if (!result.data) return NextResponse.json({ errors: result.errors }, { status: 400, headers: noStoreHeaders });
    const input = result.data;
    const next: Opportunity = {
      ...current.opportunity,
      title: input.title,
      organization: input.organization,
      type: input.type,
      category: input.category,
      description: input.description,
      eligibility: input.eligibility,
      school_scope: input.school_scope,
      schools: input.schools,
      tags: input.tags,
      estimated_value: input.estimated_value,
      estimated_value_note: input.estimated_value === null ? "Unknown — no verified dollar value is documented by the official source." : "Value entered by an authorized UnlockED reviewer.",
      application_deadline: input.deadline,
      deadline: input.deadline,
      official_source: input.official_source_url,
      official_source_url: input.official_source_url,
      verification_status: input.verification_status,
      last_verified: input.last_verified,
      metadata: { ...current.opportunity.metadata, deadlineType: input.deadline ? "fixed" : "not_announced", claimUrl: input.official_source_url },
    };
    const previous = { title: current.opportunity.title, organization: current.opportunity.organization, type: current.opportunity.type, category: current.opportunity.category, description: current.opportunity.description, eligibility: current.opportunity.eligibility, school_scope: current.opportunity.school_scope, schools: current.opportunity.schools, tags: current.opportunity.tags, estimated_value: current.opportunity.estimated_value, deadline: current.opportunity.deadline, official_source_url: current.opportunity.official_source_url, verification_status: current.opportunity.verification_status, last_verified: current.opportunity.last_verified };
    const changed = (Object.keys(input) as (keyof typeof input)[]).filter((field) => JSON.stringify(previous[field as keyof typeof previous]) !== JSON.stringify(input[field]));
    return NextResponse.json({ record: await saveManagedOpportunity(next, auth.session!.user.email, changed) }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[UnlockED CMS] update failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Unable to update opportunity.");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authorizedMutation(request, params);
    if (auth.response) return auth.response;
    const body = await readBoundedJson<{ archived?: unknown }>(request, 2 * 1024);
    if (typeof body.archived !== "boolean") return NextResponse.json({ error: "Archive state is required" }, { status: 400, headers: noStoreHeaders });
    return NextResponse.json({ record: await setManagedArchive(auth.id!, body.archived, auth.session!.user.email) }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[UnlockED CMS] archive failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Unable to archive opportunity.");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authorizedMutation(request, params);
    if (auth.response) return auth.response;
    await deleteManagedOpportunity(auth.id!, auth.session!.user.email);
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[UnlockED CMS] delete failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Unable to delete opportunity.");
  }
}
