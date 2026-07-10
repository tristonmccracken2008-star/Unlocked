import { NextResponse } from "next/server";
import { careerReadinessFrameworks } from "@/lib/advisor/config";
import { advisorEngineVersion, advisorSourceSnapshotVersion } from "@/lib/advisor/types";
import { requireAdvisorSession, unauthorizedAdvisorResponse } from "@/lib/advisor/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await requireAdvisorSession();
  if (!session) return unauthorizedAdvisorResponse();
  return NextResponse.json({
    ok: true,
    engineVersion: advisorEngineVersion,
    sourceSnapshotVersion: advisorSourceSnapshotVersion,
    careers: Object.entries(careerReadinessFrameworks).map(([id, framework]) => ({ id, displayName: framework.displayName, dimensions: Object.keys(framework.dimensions) })),
    trust: {
      readinessIsProbability: false,
      reviewedKnowledgeStudentEditable: false,
      missingEvidenceLowersConfidence: true,
    },
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
