import { after, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { validateOpportunityInput } from "@/lib/content-validation";
import { deleteManagedOpportunity, getManagedRecord, recordOpportunityChangeDiagnostic, saveManagedOpportunity, setManagedArchive } from "@/lib/content-store";
import type { Opportunity } from "@/data/opportunities";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, securityErrorResponse } from "@/lib/security";
import { queueMaterialOpportunityChanges } from "@/lib/notification-service";
import { applyOpportunityLifecycleReview } from "@/data/opportunity-lifecycle";
import { detectMeaningfulOpportunityChanges } from "@/data/opportunity-changelog";

export const dynamic = "force-dynamic";
const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

async function processChangeEffects(before: Opportunity, afterOpportunity: Opportunity) {
  const events = detectMeaningfulOpportunityChanges(before, afterOpportunity);
  if (!events.length) return;
  try {
    const result = await queueMaterialOpportunityChanges(before, afterOpportunity);
    await recordOpportunityChangeDiagnostic({
      opportunityId: afterOpportunity.id,
      eventIds: events.map((event) => event.id),
      recipients: result.recipients,
      notificationsScheduled: result.scheduled,
      calendarProjected: events.some((event) => event.calendarImpact),
      workspaceProjected: events.some((event) => event.workspaceImpact),
    });
  } catch (error) {
    await recordOpportunityChangeDiagnostic({
      opportunityId: afterOpportunity.id,
      eventIds: events.map((event) => event.id),
      recipients: 0,
      notificationsScheduled: 0,
      calendarProjected: events.some((event) => event.calendarImpact),
      workspaceProjected: events.some((event) => event.workspaceImpact),
      errorCategory: error instanceof Error ? error.name : "unknown",
    }).catch(() => undefined);
    throw error;
  }
}

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
    const draft: Opportunity = {
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
      recurring: Boolean(input.recurrence_type),
      metadata: { ...current.opportunity.metadata, deadlineType: input.lifecycle_state === "rolling" ? "rolling" : input.deadline ? "fixed" : input.lifecycle_state === "closed" ? "current_cycle_closed" : "not_announced", claimUrl: input.official_source_url },
    };
    const next = applyOpportunityLifecycleReview(current.opportunity, draft, {
      state: input.lifecycle_state,
      confidence: input.lifecycle_confidence,
      reason: input.lifecycle_reason,
      reviewedAt: input.last_verified,
      reviewer: auth.session!.user.email,
      note: input.lifecycle_review_note,
      openingDate: input.opening_date,
      recurrence: input.recurrence_type ? { type: input.recurrence_type, confidence: input.lifecycle_confidence } : null,
    });
    const previous = { title: current.opportunity.title, organization: current.opportunity.organization, type: current.opportunity.type, category: current.opportunity.category, description: current.opportunity.description, eligibility: current.opportunity.eligibility, school_scope: current.opportunity.school_scope, schools: current.opportunity.schools, tags: current.opportunity.tags, estimated_value: current.opportunity.estimated_value, deadline: current.opportunity.deadline, official_source_url: current.opportunity.official_source_url, verification_status: current.opportunity.verification_status, last_verified: current.opportunity.last_verified };
    const changed = (Object.keys(input) as (keyof typeof input)[]).filter((field) => JSON.stringify(previous[field as keyof typeof previous]) !== JSON.stringify(input[field]));
    const record = await saveManagedOpportunity(next, auth.session!.user.email, changed);
    after(async () => {
      await processChangeEffects(current.opportunity, record.opportunity).catch((error) => {
        console.warn("[UnlockED notifications] Opportunity change queue failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
      });
    });
    return NextResponse.json({ record }, { headers: noStoreHeaders });
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
    const current = await getManagedRecord(auth.id!);
    if (!current || current.deleted) return NextResponse.json({ error: "Opportunity not found" }, { status: 404, headers: noStoreHeaders });
    const record = await setManagedArchive(auth.id!, body.archived, auth.session!.user.email);
    const beforeOpportunity: Opportunity = current.opportunity;
    const changedOpportunity: Opportunity = record.opportunity;
    after(async () => {
      await processChangeEffects(beforeOpportunity, changedOpportunity).catch((error) => {
        console.warn("[UnlockED notifications] Archive change queue failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
      });
    });
    return NextResponse.json({ record }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[UnlockED CMS] archive failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Unable to archive opportunity.");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authorizedMutation(request, params);
    if (auth.response) return auth.response;
    const current = await getManagedRecord(auth.id!);
    if (!current || current.deleted) return NextResponse.json({ error: "Opportunity not found" }, { status: 404, headers: noStoreHeaders });
    await deleteManagedOpportunity(auth.id!, auth.session!.user.email);
    after(async () => {
      await processChangeEffects(current.opportunity, { ...current.opportunity, verification_status: "archived" }).catch((error) => {
        console.warn("[UnlockED notifications] Delete change queue failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
      });
    });
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[UnlockED CMS] delete failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Unable to delete opportunity.");
  }
}
