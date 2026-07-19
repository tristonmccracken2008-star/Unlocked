import { forwardRef } from "react";
import { BrandMarkArtwork } from "@/components/brand-mark";
import { OpenLineRenderer } from "@/components/open-line/open-line-renderer";
import type { PathMoment, PathMomentLayout, PathMomentNameMode } from "@/lib/path-moments";
import { pathMomentLayouts } from "@/lib/path-moments";
import { resolveJourneyTheme, type JourneyThemeName } from "@/lib/journey-theme";

export type PathMomentPrivacy = {
  nameMode: PathMomentNameMode;
  includeSchool: boolean;
  includeOrganization: boolean;
  includeOpportunity: boolean;
  includeDate: boolean;
};

type PathMomentArtworkProps = {
  moment: PathMoment;
  layout: PathMomentLayout;
  privacy: PathMomentPrivacy;
  identity: { firstName: string; fullName: string; school?: string };
  theme?: JourneyThemeName;
};

type Composition = {
  brand: { x: number; y: number };
  headline: { x: number; y: number; width: number; fontSize: number; lineHeight: number; maxLines: number };
  explanation: { x: number; width: number; fontSize: number; lineHeight: number; maxLines: number; gap: number };
  path: { x: number; y: number; width: number; height: number };
  footerY: number;
};

const compositions: Record<PathMomentLayout, Composition> = {
  story: {
    brand: { x: 88, y: 112 },
    headline: { x: 88, y: 350, width: 850, fontSize: 76, lineHeight: 87, maxLines: 4 },
    explanation: { x: 88, width: 770, fontSize: 31, lineHeight: 47, maxLines: 3, gap: 60 },
    path: { x: 390, y: 875, width: 620, height: 790 },
    footerY: 1810,
  },
  square: {
    brand: { x: 72, y: 82 },
    headline: { x: 72, y: 238, width: 735, fontSize: 56, lineHeight: 65, maxLines: 3 },
    explanation: { x: 72, width: 570, fontSize: 25, lineHeight: 37, maxLines: 3, gap: 44 },
    path: { x: 525, y: 435, width: 500, height: 490 },
    footerY: 1000,
  },
  linkedin: {
    brand: { x: 62, y: 66 },
    headline: { x: 62, y: 182, width: 690, fontSize: 50, lineHeight: 57, maxLines: 3 },
    explanation: { x: 62, width: 660, fontSize: 21, lineHeight: 31, maxLines: 3, gap: 34 },
    path: { x: 760, y: 38, width: 400, height: 535 },
    footerY: 568,
  },
};

function wrapText(value: string, approximateCharacters: number, maxLines: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= approximateCharacters || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  const consumed = lines.join(" ").split(/\s+/).length;
  if (consumed < words.length && lines.length) lines[lines.length - 1] = `${lines.at(-1)?.replace(/[.,;:]?$/, "")}…`;
  return lines;
}

function nameFor(mode: PathMomentNameMode, identity: PathMomentArtworkProps["identity"]) {
  if (mode === "first_name") return identity.firstName;
  if (mode === "full_name") return identity.fullName;
  return "";
}

