"use client";

import { studentActivityEvent, studentActivityStorageKey, type StudentActivity } from "./student-activity";
import { isCompletedStudentProfile, normalizeStudentProfile, studentProfileCompleteStorageKey, studentProfileStorageKey, type StudentProfile } from "./student-profile";
import type { AccountData, AccountSession } from "@/lib/account-types";
import { defaultBillingRecord } from "@/lib/billing";

export const journeyProgressStorageKey = "unlocked-journey-progress";
export const accountSessionEvent = "unlocked-account-session-change";
export const accountSyncErrorEvent = "unlocked-account-sync-error";
const accountMigrationKey = (userId: string) => `unlocked-account-migrated:${userId}`;
const accountMigrationPrefix = "unlocked-account-migrated:";
let sessionCache: AccountSession | null = null;
let sessionCacheAt = 0;
let sessionRequest: Promise<AccountSession> | null = null;
let hydrateRequest: Promise<AccountSession> | null = null;
const sessionCacheMs = 5000;

function readJson<T>(key: string, fallback: T): T {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function mergeActivity(local: StudentActivity | null, remote: StudentActivity | null): StudentActivity | null {
  if (!local && !remote) return null;
  const tracked = { ...(remote?.tracked ?? {}) };
  for (const [id, record] of Object.entries(local?.tracked ?? {})) {
    if (!tracked[id] || record.updatedAt > tracked[id].updatedAt) tracked[id] = record;
  }
  return {
    viewed: [...new Set([...(remote?.viewed ?? []), ...(local?.viewed ?? [])])],
    saved: [...new Set([...(remote?.saved ?? []), ...(local?.saved ?? []), ...Object.keys(tracked)])],
    claimed: [...new Set([...(remote?.claimed ?? []), ...(local?.claimed ?? [])])],
    tracked,
  };
}

function localAccountData(): Partial<AccountData> {
  const activity = readJson<StudentActivity | null>(studentActivityStorageKey, null);
  const tracker = activity?.tracked ?? {};
  return {
    profile: readJson<StudentProfile | null>(studentProfileStorageKey, null),
    activity,
    savedOpportunities: [...new Set([...(activity?.saved ?? []), ...Object.keys(tracker)])].map((opportunityId) => ({ opportunityId, savedAt: tracker[opportunityId]?.savedAt ?? new Date().toISOString() })),
    tracker,
    journeyProgress: readJson<Record<string, boolean>>(journeyProgressStorageKey, {}),
  };
}

export async function readAccountSession(force = false) {
  if (!force && sessionCache && Date.now() - sessionCacheAt < sessionCacheMs) return sessionCache;
  if (!force && sessionRequest) return sessionRequest;
  sessionRequest = fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" }).then(async (response) => {
    const session = response.ok ? await response.json() as AccountSession : { authenticated: false, user: null, data: null } as AccountSession;
    sessionCache = session;
    sessionCacheAt = Date.now();
    return session;
  }).finally(() => { sessionRequest = null; });
  return sessionRequest;
}

async function readAccountSessionUncached() {
  const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return { authenticated: false, user: null, data: null } as AccountSession;
  const session = await response.json() as AccountSession;
  sessionCache = session;
  sessionCacheAt = Date.now();
  return session;
}

