import crypto from "node:crypto";
import {
  productIntelligenceEvents,
  sanitizeAnalyticsProperties,
  type AnalyticsEnvelope,
  type AnalyticsEventName,
  type AnalyticsEventProperties,
  type AnalyticsSummary,
  type ProductIntelligenceEventName,
  type ProductIntelligenceSummary,
} from "./analytics-types";
import { requiredAuthSecret } from "./security";

type MemoryValue = Set<string> | Map<string, number> | string;
const memory = new Map<string, MemoryValue>();
const memoryExpiry = new Map<string, number>();
const kvUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const today = () => new Date().toISOString().slice(0, 10);
const aggregateRetentionSeconds = 90 * 24 * 60 * 60;
const dedupeRetentionSeconds = 2 * 24 * 60 * 60;

function liveMemory(key: string) {
  const expiry = memoryExpiry.get(key);
  if (expiry && expiry <= Date.now()) {
    memory.delete(key);
    memoryExpiry.delete(key);
  }
  return memory.get(key);
}

async function command<T>(args: (string | number)[]): Promise<T> {
  if (!kvUrl || !kvToken) {
    const [op, key, ...rest] = args;
    const name = String(key);
    if (op === "SET") {
      const nx = rest.includes("NX");
      if (nx && liveMemory(name) !== undefined) return null as T;
      memory.set(name, String(rest[0]));
      const exIndex = rest.indexOf("EX");
      if (exIndex >= 0) memoryExpiry.set(name, Date.now() + Number(rest[exIndex + 1]) * 1_000);
      return "OK" as T;
    }
    if (op === "EXPIRE") { if (liveMemory(name) !== undefined) memoryExpiry.set(name, Date.now() + Number(rest[0]) * 1_000); return 1 as T; }
    if (op === "PFADD") { const set = liveMemory(name) as Set<string> ?? new Set<string>(); set.add(String(rest[0])); memory.set(name, set); return 1 as T; }
    if (op === "PFCOUNT") { const combined = new Set<string>(); for (const candidate of [key, ...rest]) for (const value of (liveMemory(String(candidate)) as Set<string> ?? [])) combined.add(value); return combined.size as T; }
    if (op === "HINCRBY" || op === "ZINCRBY") { const map = liveMemory(name) as Map<string, number> ?? new Map<string, number>(); const field = String(op === "HINCRBY" ? rest[0] : rest[1]); const amount = Number(op === "HINCRBY" ? rest[1] : rest[0]); map.set(field, (map.get(field) ?? 0) + amount); memory.set(name, map); return map.get(field) as T; }
    if (op === "HMGET") { const map = liveMemory(name) as Map<string, number> ?? new Map<string, number>(); return rest.map((field) => map.get(String(field)) ?? 0) as T; }
    if (op === "ZREVRANGE") { const map = liveMemory(name) as Map<string, number> ?? new Map<string, number>(); return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(Number(rest[0]), Number(rest[1]) + 1).flatMap(([field, score]) => [field, String(score)]) as T; }
    throw new Error(`Unsupported analytics operation: ${op}`);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_200);
  try {
    const response = await fetch(kvUrl, { method: "POST", headers: { Authorization: `Bearer ${kvToken}`, "Content-Type": "application/json" }, body: JSON.stringify(args), cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`Analytics store failed: ${response.status}`);
    return ((await response.json()) as { result: T }).result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Analytics store timed out.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const anonymousHash = (id: string) => crypto.createHmac("sha256", requiredAuthSecret()).update(id).digest("hex").slice(0, 24);
const safe = (value: string | undefined) => value?.trim().slice(0, 120);
const bucketFor = (durationMs: number) => durationMs < 100 ? "under_100" : durationMs < 500 ? "100_499" : durationMs < 1_000 ? "500_999" : durationMs < 2_500 ? "1000_2499" : "2500_plus";

async function acceptOnce(eventId: string) {
  const key = `analytics:dedupe:${anonymousHash(eventId)}`;
  return await command<string | null>(["SET", key, "1", "NX", "EX", dedupeRetentionSeconds]) === "OK";
}

function dailyKeys(date: string) {
  return [`analytics:users:${date}`, `analytics:funnel:${date}`, `analytics:events:${date}`, `analytics:timings:${date}`, `analytics:errors:${date}`];
}

async function retainDailyKeys(date: string) {
  await Promise.all(dailyKeys(date).map((key) => command(["EXPIRE", key, aggregateRetentionSeconds])));
}

export async function recordAnalyticsEnvelope(envelope: AnalyticsEnvelope) {
  if (!await acceptOnce(envelope.id)) return false;
  const date = envelope.occurredAt.slice(0, 10);
  const properties = sanitizeAnalyticsProperties(envelope.name, envelope.properties);
  const operations: Promise<unknown>[] = [
    command(["PFADD", `analytics:users:${date}`, anonymousHash(envelope.visitorId)]),
    command(["HINCRBY", `analytics:events:${date}`, envelope.name, 1]),
  ];
  if (["homepage_visit", "onboarding_completed", "dashboard_visit", "journey_opened", productIntelligenceEvents.journeyViewed].includes(envelope.name)) {
    const field = envelope.name === "journey_opened" || envelope.name === productIntelligenceEvents.journeyViewed ? "dashboard_visit" : envelope.name;
    operations.push(command(["HINCRBY", `analytics:funnel:${date}`, field, 1]));
  }
  if (envelope.name === "opportunity_view" && safe(properties.opportunityId)) operations.push(command(["ZINCRBY", "analytics:opportunity-views", 1, safe(properties.opportunityId)!]));
  if ((envelope.name === "opportunity_saved" || envelope.name === "opportunity_added_to_journey") && safe(properties.opportunityId)) operations.push(command(["ZINCRBY", "analytics:opportunity-saves", 1, safe(properties.opportunityId)!]));
  if (envelope.name === "search" && safe(properties.searchValue) && properties.searchType) operations.push(command(["ZINCRBY", `analytics:searches:${properties.searchType}`, 1, safe(properties.searchValue)!]));
  if (envelope.name === productIntelligenceEvents.productHealthTiming && properties.component && properties.metric && typeof properties.durationMs === "number") {
    const metric = `${properties.component}.${properties.metric}`;
    operations.push(
      command(["ZINCRBY", "analytics:timing-metrics", 1, metric]),
      command(["HINCRBY", `analytics:timings:${date}`, `${metric}:count`, 1]),
      command(["HINCRBY", `analytics:timings:${date}`, `${metric}:total`, properties.durationMs]),
      command(["HINCRBY", `analytics:timings:${date}`, `${metric}:bucket:${bucketFor(properties.durationMs)}`, 1]),
    );
  }
  if ((envelope.name === productIntelligenceEvents.operationalError || envelope.name === productIntelligenceEvents.transitionFailed) && properties.component) {
    operations.push(command(["ZINCRBY", `analytics:errors:${date}`, 1, properties.component]));
  }
  await Promise.all(operations);
  await retainDailyKeys(date);
  return true;
}

export async function recordAnalyticsEvent(name: AnalyticsEventName, visitorId: string, properties: AnalyticsEventProperties = {}) {
  return await recordAnalyticsEnvelope({
    id: crypto.randomUUID(),
    version: 1,
    name,
    visitorId,
    occurredAt: new Date().toISOString(),
    properties: sanitizeAnalyticsProperties(name, properties),
  });
}

const pairs = (values: string[]) => { const result: [string, number][] = []; for (let index = 0; index < values.length; index += 2) result.push([values[index], Number(values[index + 1])]); return result; };
const ratio = (value: number, base: number) => base > 0 ? Number((value / base).toFixed(4)) : 0;
const sumRows = (rows: (number | string | null)[][], fields: readonly string[]) => Object.fromEntries(fields.map((field, index) => [field, rows.reduce((sum, row) => sum + Number(row[index] ?? 0), 0)])) as Record<string, number>;

const intelligenceFields = Object.values(productIntelligenceEvents).filter((name) => name !== productIntelligenceEvents.productHealthTiming) as ProductIntelligenceEventName[];
const timingBuckets = ["under_100", "100_499", "500_999", "1000_2499", "2500_plus"] as const;

async function productIntelligenceSummary(days: readonly string[]): Promise<ProductIntelligenceSummary> {
  const [eventRows, metricNames, ...errorRows] = await Promise.all([
    Promise.all(days.map((date) => command<(number | string | null)[]>(["HMGET", `analytics:events:${date}`, ...intelligenceFields]))),
    command<string[]>(["ZREVRANGE", "analytics:timing-metrics", 0, 19, "WITHSCORES"]),
    ...days.map((date) => command<string[]>(["ZREVRANGE", `analytics:errors:${date}`, 0, 19, "WITHSCORES"])),
  ]);
  const counts = sumRows(eventRows, intelligenceFields);
  const count = (name: ProductIntelligenceEventName) => counts[name] ?? 0;
  const timingNames = pairs(metricNames).map(([name]) => name);
  const performanceEntries = await Promise.all(timingNames.map(async (metric) => {
    const fields = [`${metric}:count`, `${metric}:total`, ...timingBuckets.map((bucket) => `${metric}:bucket:${bucket}`)];
    const rows = await Promise.all(days.map((date) => command<(number | string | null)[]>(["HMGET", `analytics:timings:${date}`, ...fields])));
    const totals = sumRows(rows, fields);
    const samples = totals[fields[0]] ?? 0;
    return [metric, { samples, averageMs: samples ? Number(((totals[fields[1]] ?? 0) / samples).toFixed(1)) : 0, buckets: Object.fromEntries(timingBuckets.map((bucket, index) => [bucket, totals[fields[index + 2]] ?? 0])) }] as const;
  }));
  const errors = new Map<string, number>();
  for (const row of errorRows) for (const [component, total] of pairs(row)) errors.set(component, (errors.get(component) ?? 0) + total);
  const views = count(productIntelligenceEvents.journeyViewed);
  const transitionStarts = count(productIntelligenceEvents.transitionStarted);
  const transitionCompletions = count(productIntelligenceEvents.transitionCompleted);
  const creatorOpens = count(productIntelligenceEvents.pathMomentCreatorOpened) + count(productIntelligenceEvents.semesterStoryCreatorOpened);
  const downloads = count(productIntelligenceEvents.pathMomentDownloaded) + count(productIntelligenceEvents.semesterStoryDownloaded);
  const shares = count(productIntelligenceEvents.pathMomentShared) + count(productIntelligenceEvents.semesterStoryShared);
  const copies = count(productIntelligenceEvents.pathMomentCopied);
  const cancellations = count(productIntelligenceEvents.pathMomentCanceled) + count(productIntelligenceEvents.semesterStoryCanceled);
  const recommendationOpens = count(productIntelligenceEvents.recommendationOpened);
  const recommendationSaves = count(productIntelligenceEvents.recommendationSaved);
  const recommendationCompletions = count(productIntelligenceEvents.recommendationCompleted);
  const totalErrors = [...errors.values()].reduce((sum, value) => sum + value, 0);
  return {
    journey: {
      views,
      returns: count(productIntelligenceEvents.journeyReturned),
      waypointClicks: count(productIntelligenceEvents.waypointClicked),
      waypointCompletions: count(productIntelligenceEvents.waypointCompleted),
      historyExpansions: count(productIntelligenceEvents.historyExpanded),
      historyExplorations: count(productIntelligenceEvents.historyExplored),
      horizonOpens: count(productIntelligenceEvents.horizonOpened),
      transitionStarts,
      transitionCompletions,
      transitionFailures: count(productIntelligenceEvents.transitionFailed),
      applicationManagementOpens: count(productIntelligenceEvents.applicationManagementOpened),
      transitionSuccessRate: ratio(transitionCompletions, transitionStarts),
      waypointCompletionRate: ratio(count(productIntelligenceEvents.waypointCompleted), views),
      historyExpansionRate: ratio(count(productIntelligenceEvents.historyExpanded), views),
      horizonEngagementRate: ratio(count(productIntelligenceEvents.horizonOpened), views),
      returnRate: ratio(count(productIntelligenceEvents.journeyReturned), views),
    },
    exports: { creatorOpens, downloads, shares, copies, cancellations, exportRate: ratio(downloads + shares + copies, creatorOpens) },
    recommendations: {
      opens: recommendationOpens,
      saves: recommendationSaves,
      starts: count(productIntelligenceEvents.recommendationStarted),
      submissions: count(productIntelligenceEvents.recommendationSubmitted),
      completions: recommendationCompletions,
      saveRate: ratio(recommendationSaves, recommendationOpens),
      completionRate: ratio(recommendationCompletions, recommendationSaves),
    },
    errors: { total: totalErrors, errorRate: ratio(totalErrors, Math.max(views, 1)), byComponent: [...errors.entries()].sort((left, right) => right[1] - left[1]).slice(0, 10) },
    performance: Object.fromEntries(performanceEntries),
  };
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const days = Array.from({ length: 7 }, (_, index) => new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10));
  const [dailyUsers, weeklyUsers, viewed, schools, majors, saved, productIntelligence, ...funnelDays] = await Promise.all([
    command<number>(["PFCOUNT", `analytics:users:${days[0]}`]),
    command<number>(["PFCOUNT", ...days.map((date) => `analytics:users:${date}`)]),
    command<string[]>(["ZREVRANGE", "analytics:opportunity-views", 0, 9, "WITHSCORES"]),
    command<string[]>(["ZREVRANGE", "analytics:searches:school", 0, 9, "WITHSCORES"]),
    command<string[]>(["ZREVRANGE", "analytics:searches:major", 0, 9, "WITHSCORES"]),
    command<string[]>(["ZREVRANGE", "analytics:opportunity-saves", 0, 9, "WITHSCORES"]),
    productIntelligenceSummary(days),
    ...days.map((date) => command<(number | string | null)[]>(["HMGET", `analytics:funnel:${date}`, "homepage_visit", "onboarding_completed", "dashboard_visit"])),
  ]);
  const funnel = funnelDays.reduce((total, row) => ({ homepage: total.homepage + Number(row[0] ?? 0), onboarding: total.onboarding + Number(row[1] ?? 0), dashboard: total.dashboard + Number(row[2] ?? 0) }), { homepage: 0, onboarding: 0, dashboard: 0 });
  return { dailyUsers, weeklyUsers, mostViewed: pairs(viewed), searchedSchools: pairs(schools), searchedMajors: pairs(majors), mostSaved: pairs(saved), funnel, productIntelligence };
}
