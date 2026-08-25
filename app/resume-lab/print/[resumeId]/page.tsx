import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { buildResumeLabModel } from "@/lib/resume-lab";
import { PrintResume } from "@/components/print-resume";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Print resume", robots: { index: false, follow: false } };

export default async function PrintResumePage({ params }: { params: Promise<{ resumeId: string }> }) {
  const session = await requireCompletedOnboarding(); const { resumeId: encodedResumeId } = await params; const resumeId = decodeURIComponent(encodedResumeId);
  const ids = [...new Set([...Object.keys(session.data.tracker ?? {}), ...Object.keys(session.data.activity?.tracked ?? {}), ...Object.values(session.data.accomplishments ?? {}).flatMap((item) => item.canonicalOpportunityId ? [item.canonicalOpportunityId] : [])])];
  const opportunities = await listPublishedOpportunitiesByIds(ids, { includeArchived: true }).catch(() => []);
  const model = buildResumeLabModel({ user: session.user, account: session.data, opportunities }); const resume = model.resumes.find((item) => item.id === resumeId); if (!resume) notFound();
  return <PrintResume model={model} resume={resume} />;
}
