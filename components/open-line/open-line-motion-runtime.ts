import type { OpenLineMotionDiagnostics, OpenLineMotionPhase, OpenLineMotionPlan } from "@/data/open-line";

export interface OpenLineAnimationDriver {
  playPhase(phase: OpenLineMotionPhase, generation: number): Promise<void>;
  cancel(): void;
  settle(): void;
}

function phaseKeyframes(phase: OpenLineMotionPhase): Keyframe[] {
  const length = Math.max(1, phase.pathLength ?? 120);
  if (["line_reveal", "line_extend", "branch_create", "branch_rejoin", "intersection_draw", "validation_ring"].includes(phase.type)) {
    return [
      { strokeDasharray: `${length} ${length}`, strokeDashoffset: length, opacity: phase.durationMs ? 0.82 : 1 },
      { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0, opacity: 1 },
    ];
  }
  if (phase.type === "line_fade") return [{ opacity: 1 }, { opacity: 0 }];
  if (phase.type === "branch_close") return [{ opacity: 1 }, { opacity: 0.68 }];
  if (phase.type === "branch_pause") return [{ opacity: 0.64 }, { opacity: 1 }];
  if (phase.source === "previous") return [{ opacity: 1 }, { opacity: 0 }];
  if (phase.type === "focus_shift") return [{ opacity: 0.45 }, { opacity: 1 }];
  return [{ opacity: 0 }, { opacity: 1 }];
}

function attributeSelector(attribute: string, value: string) {
  return `[${attribute}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
}

function selectorsForPhase(phase: OpenLineMotionPhase, targetId: string) {
  if (["line_reveal", "line_extend", "line_fade", "branch_create", "branch_rejoin", "branch_pause", "branch_close"].includes(phase.type)) {
    return [attributeSelector("data-segment-id", targetId)];
  }
  if (phase.type === "intersection_draw") {
    return [attributeSelector("data-intersection-id", targetId), `${attributeSelector("data-validation-axis", "")}${attributeSelector("data-node-id", targetId)}`];
  }
  if (phase.type === "validation_ring") return [`${attributeSelector("data-open-line-marker", "")}${attributeSelector("data-node-id", targetId)} .marker-validation-ring`];
  if (phase.type === "marker_fill") return [`${attributeSelector("data-open-line-marker", "")}${attributeSelector("data-node-id", targetId)} .marker-center`];
  if (phase.type === "label_fade") return [`${attributeSelector("data-label-anchor", "")}${attributeSelector("data-node-id", targetId)}`];
  return [`${attributeSelector("data-open-line-marker", "")}${attributeSelector("data-node-id", targetId)}`];
}

export class BrowserOpenLineAnimationDriver implements OpenLineAnimationDriver {
  private animations = new Set<Animation>();

  constructor(private readonly root: ParentNode) {}

  async playPhase(phase: OpenLineMotionPhase) {
    if (phase.durationMs === 0) return;
    const layer = this.root.querySelector(`[data-motion-layer="${phase.source}"]`) ?? this.root;
    const elements = new Set<Element>();
    for (const targetId of phase.targetIds) {
      for (const selector of selectorsForPhase(phase, targetId)) {
        for (const element of layer.querySelectorAll(selector)) elements.add(element);
      }
    }
    const animations = [...elements].map((element) => {
      const animation = element.animate(phaseKeyframes(phase), {
        delay: phase.delayMs,
        duration: phase.durationMs,
        easing: phase.easing,
        fill: "none",
      });
      this.animations.add(animation);
      void animation.finished.finally(() => this.animations.delete(animation)).catch(() => undefined);
      return animation;
    });
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  }

  cancel() {
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
  }

  settle() {
    this.cancel();
  }
}

function baseDiagnostics(plan: OpenLineMotionPlan): OpenLineMotionDiagnostics {
  return {
    transitionKind: plan.transitionKind,
    preference: plan.preference,
    phaseCount: plan.phases.length,
    totalPlannedDurationMs: plan.totalDurationMs,
    affectedNodeCount: plan.affectedNodeIds.length,
    affectedSegmentCount: plan.affectedSegmentIds.length,
    interrupted: false,
    skipped: false,
    deterministicSignature: plan.deterministicSignature,
  };
}

export class OpenLineMotionController {
  private generation = 0;
  private activeDriver?: OpenLineAnimationDriver;
  private activeDiagnostics?: OpenLineMotionDiagnostics;

  async play(plan: OpenLineMotionPlan, driver: OpenLineAnimationDriver, onComplete?: (diagnostics: OpenLineMotionDiagnostics) => void) {
    this.generation += 1;
    const generation = this.generation;
    if (this.activeDriver) this.activeDriver.cancel();
    if (this.activeDiagnostics) this.activeDiagnostics.interrupted = true;
    this.activeDriver = driver;
    const diagnostics = { ...baseDiagnostics(plan), startedAt: performance.now(), skipped: plan.phases.length === 0 };
    this.activeDiagnostics = diagnostics;
    await Promise.all(plan.phases.map((phase) => driver.playPhase(phase, generation)));
    if (generation !== this.generation) return { ...diagnostics, interrupted: true };
    driver.settle();
    diagnostics.completedAt = performance.now();
    this.activeDriver = undefined;
    this.activeDiagnostics = undefined;
    onComplete?.(diagnostics);
    return diagnostics;
  }

  skip(plan: OpenLineMotionPlan) {
    this.generation += 1;
    this.activeDriver?.settle();
    if (this.activeDiagnostics) this.activeDiagnostics.interrupted = true;
    this.activeDriver = undefined;
    this.activeDiagnostics = undefined;
    const now = performance.now();
    return { ...baseDiagnostics(plan), startedAt: now, completedAt: now, skipped: true };
  }

  dispose() {
    this.generation += 1;
    this.activeDriver?.cancel();
    if (this.activeDiagnostics) this.activeDiagnostics.interrupted = true;
    this.activeDriver = undefined;
    this.activeDiagnostics = undefined;
  }

  currentGeneration() {
    return this.generation;
  }
}
