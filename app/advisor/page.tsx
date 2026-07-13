import type { Metadata } from "next";
import { AdvisorPage } from "@/components/advisor-page";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import { resolveForYouState } from "@/lib/for-you-snapshot";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "For You",
  description: "Personalized UnlockED opportunity recommendations selected around your profile and activity.",
  alternates: { canonical: "/advisor" },
  robots: { index: false, follow: false },
};

export default async function Page() {
  const session = await requireCompletedOnboarding();
  const initialState = await resolveForYouState(session.user, session.data);
  return <AdvisorPage initialState={initialState} />;
}
