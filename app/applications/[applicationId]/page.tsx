import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { projectApplicationPacket } from "@/lib/application-packet";
import { ApplicationPacket } from "@/components/application-packet";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Application Packet", description: "Review verified requirements, selected Materials, tasks, and dates for one application.", robots: { index: false, follow: false } };

export default async function ApplicationPacketPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const session = await requireCompletedOnboarding();
  const { applicationId } = await params;
  const trackedIds = [...new Set([...Object.keys(session.data.tracker ?? {}), ...Object.keys(session.data.activity?.tracked ?? {})])];
  if (!trackedIds.includes(applicationId)) redirect("/applications");
  const opportunities = await listPublishedOpportunitiesByIds(trackedIds, { includeArchived: true });
  const packet = projectApplicationPacket({ account: session.data, opportunities, opportunityId: applicationId });
  if (!packet) redirect("/applications");
  return <ApplicationPacket initial={packet} />;
}
