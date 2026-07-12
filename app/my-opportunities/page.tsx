import type { Metadata } from "next";
import { MyOpportunitiesPage } from "@/components/my-opportunities-page";
import { requireCompletedOnboarding } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My Opportunities",
  description: "Manage Journey opportunities, application progress, deadlines, and completed benefits in UnlockED.",
  alternates: { canonical: "/my-opportunities" },
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireCompletedOnboarding();
  return <MyOpportunitiesPage />;
}
