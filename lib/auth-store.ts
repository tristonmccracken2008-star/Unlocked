import crypto from "node:crypto";
import type { AccountData, AuthUser, DatabaseUser } from "./account-types";
import type { AdvisorAccountData } from "./advisor/types";
import { defaultBillingRecord, normalizeBillingRecord, type BillingRecord } from "./billing";
import { isCompletedStudentProfile, normalizeStudentProfile } from "@/data/student-profile";
import { meaningfulAdvisorProfileChanged } from "./advisor/profile-version";

export const sessionCookieName = "unlocked_session";
export const oauthStateCookieName = "unlocked_oauth_state";

type SignedSessionPayload = {
  v: 1;
  user: AuthUser;
  exp: string;
  iat: string;
};

type StoredValue = DatabaseUser | AccountData | string | null;

const memoryStore = new Map<string, StoredValue>();
const kvUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const hasKv = Boolean(kvUrl && kvToken);

const emptyData = (): AccountData => ({ profile: null, onboardingComplete: false, billing: defaultBillingRecord(), activity: null, savedOpportunities: [], tracker: {}, preferences: null, journeyProgress: {}, advisor: null, updatedAt: new Date().toISOString() });

function requireProductionStore() {
  if (!hasKv && process.env.NODE_ENV === "production") throw new Error("A production data store is required. Set KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN.");
}

function hash(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required in production.");
  return crypto.createHmac("sha256", secret ?? "unlocked-development-secret").update(value).digest("hex");
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decode<T>(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function signPayload(payload: SignedSessionPayload) {
  const body = encode(payload);
  return `${body}.${hash(body)}`;
}

function verifySignedSession(token: string): SignedSessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature || hash(body) !== signature) return null;
  try {
    const payload = decode<SignedSessionPayload>(body);
    if (payload.v !== 1 || !payload.user?.id || !payload.user.email || new Date(payload.exp) <= new Date()) return null;
    return payload;
  } catch {
    return null;
  }
}

function userKey(userId: string) {
  return `unlocked:user:${hash(userId).slice(0, 24)}`;
}

function emailKey(email: string) {
  return `unlocked:user-email:${hash(email.toLowerCase()).slice(0, 24)}`;
}

function accountDataKey(userId: string) {
  return `unlocked:account-data:${hash(userId).slice(0, 24)}`;
}

function stripeCustomerKey(customerId: string) {
  return `unlocked:stripe-customer:${hash(customerId).slice(0, 24)}`;
}

async function kvCommand<T>(command: unknown[]): Promise<T | null> {
  requireProductionStore();
  if (!kvUrl || !kvToken) {
    const [op, key, value] = command as [string, string, StoredValue?];
    if (op === "GET") return (memoryStore.get(key) ?? null) as T | null;
    if (op === "SET") {
      memoryStore.set(key, value ?? null);
      return "OK" as T;
    }
    if (op === "DEL") {
      memoryStore.delete(key);
      return 1 as T;
    }
    throw new Error(`Unsupported development store command: ${op}`);
  }
  const response = await fetch(kvUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${kvToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`KV command failed: ${response.status}`);
  const parsed = await response.json() as { result?: T | null };
  return parsed.result ?? null;
}

async function dbGet<T>(key: string): Promise<T | null> {
  const value = await kvCommand<T | string>(["GET", key]);
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return value as T; }
  }
  return value as T | null;
}

async function dbSet(key: string, value: unknown) {
  await kvCommand(["SET", key, JSON.stringify(value)]);
}

export async function readAccountData(userId: string) {
  const data = await dbGet<AccountData>(accountDataKey(userId));
  return normalizeAccountData(data);
}

async function writeAccountData(userId: string, data: AccountData) {
  await dbSet(accountDataKey(userId), data);
}

export async function upsertUser(input: Omit<AuthUser, "id"> & { googleSub: string }) {
  const email = input.email.toLowerCase();
  const existingId = await dbGet<string>(emailKey(email));
  const id = existingId ?? `google:${input.googleSub}`;
  const existing = await dbGet<DatabaseUser>(userKey(id));
  const now = new Date().toISOString();
  const user: DatabaseUser = { id, email, name: input.name, image: input.image, provider: "google", providerAccountId: input.googleSub, createdAt: existing?.createdAt ?? now, updatedAt: now };
  await dbSet(userKey(id), user);
  await dbSet(emailKey(email), id);
  if (!existing) await writeAccountData(id, emptyData());
  console.info("[UnlockED auth] OAuth user upserted");
  return user;
}

export async function createSession(user: AuthUser) {
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  const payload: SignedSessionPayload = { v: 1, user, exp: expires.toISOString(), iat: new Date().toISOString() };
  const token = signPayload(payload);
  console.info("[UnlockED auth] Session created", { expiresAt: expires.toISOString() });
  return { token, expires };
}

export async function getSession(token: string | undefined) {
  if (!token) return null;
  const signed = verifySignedSession(token);
  if (!signed) return null;
  return { user: signed.user, data: await readAccountData(signed.user.id) };
}

export async function deleteSession(_token: string | undefined) {
  return;
}

const uniqueStrings = (items: unknown) => Array.isArray(items) ? [...new Set(items.filter((item): item is string => typeof item === "string"))] : [];

