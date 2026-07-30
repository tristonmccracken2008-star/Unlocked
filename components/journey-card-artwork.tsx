import { forwardRef } from "react";
import { BrandMarkArtwork } from "@/components/brand-mark";
import {
  journeyCardLayouts,
  journeyCardTemplateLabels,
  type JourneyCardAchievement,
  type JourneyCardData,
  type JourneyCardLayout,
  type JourneyCardPrivacy,
  type JourneyCardTemplate,
  type JourneyCardTheme,
} from "@/lib/journey-timeline";

type JourneyCardArtworkProps = {
  card: JourneyCardData;
  achievement: JourneyCardAchievement;
  layout: JourneyCardLayout;
  privacy: JourneyCardPrivacy;
  template: JourneyCardTemplate;
  theme: JourneyCardTheme;
};

type Palette = {
  canvas: string;
  surface: string;
  primary: string;
  secondary: string;
  muted: string;
  accent: string;
  line: string;
  markSurface: string;
};

const palettes: Record<JourneyCardTheme, Palette> = {
  cream: {
    canvas: "#f7f1e7",
    surface: "#fffdf8",
    primary: "#2b211a",
    secondary: "#655c55",
    muted: "#847d75",
    accent: "#0f6245",
    line: "#2b211a24",
    markSurface: "#f3eadc",
  },
  forest: {
    canvas: "#073b2c",
    surface: "#0d4937",
    primary: "#fffaf2",
    secondary: "#dce8e1",
    muted: "#aac4b7",
    accent: "#e0bf70",
    line: "#ffffff2e",
    markSurface: "#f7f1e7",
  },
  midnight: {
    canvas: "#0e2234",
    surface: "#152f47",
    primary: "#fffaf2",
    secondary: "#d8e4ec",
    muted: "#9fb4c4",
    accent: "#d9b765",
    line: "#ffffff29",
    markSurface: "#f7f1e7",
  },
  ivory_gold: {
    canvas: "#fbf7ee",
    surface: "#fffdf8",
    primary: "#30261d",
    secondary: "#6f6255",
    muted: "#8c8175",
    accent: "#a87522",
    line: "#8f6a2b30",
    markSurface: "#f4ead5",
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
  const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (consumed < words.length && lines.length) lines[lines.length - 1] = `${lines.at(-1)?.replace(/[.,;:]?$/, "")}...`;
  return lines;
}

function displayName(card: JourneyCardData, mode: JourneyCardPrivacy["nameMode"]) {
  if (mode === "full_name") return card.identity.fullName;
  if (mode === "first_name") return card.identity.firstName;
  return "Anonymous";
}

function fullDate(value: string | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function templateEyebrow(template: JourneyCardTemplate, achievement: JourneyCardAchievement) {
  if (template === "acceptance") return "Accepted";
  if (template === "internship") return achievement.season ?? "Internship";
  if (template === "scholarship") return "Scholarship awarded";
  if (template === "research") return "Research";
  if (template === "offer") return "Offer received";
  if (template === "completion") return "Completed";
  return "Year in Review";
}

function templateTitle(template: JourneyCardTemplate, achievement: JourneyCardAchievement, privacy: JourneyCardPrivacy) {
  if (template === "internship" || template === "offer") return privacy.includeOrganization !== false && achievement.organization
    ? achievement.organization
    : achievement.title;
  if (template === "scholarship" && privacy.includeAwardAmount !== false && achievement.awardAmount) return achievement.awardAmount;
  return achievement.title;
}

function templateSubtitle(template: JourneyCardTemplate, achievement: JourneyCardAchievement, privacy: JourneyCardPrivacy) {
  if ((template === "internship" || template === "offer") && templateTitle(template, achievement, privacy) !== achievement.title) return achievement.title;
  if (template === "scholarship" && templateTitle(template, achievement, privacy) !== achievement.title) return achievement.title;
  if (template === "research" && achievement.field) return achievement.field;
  if (template === "completion" && privacy.includeOrganization !== false) return achievement.organization;
  return undefined;
}

function cardDetails(card: JourneyCardData, achievement: JourneyCardAchievement, privacy: JourneyCardPrivacy) {
  const details: Array<{ label: string; value: string }> = [];
  if (privacy.includeSchool && card.identity.school) details.push({ label: "School", value: card.identity.school });
  if (privacy.includeDates && achievement.occurredAt) details.push({ label: "Date", value: fullDate(achievement.occurredAt) });
  if (privacy.includeRole !== false && achievement.role) details.push({ label: "Role", value: achievement.role });
  if (privacy.includeOrganization !== false && achievement.organization) details.push({ label: "Organization", value: achievement.organization });
  if (privacy.includeLocation !== false && achievement.location) details.push({ label: "Location", value: achievement.location });
  if (privacy.includeAwardAmount !== false && achievement.awardAmount) details.push({ label: "Award", value: achievement.awardAmount });
  return details;
}

function BackgroundMotif({ template, palette, width, height }: { template: JourneyCardTemplate; palette: Palette; width: number; height: number }) {
  const stroke = palette.accent;
  const opacity = 0.12;
  if (template === "research") return <g opacity={opacity} fill="none" stroke={stroke} strokeWidth="3">
    {[0, 1, 2, 3].map((row) => [0, 1, 2, 3, 4].map((column) => {
      const x = width * 0.58 + column * 90 + (row % 2) * 45;
      const y = height * 0.22 + row * 90;
      return <g key={`${row}-${column}`}><circle cx={x} cy={y} r="10"/>{column < 4 ? <line x1={x + 10} y1={y} x2={x + 80} y2={y + (row % 2 ? -42 : 42)}/> : null}</g>;
    }))}</g>;
  if (template === "scholarship") return <g opacity={opacity} fill="none" stroke={stroke} strokeWidth="3">
    {[0, 1, 2, 3].map((index) => <circle key={index} cx={width - 125 - index * 42} cy={170 + index * 64} r={58 + index * 14}/>)}
  </g>;
  if (template === "year_review") return <g opacity={opacity} fill="none" stroke={stroke} strokeWidth="3">
    <path d={`M ${width * .56} ${height * .34} L ${width * .66} ${height * .27} L ${width * .75} ${height * .32} L ${width * .84} ${height * .2} L ${width * .92} ${height * .14}`}/>
    {[.56, .66, .75, .84, .92].map((x, index) => <circle key={x} cx={width * x} cy={[.34, .27, .32, .2, .14][index] * height} r="8" fill={palette.canvas}/>)}
  </g>;
  if (template === "acceptance" || template === "completion") return <g opacity={opacity} fill="none" stroke={stroke} strokeWidth="3">
    <path d={`M ${width * .6} ${height * .42} Q ${width * .72} ${height * .16} ${width * .92} ${height * .3}`}/>
    <path d={`M ${width * .61} ${height * .45} Q ${width * .75} ${height * .23} ${width * .94} ${height * .37}`}/>
    {[.67, .77, .87].map((x, index) => <path key={x} d={`M ${width * x} ${height * (.23 + index * .02)} l 8 18 18 8 -18 8 -8 18 -8 -18 -18 -8 18 -8z`}/>)}
  </g>;
  return <g opacity={opacity} fill="none" stroke={stroke} strokeWidth="3">
    {[0, 1, 2, 3, 4].map((index) => <line key={index} x1={width * .6 + index * 54} y1={height * .12} x2={width * .82 + index * 54} y2={height * .45}/>)}
  </g>;
}

function OrganizationMark({ achievement, palette, x, y, size, visible }: { achievement: JourneyCardAchievement; palette: Palette; x: number; y: number; size: number; visible: boolean }) {
  if (!visible || !achievement.organizationMark) return null;
  const mark = achievement.organizationMark;
  return <g aria-hidden="true">
    <rect x={x} y={y} width={size} height={size} rx={size * .24} fill={palette.markSurface} stroke={palette.line} strokeWidth="2"/>
    {mark.src ? <image
      href={mark.src}
      x={x + size * .16}
      y={y + size * .16}
      width={size * .68}
      height={size * .68}
      preserveAspectRatio="xMidYMid meet"
      data-export-asset=""
    /> : <text x={x + size / 2} y={y + size * .62} textAnchor="middle" fill="#0f6245" fontFamily="Arial, Helvetica, sans-serif" fontSize={size * .29} fontWeight="800">{mark.initials.slice(0, 3)}</text>}
  </g>;
}

function BrandFooter({ palette, privacy, width, y, margin, size }: { palette: Palette; privacy: JourneyCardPrivacy; width: number; y: number; margin: number; size: number }) {
  if (privacy.includeBranding === false) return null;
  return <g aria-hidden="true">
    <BrandMarkArtwork x={margin} y={y - size * .74} size={size} tone={palette.primary === "#fffaf2" ? "inverse" : "default"} />
    <text x={margin + size + 16} y={y} fill={palette.primary} fontFamily="Georgia, 'Times New Roman', serif" fontSize={size * .62} fontWeight="700">UnlockED</text>
    <text x={width - margin} y={y} textAnchor="end" fill={palette.muted} fontFamily="Arial, Helvetica, sans-serif" fontSize={size * .34} fontWeight="700" letterSpacing="2">JOURNEY CARD</text>
  </g>;
}

function DetailGrid({ details, palette, x, y, width, columns, fontSize }: { details: Array<{ label: string; value: string }>; palette: Palette; x: number; y: number; width: number; columns: number; fontSize: number }) {
  if (!details.length) return null;
  const visible = details.slice(0, columns * 2);
  const columnWidth = width / columns;
  const rowHeight = fontSize * 5;
  return <g>
    {visible.map((detail, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const itemX = x + column * columnWidth;
      const itemY = y + row * rowHeight;
      return <g key={`${detail.label}-${index}`}>
        <text x={itemX} y={itemY} fill={palette.muted} fontFamily="Arial, Helvetica, sans-serif" fontSize={fontSize * .68} fontWeight="800" letterSpacing="1.7">{detail.label.toUpperCase()}</text>
        <text x={itemX} y={itemY + fontSize * 1.55} fill={palette.primary} fontFamily="Arial, Helvetica, sans-serif" fontSize={fontSize} fontWeight="650">
          {wrapText(detail.value, Math.max(11, Math.floor(columnWidth / (fontSize * .58))), 2).map((line, lineIndex) => <tspan key={`${lineIndex}-${line}`} x={itemX} dy={lineIndex ? fontSize * 1.18 : 0}>{line}</tspan>)}
        </text>
      </g>;
    })}
  </g>;
}

function YearReview({ card, achievement, palette, layout, privacy }: { card: JourneyCardData; achievement: JourneyCardAchievement; palette: Palette; layout: JourneyCardLayout; privacy: JourneyCardPrivacy }) {
  const dimensions = journeyCardLayouts[layout];
  const landscape = layout === "linkedin";
  const margin = landscape ? 68 : layout === "story" ? 90 : 72;
  const year = achievement.title.match(/\b20\d{2}\b/)?.[0] ?? card.dateRange;
  const stats = card.stats.filter((stat) => stat.value > 0).slice(0, landscape ? 5 : 6);
  const startY = landscape ? 252 : layout === "story" ? 720 : 465;
  const columns = landscape ? Math.max(1, stats.length) : 3;
  const columnWidth = (dimensions.width - margin * 2) / columns;
  return <g>
    <text x={margin} y={landscape ? 174 : layout === "story" ? 390 : 270} fill={palette.accent} fontFamily="Arial, Helvetica, sans-serif" fontSize={landscape ? 17 : 20} fontWeight="800" letterSpacing="4">YEAR IN REVIEW</text>
    <text x={margin} y={landscape ? 238 : layout === "story" ? 500 : 350} fill={palette.primary} fontFamily="Georgia, 'Times New Roman', serif" fontSize={landscape ? 76 : layout === "story" ? 128 : 92} fontWeight="700">{year}</text>
    {stats.map((stat, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = margin + column * columnWidth;
      const y = startY + row * (layout === "story" ? 190 : 120);
      return <g key={stat.id}>
        <text x={x} y={y} fill={palette.accent} fontFamily="Georgia, 'Times New Roman', serif" fontSize={landscape ? 48 : layout === "story" ? 70 : 50} fontWeight="700">{stat.value}</text>
        <text x={x} y={y + (landscape ? 30 : 38)} fill={palette.secondary} fontFamily="Arial, Helvetica, sans-serif" fontSize={landscape ? 13 : 15} fontWeight="800" letterSpacing="1.5">{stat.label.toUpperCase()}</text>
      </g>;
    })}
    <text x={margin} y={landscape ? 480 : layout === "story" ? 1460 : 850} fill={palette.secondary} fontFamily="Arial, Helvetica, sans-serif" fontSize={landscape ? 18 : 22} fontWeight="650">{displayName(card, privacy.nameMode)}{privacy.includeSchool && card.identity.school ? `  ·  ${card.identity.school}` : ""}</text>
  </g>;
}

function AchievementArtwork({ card, achievement, template, palette, layout, privacy }: { card: JourneyCardData; achievement: JourneyCardAchievement; template: JourneyCardTemplate; palette: Palette; layout: JourneyCardLayout; privacy: JourneyCardPrivacy }) {
  const dimensions = journeyCardLayouts[layout];
  const landscape = layout === "linkedin";
  const margin = landscape ? 66 : layout === "story" ? 88 : 70;
  const contentWidth = landscape ? 620 : dimensions.width - margin * 2;
  const headline = templateTitle(template, achievement, privacy);
  const subtitle = templateSubtitle(template, achievement, privacy);
  const headlineSize = landscape ? (headline.length > 32 ? 52 : 62) : layout === "story" ? (headline.length > 42 ? 74 : 92) : (headline.length > 38 ? 58 : 70);
  const titleY = landscape ? 245 : layout === "story" ? 610 : 390;
  const titleCharacters = landscape ? 22 : layout === "story" ? 22 : 26;
  const titleLines = wrapText(headline, titleCharacters, landscape ? 3 : 4);
  const lineHeight = headlineSize * 1.02;
  const detailY = landscape ? 185 : layout === "story" ? 1260 : 760;
  const detailX = landscape ? 790 : margin;
  const detailWidth = landscape ? 340 : dimensions.width - margin * 2;
  const details = cardDetails(card, achievement, privacy);
  const visibleOrganization = privacy.includeOrganization !== false;
  return <g>
    <text x={margin} y={landscape ? 150 : layout === "story" ? 360 : 235} fill={palette.accent} fontFamily="Arial, Helvetica, sans-serif" fontSize={landscape ? 16 : 18} fontWeight="800" letterSpacing="4">{templateEyebrow(template, achievement).toUpperCase()}</text>
    <text x={margin} y={titleY} fill={palette.primary} fontFamily="Georgia, 'Times New Roman', serif" fontSize={headlineSize} fontWeight="700">
      {titleLines.map((line, index) => <tspan key={`${index}-${line}`} x={margin} dy={index ? lineHeight : 0}>{line}</tspan>)}
    </text>
    {subtitle ? <text x={margin} y={titleY + titleLines.length * lineHeight + (landscape ? 18 : 26)} fill={palette.secondary} fontFamily="Arial, Helvetica, sans-serif" fontSize={landscape ? 20 : layout === "story" ? 28 : 22} fontWeight="650">
      {wrapText(subtitle, landscape ? 42 : 48, 2).map((line, index) => <tspan key={`${index}-${line}`} x={margin} dy={index ? (landscape ? 27 : 34) : 0}>{line}</tspan>)}
    </text> : null}
    <text x={margin} y={landscape ? 500 : layout === "story" ? 1090 : 680} fill={palette.secondary} fontFamily="Arial, Helvetica, sans-serif" fontSize={landscape ? 17 : layout === "story" ? 23 : 18} fontWeight="650">{displayName(card, privacy.nameMode)}</text>
    <OrganizationMark achievement={achievement} palette={palette} x={dimensions.width - margin - (landscape ? 92 : 116)} y={landscape ? 94 : layout === "story" ? 170 : 120} size={landscape ? 92 : 116} visible={visibleOrganization} />
    <DetailGrid details={details} palette={palette} x={detailX} y={detailY} width={detailWidth} columns={landscape ? 1 : 3} fontSize={landscape ? 15 : layout === "story" ? 20 : 16} />
  </g>;
}

export function journeyCardAltDescription(card: JourneyCardData, achievement: JourneyCardAchievement, template: JourneyCardTemplate, privacy: JourneyCardPrivacy) {
  const name = displayName(card, privacy.nameMode);
  if (template === "year_review") {
    const stats = card.stats.filter((stat) => stat.value > 0).map((stat) => `${stat.value} ${stat.label.toLowerCase()}`).join(", ");
    return `UnlockED Year in Review card for ${name}. ${achievement.title}.${stats ? ` Progress shown: ${stats}.` : ""}`;
  }
  const details = cardDetails(card, achievement, privacy).map((item) => `${item.label}: ${item.value}`).join(". ");
  return `UnlockED ${journeyCardTemplateLabels[template]} card for ${name}. ${achievement.title}.${details ? ` ${details}.` : ""}`;
}

export const JourneyCardArtwork = forwardRef<SVGSVGElement, JourneyCardArtworkProps>(function JourneyCardArtwork({ card, achievement, layout, privacy, template, theme }, ref) {
  const dimensions = journeyCardLayouts[layout];
  const palette = palettes[theme];
  const margin = layout === "linkedin" ? 54 : layout === "story" ? 64 : 54;
  const footerY = dimensions.height - (layout === "story" ? 88 : 48);
  const brandSize = layout === "story" ? 42 : 34;

  return <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width={dimensions.width}
    height={dimensions.height}
    viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
    aria-hidden="true"
    focusable="false"
    data-journey-card-artwork=""
    data-journey-card-layout={layout}
    data-journey-card-template={template}
    data-export-theme={theme}
  >
    <rect width={dimensions.width} height={dimensions.height} fill={palette.canvas} />
    <rect x={layout === "story" ? 34 : 26} y={layout === "story" ? 34 : 26} width={dimensions.width - (layout === "story" ? 68 : 52)} height={dimensions.height - (layout === "story" ? 68 : 52)} rx={layout === "story" ? 34 : 24} fill={palette.surface} stroke={palette.line} strokeWidth="2" />
    <BackgroundMotif template={template} palette={palette} width={dimensions.width} height={dimensions.height} />
    {template === "year_review"
      ? <YearReview card={card} achievement={achievement} palette={palette} layout={layout} privacy={privacy} />
      : <AchievementArtwork card={card} achievement={achievement} template={template} palette={palette} layout={layout} privacy={privacy} />}
    <line x1={margin} y1={footerY - (layout === "story" ? 62 : 40)} x2={dimensions.width - margin} y2={footerY - (layout === "story" ? 62 : 40)} stroke={palette.line} strokeWidth="2" />
    <BrandFooter palette={palette} privacy={privacy} width={dimensions.width} y={footerY} margin={margin} size={brandSize} />
  </svg>;
});

export function JourneyCardAccessibleDetails({ card, achievement, template, privacy }: { card: JourneyCardData; achievement: JourneyCardAchievement; template: JourneyCardTemplate; privacy: JourneyCardPrivacy }) {
  const details = cardDetails(card, achievement, privacy);
  return <div>
    <p>{journeyCardTemplateLabels[template]}: {achievement.title}</p>
    <p>{displayName(card, privacy.nameMode)}</p>
    {details.length ? <dl>{details.map((detail) => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl> : null}
  </div>;
}
