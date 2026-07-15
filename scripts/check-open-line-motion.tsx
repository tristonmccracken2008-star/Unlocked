import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { renderToStaticMarkup } from "react-dom/server";
import {
  OPEN_LINE_MOTION,
  createOpenLineMotionPlan,
  createPathGeometry,
  diffOpenLineGeometry,
  type OpenLineMotionPhase,
  type OpenLineMotionPlan,
  type PathBranch,
  type PathEvent,
  type PathGeometry,
} from "../data/open-line";
import { createOpenLineMotionLaboratoryScenarios, OpenLineMotionLaboratory, OpenLineMotionRenderer, OpenLineMotionController, type OpenLineAnimationDriver } from "../components/open-line";
import { rendererBranch, rendererEvent, rendererPathprint } from "./open-line-renderer-fixtures";

const strictBenchmark = process.argv.includes("--strict-benchmark");

function geometry(kind: PathEvent["kind"], options: {
  branchState?: PathBranch["state"];
  branchKey?: string;
  waypointId?: string;
  horizonIds?: string[];
  mode?: "desktop" | "mobile";
} = {}) {
  const branchKey = options.branchKey ?? "main";
  const event = rendererEvent("stable-action", 1, kind, branchKey, "Internships");
  const branches = options.branchState && branchKey !== "main" ? [rendererBranch(branchKey, options.branchState, [event])] : [];
  const pathprint = rendererPathprint([event], branches, { waypoint: Boolean(options.waypointId), future: 0 });
  if (options.waypointId && pathprint.currentWaypoint) pathprint.currentWaypoint = { ...pathprint.currentWaypoint, id: options.waypointId };
  pathprint.horizon = (options.horizonIds ?? []).map((id) => ({ id, title: id, rationale: "Structured future possibility." }));
  return createPathGeometry(pathprint, { mode: options.mode ?? "desktop" });
}

function plan(previous: PathGeometry | null, current: PathGeometry, cause: Parameters<typeof createOpenLineMotionPlan>[2]["cause"] = "meaningful_update", preference: "full" | "reduced" | "none" = "full") {
  return createOpenLineMotionPlan(previous, current, { cause, preference });
}

function phaseTypes(value: OpenLineMotionPlan) {
  return value.phases.map((phase) => phase.type);
}

const chosen = geometry("chosen");
const active = geometry("active");
const submitted = geometry("submitted");
const validated = geometry("validated");
const accepted = geometry("accepted");
const completed = geometry("completed");

const initial = plan(null, chosen, "first_journey_creation");
assert.equal(initial.transitionKind, "initial_reveal");
assert.ok(phaseTypes(initial).includes("line_reveal"));
assert.ok(initial.totalDurationMs <= OPEN_LINE_MOTION.maximumForeground);

const sessionReveal = plan(null, chosen, "session_reveal");
assert.equal(sessionReveal.transitionKind, "initial_reveal");
assert.deepEqual(phaseTypes(sessionReveal), ["marker_enter"], "A new session receives only a restrained opacity reveal.");
assert.ok(sessionReveal.totalDurationMs <= OPEN_LINE_MOTION.sessionReveal);

const normalRevisit = plan(null, chosen, "normal_revisit");
assert.equal(normalRevisit.transitionKind, "no_visible_change");
assert.equal(normalRevisit.phases.length, 0, "Normal visits must not redraw history.");

const started = plan(chosen, active);
assert.equal(started.transitionKind, "application_started");
assert.ok(phaseTypes(started).includes("marker_fill"));
assert.ok(started.totalDurationMs >= 420 && started.totalDurationMs <= 720);

const submittedPlan = plan(active, submitted);
assert.equal(submittedPlan.transitionKind, "application_submitted");
assert.ok(phaseTypes(submittedPlan).includes("marker_fill"));

