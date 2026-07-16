import { forwardRef } from "react";
import { openLineAperturePath } from "@/components/open-line/open-line-marker-primitives";
import { OpenLineRenderer } from "@/components/open-line/open-line-renderer";
import {
  semesterStoryLayouts,
  type SemesterStory,
  type SemesterStoryCollection,
  type SemesterStoryLayout,
  type SemesterStoryPrivacy,
} from "@/lib/semester-story";

type SemesterStoryArtworkProps = {
  story: SemesterStory;
  layout: SemesterStoryLayout;
  privacy: SemesterStoryPrivacy;
  identity: SemesterStoryCollection["identity"];
};

type Composition = {
  margin: number;
  headingY: number;
  headingWidth: number;
  headingSize: number;
  headingLineHeight: number;
  path: { x: number; y: number; width: number; height: number };
  moments: { x: number; y: number; width: number; gap: number };
  footerY: number;
};

const compositions: Record<SemesterStoryLayout, Composition> = {
  story: {
    margin: 86,
    headingY: 330,
    headingWidth: 830,
    headingSize: 66,
    headingLineHeight: 78,
    path: { x: 390, y: 690, width: 600, height: 690 },
    moments: { x: 86, y: 1450, width: 860, gap: 118 },
    footerY: 1810,
  },
  square: {
    margin: 66,
    headingY: 235,
    headingWidth: 800,
    headingSize: 48,
    headingLineHeight: 57,
    path: { x: 570, y: 335, width: 430, height: 425 },
    moments: { x: 66, y: 755, width: 900, gap: 88 },
    footerY: 1010,
  },
  linkedin: {
    margin: 58,
    headingY: 180,
    headingWidth: 650,
    headingSize: 42,
    headingLineHeight: 49,
    path: { x: 760, y: 76, width: 390, height: 420 },
    moments: { x: 58, y: 405, width: 650, gap: 68 },
    footerY: 570,
  },
};

function wrapText(value: string, approximateCharacters: number, maxLines: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= approximateCharacters || !current || lines.length === maxLines - 1) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function identityText(privacy: SemesterStoryPrivacy, identity: SemesterStoryCollection["identity"]) {
  const name = privacy.nameMode === "first_name" ? identity.firstName : privacy.nameMode === "full_name" ? identity.fullName : "";
  return [name, privacy.includeSchool ? identity.school : "", privacy.includeMajor ? identity.major : ""].filter(Boolean).join("  ·  ");
}

function contextText(story: SemesterStory, privacy: SemesterStoryPrivacy) {
  const moment = story.moments.at(-1);
  return [
    privacy.includeOpportunity ? moment?.opportunity : "",
    privacy.includeOrganization ? moment?.organization : "",
    privacy.includeDate && moment ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(moment.occurredAt)) : "",
  ].filter(Boolean).join("  ·  ");
}

export function semesterStoryAltDescription(story: SemesterStory, privacy: SemesterStoryPrivacy, identity: SemesterStoryCollection["identity"]) {
  const details = [identityText(privacy, identity), privacy.includeTerm ? story.term.label : "", contextText(story, privacy)].filter(Boolean);
  return `${story.altDescription}${details.length ? ` Shared details: ${details.join(", ")}.` : " Shared anonymously."}`;
}

