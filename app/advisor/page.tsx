import type { Metadata } from "next";
import { AdvisorPage } from "@/components/advisor-page";
import { requireCompletedOnboarding } from "@/lib/onboarding";
import type { ForYouServerState } from "@/lib/for-you-snapshot";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "For You",
  description: "Personalized UnlockED opportunity recommendations selected around your profile and activity.",
  alternates: { canonical: "/advisor" },
  robots: { index: false, follow: false },
};

export default async function Page() {
  const session = await requireCompletedOnboarding();
  const { resolveForYouState } = await import("@/lib/for-you-snapshot");
  const serverState: ForYouServerState = await resolveForYouState(session.user, session.data, { allowGeneration: false });
  const initialState = serverState.pageState === "preparing" ? null : serverState;
  return <AdvisorPage initialState={initialState} serverAuthenticated />;
}
