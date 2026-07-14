import crypto from "node:crypto";
import type { AccountData, AuthUser, DatabaseUser } from "./account-types";
import type { AdvisorAccountData } from "./advisor/types";
import { defaultBillingRecord, normalizeBillingRecord, type BillingRecord } from "./billing";
import { applyReferralProGrant, newlyUnlockedReferralRewards, normalizeReferralData, sanitizeReferralCode, type ReferralAccountData, type ReferralAdminSummary, type ReferralParticipant } from "./referrals";
import { recordAnalyticsEvent } from "./analytics-store";
import { isCompletedStudentProfile, normalizeStudentProfile } from "@/data/student-profile";
import { meaningfulAdvisorProfileChanged } from "./advisor/profile-version";
import { constantTimeEqual, requiredAuthSecret } from "./security";

export const sessionCookieName = "unlocked_session";
export const oauthStateCookieName = "unlocked_oauth_state";
export const oauthCodeVerifierCookieName = "unlocked_oauth_verifier";

type SignedSessionPayload = {
  v: 2;
  sid: string;
  exp: string;
  iat: string;
};

type StoredSession = { userId: string; expiresAt: string };
type StoredValue = DatabaseUser | AccountData | ReferralAdminSummary | StoredSession | string | null;

const memoryStore = new Map<string, StoredValue>();
const memoryExpiry = new Map<string, number>();
const kvUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const hasKv = Boolean(kvUrl && kvToken);
const kvTimeoutMs = 2800;
const kvRetryDelayMs = 120;
const releaseLockScript = "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end";

const emptyData = (): AccountData => ({ profile: null, onboardingComplete: false, billing: defaultBillingRecord(), activity: null, savedOpportunities: [], tracker: {}, preferences: null, journeyProgress: {}, advisor: null, referrals: null, updatedAt: new Date().toISOString() });

function requireProductionStore() {
  if (!hasKv && process.env.NODE_ENV === "production") throw new Error("A production data store is required. Set KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN.");
}

function hash(value: string) {
  return crypto.createHmac("sha256", requiredAuthSecret()).update(value).digest("hex");
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
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature || !constantTimeEqual(hash(body), signature)) return null;
  try {
    const payload = decode<SignedSessionPayload>(body);
    if (payload.v !== 2 || !payload.sid || new Date(payload.exp) <= new Date()) return null;
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

function accountBillingKey(userId: string) {
  return `unlocked:account-billing:${hash(userId).slice(0, 24)}`;
}

function sessionKey(sessionId: string) {
  return `unlocked:session:${hash(sessionId).slice(0, 32)}`;
}

function stripeEventKey(eventId: string) {
  return `unlocked:stripe-event:${hash(eventId).slice(0, 32)}`;
}

function securityLockKey(scope: string, identity: string) {
  return `unlocked:lock:${scope}:${hash(`${scope}:${identity}`).slice(0, 32)}`;
}

function stripeCustomerKey(customerId: string) {
  return `unlocked:stripe-customer:${hash(customerId).slice(0, 24)}`;
}

function referralCodeKey(code: string) {
  return `unlocked:referral-code:${sanitizeReferralCode(code)}`;
}

function referralAdminSummaryKey() {
  return "unlocked:referral-admin-summary";
}

function shouldRetryKvCommand(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.message.includes("timed out") || error.message.includes("fetch failed");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function kvCommand<T>(command: unknown[]): Promise<T | null> {
  requireProductionStore();
  if (!kvUrl || !kvToken) {
    const [op, key, value, ...options] = command as [string, string, StoredValue?, ...unknown[]];
    const expiresAt = memoryExpiry.get(key);
    if (expiresAt && expiresAt <= Date.now()) {
      memoryStore.delete(key);
      memoryExpiry.delete(key);
    }
    if (op === "GET") return (memoryStore.get(key) ?? null) as T | null;
    if (op === "SET") {
      if (options.includes("NX") && memoryStore.has(key)) return null;
      memoryStore.set(key, value ?? null);
      const expiryIndex = options.findIndex((item) => item === "EX");
      if (expiryIndex >= 0) memoryExpiry.set(key, Date.now() + Number(options[expiryIndex + 1]) * 1000);
      return "OK" as T;
    }
    if (op === "DEL") {
      memoryStore.delete(key);
      memoryExpiry.delete(key);
      return 1 as T;
    }
    if (op === "EVAL" && key === releaseLockScript) {
      const lockKey = String(options[0] ?? "");
      const token = String(options[1] ?? "");
      if (memoryStore.get(lockKey) !== token) return 0 as T;
      memoryStore.delete(lockKey);
      memoryExpiry.delete(lockKey);
      return 1 as T;
    }
    throw new Error(`Unsupported development store command: ${op}`);
  }
  const operation = typeof command[0] === "string" ? command[0] : "UNKNOWN";
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), kvTimeoutMs);
    try {
      const response = await fetch(kvUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${kvToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(command),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`KV command failed: ${response.status}`);
      const parsed = await response.json() as { result?: T | null };
      return parsed.result ?? null;
    } catch (error) {
      lastError = error instanceof Error && error.name === "AbortError" ? new Error("KV command timed out.") : error;
      if (attempt >= 2 || !shouldRetryKvCommand(lastError)) throw lastError;
      console.warn("[UnlockED store] KV command retry", {
        operation,
        attempt,
        reason: lastError instanceof Error ? lastError.message : "unknown",
      });
      await wait(kvRetryDelayMs);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("KV command failed.");
}

async function dbGet<T>(key: string): Promise<T | null> {
  const value = await kvCommand<T | string>(["GET", key]);
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return value as T; }
  }
  return value as T | null;
}