const validationPlan = plan(submitted, validated);
assert.equal(validationPlan.transitionKind, "validation_received");
assert.deepEqual(phaseTypes(validationPlan).slice(0, 3), ["marker_transform", "validation_ring", "intersection_draw"]);
assert.ok(validationPlan.totalDurationMs >= 800 && validationPlan.totalDurationMs <= 1_000);

const acceptancePlan = plan(validated, accepted);
assert.equal(acceptancePlan.transitionKind, "opportunity_accepted");
assert.equal(phaseTypes(acceptancePlan).filter((type) => type === "validation_ring").length, 1, "Validation gold draws exactly once.");

const completionPlan = plan(active, completed);
assert.equal(completionPlan.transitionKind, "experience_completed");
assert.deepEqual(phaseTypes(completionPlan), ["marker_fill", "marker_transform", "label_fade"]);
assert.ok(phaseTypes(completionPlan).includes("marker_fill"));
assert.ok(phaseTypes(completionPlan).includes("label_fade"));
assert.ok(completionPlan.totalDurationMs >= 700 && completionPlan.totalDurationMs <= 1_000);

const branchKey = "experience:internships";
const primaryChosen = geometry("chosen", { branchKey: "main" });
const branchChosen = geometry("chosen", { branchKey, branchState: "active" });
const branchCreated = plan(primaryChosen, branchChosen);
assert.equal(branchCreated.transitionKind, "branch_created");
assert.ok(phaseTypes(branchCreated).includes("branch_create"), JSON.stringify(branchCreated));
assert.ok(branchCreated.totalDurationMs >= 420 && branchCreated.totalDurationMs <= 560);

const branchActive = geometry("active", { branchKey, branchState: "active" });
const branchPausedGeometry = geometry("paused", { branchKey, branchState: "paused" });
const branchPaused = plan(branchActive, branchPausedGeometry);
assert.equal(branchPaused.transitionKind, "branch_paused");
assert.ok(phaseTypes(branchPaused).includes("branch_pause"), JSON.stringify(branchPaused));
assert.ok(branchPaused.totalDurationMs <= 420);

const branchClosedGeometry = geometry("closed", { branchKey, branchState: "closed" });
const branchClosed = plan(branchActive, branchClosedGeometry);
assert.equal(branchClosed.transitionKind, "branch_closed");
assert.ok(phaseTypes(branchClosed).includes("branch_close"), JSON.stringify(branchClosed));
assert.doesNotMatch(JSON.stringify(branchClosed), /confetti|pulse|glow|particle/i);

const branchRejoinedGeometry = geometry("completed", { branchKey, branchState: "rejoined" });
const branchRejoined = plan(branchActive, branchRejoinedGeometry);
assert.equal(branchRejoined.transitionKind, "branch_rejoined");
assert.ok(phaseTypes(branchRejoined).includes("branch_rejoin"), JSON.stringify(branchRejoined));
assert.ok(phaseTypes(branchRejoined).includes("intersection_draw"), JSON.stringify(branchRejoined));
assert.ok(branchRejoined.totalDurationMs >= 560 && branchRejoined.totalDurationMs <= 900);

const waypointA = geometry("active", { waypointId: "waypoint-a" });
const waypointB = geometry("active", { waypointId: "waypoint-b" });
const waypointPlan = plan(waypointA, waypointB);
assert.equal(waypointPlan.transitionKind, "waypoint_changed");
assert.equal(waypointPlan.phases.filter((phase) => phase.type === "focus_shift").length, 2);
assert.ok(waypointPlan.phases.some((phase) => phase.source === "previous"));

const horizonA = geometry("active", { horizonIds: ["future-a", "future-b"] });
const horizonB = geometry("active", { horizonIds: ["future-b", "future-c"] });
const horizonPlan = plan(horizonA, horizonB);
assert.equal(horizonPlan.transitionKind, "horizon_changed");
assert.ok(horizonPlan.phases.some((phase) => phase.type === "label_fade" && phase.source === "previous"));
assert.ok(horizonPlan.totalDurationMs <= 480);