export async function readCloudAccountData() {
  const response = await fetch("/api/account/data", { credentials: "same-origin", cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Account data could not be loaded.");
  const parsed = await response.json() as { ok: boolean; data: AccountData };
  return parsed.data;
}

export async function pushAccountData(data: Partial<AccountData>) {
  const response = await fetch("/api/account/data", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Account data could not be saved.");
  const parsed = await response.json() as { ok: boolean; data: AccountData };
  return parsed.data;
}

export function syncAccountData(data: Partial<AccountData>) {
  void pushAccountData(data).catch((error) => window.dispatchEvent(new CustomEvent(accountSyncErrorEvent, { detail: error instanceof Error ? error.message : "Account sync failed." })));
}

function sameAccountData(left: Partial<AccountData>, right: Partial<AccountData> | null | undefined) {
  return JSON.stringify({
    profile: left.profile ?? null,
    onboardingComplete: Boolean(left.onboardingComplete),
    activity: left.activity ?? null,
    journeyProgress: left.journeyProgress ?? {},
    preferences: left.preferences ?? null,
    advisor: left.advisor ?? null,
  }) === JSON.stringify({
    profile: right?.profile ?? null,
    onboardingComplete: Boolean(right?.onboardingComplete),
    activity: right?.activity ?? null,
    journeyProgress: right?.journeyProgress ?? {},
    preferences: right?.preferences ?? null,
    advisor: right?.advisor ?? null,
  });
}

export function clearLocalDashboardState() {
  localStorage.removeItem(studentProfileStorageKey);
  localStorage.removeItem(studentProfileCompleteStorageKey);
  localStorage.removeItem(studentActivityStorageKey);
  localStorage.removeItem(journeyProgressStorageKey);
  for (const key of Object.keys(localStorage)) if (key.startsWith(accountMigrationPrefix)) localStorage.removeItem(key);
  window.dispatchEvent(new CustomEvent(studentActivityEvent, { detail: { viewed: [], saved: [], claimed: [], tracked: {} } }));
}

export async function hydrateAccountData() {
  if (hydrateRequest) return hydrateRequest;
  hydrateRequest = hydrateAccountDataInner().finally(() => { hydrateRequest = null; });
  return hydrateRequest;
}

async function hydrateAccountDataInner() {
  const session = await readAccountSessionUncached();
  if (!session.authenticated || !session.user) return session;
  const cloudData = session.data;
  const local = localAccountData();
  const migrated = localStorage.getItem(accountMigrationKey(session.user.id)) === "true";
  const merged: Partial<AccountData> = {
    profile: cloudData?.profile ?? (!migrated ? local.profile ?? null : null),
    onboardingComplete: Boolean(cloudData?.onboardingComplete || isCompletedStudentProfile(cloudData?.profile) || (!migrated && isCompletedStudentProfile(local.profile))),
    activity: mergeActivity(local.activity ?? null, cloudData?.activity ?? null),
    journeyProgress: migrated ? { ...(local.journeyProgress ?? {}), ...(cloudData?.journeyProgress ?? {}) } : { ...(cloudData?.journeyProgress ?? {}), ...(local.journeyProgress ?? {}) },
    preferences: cloudData?.preferences ?? null,
    advisor: cloudData?.advisor ?? null,
  };
  merged.tracker = merged.activity?.tracked ?? {};
  merged.savedOpportunities = [...new Set([...(merged.activity?.saved ?? []), ...Object.keys(merged.tracker)])].map((opportunityId) => ({ opportunityId, savedAt: merged.tracker?.[opportunityId]?.savedAt ?? new Date().toISOString() }));
  if (isCompletedStudentProfile(merged.profile)) {
    merged.profile = normalizeStudentProfile(merged.profile);
    localStorage.setItem(studentProfileStorageKey, JSON.stringify(merged.profile));
    localStorage.setItem(studentProfileCompleteStorageKey, "true");
  }
  if (merged.activity) {
    localStorage.setItem(studentActivityStorageKey, JSON.stringify(merged.activity));
    window.dispatchEvent(new CustomEvent(studentActivityEvent, { detail: merged.activity }));
  }
  localStorage.setItem(journeyProgressStorageKey, JSON.stringify(merged.journeyProgress ?? {}));
  localStorage.setItem(accountMigrationKey(session.user.id), "true");
  const saved = !migrated || !sameAccountData(merged, cloudData) ? await pushAccountData(merged) : cloudData;
  const syncedSession = { ...session, data: saved ?? { profile: merged.profile ?? null, onboardingComplete: Boolean(merged.onboardingComplete), billing: cloudData?.billing ?? defaultBillingRecord(), activity: merged.activity ?? null, savedOpportunities: merged.savedOpportunities ?? [], tracker: merged.tracker ?? {}, preferences: merged.preferences ?? null, journeyProgress: merged.journeyProgress ?? {}, advisor: merged.advisor ?? null, updatedAt: new Date().toISOString() } } satisfies AccountSession;
  sessionCache = syncedSession;
  sessionCacheAt = Date.now();
  window.dispatchEvent(new CustomEvent(accountSessionEvent, { detail: syncedSession }));
  return syncedSession;
}
