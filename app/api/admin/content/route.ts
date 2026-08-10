import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createOpportunity, validateOpportunityInput } from "@/lib/content-validation";
import { listManagedRecords, readContentAuditLog, readOpportunityChangeDiagnostics, saveManagedOpportunity } from "@/lib/content-store";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, securityErrorResponse } from "@/lib/security";
import { applyOpportunityLifecycleReview } from "@/data/opportunity-lifecycle";

export const dynamic = "force-dynamic";
const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Administrator access required" }, { status: 403, headers: noStoreHeaders });
  try {
    await enforceRateLimit(request, "admin-content-read", 60, 60, session.user.id);
    const [records, auditLog, changeDiagnostics] = await Promise.all([listManagedRecords(), readContentAuditLog(), readOpportunityChangeDiagnostics()]);
    return NextResponse.json({ records, auditLog, changeDiagnostics }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[UnlockED CMS] list failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Content database unavailable.");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Administrator access required" }, { status: 403, headers: noStoreHeaders });
    await enforceRateLimit(request, "admin-content-write", 30, 60, session.user.id);
    const result = validateOpportunityInput(await readBoundedJson(request, 32 * 1024));
    if (!result.data) return NextResponse.json({ errors: result.errors }, { status: 400, headers: noStoreHeaders });
    const base = `${result.data.type.toLowerCase()}--${slug(result.data.title)}`;
    const existing = await listManagedRecords();
    let id = base;
    let index = 2;
    while (existing.some((item) => item.opportunity.id === id)) id = `${base}-${index++}`;
    const draft = createOpportunity(id, result.data);
    const opportunity = applyOpportunityLifecycleReview(draft, draft, {
      state: result.data.lifecycle_state,
      confidence: result.data.lifecycle_confidence,
      reason: result.data.lifecycle_reason,
      reviewedAt: result.data.last_verified,
      reviewer: session.user.email,
      note: result.data.lifecycle_review_note,
      openingDate: result.data.opening_date,
      recurrence: result.data.recurrence_type ? { type: result.data.recurrence_type, confidence: result.data.lifecycle_confidence } : null,
    });
    const record = await saveManagedOpportunity(opportunity, session.user.email, Object.keys(result.data), true);
    return NextResponse.json({ record }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    console.error("[UnlockED CMS] create failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Unable to create opportunity.");
  }
}