function monthYear(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function footerParts(moment: PathMoment, privacy: PathMomentPrivacy, identity: PathMomentArtworkProps["identity"]) {
  return [
    nameFor(privacy.nameMode, identity),
    privacy.includeSchool ? identity.school : "",
    privacy.includeOrganization ? moment.organization : "",
    privacy.includeOpportunity ? moment.opportunity : "",
    privacy.includeDate ? monthYear(moment.occurredAt) : "",
  ].map((item) => item?.trim()).filter(Boolean) as string[];
}

function footerRows(moment: PathMoment, privacy: PathMomentPrivacy, identity: PathMomentArtworkProps["identity"]) {
  const identityRow = [nameFor(privacy.nameMode, identity), privacy.includeSchool ? identity.school : ""].map((item) => item?.trim()).filter(Boolean).join("  ·  ");
  const contextRow = [privacy.includeOrganization ? moment.organization : "", privacy.includeOpportunity ? moment.opportunity : "", privacy.includeDate ? monthYear(moment.occurredAt) : ""].map((item) => item?.trim()).filter(Boolean).join("  ·  ");
  return [identityRow, contextRow].filter(Boolean);
}

export function pathMomentAltDescription(moment: PathMoment, privacy: PathMomentPrivacy, identity: PathMomentArtworkProps["identity"]) {
  const details = footerParts(moment, privacy, identity);
  return `${moment.altDescription}${details.length ? ` Shared details: ${details.join(", ")}.` : " Shared anonymously."}`;
}

export const PathMomentArtwork = forwardRef<SVGSVGElement, PathMomentArtworkProps>(function PathMomentArtwork({ moment, layout, privacy, identity, theme = "light" }, ref) {
  const colors = resolveJourneyTheme(theme);
  const dimensions = pathMomentLayouts[layout];
  const composition = compositions[layout];
  const headlineCharacters = Math.max(14, Math.floor(composition.headline.width / (composition.headline.fontSize * 0.53)));
  const explanationCharacters = Math.max(20, Math.floor(composition.explanation.width / (composition.explanation.fontSize * 0.51)));
  const headlineLines = wrapText(moment.headline, headlineCharacters, composition.headline.maxLines);
  const explanationLines = wrapText(moment.explanation, explanationCharacters, composition.explanation.maxLines);
  const explanationY = composition.headline.y + Math.max(1, headlineLines.length) * composition.headline.lineHeight + composition.explanation.gap;
  const footerLines = footerRows(moment, privacy, identity);
  const momentLabel = moment.type.replaceAll("_", " ").toUpperCase();

  return <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width={dimensions.width}
    height={dimensions.height}
    viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
    aria-hidden="true"
    focusable="false"
    data-path-moment-artwork=""
    data-path-moment-layout={layout}
    data-export-theme={theme}
  >
    <rect width={dimensions.width} height={dimensions.height} fill={colors.canvas} />
    <BrandMarkArtwork x={composition.brand.x} y={composition.brand.y - 22} size={layout === "story" ? 44 : 36} tone={theme === "dark" ? "inverse" : "default"} />
    <text x={composition.brand.x + (layout === "story" ? 56 : 46)} y={composition.brand.y + 2} fill={colors.forestStrong} fontFamily="Georgia, 'Times New Roman', serif" fontSize={layout === "story" ? 25 : 20} fontWeight="700">UnlockED</text>
    <line x1={composition.brand.x} y1={composition.brand.y + 42} x2={composition.brand.x + (layout === "linkedin" ? 92 : 118)} y2={composition.brand.y + 42} stroke={colors.gold} strokeWidth="1.5" />
    <text x={composition.headline.x} y={composition.headline.y - (layout === "linkedin" ? 64 : 74)} fill={colors.forest} fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 19 : 15} fontWeight="700" letterSpacing={layout === "story" ? 3 : 2.4}>{momentLabel}</text>

    <text x={composition.headline.x} y={composition.headline.y} fill={colors.textPrimary} fontFamily="Georgia, 'Times New Roman', serif" fontSize={composition.headline.fontSize} fontWeight="700">
      {headlineLines.map((line, index) => <tspan key={`${index}-${line}`} x={composition.headline.x} dy={index ? composition.headline.lineHeight : 0}>{line}</tspan>)}
    </text>
    <text x={composition.explanation.x} y={explanationY} fill={colors.textSecondary} fontFamily="Arial, Helvetica, sans-serif" fontSize={composition.explanation.fontSize} fontWeight="400">
      {explanationLines.map((line, index) => <tspan key={`${index}-${line}`} x={composition.explanation.x} dy={index ? composition.explanation.lineHeight : 0}>{line}</tspan>)}
    </text>

    <svg x={composition.path.x} y={composition.path.y} width={composition.path.width} height={composition.path.height} viewBox={`0 0 ${composition.path.width} ${composition.path.height}`} overflow="visible">
      <OpenLineRenderer
        geometry={moment.geometry.geometry}
        viewport={moment.geometry.viewport}
        theme={theme}
        quality="print"
        showLabels={false}
        showWaypoint={false}
        showFuture={false}
        markerStates={{ [moment.geometry.markerNodeId]: "selected" }}
        clusterDetail="public"
        showClusterCounts={false}
        background="transparent"
        title="Path Moment"
        description="One meaningful point on the student’s Open Line."
        idPrefix={`path-moment-${layout}`}
      />
    </svg>

    {footerLines.length ? <text x={composition.brand.x} y={composition.footerY} fill={colors.textSecondary} fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 22 : 17} fontWeight="600">
      {footerLines.map((line, index) => <tspan key={`${index}-${line}`} x={composition.brand.x} dy={index ? (layout === "story" ? 29 : 22) : 0}>{line}</tspan>)}
    </text> : null}
    <g transform={`translate(${dimensions.width - (layout === "story" ? 220 : 186)} ${composition.footerY - 8})`}>
      <BrandMarkArtwork x={0} y={-13} size={layout === "story" ? 24 : 20} tone={theme === "dark" ? "inverse" : "default"} />
      <text x="30" y="1" fill={colors.forest} fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 18 : 15} fontWeight="700">Built with UnlockED</text>
    </g>
  </svg>;
});
