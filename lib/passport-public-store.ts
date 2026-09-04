import "server-only";

import type { PassportCollectionView, PassportView } from "./passport";

type PublicPassportRecord = { passport: PassportView; publishedAt: string; views: number; opportunityClicks: number };
type PublicCollectionRecord = { collection: PassportCollectionView; curator: string; publishedAt: string; views: number; opportunityClicks: number };
type Value = string | number;
const memory = new Map<string, Value>();
const kvUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const passportKey = (token: string) => `unlocked:public-passport:${token}`;
const collectionKey = (token: string) => `unlocked:public-collection:${token}`;

async function command<T>(args: string[]): Promise<T | null> {
  if (!kvUrl || !kvToken) {
    const [op, key, value] = args;
    if (op === "GET") return (memory.get(key) ?? null) as T | null;
    if (op === "SET") { memory.set(key, value); return "OK" as T; }
    if (op === "DEL") { memory.delete(key); return 1 as T; }
    return null;
  }
  const response = await fetch(kvUrl, { method: "POST", headers: { Authorization: `Bearer ${kvToken}`, "Content-Type": "application/json" }, body: JSON.stringify(args), cache: "no-store" });
  if (!response.ok) throw new Error(`Passport store failed: ${response.status}`);
  return ((await response.json()) as { result: T | null }).result;
}
const parse = <T,>(value: string | null) => { if (!value) return null; try { return JSON.parse(value) as T; } catch { return null; } };

export async function publishPassport(token: string, passport: PassportView) { const current = await readPublicPassport(token, false); await command(["SET", passportKey(token), JSON.stringify({ passport, publishedAt: new Date().toISOString(), views: current?.views ?? 0, opportunityClicks: current?.opportunityClicks ?? 0 })]); }
export async function revokePassport(token?: string) { if (token) await command(["DEL", passportKey(token)]); }
export async function readPublicPassport(token: string, count = true) { const record = parse<PublicPassportRecord>(await command<string>(["GET", passportKey(token)])); if (!record) return null; record.opportunityClicks ??= 0; if (count) { record.views += 1; await command(["SET", passportKey(token), JSON.stringify(record)]); } return record; }
export async function publishCollection(token: string, collection: PassportCollectionView, curator: string) { const current = await readPublicCollection(token, false); await command(["SET", collectionKey(token), JSON.stringify({ collection, curator, publishedAt: new Date().toISOString(), views: current?.views ?? 0, opportunityClicks: current?.opportunityClicks ?? 0 })]); }
export async function revokeCollection(token?: string) { if (token) await command(["DEL", collectionKey(token)]); }
export async function readPublicCollection(token: string, count = true) { const record = parse<PublicCollectionRecord>(await command<string>(["GET", collectionKey(token)])); if (!record) return null; record.opportunityClicks ??= 0; if (count) { record.views += 1; await command(["SET", collectionKey(token), JSON.stringify(record)]); } return record; }
export async function recordPublicOpportunityClick(token: string, source: "passport" | "collection") { const key = source === "passport" ? passportKey(token) : collectionKey(token); const record = parse<PublicPassportRecord | PublicCollectionRecord>(await command<string>(["GET", key])); if (!record) return; record.opportunityClicks = (record.opportunityClicks ?? 0) + 1; await command(["SET", key, JSON.stringify(record)]); }
