import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getJourneyProfessionalWorkflow, resolveJourneyProfessionalStage } from "@/data/journey-professional";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { enforceRateLimit, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ").trim();
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) {
      return NextResponse.json(
        { error: "Your session has ended. Sign in again before exporting your Journey.", code: "not_authenticated" },
        { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }
    await enforceRateLimit(request, "journey-export", 8, 60, session.user.id);
    const recordsById = { ...(session.data.activity?.tracked ?? {}), ...(session.data.tracker ?? {}) };
    const records = Object.values(recordsById);
    const opportunities = await listPublishedOpportunitiesByIds(records.map((record) => record.id), { includeArchived: true });
    const opportunityById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));
    const header = [
      "Opportunity",
      "Organization",
      "Journey stage",
      "Public listing",
      "Added",
      "Last updated",
      "Recorded date",
      "Reminder",
      "Reminder note",
      "Private note",
      "Official source",
    ];
    const rows = records
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map((record) => {
        const opportunity = opportunityById.get(record.id);
        const workflow = opportunity ? getJourneyProfessionalWorkflow(opportunity) : undefined;
        const stage = workflow ? resolveJourneyProfessionalStage(record, workflow).label : record.status;
        const details = [...(record.history ?? [])].reverse().find((item) => item.details)?.details;
        return [
          opportunity?.title ?? "Unavailable opportunity",
          opportunity?.organization ?? "Original listing unavailable",
          stage,
          opportunity?.metadata.lifecycle?.state ?? "unavailable",
          record.savedAt,
          record.updatedAt,
          details?.milestoneDate,
          details?.reminderAt,
          details?.reminderText,
          details?.notes,
          opportunity?.official_source_url,
        ].map(csvCell).join(",");
      });
    const csv = [header.map(csvCell).join(","), ...rows].join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": `attachment; filename="unlocked-journey-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[UnlockED Journey] Export failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Your Journey export could not be prepared.");
  }
}