async function dbSet(key: string, value: unknown, options: { expiresInSeconds?: number; onlyIfMissing?: boolean } = {}) {
  const command: unknown[] = ["SET", key, JSON.stringify(value)];
  if (options.expiresInSeconds) command.push("EX", options.expiresInSeconds);
  if (options.onlyIfMissing) command.push("NX");
  return await kvCommand<string>(command);
}

async function dbDelete(key: string) {
  await kvCommand(["DEL", key]);
}

export async function withSecurityLock<T>(scope: string, identity: string, operation: () => Promise<T>) {
  const key = securityLockKey(scope, identity);
  const token = crypto.randomBytes(24).toString("base64url");
  const acquired = await dbSet(key, token, { expiresInSeconds: 60, onlyIfMissing: true });
  if (acquired !== "OK") throw new Error("A protected account operation is already in progress.");
  try {
    return await operation();
  } finally {
    await kvCommand<number>(["EVAL", releaseLockScript, "1", key, JSON.stringify(token)]).catch((error) => {
      console.warn("[UnlockED store] Lock release failed", { scope, errorCategory: error instanceof Error ? error.name : "unknown" });
    });
  }
}

export async function readAccountData(userId: string) {
  const [data, canonicalBilling] = await Promise.all([
    dbGet<AccountData>(accountDataKey(userId)),
    dbGet<BillingRecord>(accountBillingKey(userId)),
  ]);
  const normalized = normalizeAccountData(data);
  if (canonicalBilling) normalized.billing = normalizeBillingRecord(canonicalBilling);
  return await ensureReferralAccountData(userId, normalized);
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

async function generateReferralCode(_userId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const random = crypto.randomBytes(10).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const code = `U${random.slice(0, 11)}`;
    if (await dbSet(referralCodeKey(code), _userId, { onlyIfMissing: true }) === "OK") return code;
  }
  throw new Error("Could not generate a unique referral code.");
}

async function ensureReferralAccountData(userId: string, data: AccountData): Promise<AccountData> {
  const existing = normalizeReferralData(data.referrals);
  if (existing) {
    const owner = await dbGet<string>(referralCodeKey(existing.code));
    if (!owner) await dbSet(referralCodeKey(existing.code), userId);
    return { ...data, referrals: existing };
  }
  const now = new Date().toISOString();
  const code = await generateReferralCode(userId);
  const referrals: ReferralAccountData = { code, referredBy: null, pending: [], completed: [], rewardHistory: [], abuseFlags: [], createdAt: now, updatedAt: now };
  const next = { ...data, referrals, updatedAt: now };
  await writeAccountData(userId, next);
  return next;
}

export async function createSession(user: AuthUser) {
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  const sid = crypto.randomBytes(32).toString("base64url");
  const payload: SignedSessionPayload = { v: 2, sid, exp: expires.toISOString(), iat: new Date().toISOString() };
  await dbSet(sessionKey(sid), { userId: user.id, expiresAt: expires.toISOString() } satisfies StoredSession, { expiresInSeconds: 60 * 60 * 24 * 30 });
  const token = signPayload(payload);
  console.info("[UnlockED auth] Session created", { expiresAt: expires.toISOString() });
  return { token, expires };
}

