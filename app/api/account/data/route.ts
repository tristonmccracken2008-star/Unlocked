import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, mergeAccountData, readAccountData, sessionCookieName } from "@/lib/auth-store";
import { isProUser } from "@/lib/billing";
import { cleanAccountDataInput } from "@/lib/account-input";
import { publicAccountData } from "@/lib/public-account";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";
import { accountSyncPreservesJourneyState } from "@/data/journey-transformations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "account-read", 180, 60);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    const data = await readAccountData(session.user.id);
    return NextResponse.json({ ok: true, data: publicAccountData(data) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[UnlockED account] Failed to load account data", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Account data could not be loaded.");
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const session = await getSession(cookieStore.get(sessionCookieName)?.value);
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    await enforceRateLimit(request, "account-write", 120, 60, session.user.id);
    const raw = await readBoundedJson<Record<string, unknown>>(request, 256 * 1024);
    const body = cleanAccountDataInput(raw);
    if (!Object.values(body).some((value) => value !== undefined)) return NextResponse.json({ error: "No valid account fields were provided" }, { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } });
    if (body.preferences?.appearance && body.preferences.appearance !== "light" && !isProUser(session.data.billing)) body.preferences.appearance = "light";
    if (body.profile && typeof raw.expectedUpdatedAt === "string") {
      const current = await readAccountData(session.user.id);
      if (current.updatedAt !== raw.expectedUpdatedAt) throw new SecurityError("Your profile changed elsewhere. Refresh before saving.", 409, "stale_profile");
    }
    const incomingTracker = body.tracker ?? body.activity?.tracked;
    if (incomingTracker || body.activity?.saved?.length) {
      const current = await readAccountData(session.user.id);
      const currentTracker = { ...(current.activity?.tracked ?? {}), ...(current.tracker ?? {}) };
      const currentSaved = new Set([
        ...(current.activity?.saved ?? []),
        ...Object.keys(currentTracker),
        ...current.savedOpportunities.map((item) => item.opportunityId),
      ]);
      for (const id of body.activity?.saved ?? []) {
        if (!currentSaved.has(id)) throw new SecurityError("New opportunities require the Add to Journey endpoint.", 409, "journey_add_required");
      }
      for (const [id, record] of Object.entries(incomingTracker ?? {})) {
        if (!currentSaved.has(id)) throw new SecurityError("New opportunities require the Add to Journey endpoint.", 409, "journey_add_required");
        if (!accountSyncPreservesJourneyState(currentTracker[id], record)) {
          throw new SecurityError("Journey status changes require the Journey transition endpoint.", 409, "journey_transition_required");
        }
      }
    }
    const data = await mergeAccountData(session.user.id, body);
    return NextResponse.json({ ok: true, data: publicAccountData(data) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[UnlockED account] Failed to save account data", { errorCategory: error instanceof Error ? error.name : "unknown" });
    return securityErrorResponse(error, "Account data could not be saved.");
  }
}
