"use client";

import { useMemo, useRef, useState } from "react";
import { createOpenLineMotionPlan } from "@/data/open-line/motion";
import type { OpenLineMotionDiagnostics } from "@/data/open-line/motion-types";
import { createOpenLineMotionLaboratoryScenarios } from "./open-line-motion-laboratory-fixtures";
import { OpenLineMotionRenderer, type OpenLineMotionRendererHandle } from "./open-line-motion-renderer";

/** Developer-only laboratory. It is intentionally not mounted by an application route. */
export function OpenLineMotionLaboratory() {
  const scenarios = useMemo(createOpenLineMotionLaboratoryScenarios, []);
  const [selectedId, setSelectedId] = useState(scenarios[0].id);
  const [diagnostics, setDiagnostics] = useState<OpenLineMotionDiagnostics>();
  const rendererRef = useRef<OpenLineMotionRendererHandle>(null);
  const selected = scenarios.find((scenario) => scenario.id === selectedId) ?? scenarios[0];
  const plan = createOpenLineMotionPlan(selected.previousGeometry, selected.geometry, { cause: selected.cause, preference: selected.preference, allowDeveloperReplay: true });

  return <section data-open-line-motion-laboratory="" aria-label="Open Line motion laboratory">
    <header>
      <p>Developer preview</p>
      <h2>Open Line Motion Laboratory</h2>
      <p>{selected.description}</p>
    </header>
    <div role="tablist" aria-label="Motion scenarios">
      {scenarios.map((scenario) => <button key={scenario.id} type="button" role="tab" aria-selected={scenario.id === selected.id} onClick={() => { setSelectedId(scenario.id); setDiagnostics(undefined); }}>{scenario.label}</button>)}
    </div>
    <div>
      <button type="button" onClick={() => rendererRef.current?.replayForPreview()}>Replay selected transition</button>
      <button type="button" onClick={() => setDiagnostics(rendererRef.current?.skip())}>Skip to final state</button>
    </div>
    <OpenLineMotionRenderer
      ref={rendererRef}
      previousGeometry={selected.previousGeometry}
      geometry={selected.geometry}
      motionContext={{ cause: selected.cause, preference: selected.preference, allowDeveloperReplay: true }}
      onMotionComplete={setDiagnostics}
      background="paper"
      title={`${selected.label} motion preview`}
      description={selected.description}
      idPrefix={`motion-lab-${selected.id}`}
    />
    <dl data-motion-laboratory-diagnostics="">
      <dt>Transition</dt><dd>{plan.transitionKind}</dd>
      <dt>Preference</dt><dd>{plan.preference}</dd>
      <dt>Phases</dt><dd>{plan.phases.length}</dd>
      <dt>Planned duration</dt><dd>{plan.totalDurationMs}ms</dd>
      <dt>Runtime status</dt><dd>{diagnostics?.interrupted ? "Interrupted" : diagnostics?.skipped ? "Skipped" : diagnostics?.completedAt ? "Complete" : "Ready"}</dd>
    </dl>
  </section>;
}
