import type { Metadata } from "next";
import { AdvisorPage } from "@/components/advisor-page";
import { schoolDirectory as schools } from "@/data/school-directory";
import { getEntitlementsForBilling } from "@/lib/billing";
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
  const entitlements = getEntitlementsForBilling(session.data.billing);
  let serverState: ForYouServerState;
  if (!entitlements.canUseFullForYou) {
    const profile = session.data.profile;
    const school = schools.find((item) => item.slug === profile?.schoolSlug) ?? null;
    serverState = profile && school
      ? { pageState: "free_preview", access: "preview", entitlements, profile, school, activity: session.data.activity ?? { viewed: [], saved: [], claimed: [], tracked: {} }, session: null, recommendations: [], totalMatches: 0, snapshotStatus: "missing", isRefreshing: false }
      : { pageState: "profile_incomplete", access: "unavailable", entitlements, profile: profile ?? null, school, activity: session.data.activity ?? { viewed: [], saved: [], claimed: [], tracked: {} }, session: null, recommendations: [], totalMatches: 0, snapshotStatus: "missing", isRefreshing: false, errorCode: "profile_incomplete" };
  } else {
    const { resolveForYouState } = await import("@/lib/for-you-snapshot");
    serverState = await resolveForYouState(session.user, session.data, { allowGeneration: false });
  }
  const initialState = serverState.pageState === "preparing" ? null : serverState;
  return <AdvisorPage initialState={initialState} serverAuthenticated />;
}
