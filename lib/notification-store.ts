import "server-only";

import crypto from "node:crypto";
import { withSecurityLock } from "./auth-store";
import { requiredAuthSecret } from "./security";
import type { NotificationRecord, NotificationSchedule } from "./notification-types";

type MemorySortedMember = { member: string; score: number };
type MemoryValue = string | Set<string> | MemorySortedMember[];
const memory = new Map<string, MemoryValue>();
const memoryExpiry = new Map<string, number>();
const kvUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const dueKey = "unlocked:notifications:due:v1";
const maxHistory = 200;

function requireStore() {
  if ((!kvUrl || !kvToken) && process.env.NODE_ENV === "production") {
    throw new Error("Production notification storage requires KV/Upstash.");
  }
}

function keyed(scope: string, value: string) {
  const digest = crypto.createHmac("sha256", requiredAuthSecret()).update(`${scope}:${value}`).digest("hex").slice(0, 32);
  return `unlocked:notifications:${scope}:${digest}`;
}

function pruneExpiry(key: string) {
  const expiresAt = memoryExpiry.get(key);
  if (expiresAt && expiresAt <= Date.now()) {
    memory.delete(key);
    memoryExpiry.delete(key);
  }
}

async function command<T>(args: string[]): Promise<T | null> {
  requireStore();
  if (!kvUrl || !kvToken) {
    const [operation, key, ...rest] = args;
    pruneExpiry(key);
    if (operation === "GET") return (memory.get(key) as T) ?? null;
    if (operation === "SET") {
      if (rest.includes("NX") && memory.has(key)) return null;
      memory.set(key, rest[0]);
      const ex = rest.indexOf("EX");
      if (ex >= 0) memoryExpiry.set(key, Date.now() + Number(rest[ex + 1]) * 1_000);
      return "OK" as T;
    }
    if (operation === "DEL") {
      const existed = memory.delete(key);
      memoryExpiry.delete(key);
      return Number(existed) as T;
    }
    if (operation === "SADD") {
      const values = memory.get(key) instanceof Set ? memory.get(key) as Set<string> : new Set<string>();
      const before = values.size;
      for (const value of rest) values.add(value);
      memory.set(key, values);
      return (values.size - before) as T;
    }
    if (operation === "SMEMBERS") return [...(memory.get(key) as Set<string> ?? new Set<string>())] as T;
    if (operation === "ZADD") {
      const score = Number(rest[0]);
      const member = rest[1];
      const values = Array.isArray(memory.get(key)) ? memory.get(key) as MemorySortedMember[] : [];
      const next = values.filter((item) => item.member !== member);
      next.push({ member, score });
      next.sort((left, right) => left.score - right.score || left.member.localeCompare(right.member));
      memory.set(key, next);
      return 1 as T;
    }
    if (operation === "ZRANGEBYSCORE") {
      const minimum = rest[0] === "-inf" ? Number.NEGATIVE_INFINITY : Number(rest[0]);
      const maximum = rest[1] === "+inf" ? Number.POSITIVE_INFINITY : Number(rest[1]);
      const limitIndex = rest.indexOf("LIMIT");
      const offset = limitIndex >= 0 ? Number(rest[limitIndex + 1]) : 0;
      const count = limitIndex >= 0 ? Number(rest[limitIndex + 2]) : Number.POSITIVE_INFINITY;
      const values = (memory.get(key) as MemorySortedMember[] ?? []).filter((item) => item.score >= minimum && item.score <= maximum);
      return values.slice(offset, offset + count).map((item) => item.member) as T;
    }
    if (operation === "ZREM") {
      const values = memory.get(key) as MemorySortedMember[] ?? [];
      const members = new Set(rest);
      const next = values.filter((item) => !members.has(item.member));
      memory.set(key, next);
      return (values.length - next.length) as T;
    }
    throw new Error(`Unsupported notification store command: ${operation}`);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_200);
  try {
    const response = await fetch(kvUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${kvToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Notification store failed: ${response.status}`);
    return ((await response.json()) as { result: T | null }).result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Notification store timed out.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parse<T>(value: T | string | null, fallback: T): T {
  if (typeof value !== "string") return value ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const userHistoryKey = (userId: string) => keyed("user", userId);
const scheduleKey = (scheduleId: string) => keyed("schedule", scheduleId);
const trackedKey = (opportunityId: string) => keyed("tracked", opportunityId);
const emailRecordKey = (providerId: string) => keyed("email", providerId);
const emailSuppressionKey = (userId: string) => keyed("email-suppressed", userId);
const userScheduleIndexKey = (userId: string) => keyed("user-schedules", userId);
const webhookKey = (eventId: string) => keyed("webhook", eventId);

async function readAll(userId: string) {
  return parse<NotificationRecord[]>(await command<string>(["GET", userHistoryKey(userId)]), []);
}

async function writeAll(userId: string, records: NotificationRecord[]) {
  await command(["SET", userHistoryKey(userId), JSON.stringify(records.slice(0, maxHistory))]);
}

export async function storeNotification(userId: string, record: NotificationRecord) {
  return await withSecurityLock("notifications", userId, async () => {
    const records = await readAll(userId);
    const duplicate = records.find((item) => item.idempotencyKey === record.idempotencyKey);
    if (duplicate) return { duplicate: true, record: duplicate };
    await writeAll(userId, [record, ...records]);
    return { duplicate: false, record };
  });
}

function visible(record: NotificationRecord, now: number) {
  return record.channels.inApp.state === "delivered"
    && !record.dismissedAt
    && Date.parse(record.expiresAt) > now
    && !["canceled", "expired", "suppressed"].includes(record.state);
}

export async function readNotifications(userId: string, offset = 0, limit = 30) {
  const now = Date.now();
  const visibleRecords = (await readAll(userId)).filter((item) => visible(item, now));
  return {
    notifications: visibleRecords.slice(offset, offset + limit),
    unreadCount: Math.min(visibleRecords.filter((item) => !item.readAt).length, 99),
    nextCursor: offset + limit < visibleRecords.length ? offset + limit : null,
  };
}

export async function unreadNotificationCount(userId: string) {
  const now = Date.now();
  return Math.min((await readAll(userId)).filter((item) => visible(item, now) && !item.readAt).length, 99);
}

export async function readNotificationById(userId: string, notificationId: string) {
  return (await readAll(userId)).find((item) => item.id === notificationId) ?? null;
}

export async function updateNotificationState(userId: string, notificationId: string, action: "read" | "dismiss" | "acted", now = new Date()) {
  return await withSecurityLock("notifications", userId, async () => {
    const records = await readAll(userId);
    const index = records.findIndex((item) => item.id === notificationId);
    if (index < 0) return null;
    const current = records[index];
    const updated: NotificationRecord = action === "dismiss"
      ? { ...current, state: "dismissed", dismissedAt: now.toISOString() }
      : action === "acted"
        ? { ...current, state: "acted_on", readAt: current.readAt ?? now.toISOString(), actedAt: now.toISOString() }
        : { ...current, state: current.state === "delivered" ? "read" : current.state, readAt: current.readAt ?? now.toISOString() };
    records[index] = updated;
    await writeAll(userId, records);
    return updated;
  });
}

export async function markAllNotificationsRead(userId: string, now = new Date()) {
  return await withSecurityLock("notifications", userId, async () => {
    const records = await readAll(userId);
    let changed = 0;
    const next = records.map((item) => {
      if (item.readAt || item.channels.inApp.state !== "delivered") return item;
      changed += 1;
      return { ...item, state: item.state === "delivered" ? "read" as const : item.state, readAt: now.toISOString() };
    });
    if (changed) await writeAll(userId, next);
    return changed;
  });
}

export async function deleteUserNotificationData(userId: string) {
  const scheduleIds = parse<string[]>(await command<string>(["GET", userScheduleIndexKey(userId)]), []);
  await Promise.all(scheduleIds.map(async (scheduleId) => {
    await command(["ZREM", dueKey, scheduleId]);
    await command(["DEL", scheduleKey(scheduleId)]);
  }));
  await Promise.all([
    command(["DEL", userHistoryKey(userId)]),
    command(["DEL", emailSuppressionKey(userId)]),
    command(["DEL", userScheduleIndexKey(userId)]),
  ]);
}

export async function scheduleNotification(schedule: NotificationSchedule) {
  const existing = await command<string>(["GET", scheduleKey(schedule.id)]);
  if (existing) return false;
  await command(["SET", scheduleKey(schedule.id), JSON.stringify(schedule), "EX", String(60 * 60 * 24 * 400)]);
  await command(["ZADD", dueKey, String(Date.parse(schedule.scheduledFor)), schedule.id]);
  const userSchedules = parse<string[]>(await command<string>(["GET", userScheduleIndexKey(schedule.userId)]), []);
  await command(["SET", userScheduleIndexKey(schedule.userId), JSON.stringify([...new Set([...userSchedules, schedule.id])].slice(-500)), "EX", String(60 * 60 * 24 * 400)]);
  return true;
}

export async function cancelNotificationSchedule(scheduleId: string) {
  const schedule = parse<NotificationSchedule | null>(await command<string>(["GET", scheduleKey(scheduleId)]), null);
  await command(["ZREM", dueKey, scheduleId]);
  await command(["DEL", scheduleKey(scheduleId)]);
  if (schedule?.userId) {
    const userSchedules = parse<string[]>(await command<string>(["GET", userScheduleIndexKey(schedule.userId)]), []);
    await command(["SET", userScheduleIndexKey(schedule.userId), JSON.stringify(userSchedules.filter((id) => id !== scheduleId)), "EX", String(60 * 60 * 24 * 400)]);
  }
}

export async function readDueNotificationSchedules(now: Date, limit = 100) {
  const ids = await command<string[]>(["ZRANGEBYSCORE", dueKey, "-inf", String(now.getTime()), "LIMIT", "0", String(limit)]) ?? [];
  const schedules = await Promise.all(ids.map(async (id) => parse<NotificationSchedule | null>(await command<string>(["GET", scheduleKey(id)]), null)));
  return schedules.filter((item): item is NotificationSchedule => Boolean(item));
}

export async function claimNotificationSchedule(scheduleId: string) {
  return await command<string>(["SET", keyed("claim", scheduleId), "1", "NX", "EX", "300"]) === "OK";
}

export async function completeNotificationSchedule(scheduleId: string) {
  await cancelNotificationSchedule(scheduleId);
}

export async function releaseNotificationSchedule(scheduleId: string) {
  await command(["DEL", keyed("claim", scheduleId)]);
}

export async function registerTrackedRecipient(userId: string, opportunityId: string) {
  await command(["SADD", trackedKey(opportunityId), userId]);
}

export async function trackedRecipients(opportunityId: string, limit = 500) {
  return (await command<string[]>(["SMEMBERS", trackedKey(opportunityId)]) ?? []).slice(0, limit);
}

export async function claimEmailFrequency(userId: string, bucket: string, expiresInSeconds: number) {
  return await command<string>(["SET", keyed("email-frequency", `${userId}:${bucket}`), "1", "NX", "EX", String(expiresInSeconds)]) === "OK";
}

export async function registerProviderEmail(providerId: string, userId: string, notificationId: string) {
  await command(["SET", emailRecordKey(providerId), JSON.stringify({ userId, notificationId }), "EX", String(60 * 60 * 24 * 180)]);
}

export async function providerEmailOwner(providerId: string) {
  return parse<{ userId: string; notificationId: string } | null>(await command<string>(["GET", emailRecordKey(providerId)]), null);
}

export async function updateNotificationEmailDelivery(userId: string, notificationId: string, delivery: NotificationRecord["channels"]["email"]) {
  return await withSecurityLock("notifications", userId, async () => {
    const records = await readAll(userId);
    const index = records.findIndex((item) => item.id === notificationId);
    if (index < 0) return null;
    records[index] = {
      ...records[index],
      channels: { ...records[index].channels, email: delivery },
      state: delivery.state === "failed" && records[index].channels.inApp.state !== "delivered" ? "failed" : records[index].state,
    };
    await writeAll(userId, records);
    return records[index];
  });
}

export async function suppressEmailForUser(userId: string, reason: string) {
  await command(["SET", emailSuppressionKey(userId), reason.slice(0, 40)]);
}

export async function emailSuppressionReason(userId: string) {
  return await command<string>(["GET", emailSuppressionKey(userId)]);
}

export async function claimProviderWebhook(eventId: string) {
  return await command<string>(["SET", webhookKey(eventId), "1", "NX", "EX", String(60 * 60 * 24 * 30)]) === "OK";
}

export async function notificationDiagnostics(userId: string) {
  const records = await readAll(userId);
  return {
    total: records.length,
    unread: records.filter((item) => !item.readAt && item.channels.inApp.state === "delivered").length,
    byState: Object.fromEntries([...new Set(records.map((item) => item.state))].map((state) => [state, records.filter((item) => item.state === state).length])),
    byType: Object.fromEntries([...new Set(records.map((item) => item.type))].map((type) => [type, records.filter((item) => item.type === type).length])),
  };
}
