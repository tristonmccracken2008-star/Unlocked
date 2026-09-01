export const motionDuration = {
  instant: 80,
  fast: 140,
  standard: 220,
  deliberate: 320,
} as const;

export const motionEasing = {
  standard: "cubic-bezier(.2, .7, .2, 1)",
  emphasized: "cubic-bezier(.16, 1, .3, 1)",
} as const;

export function motionIsReduced() {
  if (typeof window === "undefined") return true;
  return (
    document.documentElement.dataset.motion === "reduce" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
