import type { Metadata } from "next";
import { PersonalizedHome } from "@/components/personalized-home";
import { JourneyEditorial, JourneyEditorialUnavailable } from "@/components/journey-editorial";
import { JourneyClientEffects } from "@/components/journey-client-effects";
import { getServerSessionForProduct } from "@/lib/onboarding";
import { accountHasCompletedOnboarding } from "@/lib/auth-store";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { buildJourneyEditorialModel } from "@/lib/journey-editorial";
import { cookies } from "next/headers";
import { isProUser } from "@/lib/billing";

export const metadata: Metadata = {
  title: { absolute: "UnlockED — Student opportunities, chosen for you" },
  description: "Discover scholarships, internships, research, student benefits, and other opportunities from official sources.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSessionForProduct();
  if (!session || !accountHasCompletedOnboarding(session.data) || !session.data.profile) {
    return <div data-unlocked-home="public-or-onboarding-v1"><PersonalizedHome /></div>;
  }

  const trackedIds = [...new Set([
    ...Object.keys(session.data.tracker ?? {}),
    ...Object.keys(session.data.activity?.tracked ?? {}),
    ...(session.data.activity?.saved ?? []),
    ...session.data.savedOpportunities.map((record) => record.opportunityId),
  ])];
  try {
    const opportunities = await listPublishedOpportunitiesByIds(trackedIds);
    const appearance = session.data.preferences?.appearance ?? "light";
    const systemScheme = (await cookies()).get("unlocked-color-scheme")?.value;
    const resolvedTheme = isProUser(session.data.billing) && (appearance === "midnight" || appearance === "forest" || (appearance === "system" && systemScheme === "dark")) ? "dark" as const : "light" as const;
    const projectionStarted = performance.now();
    const model = buildJourneyEditorialModel({ user: session.user, account: session.data, opportunities, resolvedTheme });
    model.diagnostics.serverProjectionMs = Math.max(0, performance.now() - projectionStarted);
    const showDiagnostics = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_OPEN_LINE_DIAGNOSTICS === "1";
    return <div data-unlocked-home="journey-editorial-v1">
      <JourneyClientEffects />
      <JourneyEditorial model={model} showDiagnostics={showDiagnostics} />
    </div>;
  } catch (error) {
    console.error("[UnlockED Journey] editorial composition failed", process.env.NODE_ENV === "production"
      ? { errorType: error instanceof Error ? error.name : "UnknownError" }
      : { errorType: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : "Unknown Journey composition failure" });
    return <JourneyEditorialUnavailable />;
  }
}
