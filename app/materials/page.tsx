import type { Metadata } from "next";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { buildApplicationMaterialsModel } from "@/lib/application-materials";
import {
  ApplicationMaterials,
  ApplicationMaterialsUnavailable,
} from "@/components/application-materials";
import { normalizeGuidanceState } from "@/lib/guidance";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Application Materials",
  description:
    "Organize reusable application materials and connect them to verified requirements.",
  robots: { index: false, follow: false },
};

export default async function MaterialsPage() {
  const session = await requireCompletedOnboarding();
  const ids = [
    ...new Set([
      ...Object.keys(session.data.tracker ?? {}),
      ...Object.keys(session.data.activity?.tracked ?? {}),
    ]),
  ];
  try {
    const opportunities = await listPublishedOpportunitiesByIds(ids, {
      includeArchived: true,
    });
    return (
      <ApplicationMaterials
        initial={buildApplicationMaterialsModel({
          account: session.data,
          opportunities,
        })}
        guidance={normalizeGuidanceState(session.data.guidance)}
      />
    );
  } catch (error) {
    console.error("[UnlockED Materials] composition failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return <ApplicationMaterialsUnavailable />;
  }
}