export async function getSession(token: string | undefined) {
  if (!token) return null;
  const signed = verifySignedSession(token);
  if (!signed) return null;
  const stored = await dbGet<StoredSession>(sessionKey(signed.sid));
  if (!stored || new Date(stored.expiresAt) <= new Date()) return null;
  const databaseUser = await dbGet<DatabaseUser>(userKey(stored.userId));
  if (!databaseUser) return null;
  const user: AuthUser = { id: databaseUser.id, email: databaseUser.email, name: databaseUser.name, image: databaseUser.image };
  return { user, data: await readAccountData(user.id) };
}

export async function deleteSession(token: string | undefined) {
  if (!token) return;
  const signed = verifySignedSession(token);
  if (signed?.sid) await dbDelete(sessionKey(signed.sid));
}

export type SessionRevocationResult = "revoked" | "already_revoked" | "no_session" | "invalid_session";

export async function revokeCurrentSession(token: string | undefined): Promise<SessionRevocationResult> {
  if (!token) return "no_session";
  const signed = verifySignedSession(token);
  if (!signed?.sid) return "invalid_session";
  const key = sessionKey(signed.sid);
  const stored = await dbGet<StoredSession>(key);
  if (!stored) return "already_revoked";
  await dbDelete(key);
  return "revoked";
}

export async function claimStripeWebhookEvent(eventId: string) {
  const result = await dbSet(stripeEventKey(eventId), "processing", { expiresInSeconds: 10 * 60, onlyIfMissing: true });
  return result === "OK";
}

export async function completeStripeWebhookEvent(eventId: string) {
  await dbSet(stripeEventKey(eventId), "processed", { expiresInSeconds: 60 * 60 * 24 * 30 });
}

export async function releaseStripeWebhookEvent(eventId: string) {
  await dbDelete(stripeEventKey(eventId));
}

const uniqueStrings = (items: unknown) => Array.isArray(items) ? [...new Set(items.filter((item): item is string => typeof item === "string"))] : [];

function normalizeAdvisorData(value: AdvisorAccountData | null | undefined): AdvisorAccountData | null {
  if (!value) return null;
  return {
    normalizedProfiles: Array.isArray(value.normalizedProfiles) ? value.normalizedProfiles.slice(-20) : [],
    recommendationSnapshots: Array.isArray(value.recommendationSnapshots) ? value.recommendationSnapshots.slice(-20) : [],
    forYouSnapshots: Array.isArray(value.forYouSnapshots) ? value.forYouSnapshots.slice(-3) : [],
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
    referrals: normalizeReferralData(value.referrals),
    updatedAt: value.updatedAt ?? new Date().toISOString(),
  };
}

export function accountHasCompletedOnboarding(data: AccountData | null | undefined) {
  return Boolean(data?.onboardingComplete && data.profile && isCompletedStudentProfile(data.profile));
}

export async function mergeAccountData(userId: string, incoming: Partial<AccountData>) {
  const current = await readAccountData(userId);
  const wasOnboarded = accountHasCompletedOnboarding(current);
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
    referrals: current.referrals,
    updatedAt: new Date().toISOString(),
  };
  await writeAccountData(userId, next);
  if (!wasOnboarded && accountHasCompletedOnboarding(next)) {
    await completeReferralOnboarding(userId);
    return await readAccountData(userId);
  }
  return next;
}

export async function updateAccountBilling(userId: string, billing: Partial<BillingRecord>) {
  const current = await readAccountData(userId);
  const nextBilling = normalizeBillingRecord({ ...current.billing, ...billing, updatedAt: new Date().toISOString() });
  const next: AccountData = {
    ...current,
    billing: nextBilling,
    updatedAt: new Date().toISOString(),
  };
  await dbSet(accountBillingKey(userId), nextBilling);
  await writeAccountData(userId, next);
  if (next.billing.stripeCustomerId) await dbSet(stripeCustomerKey(next.billing.stripeCustomerId), userId);
  return next;
}

export async function findUserIdByStripeCustomerId(customerId: string) {
  return await dbGet<string>(stripeCustomerKey(customerId));
}

export async function accountUserExists(userId: string) {
  return Boolean(await dbGet<DatabaseUser>(userKey(userId)));
}

function participantFor(userId: string, data: AccountData, status: "pending" | "completed", now: string): ReferralParticipant {
  return {
    userId,
    firstName: data.profile?.firstName,
    school: data.profile?.schoolSlug,
    joinedAt: now,
    completedAt: status === "completed" ? now : undefined,
    status,
  };
}

