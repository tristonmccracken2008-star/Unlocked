import type { Metadata } from "next";
import { PersonalizedHome } from "@/components/personalized-home";
import { JourneyCommandCenter, JourneyCommandCenterUnavailable } from "@/components/journey-command-center";
import { getServerSessionForProduct } from "@/lib/onboarding";
import { accountHasCompletedOnboarding } from "@/lib/auth-store";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { buildJourneyCommandCenterModel } from "@/lib/journey-command-center";
import { buildReturnBriefing } from "@/lib/return-experience";
import { readReturnExperienceReceipt, returnExperienceCookieName } from "@/lib/return-experience-receipt";
import { readNotifications } from "@/lib/notification-store";
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

async function returnNotifications(userId: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const fallback = new Promise<{ notifications: []; unreadCount: 0; nextCursor: null }>((resolve) => {
    timeout = setTimeout(() => resolve({ notifications: [], unreadCount: 0, nextCursor: null }), 500);
  });
  return await Promise.race([
    readNotifications(userId, 0, 30).catch(() => ({ notifications: [], unreadCount: 0, nextCursor: null })),
    fallback,
  ]).finally(() => { if (timeout) clearTimeout(timeout); });
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
    const cookieStore = await cookies();
    const [opportunities, notificationCenter] = await Promise.all([
      listPublishedOpportunitiesByIds(trackedIds, { includeArchived: true }),
      returnNotifications(session.user.id),
    ]);
    const appearance = session.data.preferences?.appearance ?? "light";
    const systemScheme = cookieStore.get("unlocked-color-scheme")?.value;
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
    const isDefaultReturnView = !["stage", "sort", "q", "history", "active", "guide"].some((key) => first(query?.[key]));
    const freshnessCutoff = readReturnExperienceReceipt(cookieStore.get(returnExperienceCookieName)?.value, session.user.id)
      ?? session.data.firstLaunchCompletedAt;
    const returnBriefing = isDefaultReturnView ? buildReturnBriefing({
      profile: session.data.profile,
      journey: model,
      notifications: notificationCenter.notifications,
      freshnessCutoff,
    }) : null;
    return <div data-unlocked-home="journey-command-center-v1">
      <JourneyCommandCenter model={model} returnBriefing={returnBriefing} />
    </div>;
  } catch (error) {
    console.error("[UnlockED Journey] command center composition failed", process.env.NODE_ENV === "production"
      ? { errorType: error instanceof Error ? error.name : "UnknownError" }
      : { errorType: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : "Unknown Journey composition failure" });
    return <JourneyCommandCenterUnavailable />;
  }
}
