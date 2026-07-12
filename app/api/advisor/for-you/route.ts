import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildRecommendationService } from "@/data/recommendation-service";
import { opportunities } from "@/data/opportunities";
import { schools } from "@/data/seed";
import { inferApplicationsFromActivity } from "@/data/student-progress";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import { getEntitlementsForBilling } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(sessionCookieName)?.value);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
  const profile = session.data.profile;
  const school = schools.find((item) => item.slug === profile?.schoolSlug);
  if (!profile || !school) return NextResponse.json({ access: "unavailable", recommendations: [], totalMatches: 0 }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  const activity = session.data.activity ?? { viewed: [], saved: [], claimed: [], tracked: {} };
  const progress = inferApplicationsFromActivity(activity, opportunities, { milestones: {}, applications: {} });
  const service = buildRecommendationService({ profile, school, activity, progress, source: opportunities });
  const entitlements = getEntitlementsForBilling(session.data.billing);
  const pro = entitlements.canUseFullForYou;
  const allowed = pro ? service.recommendations.slice(0, 24) : service.recommendations.slice(0, 2);
  const recommendations = allowed.map((view) => ({
    ...view,
    reasons: entitlements.canViewRecommendationExplanations ? view.reasons : view.reasons.slice(0, 1),
  }));
  return NextResponse.json({
    access: pro ? "pro" : "preview",
    entitlements,
    profile,
    school,
    activity,
    recommendations,
    totalMatches: service.recommendations.length,
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
