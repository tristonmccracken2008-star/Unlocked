import type { ImgHTMLAttributes } from "react";
import { UNLOCKED_MARK_HEIGHT, UNLOCKED_MARK_SRC, UNLOCKED_MARK_WIDTH } from "@/data/brand-assets";

type BrandMarkProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt" | "height" | "src" | "width"> & {
  tone?: "default" | "inverse";
  width?: number | string;
  height?: number | string;
};

export function BrandMark({ className = "", tone = "default", width = UNLOCKED_MARK_WIDTH, height = UNLOCKED_MARK_HEIGHT, style, ...props }: BrandMarkProps) {
  return <img
    src={UNLOCKED_MARK_SRC}
    alt=""
    aria-hidden="true"
    width={width}
    height={height}
    className={className}
    data-unlocked-brand-mark=""
    data-brand-tone={tone}
    style={tone === "inverse"
      ? { background: "#f6f0e6", borderRadius: 4, boxSizing: "border-box", objectFit: "contain", padding: 3, ...style }
      : style}
    {...props}
  />;
}

export function BrandMarkArtwork({ x, y, size, tone = "default" }: { x: number; y: number; size: number; tone?: "default" | "inverse" }) {
  const inset = tone === "inverse" ? Math.max(2, size * 0.08) : 0;
  return <g aria-hidden="true" data-brand-lockup-tone={tone}>
    {tone === "inverse" ? <rect x={x} y={y} width={size} height={size} rx={size * 0.12} fill="#f6f0e6" /> : null}
    <image
      href={UNLOCKED_MARK_SRC}
      x={x + inset}
      y={y + inset}
      width={size - inset * 2}
      height={size - inset * 2}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      data-unlocked-brand-mark=""
      data-brand-tone={tone}
    />
  </g>;
}
