import { openLineMarkerSizes, type OpenLineMarkerSize } from "./open-line-marker-tokens";

export const openLineAperturePath = "M-10.5-12v13.5C-10.5 9-6 13 0 13S10.5 9 10.5 1.5V-12M10.5-12H14v3.5";

type MarkerApertureProps = {
  size: number | OpenLineMarkerSize;
  stroke: string;
  strokeWidth: number;
  fill?: string;
  dashed?: boolean;
  apertureHref?: string;
  className?: string;
};

function visibleSize(size: number | OpenLineMarkerSize) {
  return typeof size === "number" ? size : openLineMarkerSizes[size];
}

export function MarkerAperture({ size, stroke, strokeWidth, fill = "none", dashed = false, apertureHref, className = "marker-aperture" }: MarkerApertureProps) {
  const pixels = visibleSize(size);
  const scale = pixels / 32;
  const normalizedStroke = strokeWidth / scale;
  const shared = {
    fill,
    stroke,
    strokeWidth: normalizedStroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeDasharray: dashed ? `${3 / scale} ${3 / scale}` : undefined,
  };
  return <g className={className} data-marker-aperture="" transform={`scale(${scale})`}>
    {apertureHref ? <use href={apertureHref} {...shared} /> : <path d={openLineAperturePath} {...shared} />}
  </g>;
}

export function MarkerCenter({ radius, fill, stroke, strokeWidth = 0 }: { radius: number; fill: string; stroke?: string; strokeWidth?: number }) {
  return <circle className="marker-center" data-marker-center="" cx="0" cy="0" r={radius} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
}

export function ValidationRing({ stroke, strokeWidth, apertureHref }: { stroke: string; strokeWidth: number; apertureHref?: string }) {
  return <MarkerAperture size="validation" stroke={stroke} strokeWidth={strokeWidth} apertureHref={apertureHref} className="marker-validation-ring" />;
}

export function MarkerVisibleBounds({ size }: { size: number }) {
  return <rect data-marker-visible-bounds="" x={-size / 2} y={-size / 2} width={size} height={size} fill="none" opacity="0" pointerEvents="none" aria-hidden="true" />;
}