const identicalSnapshot = plan(active, active, "snapshot_refresh");
assert.equal(identicalSnapshot.transitionKind, "snapshot_refreshed");
assert.equal(identicalSnapshot.phases.length, 0);

const mobileActive = geometry("active", { mode: "mobile" });
const layoutOnly = plan(active, mobileActive, "layout_change");
assert.equal(diffOpenLineGeometry(active, mobileActive).geometryOnly, true);
assert.equal(layoutOnly.transitionKind, "no_visible_change");
assert.equal(layoutOnly.phases.length, 0);

const themeOnly = plan(active, active, "theme_change");
assert.equal(themeOnly.phases.length, 0);
const privateProjection = plan(active, submitted, "privacy_projection_change");
assert.equal(privateProjection.transitionKind, "snapshot_refreshed");
assert.equal(privateProjection.phases.length, 0);

const reduced = plan(submitted, validated, "meaningful_update", "reduced");
assert.equal(reduced.preference, "reduced");
assert.equal(reduced.phases.find((phase) => phase.type === "validation_ring")?.durationMs, 0);
assert.ok(reduced.phases.filter((phase) => phase.durationMs > 0).every((phase) => phase.durationMs <= OPEN_LINE_MOTION.reducedFade));
const none = plan(submitted, validated, "meaningful_update", "none");
assert.equal(none.totalDurationMs, 0);
assert.equal(none.phases.length, 0);

assert.equal(started.affectedNodeIds.length, 1, "Only the changed action marker should animate.");
assert.equal(started.affectedNodeIds[0], active.nodes.find((node) => node.kind === "active")?.id);
const unchangedOrigin = active.nodes.find((node) => node.kind === "origin")?.id;
assert.equal(started.affectedNodeIds.includes(unchangedOrigin!), false, "Unchanged history remains static.");
for (const value of [initial, started, validationPlan, branchRejoined]) {
  assert.ok(value.phases.every((phase) => phase.delayMs + phase.durationMs <= OPEN_LINE_MOTION.maximumForeground));
  assert.equal(value.phases.some((phase) => phase.durationMs === Number.POSITIVE_INFINITY), false);
}
assert.deepEqual(plan(submitted, validated), validationPlan);
assert.equal(plan(submitted, validated).deterministicSignature, validationPlan.deterministicSignature);

class ControlledDriver implements OpenLineAnimationDriver {
  cancelled = false;
  settled = false;
  pending: Array<() => void> = [];
  constructor(private readonly immediate = false) {}
  playPhase(_phase: OpenLineMotionPhase) {
    if (this.immediate) return Promise.resolve();
    return new Promise<void>((resolve) => this.pending.push(resolve));
  }
  cancel() { this.cancelled = true; this.pending.splice(0).forEach((resolve) => resolve()); }
  settle() { this.settled = true; this.pending.splice(0).forEach((resolve) => resolve()); }
}

const controller = new OpenLineMotionController();
const slowDriver = new ControlledDriver();
let staleCallbackCount = 0;
const firstRun = controller.play(started, slowDriver, () => { staleCallbackCount += 1; });
const nextDriver = new ControlledDriver(true);
const secondRun = controller.play(submittedPlan, nextDriver);
const [firstDiagnostics, secondDiagnostics] = await Promise.all([firstRun, secondRun]);
assert.equal(slowDriver.cancelled, true, "A consecutive transition must cancel the prior driver.");
assert.equal(firstDiagnostics.interrupted, true);
assert.equal(secondDiagnostics.interrupted, false);
assert.equal(staleCallbackCount, 0, "A stale completion callback cannot overwrite newer state.");
assert.ok(controller.currentGeneration() >= 2);

