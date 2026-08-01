import type { Metadata } from "next";
import { PersonalizedHome } from "@/components/personalized-home";
import { JourneyCommandCenter, JourneyCommandCenterUnavailable } from "@/components/journey-command-center";
import { getServerSessionForProduct } from "@/lib/onboarding";
import { accountHasCompletedOnboarding } from "@/lib/auth-store";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { buildJourneyCommandCenterModel } from "@/lib/journey-command-center";
import { cookies } from "next/headers";
import { isProUser } from "@/lib/billing";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: { absolute: "UnlockED — Student opportunities, chosen for you" },
  description: "Discover scholarships, internships, research, student benefits, and other opportunities from official sources.",
};

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getServerSessionForProduct();
  if (!session || !accountHasCompletedOnboarding(session.data) || !session.data.profile) {
    const initialSession = session
      ? { authenticated: true, user: session.user, data: session.data }
      : { authenticated: false, user: null, data: null };
    return <div data-unlocked-home="public-or-onboarding-v1"><PersonalizedHome initialSession={initialSession} /></div>;
  }
  if (!session.data.firstLaunchComplete) redirect("/welcome");

  const trackedIds = [...new Set([
    ...Object.keys(session.data.tracker ?? {}),
    ...Object.keys(session.data.activity?.tracked ?? {}),
    ...(session.data.activity?.saved ?? []),
    ...session.data.savedOpportunities.map((record) => record.opportunityId),
  ])];
  try {
    const query = await searchParams;
    const opportunities = await listPublishedOpportunitiesByIds(trackedIds, { includeArchived: true });
    const appearance = session.data.preferences?.appearance ?? "light";
    const systemScheme = (await cookies()).get("unlocked-color-scheme")?.value;
    const resolvedTheme = isProUser(session.data.billing) && (appearance === "midnight" || appearance === "forest" || (appearance === "system" && systemScheme === "dark")) ? "dark" as const : "light" as const;
    const model = buildJourneyCommandCenterModel({
      user: session.user,
      account: session.data,
      opportunities,
      resolvedTheme,
      filter: first(query?.stage),
      sort: first(query?.sort),
      query: first(query?.q),
      historyLimit: first(query?.history) === "100" ? 100 : 24,
      activeLimit: first(query?.active) === "100" ? 100 : 6,
    });
    return <div data-unlocked-home="journey-command-center-v1">
      <JourneyCommandCenter model={model} />
    </div>;
  } catch (error) {
    console.error("[UnlockED Journey] command center composition failed", process.env.NODE_ENV === "production"
      ? { errorType: error instanceof Error ? error.name : "UnknownError" }
      : { errorType: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : "Unknown Journey composition failure" });
    return <JourneyCommandCenterUnavailable />;
  }
}