async function readReferralAdminSummary(): Promise<ReferralAdminSummary> {
  return await dbGet<ReferralAdminSummary>(referralAdminSummaryKey()) ?? { topReferrers: [], pendingReferrals: [], rewardHistory: [], abuseFlags: [], updatedAt: new Date().toISOString() };
}

async function writeReferralAdminSummary(summary: ReferralAdminSummary) {
  await dbSet(referralAdminSummaryKey(), { ...summary, updatedAt: new Date().toISOString() });
}

async function updateReferralAdminSnapshot(userId: string, referrals: ReferralAccountData) {
  const summary = await readReferralAdminSummary();
  const nextTop = [
    { userId, code: referrals.code, completed: referrals.completed.length, pending: referrals.pending.length, rewards: referrals.rewardHistory.length, updatedAt: new Date().toISOString() },
    ...summary.topReferrers.filter((item) => item.userId !== userId),
  ].sort((a, b) => b.completed - a.completed || b.rewards - a.rewards).slice(0, 100);
  const pending = [
    ...summary.pendingReferrals.filter((item) => item.referrerUserId !== userId),
    ...referrals.pending.map((item) => ({ referrerUserId: userId, referredUserId: item.userId, code: referrals.code, joinedAt: item.joinedAt })),
  ].slice(-300);
  const rewards = [
    ...summary.rewardHistory,
    ...referrals.rewardHistory.map((reward) => ({ userId, code: referrals.code, rewardKey: reward.rewardKey, threshold: reward.threshold, unlockedAt: reward.unlockedAt })),
  ].filter((item, index, all) => all.findIndex((candidate) => candidate.userId === item.userId && candidate.rewardKey === item.rewardKey && candidate.unlockedAt === item.unlockedAt) === index).slice(-500);
  await writeReferralAdminSummary({ ...summary, topReferrers: nextTop, pendingReferrals: pending, rewardHistory: rewards, abuseFlags: summary.abuseFlags.slice(-300) });
}

async function addReferralAbuseFlag(userId: string, reason: string, code?: string) {
  const summary = await readReferralAdminSummary();
  await writeReferralAdminSummary({ ...summary, abuseFlags: [...summary.abuseFlags, { userId, code, reason, createdAt: new Date().toISOString() }].slice(-300) });
}

export async function getReferralCodeOwner(code: string) {
  const safeCode = sanitizeReferralCode(code);
  if (!safeCode) return null;
  return await dbGet<string>(referralCodeKey(safeCode));
}

async function attachReferralToUserUnlocked(userId: string, code: string) {
  const safeCode = sanitizeReferralCode(code);
  if (!safeCode) return { attached: false, reason: "invalid_code" as const };
  const referrerUserId = await getReferralCodeOwner(safeCode);
  if (!referrerUserId) return { attached: false, reason: "unknown_code" as const };
  if (referrerUserId === userId) {
    await addReferralAbuseFlag(userId, "self_referral", safeCode);
    return { attached: false, reason: "self_referral" as const };
  }
  const referred = await readAccountData(userId);
  if (accountHasCompletedOnboarding(referred)) return { attached: false, reason: "already_onboarded" as const };
  if (referred.referrals?.referredBy) return { attached: false, reason: "already_referred" as const };
  const referrer = await readAccountData(referrerUserId);
  if (referrer.referrals?.referredBy?.referrerUserId === userId) {
    await addReferralAbuseFlag(userId, "referral_loop", safeCode);
    return { attached: false, reason: "referral_loop" as const };
  }
  const now = new Date().toISOString();
  const nextReferred: AccountData = {
    ...referred,
    referrals: {
      ...referred.referrals!,
      referredBy: { code: safeCode, referrerUserId, attachedAt: now, status: "pending" },
      updatedAt: now,
    },
    updatedAt: now,
  };
  const pendingParticipant = participantFor(userId, referred, "pending", now);
  const referrerPending = referrer.referrals!.pending.filter((item) => item.userId !== userId);
  const nextReferrer: AccountData = {
    ...referrer,
    referrals: {
      ...referrer.referrals!,
      pending: [...referrerPending, pendingParticipant],
      updatedAt: now,
    },
    updatedAt: now,
  };
  await writeAccountData(userId, nextReferred);
  await writeAccountData(referrerUserId, nextReferrer);
  await updateReferralAdminSnapshot(referrerUserId, nextReferrer.referrals!);
  return { attached: true, reason: "attached" as const };
}

