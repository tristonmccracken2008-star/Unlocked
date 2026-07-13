import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, mergeAccountData, sessionCookieName } from "@/lib/auth-store";
import type { AccountData, AuthUser } from "@/lib/account-types";
import { chooseCareerId, generateAdvisorOutput, normalizeOnboardingProfile, profileToRawAdvisorProfile } from "./engine";
import type { AdvisorAccountData, AdvisorFeedbackRecord, AdvisorOutput, NormalizedAdvisorProfile, RawAdvisorProfile } from "./types";

export async function requireAdvisorSession() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(sessionCookieName)?.value);
  if (!session) return null;
  return session;
}

export function unauthorizedAdvisorResponse() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
}

export function emptyAdvisorData(): AdvisorAccountData {
  return { normalizedProfiles: [], recommendationSnapshots: [], forYouSnapshots: [], auditRecords: [], feedbackRecords: [], completedActionEvidence: [], updatedAt: new Date().toISOString() };
}

export function nextAdvisorData(current: AccountData, patch: Partial<AdvisorAccountData>): AdvisorAccountData {
  const existing = current.advisor ?? emptyAdvisorData();
  const next = {
    normalizedProfiles: [...existing.normalizedProfiles, ...(patch.normalizedProfiles ?? [])].slice(-20),
    recommendationSnapshots: [...existing.recommendationSnapshots, ...(patch.recommendationSnapshots ?? [])].slice(-20),
    forYouSnapshots: [...(existing.forYouSnapshots ?? []), ...(patch.forYouSnapshots ?? [])].slice(-3),
    auditRecords: [...existing.auditRecords, ...(patch.auditRecords ?? [])].slice(-50),
    feedbackRecords: [...existing.feedbackRecords, ...(patch.feedbackRecords ?? [])].slice(-100),
    completedActionEvidence: [...existing.completedActionEvidence, ...(patch.completedActionEvidence ?? [])].slice(-100),
    updatedAt: new Date().toISOString(),
  };
  return next;
}

export async function saveAdvisorData(userId: string, current: AccountData, patch: Partial<AdvisorAccountData>) {
  const advisor = nextAdvisorData(current, patch);
  const data = await mergeAccountData(userId, { advisor });
  return data.advisor ?? advisor;
}

export function profileForRecommendation(user: AuthUser, data: AccountData, body: unknown): NormalizedAdvisorProfile {
  const rawBody = body && typeof body === "object" ? body as { profile?: RawAdvisorProfile; rawProfile?: RawAdvisorProfile } : {};
  if (rawBody.profile || rawBody.rawProfile) return normalizeOnboardingProfile({ ...(rawBody.profile ?? rawBody.rawProfile), userId: user.id });
  if (!data.profile) return normalizeOnboardingProfile({ userId: user.id });
  return normalizeOnboardingProfile(profileToRawAdvisorProfile(data.profile, user.id));
}

export function recommendationFor(user: AuthUser, data: AccountData, body: unknown): { normalizedProfile: NormalizedAdvisorProfile; output: AdvisorOutput } {
  const normalizedProfile = profileForRecommendation(user, data, body);
  const careerId = chooseCareerId(normalizedProfile);
  const output = generateAdvisorOutput(normalizedProfile, careerId, data.advisor?.feedbackRecords ?? []);
  return { normalizedProfile, output };
}

export function cleanFeedback(input: unknown, userId: string): AdvisorFeedbackRecord | null {
  if (!input || typeof input !== "object") return null;
  const body = input as Partial<AdvisorFeedbackRecord>;
  const cleanId = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value) ? value : null;
  const recommendationId = cleanId(body.recommendationId);
  const actionId = cleanId(body.actionId);
  if (!recommendationId || !actionId || !body.feedbackType) return null;
  if (!["helpful", "not-relevant", "already-completed", "already-applied", "too-expensive", "too-time-consuming", "completed", "dismissed", "dont-enjoy-this", "prefer-research", "prefer-industry", "not-interested"].includes(body.feedbackType)) return null;
  return {
    recommendationId,
    studentId: userId,
    actionId,
    signal: typeof body.signal === "string" ? body.signal.trim().slice(0, 160) : undefined,
    feedbackType: body.feedbackType,
    reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : undefined,
    outcomeEvidence: body.outcomeEvidence && typeof body.outcomeEvidence === "object" && !Array.isArray(body.outcomeEvidence)
      ? Object.fromEntries(Object.entries(body.outcomeEvidence).slice(0, 20).filter(([, value]) => value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string").map(([key, value]) => [key.slice(0, 80), typeof value === "string" ? value.slice(0, 500) : value]))
      : null,
    createdAt: new Date().toISOString(),
  };
}
