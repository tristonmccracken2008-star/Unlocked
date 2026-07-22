import { forwardRef } from "react";
import { BrandMarkArtwork } from "@/components/brand-mark";
import { journeyCardLayouts, type JourneyCardData, type JourneyCardLayout, type JourneyCardPrivacy } from "@/lib/journey-timeline";

type JourneyCardArtworkProps = {
  card: JourneyCardData;
  layout: JourneyCardLayout;
  privacy: JourneyCardPrivacy;
  theme: "light" | "dark";
};

type Composition = {
  margin: number;
  brandY: number;
  identityY: number;
  headlineY: number;
  headlineSize: number;
  headlineWidth: number;
  statsY: number;
  statsColumns: number;
  statsGap: number;
  momentsY: number;
  momentGap: number;
  footerY: number;
};

const compositions: Record<JourneyCardLayout, Composition> = {
  story: { margin: 82, brandY: 78, identityY: 212, headlineY: 365, headlineSize: 78, headlineWidth: 880, statsY: 760, statsColumns: 3, statsGap: 228, momentsY: 1160, momentGap: 132, footerY: 1810 },
  square: { margin: 66, brandY: 60, identityY: 150, headlineY: 262, headlineSize: 56, headlineWidth: 900, statsY: 520, statsColumns: 4, statsGap: 220, momentsY: 730, momentGap: 88, footerY: 1010 },
  linkedin: { margin: 58, brandY: 50, identityY: 128, headlineY: 220, headlineSize: 48, headlineWidth: 650, statsY: 410, statsColumns: 4, statsGap: 154, momentsY: 192, momentGap: 82, footerY: 575 },
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

function displayName(card: JourneyCardData, mode: JourneyCardPrivacy["nameMode"]) {
  if (mode === "full_name") return card.identity.fullName;
  if (mode === "first_name") return card.identity.firstName;
  return "Anonymous";
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

export function journeyCardAltDescription(card: JourneyCardData, privacy: JourneyCardPrivacy) {
  const name = displayName(card, privacy.nameMode);
  const stats = card.stats.map((stat) => `${stat.value} ${stat.label.toLowerCase()}`).join(", ");
  return `UnlockED Journey Card for ${name}. ${card.headline}${stats ? ` Progress shown: ${stats}.` : ""}`;
}

export const JourneyCardArtwork = forwardRef<SVGSVGElement, JourneyCardArtworkProps>(function JourneyCardArtwork({ card, layout, privacy, theme }, ref) {
  const dimensions = journeyCardLayouts[layout];
  const c = compositions[layout];
  const dark = theme === "dark";
  const canvas = dark ? "#0b3b2d" : "#f6f0e6";
  const panel = dark ? "#124b39" : "#fffdf8";
  const primary = dark ? "#fffaf2" : "#2b211a";
  const secondary = dark ? "#d6e3dc" : "#655c55";
  const muted = dark ? "#a8c0b4" : "#847d75";
  const line = dark ? "#ffffff2e" : "#2b211a24";
  const accent = dark ? "#d6bd79" : "#1f5f43";
  const headlineLines = wrapText(card.headline, layout === "story" ? 24 : layout === "square" ? 32 : 27, layout === "linkedin" ? 3 : 4);
  const shownStats = card.stats.slice(0, layout === "story" ? 6 : 4);
  const shownHighlights = card.highlights.slice(-(layout === "linkedin" ? 3 : layout === "square" ? 3 : 4));
  const momentsX = layout === "linkedin" ? 785 : c.margin;
  const momentsWidth = layout === "linkedin" ? 340 : dimensions.width - c.margin * 2;
  const identity = [displayName(card, privacy.nameMode), privacy.includeSchool ? card.identity.school : ""].filter(Boolean).join("  ·  ");
  const period = privacy.includeDates ? card.dateRange : "My Journey";
  const periodTitle = card.periodTitle?.toUpperCase() || "MY JOURNEY";

  return <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={dimensions.width} height={dimensions.height} viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} aria-hidden="true" focusable="false" data-journey-card-artwork="" data-journey-card-layout={layout} data-export-theme={theme}>
    <rect width={dimensions.width} height={dimensions.height} fill={canvas} />
    <rect x={layout === "story" ? 34 : 28} y={layout === "story" ? 34 : 28} width={dimensions.width - (layout === "story" ? 68 : 56)} height={dimensions.height - (layout === "story" ? 68 : 56)} rx={layout === "story" ? 38 : 28} fill="none" stroke={line} strokeWidth="2" />

    <BrandMarkArtwork x={c.margin} y={c.brandY} size={layout === "story" ? 48 : 38} tone={dark ? "inverse" : "default"} />
    <text x={c.margin + (layout === "story" ? 62 : 50)} y={c.brandY + (layout === "story" ? 34 : 28)} fill={primary} fontFamily="Georgia, 'Times New Roman', serif" fontSize={layout === "story" ? 29 : 22} fontWeight="700">UnlockED</text>
    <text x={dimensions.width - c.margin} y={c.brandY + (layout === "story" ? 32 : 27)} textAnchor="end" fill={accent} fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 17 : 13} fontWeight="700" letterSpacing={layout === "story" ? 3.2 : 2.4}>{periodTitle}</text>
    <line x1={c.margin} y1={c.brandY + (layout === "story" ? 76 : 58)} x2={dimensions.width - c.margin} y2={c.brandY + (layout === "story" ? 76 : 58)} stroke={line} strokeWidth="2" />

    <text x={c.margin} y={c.identityY} fill={secondary} fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 22 : 16} fontWeight="600">{identity}</text>
    <text x={dimensions.width - c.margin} y={c.identityY} textAnchor="end" fill={muted} fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 20 : 15}>{period}</text>

    <text x={c.margin} y={c.headlineY} fill={primary} fontFamily="Georgia, 'Times New Roman', serif" fontSize={c.headlineSize} fontWeight="700">
      {headlineLines.map((lineText, index) => <tspan key={`${index}-${lineText}`} x={c.margin} dy={index ? c.headlineSize * 1.08 : 0}>{lineText}</tspan>)}
    </text>

    <g transform={`translate(${c.margin} ${c.statsY})`}>
      {shownStats.map((stat, index) => {
        const column = index % c.statsColumns;
        const row = Math.floor(index / c.statsColumns);
        const rowHeight = layout === "story" ? 150 : 102;
        return <g key={stat.id} transform={`translate(${column * c.statsGap} ${row * rowHeight})`}>
          <text x="0" y="0" fill={accent} fontFamily="Georgia, 'Times New Roman', serif" fontSize={layout === "story" ? 54 : 36} fontWeight="700">{stat.value}</text>
          <text x="0" y={layout === "story" ? 34 : 25} fill={secondary} fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 16 : 12} fontWeight="700" letterSpacing="1.5">{stat.label.toUpperCase()}</text>
        </g>;
      })}
    </g>

    {layout !== "linkedin" ? <line x1={c.margin} y1={c.momentsY - 76} x2={dimensions.width - c.margin} y2={c.momentsY - 76} stroke={line} strokeWidth="2" /> : null}
    <g transform={`translate(${momentsX} ${c.momentsY})`}>
      <text x="0" y="-38" fill={accent} fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 16 : 12} fontWeight="700" letterSpacing="2.2">MOMENTS</text>
      {shownHighlights.map((moment, index) => {
        const lines = wrapText(moment.title, layout === "linkedin" ? 31 : layout === "story" ? 54 : 50, 2);
        return <g key={moment.id} transform={`translate(0 ${index * c.momentGap})`}>
          <circle cx="6" cy="-5" r={layout === "story" ? 7 : 5} fill={index === shownHighlights.length - 1 ? "#b48a45" : accent} />
          <line x1="6" y1={layout === "story" ? 14 : 10} x2="6" y2={c.momentGap - 24} stroke={index === shownHighlights.length - 1 ? "transparent" : line} strokeWidth="2" />
          <text x={layout === "story" ? 34 : 25} y="0" fill={primary} fontFamily="Georgia, 'Times New Roman', serif" fontSize={layout === "story" ? 27 : layout === "square" ? 20 : 16} fontWeight="700">
            {lines.map((lineText, lineIndex) => <tspan key={`${lineIndex}-${lineText}`} x={layout === "story" ? 34 : 25} dy={lineIndex ? (layout === "story" ? 32 : 23) : 0}>{lineText}</tspan>)}
          </text>
          <text x={momentsWidth} y="0" textAnchor="end" fill={muted} fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 16 : 12}>{privacy.includeDates ? shortDate(moment.date) : moment.label}</text>
          {moment.organization ? <text x={layout === "story" ? 34 : 25} y={layout === "story" ? 54 : 38} fill={muted} fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 15 : 11} fontWeight="600">{wrapText(moment.organization, 28, 1)[0]}</text> : null}
        </g>;
      })}
    </g>

    <line x1={c.margin} y1={c.footerY - (layout === "story" ? 60 : 42)} x2={dimensions.width - c.margin} y2={c.footerY - (layout === "story" ? 60 : 42)} stroke={line} strokeWidth="2" />
    <text x={c.margin} y={c.footerY} fill={secondary} fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 18 : 14} fontWeight="600">Built with UnlockED</text>
    <text x={dimensions.width - c.margin} y={c.footerY} textAnchor="end" fill={accent} fontFamily="Arial, Helvetica, sans-serif" fontSize={layout === "story" ? 18 : 14} fontWeight="700">unlockededu.com</text>
  </svg>;
});