export const SemesterStoryArtwork = forwardRef<SVGSVGElement, SemesterStoryArtworkProps>(function SemesterStoryArtwork({ story, layout, privacy, identity }, ref) {
  const dimensions = semesterStoryLayouts[layout];
  const composition = compositions[layout];
  const headingLines = wrapText(story.opening, layout === "linkedin" ? 38 : layout === "story" ? 26 : 34, layout === "linkedin" ? 3 : 4);
  const visibleMoments = story.moments.slice(-1 * (layout === "linkedin" ? 2 : 3));
  const identityLine = identityText(privacy, identity);
  const contextLine = contextText(story, privacy);
  const termLine = privacy.includeTerm ? (story.state === "active" ? `${story.term.label} so far` : story.term.label) : "Semester Story";

  return <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width={dimensions.width}
    height={dimensions.height}
    viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
    aria-hidden="true"
    focusable="false"
    data-semester-story-artwork=""
    data-semester-story-layout={layout}
  >
    <rect width={dimensions.width} height={dimensions.height} fill="#f6f0e6" />
    <g transform={`translate(${composition.margin} ${layout === "story" ? 108 : 70})`}>
      <path d={openLineAperturePath} transform="scale(.72)" fill="none" stroke="#0b3b2d" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <text x="28" y="1" fill="#0b3b2d" fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 24 : 18} fontWeight="700">UnlockED</text>
    </g>
    <text x={composition.margin} y={composition.headingY - (layout === "linkedin" ? 66 : 82)} fill="#1f5f43" fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 20 : 15} fontWeight="700" letterSpacing={layout === "story" ? 3.2 : 2.3}>{termLine.toUpperCase()}</text>
    <text x={composition.margin} y={composition.headingY} fill="#2b211a" fontFamily="Georgia, 'Times New Roman', serif" fontSize={composition.headingSize} fontWeight="700">
      {headingLines.map((line, index) => <tspan key={`${index}-${line}`} x={composition.margin} dy={index ? composition.headingLineHeight : 0}>{line}</tspan>)}
    </text>

    <svg x={composition.path.x} y={composition.path.y} width={composition.path.width} height={composition.path.height} viewBox={`0 0 ${composition.path.width} ${composition.path.height}`} overflow="visible">
      <OpenLineRenderer
        geometry={story.geometry.geometry}
        viewport={story.geometry.viewport}
        theme="light"
        quality="print"
        showLabels={false}
        showWaypoint={false}
        showFuture
        markerStates={{}}
        decorativeMarkers
        clusterDetail="public"
        showClusterCounts={false}
        background="transparent"
        title={`${story.heading} Pathprint`}
        description="The meaningful direction, action, and validation recorded during this academic term."
        idPrefix={`semester-story-${layout}`}
      />
    </svg>

    <g transform={`translate(${composition.moments.x} ${composition.moments.y})`}>
      {visibleMoments.map((moment, index) => <g key={moment.id} transform={`translate(0 ${index * composition.moments.gap})`}>
        <circle cx="7" cy="-5" r="5" fill={moment.evidence === "validation" ? "#a67e34" : "#1f5f43"} />
        <text x="28" y="0" fill="#2b211a" fontFamily="Georgia, 'Times New Roman', serif" fontSize={layout === "story" ? 27 : layout === "square" ? 21 : 17} fontWeight="700">{moment.headline}</text>
        {privacy.includeDate ? <text x="28" y={layout === "story" ? 32 : 25} fill="#71665c" fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 17 : 13}>{new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(moment.occurredAt))}</text> : null}
      </g>)}
    </g>

    {privacy.includeCounts && story.counts.length ? <g transform={`translate(${composition.margin} ${composition.footerY - (layout === "story" ? 128 : 72)})`}>
      {story.counts.map((count, index) => <g key={count.id} transform={`translate(${index * (layout === "story" ? 270 : 205)} 0)`}>
        <text x="0" y="0" fill="#1f5f43" fontFamily="Georgia, 'Times New Roman', serif" fontSize={layout === "story" ? 30 : 22} fontWeight="700">{count.value}</text>
        <text x="0" y={layout === "story" ? 29 : 23} fill="#71665c" fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 15 : 11} fontWeight="700">{count.label.toUpperCase()}</text>
      </g>)}
    </g> : null}

    {identityLine ? <text x={composition.margin} y={composition.footerY - (contextLine ? 34 : 0)} fill="#5f554c" fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 20 : 15} fontWeight="600">{identityLine}</text> : null}
    {contextLine ? <text x={composition.margin} y={composition.footerY} fill="#5f554c" fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 18 : 14} fontWeight="600">{contextLine}</text> : null}
    {privacy.includeProfileLink && identity.profileHref ? <text x={composition.margin} y={composition.footerY + (layout === "story" ? 32 : 22)} fill="#1f5f43" fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 16 : 12}>unlockededu.com{identity.profileHref}</text> : null}
    <g transform={`translate(${dimensions.width - (layout === "story" ? 220 : 184)} ${composition.footerY - 8})`}>
      <path d={openLineAperturePath} transform="scale(.56)" fill="none" stroke="#1f5f43" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <text x="24" y="1" fill="#1f5f43" fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 18 : 14} fontWeight="700">Built with UnlockED</text>
    </g>
  </svg>;
});
