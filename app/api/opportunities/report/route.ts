import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { recordAnalyticsEvent } from "@/lib/analytics-store";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import {
  opportunityReporterHash,
  opportunityReportIssueTypes,
  saveOpportunityReport,
  type OpportunityReportIssue,
} from "@/lib/opportunity-report-store";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const requestIdentifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const validIssues = new Set<string>(opportunityReportIssueTypes);

function cleanDetail(value: unknown) {
  if (typeof value !== "string") return undefined;
  const detail = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  return detail || undefined;
}

function parseReport(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SecurityError("Invalid report.", 400, "invalid_request");
  const body = value as Record<string, unknown>;
  if (typeof body.opportunityId !== "string" || !identifier.test(body.opportunityId)) throw new SecurityError("Invalid opportunity.", 400, "invalid_request");
  if (typeof body.issue !== "string" || !validIssues.has(body.issue)) throw new SecurityError("Choose what needs attention.", 400, "invalid_request");
  if (typeof body.idempotencyKey !== "string" || !requestIdentifier.test(body.idempotencyKey)) throw new SecurityError("Invalid request identifier.", 400, "invalid_request");
  return {
    opportunityId: body.opportunityId,
    issue: body.issue as OpportunityReportIssue,
    detail: cleanDetail(body.detail),
    idempotencyKey: body.idempotencyKey,
  };
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Sign in again to send this report.", code: "not_authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    await enforceRateLimit(request, "opportunity-report", 8, 60 * 60, session.user.id);
    const input = parseReport(await readBoundedJson(request, 4 * 1024));
    const opportunity = (await listPublishedOpportunitiesByIds([input.opportunityId]))[0];
    if (!opportunity) throw new SecurityError("This opportunity is no longer available.", 404, "opportunity_not_found");
    const result = await saveOpportunityReport({
      opportunityId: input.opportunityId,
      issue: input.issue,
      detail: input.detail,
      reporterHash: opportunityReporterHash(session.user.id),
    }, input.idempotencyKey);
    if (!result.duplicate) {
      await recordAnalyticsEvent(productIntelligenceEvents.discoverReportSubmitted, session.user.id, {
        opportunityId: input.opportunityId,
        action: input.issue,
        source: "opportunity",
      }).catch(() => undefined);
    }
    return NextResponse.json({ ok: true, duplicate: result.duplicate }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    if (!(error instanceof SecurityError)) console.error("[UnlockED opportunities] Report failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "We couldn’t send this report. Try again.");
  }
}
