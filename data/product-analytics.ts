"use client";

import {
  analyticsSchemaVersion,
  productIntelligenceEvents,
  sanitizeAnalyticsProperties,
  type AnalyticsEnvelope,
  type AnalyticsEventName,
  type AnalyticsEventProperties,
} from "@/lib/analytics-types";

export const analyticsVisitorKey = "unlocked-anonymous-analytics-id-v1";
export const analyticsQueueKey = "unlocked-analytics-queue-v1";
export const analyticsEnabledKey = "unlocked-analytics-enabled";
const analyticsJourneyDayKey = "unlocked-analytics-journey-day-v1";
const recommendationAttributionKey = "unlocked-recommendation-attribution-v1";
const queueLimit = 50;
const batchLimit = 20;
const maxAgeMs = 24 * 60 * 60 * 1_000;

type QueuedEnvelope = AnalyticsEnvelope & { attempts: number; queuedAt: number };
type TrackingOptions = { dedupeKey?: string; dedupeWindowMs?: number };
type AnalyticsTestHook = {
  track: typeof trackProductEvent;
  flush: typeof flushProductAnalytics;
  clear: typeof clearProductAnalyticsSession;
  bindAccount: typeof bindProductAnalyticsAccount;
  setEnabled: typeof setProductAnalyticsEnabled;
};

declare global {
  interface Window { __unlockedAnalyticsTest?: AnalyticsTestHook }
}

let flushPromise: Promise<void> | null = null;
let retryTimer: number | null = null;
let initialized = false;
let boundAccountId: string | null | undefined;
let queueGeneration = 0;
const recentEvents = new Map<string, number>();

function storage() {
  try { return window.localStorage; } catch { return null; }
}

function sessionStorageSafe() {
  try { return window.sessionStorage; } catch { return null; }
}

function analyticsDisabledByBrowser() {
  const navigatorWithPrivacy = navigator as Navigator & { globalPrivacyControl?: boolean };
  return navigatorWithPrivacy.globalPrivacyControl === true || navigator.doNotTrack === "1";
}

export function productAnalyticsEnabled() {
  if (typeof window === "undefined") return false;
  return storage()?.getItem(analyticsEnabledKey) !== "false" && !analyticsDisabledByBrowser();
}

export function setProductAnalyticsEnabled(enabled: boolean) {
  const local = storage();
  local?.setItem(analyticsEnabledKey, enabled ? "true" : "false");
  if (!enabled) clearProductAnalyticsSession();
  else void flushProductAnalytics();
}

function randomId() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function visitorId() {
  const local = storage();
  let value = local?.getItem(analyticsVisitorKey) ?? "";
  if (!/^[A-Za-z0-9._:-]{8,80}$/.test(value)) {
    value = randomId();
    local?.setItem(analyticsVisitorKey, value);
  }
  return value;
}