function normalizeAdvisorData(value: AdvisorAccountData | null | undefined): AdvisorAccountData | null {
  if (!value) return null;
  return {
    normalizedProfiles: Array.isArray(value.normalizedProfiles) ? value.normalizedProfiles.slice(-20) : [],
    recommendationSnapshots: Array.isArray(value.recommendationSnapshots) ? value.recommendationSnapshots.slice(-20) : [],
    auditRecords: Array.isArray(value.auditRecords) ? value.auditRecords.slice(-50) : [],
    feedbackRecords: Array.isArray(value.feedbackRecords) ? value.feedbackRecords.slice(-100) : [],
    completedActionEvidence: Array.isArray(value.completedActionEvidence) ? value.completedActionEvidence.slice(-100) : [],
    updatedAt: value.updatedAt ?? new Date().toISOString(),
  };
}

function normalizeAccountData(value: AccountData | null | undefined): AccountData {
  if (!value) return emptyData();
  const tracked = value.tracker ?? value.activity?.tracked ?? {};
  const profile = value.profile && isCompletedStudentProfile(value.profile) ? normalizeStudentProfile(value.profile) : value.profile ?? null;
  return {
    profile,
    onboardingComplete: Boolean(value.onboardingComplete || (profile && isCompletedStudentProfile(profile))),
    billing: normalizeBillingRecord(value.billing),
    activity: value.activity ? {
      viewed: uniqueStrings(value.activity.viewed),
      saved: [...new Set([...uniqueStrings(value.activity.saved), ...Object.keys(tracked)])],
      claimed: uniqueStrings(value.activity.claimed),
      tracked,
    } : null,
    savedOpportunities: value.savedOpportunities?.length ? value.savedOpportunities : uniqueStrings(value.activity?.saved).map((opportunityId) => ({ opportunityId, savedAt: tracked[opportunityId]?.savedAt ?? value.updatedAt })),
    tracker: tracked,
    preferences: value.preferences ?? null,
    journeyProgress: value.journeyProgress ?? {},
    advisor: normalizeAdvisorData(value.advisor),
    updatedAt: value.updatedAt ?? new Date().toISOString(),
  };
}

export function accountHasCompletedOnboarding(data: AccountData | null | undefined) {
  return Boolean(data?.onboardingComplete && data.profile && isCompletedStudentProfile(data.profile));
}

export async function mergeAccountData(userId: string, incoming: Partial<AccountData>) {
  const current = await readAccountData(userId);
  const currentActivity = current.activity;
  const incomingActivity = incoming.activity;
  const tracker = { ...(current.tracker ?? {}), ...(currentActivity?.tracked ?? {}) };
  for (const [id, record] of Object.entries(incoming.tracker ?? incomingActivity?.tracked ?? {})) {
    if (!tracker[id] || record.updatedAt > tracker[id].updatedAt) tracker[id] = record;
  }
  const activity = incomingActivity || currentActivity ? {
    viewed: [...new Set([...uniqueStrings(currentActivity?.viewed), ...uniqueStrings(incomingActivity?.viewed)])],
    saved: [...new Set([...uniqueStrings(currentActivity?.saved), ...uniqueStrings(incomingActivity?.saved), ...Object.keys(tracker)])],
    claimed: [...new Set([...uniqueStrings(currentActivity?.claimed), ...uniqueStrings(incomingActivity?.claimed)])],
    tracked: tracker,
  } : null;
  const savedIds = [...new Set([...(current.savedOpportunities ?? []).map((item) => item.opportunityId), ...uniqueStrings(activity?.saved), ...Object.keys(tracker)])];
  const incomingProfile = incoming.profile && isCompletedStudentProfile(incoming.profile) ? normalizeStudentProfile(incoming.profile) : null;
  const profile = incomingProfile ?? current.profile ?? null;
  const profileChangedForAdvisor = Boolean(incomingProfile && meaningfulAdvisorProfileChanged(current.profile, incomingProfile));
  const next: AccountData = {
    profile,
    onboardingComplete: Boolean(current.onboardingComplete || incoming.onboardingComplete || (profile && isCompletedStudentProfile(profile))),
    billing: normalizeBillingRecord(current.billing),
    activity,
    savedOpportunities: savedIds.map((opportunityId) => current.savedOpportunities.find((item) => item.opportunityId === opportunityId) ?? incoming.savedOpportunities?.find((item) => item.opportunityId === opportunityId) ?? { opportunityId, savedAt: tracker[opportunityId]?.savedAt ?? new Date().toISOString() }),
    tracker,
    preferences: incoming.preferences ?? current.preferences ?? null,
    journeyProgress: { ...(current.journeyProgress ?? {}), ...(incoming.journeyProgress ?? {}) },
    advisor: profileChangedForAdvisor ? null : normalizeAdvisorData(incoming.advisor ?? current.advisor),
    updatedAt: new Date().toISOString(),
  };
  await writeAccountData(userId, next);
  return next;
}

export async function updateAccountBilling(userId: string, billing: Partial<BillingRecord>) {
  const current = await readAccountData(userId);
  const next: AccountData = {
    ...current,
    billing: normalizeBillingRecord({ ...current.billing, ...billing, updatedAt: new Date().toISOString() }),
    updatedAt: new Date().toISOString(),
  };
  await writeAccountData(userId, next);
  if (next.billing.stripeCustomerId) await dbSet(stripeCustomerKey(next.billing.stripeCustomerId), userId);
  return next;
}

export async function findUserIdByStripeCustomerId(customerId: string) {
  return await dbGet<string>(stripeCustomerKey(customerId));
}
