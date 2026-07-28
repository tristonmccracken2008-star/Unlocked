import "server-only";

import type { Opportunity } from "@/data/opportunities";
import {
  appendOpportunityLifecycleEvents,
  createOpportunityLifecycleEvents,
  resolveOpportunityLifecycle,
  type OpportunityLifecycleEvent,
  type OpportunityLifecycleReason,
  type OpportunityLifecycleState,
} from "@/data/opportunity-lifecycle";

export type OperationalLifecycleRecord = {
  opportunityId: string;
  identityId: string;
  cycleId: string;
  state: OpportunityLifecycleState;
  confidence: ReturnType<typeof resolveOpportunityLifecycle>["confidence"];
  reason: OpportunityLifecycleReason;
  effectiveAt: string;
  deadline?: string;
  sourceUrl: string;
  checkedAt: string;
  events: OpportunityLifecycleEvent[];
};

const kvUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const cursorKey = "unlocked:lifecycle:cursor";
const recordKey = (id: string) => `unlocked:lifecycle:record:${id}`;
const memory = new Map<string, string>();

async function command<T>(args: string[]): Promise<T | null> {
  const [operation, key, value] = args;
  if (!kvUrl || !kvToken) {
    if (operation === "GET") return (memory.get(key) as T) ?? null;
    if (operation === "SET") {
      memory.set(key, value);
      return "OK" as T;
    }
    throw new Error(`Unsupported lifecycle-store operation: ${operation}`);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await fetch(kvUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${kvToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Lifecycle store failed: ${response.status}`);
    return ((await response.json()) as { result: T | null }).result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Lifecycle store timed out.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseRecord(value: string | null) {
  if (!value) return null;
  try {
    const record = JSON.parse(value) as OperationalLifecycleRecord;
    return record?.opportunityId && Array.isArray(record.events) ? record : null;
  } catch {
    return null;
  }
}

export async function readOperationalLifecycleRecord(opportunityId: string) {
  return parseRecord(await command<string>(["GET", recordKey(opportunityId)]));
}

export async function readLifecycleCursor() {
  const value = await command<string>(["GET", cursorKey]);
  const parsed = Number(value ?? "0");
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export async function writeLifecycleCursor(cursor: number) {
  await command(["SET", cursorKey, String(Math.max(0, Math.floor(cursor)))]);
}

function historicalOpportunity(item: Opportunity, previous: OperationalLifecycleRecord): Opportunity {
  const base = item.metadata.lifecycle ?? {
    schemaVersion: 1 as const,
    identity: { identityId: previous.identityId },
    cycle: { cycleId: previous.cycleId },
  };
  return {
    ...item,
    metadata: {
      ...item.metadata,
      lifecycle: {
        ...base,
        state: previous.state,
        confidence: previous.confidence,
        reason: previous.reason,
        effectiveAt: previous.effectiveAt,
        finalDeadline: previous.deadline ? {
          kind: "final_deadline",
          sourceValue: previous.deadline,
          normalizedValue: previous.deadline,
          precision: "date",
          estimated: false,
        } : undefined,
        events: previous.events,
      },
    },
  };
}

export async function persistOperationalLifecycle(item: Opportunity, now = new Date()) {
  const snapshot = resolveOpportunityLifecycle(item, now);
  const previous = await readOperationalLifecycleRecord(item.id);
  const events = previous
    ? createOpportunityLifecycleEvents(historicalOpportunity(item, previous), item, now)
    : [];
  const record: OperationalLifecycleRecord = {
    opportunityId: item.id,
    identityId: snapshot.identityId,
    cycleId: snapshot.cycleId,
    state: snapshot.state,
    confidence: snapshot.confidence,
    reason: snapshot.reason,
    effectiveAt: snapshot.effectiveAt,
    deadline: snapshot.finalDeadline?.normalizedValue,
    sourceUrl: item.official_source_url,
    checkedAt: now.toISOString(),
    events: appendOpportunityLifecycleEvents(previous?.events, events),
  };
  await command(["SET", recordKey(item.id), JSON.stringify(record)]);
  return { previous, record, events };
}
