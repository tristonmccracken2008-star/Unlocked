import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { normalizeOpportunityPassport } from "@/data/passport";
import { getSession, readAccountData, sessionCookieName, updateOpportunityPassport } from "@/lib/auth-store";
import { listPublishedOpportunitiesByIds } from "@/lib/content-store";
import { buildPassportView, generatePublicToken } from "@/lib/passport";
import { publishCollection, publishPassport, readPublicCollection, readPublicPassport, revokeCollection, revokePassport } from "@/lib/passport-public-store";
import { assertSameOrigin, enforceRateLimit, readBoundedJson, SecurityError, securityErrorResponse } from "@/lib/security";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const idsFor = (account: Awaited<ReturnType<typeof readAccountData>>) => [...new Set([
  ...Object.keys(account.tracker ?? {}), ...Object.keys(account.activity?.tracked ?? {}),
  ...Object.values(account.accomplishments ?? {}).flatMap((item) => item.canonicalOpportunityId ? [item.canonicalOpportunityId] : []),
  ...normalizeOpportunityPassport(account.passport).collections.flatMap((item) => item.opportunityIds),
])];

async function auth() { const store = await cookies(); return await getSession(store.get(sessionCookieName)?.value); }

export async function GET(request: Request) {
  try {
    const session = await auth(); if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers });
    await enforceRateLimit(request, "passport-read", 120, 60, session.user.id);
    const account = await readAccountData(session.user.id); const config = normalizeOpportunityPassport(account.passport);
    const [passportStats, collectionStats] = await Promise.all([
      config.shareToken ? readPublicPassport(config.shareToken, false) : null,
      Promise.all(config.collections.map((item) => item.shareToken ? readPublicCollection(item.shareToken, false) : null)),
    ]);
    return NextResponse.json({ ok: true, passport: config, stats: { views: passportStats?.views ?? 0, opportunityClicks: passportStats?.opportunityClicks ?? 0, collections: Object.fromEntries(config.collections.map((item, index) => [item.id, { views: collectionStats[index]?.views ?? 0, opportunityClicks: collectionStats[index]?.opportunityClicks ?? 0 }])) } }, { headers });
  } catch (error) { return securityErrorResponse(error, "Passport could not be loaded."); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await auth(); if (!session) return NextResponse.json({ error: "Your session has ended." }, { status: 401, headers });
    await enforceRateLimit(request, "passport-write", 30, 60, session.user.id);
    const body = await readBoundedJson<Record<string, unknown>>(request, 96 * 1024);
    if (!body.passport || typeof body.passport !== "object") throw new SecurityError("Invalid Passport settings.", 400, "invalid_passport");
    const account = await readAccountData(session.user.id); const current = normalizeOpportunityPassport(account.passport); const rawPassport = body.passport as Record<string, unknown>; const requested = normalizeOpportunityPassport(body.passport); const wantsSharing = rawPassport.sharingEnabled === true;
    const rawCollections = Array.isArray(rawPassport.collections) ? rawPassport.collections : [];
    const now = new Date().toISOString();
    const collections = requested.collections.map((item) => {
      const previous = current.collections.find((candidate) => candidate.id === item.id);
      const wantsCollectionSharing = rawCollections.some((candidate) => candidate && typeof candidate === "object" && (candidate as Record<string, unknown>).id === item.id && (candidate as Record<string, unknown>).sharingEnabled === true);
      return { ...item, shareToken: wantsCollectionSharing ? previous?.shareToken ?? generatePublicToken() : previous?.shareToken, sharingEnabled: wantsCollectionSharing, updatedAt: now };
    });
    const next = normalizeOpportunityPassport({ ...requested, shareToken: wantsSharing ? current.shareToken ?? generatePublicToken() : current.shareToken, sharingEnabled: wantsSharing, collections, updatedAt: now, version: current.version + 1 });
    const updated = await updateOpportunityPassport(session.user.id, next);
    const opportunities = await listPublishedOpportunitiesByIds(idsFor(updated), { includeArchived: true });
    const publicView = buildPassportView({ user: session.user, account: updated, opportunities, publicOnly: true });
    if (next.sharingEnabled && next.shareToken) await publishPassport(next.shareToken, publicView); else await revokePassport(current.shareToken);
    for (const previous of current.collections) if (previous.sharingEnabled && (!collections.find((item) => item.id === previous.id)?.sharingEnabled || !collections.some((item) => item.id === previous.id))) await revokeCollection(previous.shareToken);
    for (const collection of publicView.collections) if (collection.sharingEnabled && collection.shareToken) await publishCollection(collection.shareToken, collection, publicView.identity.name);
    return NextResponse.json({ ok: true, passport: next, shareUrl: next.sharingEnabled ? `/p/${next.shareToken}` : null }, { headers });
  } catch (error) { if (!(error instanceof SecurityError)) console.error("[UnlockED Passport] save failed", { errorType: error instanceof Error ? error.name : "unknown" }); return securityErrorResponse(error, "Passport could not be saved."); }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await auth(); if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers });
    await enforceRateLimit(request, "passport-collection-copy", 20, 60, session.user.id);
    const body = await readBoundedJson<Record<string, unknown>>(request, 8 * 1024); const token = typeof body.token === "string" && /^[A-Za-z0-9_-]{24,80}$/.test(body.token) ? body.token : "";
    if (body.action !== "copy_collection" || !token) throw new SecurityError("Invalid collection request.", 400, "invalid_collection");
    const shared = await readPublicCollection(token, false); if (!shared?.collection.sharingEnabled) return NextResponse.json({ error: "Collection is no longer shared." }, { status: 404, headers });
    const account = await readAccountData(session.user.id); const passport = normalizeOpportunityPassport(account.passport); const opportunityIds = shared.collection.opportunities.map((item) => item.id); const alreadySaved = passport.collections.some((item) => item.opportunityIds.join("|") === opportunityIds.join("|") && item.title === shared.collection.title);
    if (alreadySaved) return NextResponse.json({ ok: true, duplicate: true }, { headers });
    const now = new Date().toISOString(); passport.collections.push({ id: `collection:${crypto.randomUUID()}`, title: shared.collection.title, description: shared.collection.description, opportunityIds, sharingEnabled: false, createdAt: now, updatedAt: now }); passport.updatedAt = now; passport.version += 1;
    await updateOpportunityPassport(session.user.id, normalizeOpportunityPassport(passport));
    return NextResponse.json({ ok: true, duplicate: false }, { headers });
  } catch (error) { return securityErrorResponse(error, "Collection could not be copied."); }
}
