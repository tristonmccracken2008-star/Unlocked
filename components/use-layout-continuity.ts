"use client";

import { useLayoutEffect, useRef } from "react";
import { motionDuration, motionEasing, motionIsReduced } from "@/lib/motion-system";

type MotionElement = HTMLElement & { dataset: DOMStringMap & { motionKey?: string } };

/**
 * Adds bounded FLIP continuity to a small, keyed list without owning its state.
 * The list remains normal DOM, server markup stays unchanged, and reduced-motion
 * users receive the final layout immediately.
 */
export function useLayoutContinuity<T extends HTMLElement>(changeKey: string) {
  const containerRef = useRef<T | null>(null);
  const previousRects = useRef(new Map<string, DOMRect>());
  const hasMeasured = useRef(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const elements = [...container.querySelectorAll<MotionElement>("[data-motion-key]")];
    const nextRects = new Map<string, DOMRect>();
    for (const element of elements) {
      const key = element.dataset.motionKey;
      if (!key) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width && rect.height) nextRects.set(key, rect);
    }

    if (hasMeasured.current && !motionIsReduced()) {
      for (const element of elements) {
        const key = element.dataset.motionKey;
        if (!key) continue;
        const next = nextRects.get(key);
        const previous = previousRects.current.get(key);
        if (!next) continue;

        if (previous) {
          const x = previous.left - next.left;
          const y = previous.top - next.top;
          if (Math.abs(x) > 0.5 || Math.abs(y) > 0.5) {
            element.animate(
              [
                { transform: `translate3d(${x}px, ${y}px, 0)` },
                { transform: "translate3d(0, 0, 0)" },
              ],
              {
                duration: motionDuration.standard,
                easing: motionEasing.emphasized,
              },
            );
          }
        } else {
          element.animate(
            [
              { opacity: 0, transform: "translate3d(0, 4px, 0)" },
              { opacity: 1, transform: "translate3d(0, 0, 0)" },
            ],
            {
              duration: motionDuration.fast,
              easing: motionEasing.standard,
            },
          );
        }
      }
    }

    previousRects.current = nextRects;
    hasMeasured.current = true;
  }, [changeKey]);

  return containerRef;
}
