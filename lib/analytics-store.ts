import crypto from "node:crypto";
import type { AnalyticsEventName, AnalyticsEventProperties, AnalyticsSummary } from "./analytics-types";

type MemoryValue = Set<string> | Map<string, number>;
const memory = new Map<string, MemoryValue>();
const kvUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const today = () => new Date().toISOString().slice(0, 10);

async function command<T>(args: (string | number)[]): Promise<T> {
  if (!kvUrl || !kvToken) {
    const [op, key, ...rest] = args;
    if (op === "PFADD") { const set = memory.get(String(key)) as Set<string> ?? new Set<string>(); set.add(String(rest[0])); memory.set(String(key), set); return 1 as T; }
    if (op === "PFCOUNT") { const combined = new Set<string>(); for (const name of [key, ...rest]) for (const value of (memory.get(String(name)) as Set<string> ?? [])) combined.add(value); return combined.size as T; }
    if (op === "HINCRBY" || op === "ZINCRBY") { const map = memory.get(String(key)) as Map<string, number> ?? new Map<string, number>(); const field = String(op === "HINCRBY" ? rest[0] : rest[1]); const amount = Number(op === "HINCRBY" ? rest[1] : rest[0]); map.set(field, (map.get(field) ?? 0) + amount); memory.set(String(key), map); return map.get(field) as T; }
    if (op === "HMGET") { const map = memory.get(String(key)) as Map<string, number> ?? new Map<string, number>(); return rest.map((field) => map.get(String(field)) ?? 0) as T; }
    if (op === "ZREVRANGE") { const map = memory.get(String(key)) as Map<string, number> ?? new Map<string, number>(); return [...map.entries()].sort((a,b) => b[1]-a[1]).slice(Number(rest[0]), Number(rest[1])+1).flatMap(([field,score]) => [field,String(score)]) as T; }
    throw new Error(`Unsupported analytics operation: ${op}`);
  }
  const response = await fetch(kvUrl, { method: "POST", headers: { Authorization: `Bearer ${kvToken}`, "Content-Type": "application/json" }, body: JSON.stringify(args), cache: "no-store" });
  if (!response.ok) throw new Error(`Analytics store failed: ${response.status}`);
  return ((await response.json()) as { result: T }).result;
}

const anonymousHash = (id: string) => crypto.createHash("sha256").update(id).digest("hex").slice(0, 24);
const safe = (value: string | undefined) => value?.trim().slice(0, 120);
export async function recordAnalyticsEvent(name: AnalyticsEventName, visitorId: string, properties: AnalyticsEventProperties = {}) {
  const date = today();
  await command(["PFADD", `analytics:users:${date}`, anonymousHash(visitorId)]);
  if (["homepage_visit","onboarding_completed","dashboard_visit","journey_opened"].includes(name)) await command(["HINCRBY", `analytics:funnel:${date}`, name === "journey_opened" ? "dashboard_visit" : name, 1]);
  if (name === "opportunity_view" && safe(properties.opportunityId)) await command(["ZINCRBY", "analytics:opportunity-views", 1, safe(properties.opportunityId)!]);
  if (name === "opportunity_saved" && safe(properties.opportunityId)) await command(["ZINCRBY", "analytics:opportunity-saves", 1, safe(properties.opportunityId)!]);
  if (name === "search" && safe(properties.searchValue) && properties.searchType) await command(["ZINCRBY", `analytics:searches:${properties.searchType}`, 1, safe(properties.searchValue)!]);
  await command(["HINCRBY", `analytics:events:${date}`, name, 1]);
}

const pairs = (values: string[]) => { const result: [string,number][]=[]; for(let i=0;i<values.length;i+=2) result.push([values[i],Number(values[i+1])]); return result; };
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const days = Array.from({length:7},(_,index)=>new Date(Date.now()-index*86_400_000).toISOString().slice(0,10));
  const [dailyUsers,weeklyUsers,viewed,schools,majors,saved,...funnelDays] = await Promise.all([
    command<number>(["PFCOUNT",`analytics:users:${days[0]}`]), command<number>(["PFCOUNT",...days.map((date)=>`analytics:users:${date}`)]),
    command<string[]>(["ZREVRANGE","analytics:opportunity-views",0,9,"WITHSCORES"]), command<string[]>(["ZREVRANGE","analytics:searches:school",0,9,"WITHSCORES"]), command<string[]>(["ZREVRANGE","analytics:searches:major",0,9,"WITHSCORES"]), command<string[]>(["ZREVRANGE","analytics:opportunity-saves",0,9,"WITHSCORES"]),
    ...days.map((date)=>command<(number|string|null)[]>(["HMGET",`analytics:funnel:${date}`,"homepage_visit","onboarding_completed","dashboard_visit"]))
  ]);
  const funnel=funnelDays.reduce((total,row)=>({homepage:total.homepage+Number(row[0]??0),onboarding:total.onboarding+Number(row[1]??0),dashboard:total.dashboard+Number(row[2]??0)}),{homepage:0,onboarding:0,dashboard:0});
  return {dailyUsers,weeklyUsers,mostViewed:pairs(viewed),searchedSchools:pairs(schools),searchedMajors:pairs(majors),mostSaved:pairs(saved),funnel};
}
