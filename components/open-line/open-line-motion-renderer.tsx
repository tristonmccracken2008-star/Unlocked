"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createOpenLineMotionPlan } from "@/data/open-line/motion";
import type { PathGeometry } from "@/data/open-line/geometry-types";
import type { OpenLineMotionContext, OpenLineMotionDiagnostics, OpenLineMotionPreference } from "@/data/open-line/motion-types";
import { BrowserOpenLineAnimationDriver, OpenLineMotionController } from "./open-line-motion-runtime";
import { OpenLineRenderer, type OpenLineRendererProps } from "./open-line-renderer";

export type OpenLineMotionRendererHandle = {
  skip(): OpenLineMotionDiagnostics;
  replayForPreview(): void;
};

export type OpenLineMotionRendererProps = Omit<OpenLineRendererProps, "geometry" | "motionPlan" | "motionLayer"> & {
  previousGeometry?: PathGeometry | null;
  geometry: PathGeometry;
  motionContext: Omit<OpenLineMotionContext, "preference"> & { preference?: OpenLineMotionPreference | "system" };
  announcement?: string;
  onMotionComplete?: (diagnostics: OpenLineMotionDiagnostics) => void;
};

function systemPreference(): OpenLineMotionPreference {
  if (typeof window === "undefined") return "reduced";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full";
}

export const OpenLineMotionRenderer = forwardRef<OpenLineMotionRendererHandle, OpenLineMotionRendererProps>(function OpenLineMotionRenderer({
  previousGeometry,
  geometry,
  motionContext,
  announcement,
  onMotionComplete,
  idPrefix = "open-line-motion",
  ...rendererProps
}, forwardedRef) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onMotionCompleteRef = useRef(onMotionComplete);
  onMotionCompleteRef.current = onMotionComplete;
  const replayFrameRef = useRef<number | undefined>(undefined);
  const controllerRef = useRef<OpenLineMotionController | null>(null);
  if (!controllerRef.current) controllerRef.current = new OpenLineMotionController();
  const [resolvedSystemPreference, setResolvedSystemPreference] = useState<OpenLineMotionPreference>("reduced");
  const [systemPreferenceReady, setSystemPreferenceReady] = useState(false);
  const [completedSignature, setCompletedSignature] = useState<string>();
  const preference = motionContext.preference && motionContext.preference !== "system" ? motionContext.preference : resolvedSystemPreference;
  const plan = useMemo(() => createOpenLineMotionPlan(previousGeometry, geometry, {
    cause: motionContext.cause,
    allowDeveloperReplay: motionContext.allowDeveloperReplay,
    preference,
  }), [previousGeometry, geometry, motionContext.cause, motionContext.allowDeveloperReplay, preference]);
  const needsPreviousLayer = plan.phases.some((phase) => phase.source === "previous") && completedSignature !== plan.deterministicSignature;

  useEffect(() => {
    if (motionContext.preference && motionContext.preference !== "system") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setResolvedSystemPreference(media.matches ? "reduced" : "full");
    update();
    setSystemPreferenceReady(true);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [motionContext.preference]);

  useEffect(() => {
    const root = rootRef.current;
    const controller = controllerRef.current;
    if (!root || !controller) return;
    if ((!motionContext.preference || motionContext.preference === "system") && !systemPreferenceReady) return;
    const driver = new BrowserOpenLineAnimationDriver(root);
    void controller.play(plan, driver, (diagnostics) => {
      setCompletedSignature(plan.deterministicSignature);
      onMotionCompleteRef.current?.(diagnostics);
    });
    return () => driver.cancel();
  }, [motionContext.preference, plan, systemPreferenceReady]);

  useEffect(() => () => {
    if (replayFrameRef.current !== undefined) cancelAnimationFrame(replayFrameRef.current);
    controllerRef.current?.dispose();
  }, []);

  useImperativeHandle(forwardedRef, () => ({
    skip() {
      const diagnostics = controllerRef.current!.skip(plan);
      setCompletedSignature(plan.deterministicSignature);
      onMotionCompleteRef.current?.(diagnostics);
      return diagnostics;
    },
    replayForPreview() {
      if (!motionContext.allowDeveloperReplay || !rootRef.current) return;
      setCompletedSignature(undefined);
      if (replayFrameRef.current !== undefined) cancelAnimationFrame(replayFrameRef.current);
      replayFrameRef.current = requestAnimationFrame(() => {
        replayFrameRef.current = undefined;
        if (!rootRef.current) return;
        const driver = new BrowserOpenLineAnimationDriver(rootRef.current);
        void controllerRef.current!.play(plan, driver, onMotionCompleteRef.current);
      });
    },
  }), [motionContext.allowDeveloperReplay, plan]);

  return <div ref={rootRef} data-open-line-motion-root="" data-motion-signature={plan.deterministicSignature} data-motion-transition={plan.transitionKind} data-motion-preference={plan.preference} style={{ position: "relative" }}>
    {needsPreviousLayer && previousGeometry && <div data-motion-layer="previous" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", pointerEvents: "none" }}>
      <OpenLineRenderer {...rendererProps} geometry={previousGeometry} idPrefix={`${idPrefix}-previous`} motionPlan={plan} motionLayer="previous" interactive={false} decorativeMarkers />
    </div>}
    <div data-motion-layer="current">
      <OpenLineRenderer {...rendererProps} geometry={geometry} idPrefix={`${idPrefix}-current`} motionPlan={plan} motionLayer="current" />
    </div>
    {announcement && <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>}
  </div>;
});
