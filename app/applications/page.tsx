import type { Metadata } from "next";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { buildApplicationsWorkspace } from "@/lib/applications-workspace";
import { ApplicationsWorkspace, ApplicationsWorkspaceUnavailable } from "@/components/applications-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Applications",
  description: "Manage verified requirements, private tasks, reusable materials, and deadlines across active applications.",
  robots: { index: false, follow: false },
};

export default async function ApplicationsPage() {
  const session = await requireCompletedOnboarding();
  const ids = [...new Set([...Object.keys(session.data.tracker ?? {}), ...Object.keys(session.data.activity?.tracked ?? {})])];
  try {
    const opportunities = await listPublishedOpportunitiesByIds(ids, { includeArchived: true });
    return <ApplicationsWorkspace initial={buildApplicationsWorkspace({ account: session.data, opportunities })} />;
  } catch (error) {
    console.error("[UnlockED Applications] composition failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return <ApplicationsWorkspaceUnavailable />;
  }
}
