"use client";

import { track } from "@vercel/analytics";
import type { AnalyticsEventName, AnalyticsEventProperties } from "@/lib/analytics-types";

const visitorKey = "unlocked-anonymous-analytics-id";
export function trackProductEvent(name: AnalyticsEventName, properties: AnalyticsEventProperties = {}) {
  track(name, properties as Record<string, string>);
  let visitorId = localStorage.getItem(visitorKey);
  if (!visitorId) { visitorId = crypto.randomUUID(); localStorage.setItem(visitorKey, visitorId); }
  void fetch("/api/analytics/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, visitorId, properties }), keepalive: true }).catch(() => undefined);
}
