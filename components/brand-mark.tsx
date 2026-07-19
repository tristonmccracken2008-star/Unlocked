import type { SVGProps } from "react";

export const unlockedBrandPaths = {
  frame: "M9 8h18v19.5C27 33 23.5 36 18 36S9 33 9 27.5V8Z",
  opening: "M27 8h7v7",
  letter: "M17 14v13c0 2.1 1.2 3.2 3 3.2s3-1.1 3-3.2V14",
  accent: "M27 8 20 15",
} as const;

type BrandMarkProps = SVGProps<SVGSVGElement> & {
  tone?: "default" | "inverse";
};

export function BrandMark({ className = "", tone = "default", ...props }: BrandMarkProps) {
  const frame = tone === "inverse" ? "#f6f0e6" : "#1f5f43";
  const ink = tone === "inverse" ? "#ffffff" : "#2b211a";
  return <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" className={className} data-unlocked-brand-mark="" {...props}>
    <path d={unlockedBrandPaths.frame} fill="none" stroke={frame} strokeWidth="3" strokeLinejoin="round" />
    <path d={unlockedBrandPaths.opening} fill="none" stroke={ink} strokeWidth="3" strokeLinecap="square" />
    <path d={unlockedBrandPaths.letter} fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
    <path d={unlockedBrandPaths.accent} fill="none" stroke="#b48a45" strokeWidth="2.4" strokeLinecap="round" />
  </svg>;
}

export function BrandMarkArtwork({ x, y, size, tone = "default" }: { x: number; y: number; size: number; tone?: "default" | "inverse" }) {
  const scale = size / 40;
  const frame = tone === "inverse" ? "#f6f0e6" : "#1f5f43";
  const ink = tone === "inverse" ? "#ffffff" : "#2b211a";
  return <g transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden="true" data-unlocked-brand-mark="">
    <path d={unlockedBrandPaths.frame} fill="none" stroke={frame} strokeWidth="3" strokeLinejoin="round" />
    <path d={unlockedBrandPaths.opening} fill="none" stroke={ink} strokeWidth="3" strokeLinecap="square" />
    <path d={unlockedBrandPaths.letter} fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
    <path d={unlockedBrandPaths.accent} fill="none" stroke="#b48a45" strokeWidth="2.4" strokeLinecap="round" />
  </g>;
}