export async function attachReferralToUser(userId: string, code: string) {
  return await withSecurityLock("referral-ledger", "global", () => attachReferralToUserUnlocked(userId, code));
}

async function completeReferralOnboardingUnlocked(userId: string) {
  const referred = await readAccountData(userId);
  const attribution = referred.referrals?.referredBy;
  if (!attribution || attribution.status === "completed" || attribution.status === "blocked") return { credited: false, reason: "not_pending" as const };
  if (!accountHasCompletedOnboarding(referred)) return { credited: false, reason: "onboarding_incomplete" as const };
  const referrerUserId = await getReferralCodeOwner(attribution.code);
  if (!referrerUserId || referrerUserId !== attribution.referrerUserId || referrerUserId === userId) {
    await addReferralAbuseFlag(userId, "invalid_referral_completion", attribution.code);
    const now = new Date().toISOString();
    await writeAccountData(userId, { ...referred, referrals: { ...referred.referrals!, referredBy: { ...attribution, status: "blocked", blockReason: "invalid_referral_completion" }, updatedAt: now }, updatedAt: now });
    return { credited: false, reason: "invalid_referrer" as const };
  }
  const referrer = await readAccountData(referrerUserId);
  if (referrer.referrals!.completed.some((item) => item.userId === userId)) {
    const now = new Date().toISOString();
    await dbSet(accountBillingKey(referrerUserId), referrer.billing);
    await writeAccountData(userId, {
      ...referred,
      referrals: { ...referred.referrals!, referredBy: { ...attribution, status: "completed", creditedAt: now }, updatedAt: now },
      updatedAt: now,
    });
    return { credited: false, reason: "duplicate_completion" as const };
  }
  const now = new Date().toISOString();
  const previousCompleted = referrer.referrals!.completed.length;
  const completedParticipant = participantFor(userId, referred, "completed", now);
  const completed = [...referrer.referrals!.completed, completedParticipant];
  const unlocked = newlyUnlockedReferralRewards(previousCompleted, completed.length).filter((reward) => !referrer.referrals!.rewardHistory.some((item) => item.rewardKey === reward.key));
  let nextBilling = referrer.billing;
  const rewardHistory = [...referrer.referrals!.rewardHistory];
  for (const reward of unlocked) {
    const proBilling = reward.key === "one_month_pro" ? applyReferralProGrant(nextBilling, now) : nextBilling;
    nextBilling = proBilling;
    rewardHistory.push({ rewardKey: reward.key, threshold: reward.threshold, label: reward.label, unlockedAt: now, applied: true, expiresAt: reward.key === "one_month_pro" ? proBilling.referralProGrantedUntil : undefined });
  }
  const nextReferrer: AccountData = {
    ...referrer,
    billing: normalizeBillingRecord(nextBilling),
    referrals: {
      ...referrer.referrals!,
      pending: referrer.referrals!.pending.filter((item) => item.userId !== userId),
      completed,
      rewardHistory,
      updatedAt: now,
    },
    updatedAt: now,
  };
  const nextReferred: AccountData = {
    ...referred,
    referrals: {
      ...referred.referrals!,
      referredBy: { ...attribution, status: "completed", creditedAt: now },
      updatedAt: now,
    },
    updatedAt: now,
  };
  await writeAccountData(referrerUserId, nextReferrer);
  await dbSet(accountBillingKey(referrerUserId), nextReferrer.billing);
  await writeAccountData(userId, nextReferred);
  await updateReferralAdminSnapshot(referrerUserId, nextReferrer.referrals!).catch((error) => console.warn("[UnlockED referrals] admin snapshot failed", { errorCategory: error instanceof Error ? error.name : "unknown" }));
  await recordAnalyticsEvent("referral_completed", referrerUserId, { referralCode: attribution.code }).catch((error) => console.warn("[UnlockED referrals] completion analytics failed", { errorCategory: error instanceof Error ? error.name : "unknown" }));
  await Promise.all(unlocked.map((reward) => recordAnalyticsEvent("referral_reward_unlocked", referrerUserId, { referralCode: attribution.code, referralReward: reward.key }).catch((error) => console.warn("[UnlockED referrals] reward analytics failed", { errorCategory: error instanceof Error ? error.name : "unknown" }))));
  return { credited: true, rewards: unlocked.map((reward) => reward.key) };
}

export async function completeReferralOnboarding(userId: string) {
  return await withSecurityLock("referral-ledger", "global", () => completeReferralOnboardingUnlocked(userId));
}

export async function getReferralAdminSummary() {
  return await readReferralAdminSummary();
}
