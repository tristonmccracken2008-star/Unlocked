import { createPathGeometry } from "@/data/open-line/geometry";
import type { PathGeometry } from "@/data/open-line/geometry-types";
import type { OpenLineMotionCause, OpenLineMotionPreference } from "@/data/open-line/motion-types";
import { stableHash } from "@/data/open-line/stable";
import type { PathBranch, PathEvent, PathPossibility, Pathprint } from "@/data/open-line/types";

export type OpenLineMotionLaboratoryScenarioId =
  | "initial_reveal"
  | "chosen_to_active"
  | "active_to_submitted"
  | "submitted_to_validated"
  | "validated_to_accepted"
  | "experience_completion"
  | "branch_creation"
  | "branch_pause"
  | "branch_close"
  | "branch_rejoin"
  | "waypoint_change"
  | "horizon_update"
  | "reduced_motion"
  | "no_motion"
  | "interrupted_transition"
  | "rapid_consecutive_updates";

export type OpenLineMotionLaboratoryScenario = {
  id: OpenLineMotionLaboratoryScenarioId;
  label: string;
  description: string;
  previousGeometry: PathGeometry | null;
  geometry: PathGeometry;
  cause: OpenLineMotionCause;
  preference: OpenLineMotionPreference;
};

const time = "2026-07-14T12:00:00.000Z";
const progressByKind: Record<PathEvent["kind"], PathEvent["progressLevel"]> = {
  origin: "exploration", explored: "exploration", chosen: "intention", active: "action", submitted: "commitment", validated: "validation", accepted: "validation", completed: "validation", paused: "intention", closed: "intention", future: "exploration",
};
const importanceByKind: Record<PathEvent["kind"], number> = {
  origin: 0, explored: 10, chosen: 25, active: 45, submitted: 65, validated: 80, accepted: 92, completed: 96, paused: 15, closed: 12, future: 0,
};

function pathEvent(kind: PathEvent["kind"], branchKey = "main"): PathEvent {
  return { id: "motion-lab-action", kind, occurredAt: time, progressLevel: progressByKind[kind], title: `${kind} action`, narrative: `Motion laboratory ${kind} state.`, category: "Internships", branchKey, importance: importanceByKind[kind], shareable: false, publicSafe: false };
}

function pathprint(kind: PathEvent["kind"], options: { branchState?: PathBranch["state"]; branchKey?: string; waypoint?: string; horizon?: string[] } = {}): Pathprint {
  const branchKey = options.branchKey ?? "main";
  const event = pathEvent(kind, branchKey);
  const branches: PathBranch[] = options.branchState && branchKey !== "main" ? [{ key: branchKey, label: "Internships", eventIds: [event.id], startedAt: time, state: options.branchState }] : [];
  const horizon: PathPossibility[] = (options.horizon ?? []).map((id) => ({ id, title: id.replace(/-/g, " "), rationale: "A nonbinding future possibility." }));
  const currentWaypoint = options.waypoint ? { id: options.waypoint, title: "Current next step", whyItMatters: "A structured motion laboratory waypoint.", impact: "high" as const, source: "roadmap" as const } : undefined;
  const origin: PathEvent = { ...pathEvent("origin"), id: "motion-lab-origin", occurredAt: time };
  const summary = { strongestProgressLevel: event.progressLevel, meaningfulEventCount: 1, validationCount: event.progressLevel === "validation" ? 1 : 0 };
  return { version: "open-line-data-v1", signature: stableHash({ event, branches, currentWaypoint, horizon }), userId: "motion-laboratory", generatedAt: time, origin, events: [event], branches, currentWaypoint, horizon, summary };
}

function geometry(kind: PathEvent["kind"], options?: Parameters<typeof pathprint>[1]) {
  return createPathGeometry(pathprint(kind, options), { mode: "desktop", width: 760 });
}

export function createOpenLineMotionLaboratoryScenarios(): OpenLineMotionLaboratoryScenario[] {
  const chosen = geometry("chosen");
  const active = geometry("active");
  const submitted = geometry("submitted");
  const validated = geometry("validated");
  const accepted = geometry("accepted");
  const completed = geometry("completed");
  const branchKey = "experience:internships";
  const branchActive = geometry("active", { branchKey, branchState: "active" });
  const scenario = (id: OpenLineMotionLaboratoryScenarioId, label: string, description: string, previousGeometry: PathGeometry | null, current: PathGeometry, preference: OpenLineMotionPreference = "full", cause: OpenLineMotionCause = "meaningful_update"): OpenLineMotionLaboratoryScenario => ({ id, label, description, previousGeometry, geometry: current, cause, preference });
  return [
    scenario("initial_reveal", "Initial reveal", "First creation reveals the established line once.", null, chosen, "full", "first_journey_creation"),
    scenario("chosen_to_active", "Chosen to active", "A chosen direction becomes real work.", chosen, active),
    scenario("active_to_submitted", "Active to submitted", "The marker settles before commitment extends the path.", active, submitted),
    scenario("submitted_to_validated", "Submitted to validated", "External validation draws gold once and settles.", submitted, validated),
    scenario("validated_to_accepted", "Validated to accepted", "Acceptance resolves the existing validation construction.", validated, accepted),
    scenario("experience_completion", "Experience completion", "Completion fills, extends, and then reveals meaning.", active, completed),
    scenario("branch_creation", "Branch creation", "A meaningful secondary direction extends from the line.", chosen, geometry("chosen", { branchKey, branchState: "active" })),
    scenario("branch_pause", "Branch pause", "The alternate direction settles into a calm pause.", branchActive, geometry("paused", { branchKey, branchState: "paused" })),
    scenario("branch_close", "Branch close", "The terminal strand fades without a failure symbol.", branchActive, geometry("closed", { branchKey, branchState: "closed" })),
    scenario("branch_rejoin", "Branch rejoin", "The incoming strand resolves through a woven junction.", branchActive, geometry("completed", { branchKey, branchState: "rejoined" })),
    scenario("waypoint_change", "Waypoint change", "Current emphasis transfers without moving keyboard focus.", geometry("active", { waypoint: "waypoint-a" }), geometry("active", { waypoint: "waypoint-b" })),
    scenario("horizon_update", "Horizon update", "Old possibilities fade before new possibilities appear.", geometry("active", { horizon: ["research", "internship"] }), geometry("active", { horizon: ["internship", "fellowship"] })),
    scenario("reduced_motion", "Reduced motion", "Semantic order remains while drawing becomes immediate.", submitted, validated, "reduced"),
    scenario("no_motion", "No motion", "The final canonical state renders immediately.", submitted, validated, "none"),
    scenario("interrupted_transition", "Interrupted transition", "A newer canonical state cancels the active visual transition.", active, submitted),
    scenario("rapid_consecutive_updates", "Rapid consecutive updates", "Repeated updates settle on the newest canonical geometry.", submitted, accepted),
  ];
}
