import { stableId, validTimestamp } from "./stable";
import type { PathEvent } from "./types";

export const quietCompactionRules = {
  minimumClusterSize: 3,
  maximumClusterSize: 8,
  sameCategoryWindowDays: 30,
  mixedCategoryWindowDays: 7,
} as const;

export type PathGeometryEventUnit = {
  id: string;
  eventIds: string[];
  branchKey: string;
  kind: PathEvent["kind"];
  progressLevel: PathEvent["progressLevel"];
  occurredAt: string | null;
  importance: number;
  category?: string;
  clustered: boolean;
};

function daysBetween(left: string | null, right: string | null) {
  if (!validTimestamp(left) || !validTimestamp(right)) return Number.POSITIVE_INFINITY;
  return Math.abs(new Date(right).getTime() - new Date(left).getTime()) / 86_400_000;
}

function normalizedCategory(event: PathEvent) {
  return event.category?.trim().toLowerCase() || "general";
}

function isQuiet(event: PathEvent) {
  return event.kind === "explored" && event.progressLevel === "exploration";
}

function canJoinQuietRun(run: readonly PathEvent[], next: PathEvent) {
  const previous = run[run.length - 1];
  if (!previous || !isQuiet(next) || run.length >= quietCompactionRules.maximumClusterSize) return false;
  const gapDays = daysBetween(previous.occurredAt, next.occurredAt);
  const sameCategory = normalizedCategory(previous) === normalizedCategory(next);
  return sameCategory ? gapDays <= quietCompactionRules.sameCategoryWindowDays : gapDays <= quietCompactionRules.mixedCategoryWindowDays;
}

function toSingle(event: PathEvent): PathGeometryEventUnit {
  return {
    id: stableId("geometry-unit", event.id),
    eventIds: [event.id],
    branchKey: event.branchKey,
    kind: event.kind,
    progressLevel: event.progressLevel,
    occurredAt: event.occurredAt,
    importance: event.importance,
    category: event.category,
    clustered: false,
  };
}

function compactRun(run: readonly PathEvent[]) {
  if (run.length < quietCompactionRules.minimumClusterSize) return run.map(toSingle);
  const categories = [...new Set(run.map(normalizedCategory))];
  return [{
    id: stableId("geometry-cluster", run.map((event) => event.id)),
    eventIds: run.map((event) => event.id),
    branchKey: "main",
    kind: "explored" as const,
    progressLevel: "exploration" as const,
    occurredAt: run[0].occurredAt,
    importance: Math.max(...run.map((event) => event.importance)),
    category: categories.length === 1 ? run[0].category : undefined,
    clustered: true,
  }];
}

export function compactPathEvents(events: readonly PathEvent[]): PathGeometryEventUnit[] {
  const units: PathGeometryEventUnit[] = [];
  for (let index = 0; index < events.length;) {
    const event = events[index];
    if (!isQuiet(event)) {
      units.push(toSingle(event));
      index += 1;
      continue;
    }
    const run = [event];
    let nextIndex = index + 1;
    while (nextIndex < events.length && canJoinQuietRun(run, events[nextIndex])) {
      run.push(events[nextIndex]);
      nextIndex += 1;
    }
    units.push(...compactRun(run));
    index = nextIndex;
  }
  return units;
}