const skipDriver = new ControlledDriver();
void controller.play(validationPlan, skipDriver);
const skipped = controller.skip(validationPlan);
assert.equal(skipped.skipped, true);
assert.equal(skipDriver.settled, true);
controller.dispose();
assert.equal(skipDriver.cancelled || skipDriver.settled, true, "Disposal leaves no active animation behind.");

const accessibleMarkup = renderToStaticMarkup(<OpenLineMotionRenderer
  previousGeometry={submitted}
  geometry={validated}
  motionContext={{ cause: "meaningful_update", preference: "none" }}
  announcement="Interview reached."
  idPrefix="motion-accessibility"
/>);
assert.match(accessibleMarkup, /data-motion-layer="current"/);
assert.match(accessibleMarkup, /data-marker-kind="validated"/, "The canonical state is immediately present for assistive technology.");
assert.match(accessibleMarkup, /aria-live="polite"/);
assert.match(accessibleMarkup, />Interview reached\.<\/span>/);
assert.doesNotMatch(accessibleMarkup, /autofocus/i, "Motion cannot steal keyboard focus.");

const laboratoryScenarios = createOpenLineMotionLaboratoryScenarios();
assert.deepEqual(laboratoryScenarios.map((scenario) => scenario.id), [
  "initial_reveal", "chosen_to_active", "active_to_submitted", "submitted_to_validated", "validated_to_accepted", "experience_completion", "branch_creation", "branch_pause", "branch_close", "branch_rejoin", "waypoint_change", "horizon_update", "reduced_motion", "no_motion", "interrupted_transition", "rapid_consecutive_updates",
]);
const laboratoryMarkup = renderToStaticMarkup(<OpenLineMotionLaboratory />);
assert.match(laboratoryMarkup, /data-open-line-motion-laboratory=""/);
assert.match(laboratoryMarkup, />Replay selected transition<\/button>/);
assert.match(laboratoryMarkup, />Skip to final state<\/button>/);
assert.match(laboratoryMarkup, /data-motion-laboratory-diagnostics=""/);
const routeSources = ["../app/page.tsx", "../app/my-opportunities/page.tsx"].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
assert.doesNotMatch(routeSources, /OpenLineMotionLaboratory/, "The developer laboratory cannot be mounted by a production route.");

const runtimeSource = readFileSync(new URL("../components/open-line/open-line-motion-runtime.ts", import.meta.url), "utf8");
assert.doesNotMatch(runtimeSource, /setInterval|requestAnimationFrame|getTotalLength/, "Motion uses bounded WAAPI animations and geometry-derived lengths without continuous timers or DOM measurement.");
assert.match(runtimeSource, /animation\.cancel\(\)/);

const largeEvents = Array.from({ length: 1_000 }, (_, index) => rendererEvent(`motion-large-${index}`, index, index === 999 ? "submitted" : "active", "main", "Projects"));
const largePrevious = createPathGeometry(rendererPathprint(largeEvents.slice(0, -1)));
const largeCurrent = createPathGeometry(rendererPathprint(largeEvents));
for (let index = 0; index < 10; index += 1) plan(largePrevious, largeCurrent);
const samples = Array.from({ length: 80 }, () => {
  const startedAt = performance.now();
  plan(largePrevious, largeCurrent);
  return performance.now() - startedAt;
}).sort((a, b) => a - b);
const p95 = samples[Math.ceil(samples.length * 0.95) - 1];
const maximum = samples.at(-1) ?? 0;
if (strictBenchmark) {
  assert.ok(p95 < 25, `Large motion diff and planning p95 must stay under 25ms; measured ${p95.toFixed(2)}ms.`);
} else {
  assert.ok(maximum < 250, `Large motion diff and planning exceeded the deployment catastrophic ceiling of 250ms; measured ${maximum.toFixed(2)}ms.`);
}

console.log(`Open Line motion checks passed (${strictBenchmark ? "strict benchmark" : "build-safe"}). Large-history diff and plan p95: ${p95.toFixed(2)}ms.`);
