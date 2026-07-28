import "server-only";

import type { Opportunity } from "@/data/opportunities";
import { resolveOpportunityLifecycle } from "@/data/opportunity-lifecycle";
import { listPublishedOpportunities } from "./content-store";
import { queueMaterialOpportunityChanges } from "./notification-service";
import {
  persistOperationalLifecycle,
  readLifecycleCursor,
  writeLifecycleCursor,
  type OperationalLifecycleRecord,
} from "./opportunity-lifecycle-store";

function historicalOpportunity(item: Opportunity, previous: OperationalLifecycleRecord): Opportunity {
  const lifecycle = item.metadata.lifecycle ?? {
    schemaVersion: 1 as const,
    identity: { identityId: previous.identityId },
    cycle: { cycleId: previous.cycleId },
  };
  return {
    ...item,
    metadata: {
      ...item.metadata,
      lifecycle: {
        ...lifecycle,
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

export async function processOpportunityLifecycleBatch(now = new Date(), limit = 100) {
  const catalog = (await listPublishedOpportunities()).slice().sort((left, right) => left.id.localeCompare(right.id));
  if (!catalog.length) return { processed: 0, changed: 0, events: 0, notifications: 0, nextCursor: 0 };
  const cursor = (await readLifecycleCursor()) % catalog.length;
  const boundedLimit = Math.min(250, Math.max(1, Math.floor(limit)));
  const batch = Array.from({ length: Math.min(boundedLimit, catalog.length) }, (_, index) => catalog[(cursor + index) % catalog.length]);
  let changed = 0;
  let eventCount = 0;
  let notifications = 0;
  for (const item of batch) {
    const result = await persistOperationalLifecycle(item, now);
    if (!result.previous || !result.events.length) continue;
    changed += 1;
    eventCount += result.events.length;
    const before = historicalOpportunity(item, result.previous);
    const queued = await queueMaterialOpportunityChanges(before, item, now);
    notifications += queued.scheduled;
    const afterSnapshot = resolveOpportunityLifecycle(item, now);
    console.info("[UnlockED lifecycle] Material transition", {
      opportunityId: item.id,
      before: result.previous.state,
      after: afterSnapshot.state,
      events: result.events.map((event) => event.type),
    });
  }
  const nextCursor = (cursor + batch.length) % catalog.length;
  await writeLifecycleCursor(nextCursor);
  return { processed: batch.length, changed, events: eventCount, notifications, nextCursor };
}
