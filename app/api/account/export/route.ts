import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, readAccountData, sessionCookieName } from "@/lib/auth-store";
import { readNotifications } from "@/lib/notification-store";
import { publicAccountData } from "@/lib/public-account";
import { assertSameOrigin, enforceRateLimit, securityErrorResponse } from "@/lib/security";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { buildAccomplishmentsModel } from "@/lib/accomplishments";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    await enforceRateLimit(request, "account-export", 3, 60 * 60, session.user.id);
    const [data, notificationData] = await Promise.all([
      readAccountData(session.user.id),
      readNotifications(session.user.id, 0, 200),
    ]);
    const safe = publicAccountData(data);
    const accomplishmentIds = [...new Set([
      ...Object.keys(data.tracker ?? {}),
      ...Object.keys(data.activity?.tracked ?? {}),
      ...Object.values(data.accomplishments ?? {}).flatMap((record) => record.canonicalOpportunityId ? [record.canonicalOpportunityId] : []),
    ])];
    const accomplishmentOpportunities = await listPublishedOpportunitiesByIds(accomplishmentIds, { includeArchived: true }).catch(() => []);
    const accomplishments = buildAccomplishmentsModel({ account: data, opportunities: accomplishmentOpportunities }).records.map(({ kindLabel: _kindLabel, outcomeLabel: _outcomeLabel, opportunityHref: _opportunityHref, journeyHref: _journeyHref, year: _year, ...record }) => record);
    const payload = {
      format: "unlocked-account-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      account: { email: session.user.email, name: session.user.name },
      profile: safe.profile,
      preferences: safe.preferences,
      savedOpportunities: safe.savedOpportunities,
      watchedOpportunities: safe.watchedOpportunities ?? [],
      followedPaths: Object.keys(safe.pathPreferences ?? {}),
      journey: { tracker: safe.tracker, progress: safe.journeyProgress, applicationWorkspaces: data.applicationWorkspaces ?? {} },
      materials: data.applicationMaterials ?? { records: {}, associations: {}, version: 0 },
      resumeLab: data.resumeLab ?? { experiences: {}, resumes: {}, version: 0 },
      accomplishments,
      passport: data.passport,
      notifications: notificationData.notifications.map((item) => ({
        type: item.type,
        state: item.state,
        createdAt: item.createdAt,
        relevantAt: item.relevantAt,
        opportunityId: item.opportunityId,
      })),
      subscription: {
        tier: safe.billing.tier,
        status: safe.billing.status,
        billingInterval: safe.billing.billingInterval,
        currentPeriodEnd: safe.billing.currentPeriodEnd,
        cancelAtPeriodEnd: safe.billing.cancelAtPeriodEnd,
      },
      accountUpdatedAt: safe.updatedAt,
    };
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="unlocked-data-${new Date().toISOString().slice(0, 10)}.json"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[UnlockED account] Export failed", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Your data export could not be prepared.");
  }
}
