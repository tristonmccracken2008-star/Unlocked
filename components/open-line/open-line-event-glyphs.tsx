import { resolveOpenLineTheme, type OpenLineTheme } from "./open-line-theme";

export type OpenLineEventGlyphType = "application" | "interview" | "research" | "scholarship" | "experience" | "skill" | "completion";

export type OpenLineEventGlyphProps = {
  type: OpenLineEventGlyphType;
  theme?: OpenLineTheme;
  size?: number;
  decorative?: boolean;
  id?: string;
};

const glyphLabels: Record<OpenLineEventGlyphType, string> = {
  application: "Application",
  interview: "Interview",
  research: "Research",
  scholarship: "Scholarship",
  experience: "Experience",
  skill: "Skill evidence",
  completion: "Completion",
};

const glyphArtwork: Record<OpenLineEventGlyphType, () => React.ReactNode> = {
  application: () => <><path d="M3 10.5 21 3l-7.5 18-3.2-7.3L3 10.5Z" /><path d="m10.3 13.7 4.8-4.8" /></>,
  interview: () => <><path d="M5 5.5h14v10H11l-4.5 3v-3H5v-10Z" /><path d="M9 9.2h6M9 12h4" /></>,
  research: () => <><path d="M3.5 5.5c3.3-.8 6.2 0 8.5 2.1v11c-2.3-2.1-5.2-2.9-8.5-2.1v-11ZM20.5 5.5c-3.3-.8-6.2 0-8.5 2.1v11c2.3-2.1 5.2-2.9 8.5-2.1v-11Z" /></>,
  scholarship: () => <><path d="M12 3.5 15 6l3.8-.2-.2 3.8L21 12l-2.4 2.4.2 3.8-3.8-.2-3 2.5L9 18l-3.8.2.2-3.8L3 12l2.4-2.4-.2-3.8L9 6l3-2.5Z" /><path d="m9 12 2 2 4-4" /></>,
  experience: () => <><path d="M3.5 8h17v11h-17V8ZM9 8V5h6v3" /><path d="M3.5 12.5c4.5 1.9 12.5 1.9 17 0M10 13h4" /></>,
  skill: () => <><path d="M12 2.8c.7 4.7 3.5 7.5 8.2 8.2-4.7.7-7.5 3.5-8.2 8.2-.7-4.7-3.5-7.5-8.2-8.2 4.7-.7 7.5-3.5 8.2-8.2Z" /><path d="M19 3.5c.2 1.4 1.1 2.3 2.5 2.5-1.4.2-2.3 1.1-2.5 2.5-.2-1.4-1.1-2.3-2.5-2.5 1.4-.2 2.3-1.1 2.5-2.5Z" /></>,
  completion: () => <path d="m4.5 12.5 4.8 4.8L19.8 6.8" />,
};

export function OpenLineEventGlyph({ type, theme: themeInput = "light", size = 20, decorative = false, id }: OpenLineEventGlyphProps) {
  const theme = resolveOpenLineTheme(themeInput);
  const label = glyphLabels[type];
  return <svg
    id={id}
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke={theme.ink}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    role={decorative ? undefined : "img"}
    aria-label={decorative ? undefined : label}
    aria-hidden={decorative ? true : undefined}
    focusable="false"
    data-open-line-event-glyph={type}
  >
    {glyphArtwork[type]()}
  </svg>;
}
