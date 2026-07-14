import {
  createPathGeometry,
  stableHash,
  type PathBranch,
  type PathEvent,
  type PathGeometry,
  type PathLayoutMode,
  type PathPossibility,
  type Pathprint,
} from "../data/open-line";

const baseTime = Date.parse("2026-01-01T12:00:00.000Z");

const progressByKind: Record<PathEvent["kind"], PathEvent["progressLevel"]> = {
  origin: "exploration",
  explored: "exploration",
  chosen: "intention",
  active: "action",
  submitted: "commitment",
  validated: "validation",
  accepted: "validation",
  completed: "validation",
  paused: "intention",
  closed: "intention",
  future: "exploration",
};

const importanceByKind: Record<PathEvent["kind"], number> = {
  origin: 0,
  explored: 10,
  chosen: 25,
  active: 45,
  submitted: 65,
  validated: 80,
  accepted: 92,
  completed: 96,
  paused: 15,
  closed: 12,
  future: 0,
};

export function rendererEvent(id: string, index: number, kind: PathEvent["kind"], branchKey = "category:internships", category = "Internships"): PathEvent {
  return {
    id,
    kind,
    occurredAt: new Date(baseTime + index * 86_400_000).toISOString(),
    progressLevel: progressByKind[kind],
    title: `${kind} fixture`,
    narrative: `Renderer fixture for ${kind}.`,
    category,
    branchKey,
    importance: importanceByKind[kind],
    shareable: ["submitted", "validated", "accepted", "completed"].includes(kind),
    publicSafe: true,
  };
}

export function rendererBranch(key: string, state: PathBranch["state"], events: readonly PathEvent[]): PathBranch {
  return {
    key,
    label: key,
    eventIds: events.map((event) => event.id),
    startedAt: events[0]?.occurredAt ?? new Date(baseTime).toISOString(),
    endedAt: state === "paused" || state === "closed" ? events.at(-1)?.occurredAt ?? new Date(baseTime).toISOString() : undefined,
    state,
  };
}

export function rendererPathprint(events: PathEvent[] = [], branches: PathBranch[] = [], options: { waypoint?: boolean; future?: number } = {}): Pathprint {
  const horizon: PathPossibility[] = Array.from({ length: options.future ?? 0 }, (_, index) => ({
    id: `renderer-future-${index}`,
    title: `Future possibility ${index + 1}`,
    rationale: "A structured renderer fixture.",
  }));
  const waypoint = options.waypoint ? {
    id: "renderer-waypoint",
    title: "Take the next meaningful step",
    whyItMatters: "This fixture exercises the current waypoint.",
    estimatedMinutes: 45,
    impact: "high" as const,
    source: "recommendation" as const,
  } : undefined;
  return {
    version: "open-line-data-v1",
    signature: stableHash({ events, branches, horizon, waypoint }),
    userId: "open-line-renderer-fixture",
    generatedAt: "2026-07-14T12:00:00.000Z",
    origin: {
      id: "renderer-origin",
      kind: "origin",
      occurredAt: events[0]?.occurredAt ?? null,
      progressLevel: "exploration",
      title: "Your path began",
      narrative: "The canonical renderer origin.",
      branchKey: "main",
      importance: 0,
      shareable: true,
      publicSafe: true,
    },
    events,
    branches,
    currentWaypoint: waypoint,
    horizon,
    summary: {
      strongestProgressLevel: events.reduce<PathEvent["progressLevel"]>((strongest, event) => {
        const rank = { exploration: 0, intention: 1, action: 2, commitment: 3, validation: 4 };
        return rank[event.progressLevel] > rank[strongest] ? event.progressLevel : strongest;
      }, "exploration"),
      meaningfulEventCount: events.filter((event) => event.progressLevel !== "exploration").length,
      validationCount: events.filter((event) => event.progressLevel === "validation").length,
    },
  };
}

export function createRendererFixtureGeometry(mode: PathLayoutMode = "desktop"): PathGeometry {
  const main = [
    rendererEvent("explored-main", 0, "explored", "main", "Research"),
  ];
  const internships = [
    rendererEvent("chosen-internship", 1, "chosen"),
    rendererEvent("active-internship", 2, "active"),
    rendererEvent("submitted-internship", 3, "submitted"),
    rendererEvent("validated-internship", 4, "validated"),
    rendererEvent("accepted-internship", 5, "accepted"),
    rendererEvent("completed-internship", 6, "completed"),
  ];
  const research = [
    rendererEvent("research-chosen", 7, "chosen", "category:research", "Research"),
    rendererEvent("research-paused", 8, "paused", "category:research", "Research"),
    rendererEvent("research-returned", 9, "chosen", "category:research", "Research"),
  ];
  const closed = [rendererEvent("law-closed", 10, "closed", "career:law", "Law")];
  const events = [...main, ...internships, ...research, ...closed];
  const branches = [
    rendererBranch("category:internships", "active", internships),
    rendererBranch("category:research", "rejoined", research),
    rendererBranch("career:law", "closed", closed),
  ];
  return createPathGeometry(rendererPathprint(events, branches, { waypoint: true, future: 3 }), { mode });
}

export function createLargeRendererGeometry(count = 160): PathGeometry {
  const events = Array.from({ length: count }, (_, index) => rendererEvent(`large-active-${index}`, index, "active", "category:projects", "Projects"));
  return createPathGeometry(rendererPathprint(events, [rendererBranch("category:projects", "active", events)], { waypoint: true, future: 3 }), { mode: "desktop" });
}
