"use client";

import { useEffect } from "react";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { trackJourneyView, trackProductEvent, trackProductTiming } from "@/data/product-analytics";

export function JourneyAnalytics({ state, serverProjectionMs }: { state: string; serverProjectionMs?: number }) {
  useEffect(() => {
    trackJourneyView(state);
    if (typeof serverProjectionMs === "number") trackProductTiming("journey", "server_projection", serverProjectionMs);
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation) trackProductTiming("journey", "hydration_duration", Math.max(0, performance.now() - navigation.responseStart));
    const renderStarted = performance.now();
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => trackProductTiming("open_line", "initial_render", performance.now() - renderStarted));
    });
    const expandedMoments = new WeakSet<Element>();
    let historyFullyExplored = false;
    const toggle = (event: Event) => {
      const details = event.target instanceof HTMLDetailsElement ? event.target : null;
      if (!details?.open || !details.closest("[data-journey-editorial]")) return;
      if (details.matches("[data-journey-moment]")) {
        expandedMoments.add(details);
        trackProductEvent(productIntelligenceEvents.historyExpanded);
        const allMoments = [...document.querySelectorAll("[data-journey-editorial] [data-journey-moment]")];
        if (!historyFullyExplored && allMoments.length > 0 && allMoments.every((item) => expandedMoments.has(item))) {
          historyFullyExplored = true;
          trackProductEvent(productIntelligenceEvents.historyExplored);
        }
      }
      if (details.matches("[data-earlier-chapters]") && !historyFullyExplored) {
        historyFullyExplored = true;
        trackProductEvent(productIntelligenceEvents.historyExplored);
      }
      if (details.matches("[data-horizon-detail], [data-additional-horizon]")) trackProductEvent(productIntelligenceEvents.horizonOpened);
    };
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-journey-analytics]") : null;
      if (!target) return;
      if (target.dataset.journeyAnalytics === "waypoint") trackProductEvent(productIntelligenceEvents.waypointClicked, { source: target.dataset.journeySource ?? "journey" });
      if (target.dataset.journeyAnalytics === "application-management") trackProductEvent(productIntelligenceEvents.applicationManagementOpened);
    };
    document.addEventListener("toggle", toggle, true);
    document.addEventListener("click", click);
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      document.removeEventListener("toggle", toggle, true);
      document.removeEventListener("click", click);
    };
  }, [serverProjectionMs, state]);
  return null;
}