function readQueue(): QueuedEnvelope[] {
  const local = storage();
  if (!local) return [];
  try {
    const value = JSON.parse(local.getItem(analyticsQueueKey) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    const oldest = Date.now() - maxAgeMs;
    return value.filter((item): item is QueuedEnvelope => Boolean(item && typeof item === "object" && !Array.isArray(item)
      && typeof (item as QueuedEnvelope).id === "string"
      && typeof (item as QueuedEnvelope).queuedAt === "number"
      && (item as QueuedEnvelope).queuedAt >= oldest)).slice(-queueLimit);
  } catch { return []; }
}

function writeQueue(queue: readonly QueuedEnvelope[]) {
  storage()?.setItem(analyticsQueueKey, JSON.stringify(queue.slice(-queueLimit)));
}

function stableProperties(properties: AnalyticsEventProperties) {
  return Object.entries(properties).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}:${String(value)}`).join("|");
}

function deviceClass() {
  if (innerWidth <= 480) return "mobile";
  if (innerWidth <= 1024) return "tablet";
  return "desktop";
}

function browserFamily() {
  const agent = navigator.userAgent.toLowerCase();
  if (agent.includes("firefox")) return "firefox";
  if (agent.includes("applewebkit") && !agent.includes("chrome") && !agent.includes("chromium")) return "webkit";
  if (agent.includes("chrome") || agent.includes("chromium")) return "chromium";
  return "other";
}

function currentTheme() {
  const value = document.documentElement.dataset.theme;
  return value === "midnight" || value === "dark" ? "dark" : "light";
}

function scheduleRetry(attempts: number) {
  if (retryTimer !== null || typeof window === "undefined") return;
  const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempts, 5));
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    void flushProductAnalytics();
  }, delay);
}

function removeDelivered(ids: ReadonlySet<string>) {
  writeQueue(readQueue().filter((event) => !ids.has(event.id)));
}

export async function flushProductAnalytics(options: { beacon?: boolean } = {}) {
  if (!productAnalyticsEnabled() || navigator.onLine === false) return;
  if (flushPromise) return flushPromise;
  const batch = readQueue().slice(0, batchLimit);
  if (!batch.length) return;
  const generation = queueGeneration;
  let delivered = false;
  const task = (async () => {
    const payload = JSON.stringify({ events: batch.map(({ attempts: _attempts, queuedAt: _queuedAt, ...event }) => event) });
    try {
      if (options.beacon && typeof navigator.sendBeacon === "function") {
        const accepted = navigator.sendBeacon("/api/analytics/event", new Blob([payload], { type: "application/json" }));
        if (accepted && generation === queueGeneration) {
          removeDelivered(new Set(batch.map((event) => event.id)));
          delivered = true;
        }
        else scheduleRetry(Math.max(...batch.map((event) => event.attempts), 0) + 1);
        return;
      }
      const response = await fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        credentials: "same-origin",
        keepalive: true,
      });
      if (!response.ok) throw new Error(`analytics_http_${response.status}`);
      const body = await response.json().catch(() => null) as { acceptedIds?: string[] } | null;
      const acceptedIds = new Set(body?.acceptedIds?.length ? body.acceptedIds : batch.map((event) => event.id));
      if (generation === queueGeneration) {
        removeDelivered(acceptedIds);
        delivered = true;
      }
    } catch {
      if (generation !== queueGeneration) return;
      const queued = readQueue();
      const ids = new Set(batch.map((event) => event.id));
      writeQueue(queued.map((event) => ids.has(event.id) ? { ...event, attempts: event.attempts + 1 } : event));
      scheduleRetry(Math.max(...batch.map((event) => event.attempts), 0) + 1);
    }
  })().finally(() => {
    if (flushPromise === task) flushPromise = null;
    if (delivered && generation === queueGeneration && readQueue().length && productAnalyticsEnabled() && navigator.onLine !== false) window.setTimeout(() => void flushProductAnalytics(), 0);
  });
  flushPromise = task;
  return flushPromise;
}

export function trackProductEvent(name: AnalyticsEventName, properties: AnalyticsEventProperties = {}, options: TrackingOptions = {}) {
  if (!productAnalyticsEnabled()) return null;
  const sanitized = sanitizeAnalyticsProperties(name, properties);
  const fingerprint = options.dedupeKey ?? `${name}|${stableProperties(sanitized)}`;
  const now = Date.now();
  const last = recentEvents.get(fingerprint) ?? 0;
  if (now - last < (options.dedupeWindowMs ?? 1_000)) return null;
  recentEvents.set(fingerprint, now);
  for (const [key, timestamp] of recentEvents) if (now - timestamp > 60_000) recentEvents.delete(key);
  const envelope: QueuedEnvelope = {
    id: randomId(),
    version: analyticsSchemaVersion,
    name,
    visitorId: visitorId(),
    occurredAt: new Date(now).toISOString(),
    properties: sanitized,
    attempts: 0,
    queuedAt: now,
  };
  const queue = readQueue();
  if (!queue.some((item) => item.id === envelope.id)) writeQueue([...queue, envelope]);
  queueMicrotask(() => void flushProductAnalytics());
  return envelope.id;
}

export function trackProductTiming(component: string, metric: string, durationMs: number) {
  return trackProductEvent(productIntelligenceEvents.productHealthTiming, {
    component,
    metric,
    durationMs,
    browser: browserFamily(),
    theme: currentTheme(),
    deviceClass: deviceClass(),
  });
}

export function trackProductError(component: string, errorType: AnalyticsEventProperties["errorType"], action?: string) {
  return trackProductEvent(productIntelligenceEvents.operationalError, {
    component,
    errorType,
    action,
    browser: browserFamily(),
    theme: currentTheme(),
    deviceClass: deviceClass(),
  });
}

export function trackJourneyView(status: string) {
  trackProductEvent(productIntelligenceEvents.journeyViewed, { status }, { dedupeKey: "journey-view", dedupeWindowMs: 30_000 });
  const local = storage();
  const today = new Date().toISOString().slice(0, 10);
  const previous = local?.getItem(analyticsJourneyDayKey);
  if (previous && previous !== today) trackProductEvent(productIntelligenceEvents.journeyReturned, {}, { dedupeKey: `journey-return:${today}`, dedupeWindowMs: 86_400_000 });
  local?.setItem(analyticsJourneyDayKey, today);
}

export function rememberRecommendationAttribution(opportunityId: string, recommendationId: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(opportunityId) || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(recommendationId)) return;
  const session = sessionStorageSafe();
  if (!session) return;
  try {
    const current = JSON.parse(session.getItem(recommendationAttributionKey) ?? "{}") as Record<string, string>;
    session.setItem(recommendationAttributionKey, JSON.stringify({ ...current, [opportunityId]: recommendationId }));
  } catch { session.removeItem(recommendationAttributionKey); }
}

export function recommendationAttributionFor(opportunityId: string) {
  try {
    const value = JSON.parse(sessionStorageSafe()?.getItem(recommendationAttributionKey) ?? "{}") as Record<string, unknown>;
    return typeof value[opportunityId] === "string" ? value[opportunityId] as string : undefined;
  } catch { return undefined; }
}

export function clearProductAnalyticsSession() {
  if (typeof window === "undefined") return;
  queueGeneration += 1;
  if (retryTimer !== null) window.clearTimeout(retryTimer);
  retryTimer = null;
  flushPromise = null;
  recentEvents.clear();
  const local = storage();
  local?.removeItem(analyticsQueueKey);
  local?.removeItem(analyticsVisitorKey);
  local?.removeItem(analyticsJourneyDayKey);
  sessionStorageSafe()?.removeItem(recommendationAttributionKey);
}

export function bindProductAnalyticsAccount(accountId: string | null) {
  if (boundAccountId !== undefined && boundAccountId !== accountId) clearProductAnalyticsSession();
  boundAccountId = accountId;
}

export function initializeProductAnalytics() {
  if (initialized || typeof window === "undefined") return () => undefined;
  initialized = true;
  const online = () => void flushProductAnalytics();
  const pagehide = () => void flushProductAnalytics({ beacon: true });
  const unexpectedError = () => trackProductError("window", "unknown", "exception");
  const unhandledRejection = () => trackProductError("window", "unknown", "promise");
  window.addEventListener("online", online);
  window.addEventListener("pagehide", pagehide);
  window.addEventListener("error", unexpectedError);
  window.addEventListener("unhandledrejection", unhandledRejection);
  if (process.env.NODE_ENV !== "production") window.__unlockedAnalyticsTest = {
    track: trackProductEvent,
    flush: flushProductAnalytics,
    clear: clearProductAnalyticsSession,
    bindAccount: bindProductAnalyticsAccount,
    setEnabled: setProductAnalyticsEnabled,
  };
  void flushProductAnalytics();
  return () => {
    initialized = false;
    window.removeEventListener("online", online);
    window.removeEventListener("pagehide", pagehide);
    window.removeEventListener("error", unexpectedError);
    window.removeEventListener("unhandledrejection", unhandledRejection);
    delete window.__unlockedAnalyticsTest;
    if (retryTimer !== null) window.clearTimeout(retryTimer);
    retryTimer = null;
  };
}
