"use client";

import { studentActivityEvent, studentActivityStorageKey, type StudentActivity } from "./student-activity";
import { studentProfileStorageKey, type StudentProfile } from "./student-profile";
import type { AccountData, AccountSession } from "@/lib/account-types";

export const journeyProgressStorageKey = "unlocked-journey-progress";
export const accountSessionEvent = "unlocked-account-session-change";
export const accountSyncErrorEvent = "unlocked-account-sync-error";
const accountMigrationKey = (userId: string) => `unlocked-account-migrated:${userId}`;

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
  return {
    profile: readJson<StudentProfile | null>(studentProfileStorageKey, null),
    activity: readJson<StudentActivity | null>(studentActivityStorageKey, null),
    journeyProgress: readJson<Record<string, boolean>>(journeyProgressStorageKey, {}),
  };
}

export async function readAccountSession() {
  const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return { authenticated: false, user: null, data: null } as AccountSession;
  return await response.json() as AccountSession;
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

export async function hydrateAccountData() {
  const session = await readAccountSession();
  if (!session.authenticated || !session.user) return session;
  const cloudData = await readCloudAccountData();
  const local = localAccountData();
  const migrated = localStorage.getItem(accountMigrationKey(session.user.id)) === "true";
  const merged: Partial<AccountData> = {
    profile: migrated ? cloudData?.profile ?? local.profile ?? null : local.profile ?? cloudData?.profile ?? null,
    activity: mergeActivity(local.activity ?? null, cloudData?.activity ?? null),
    journeyProgress: migrated ? { ...(local.journeyProgress ?? {}), ...(cloudData?.journeyProgress ?? {}) } : { ...(cloudData?.journeyProgress ?? {}), ...(local.journeyProgress ?? {}) },
  };
  if (merged.profile) localStorage.setItem(studentProfileStorageKey, JSON.stringify(merged.profile));
  if (merged.activity) {
    localStorage.setItem(studentActivityStorageKey, JSON.stringify(merged.activity));
    window.dispatchEvent(new CustomEvent(studentActivityEvent, { detail: merged.activity }));
  }
  localStorage.setItem(journeyProgressStorageKey, JSON.stringify(merged.journeyProgress ?? {}));
  localStorage.setItem(accountMigrationKey(session.user.id), "true");
  const saved = await pushAccountData(merged);
  const syncedSession = { ...session, data: saved ?? { profile: merged.profile ?? null, activity: merged.activity ?? null, journeyProgress: merged.journeyProgress ?? {}, updatedAt: new Date().toISOString() } } satisfies AccountSession;
  window.dispatchEvent(new CustomEvent(accountSessionEvent, { detail: syncedSession }));
  return syncedSession;
}
