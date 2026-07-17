export type JourneyThemeName = "light" | "dark";
export type AppearancePreference = "light" | "midnight" | "forest" | "system";

export type JourneyThemeTokens = Readonly<{
  name: JourneyThemeName;
  canvas: string;
  canvasElevated: string;
  surface: string;
  surfaceStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  forest: string;
  forestStrong: string;
  forestMuted: string;
  gold: string;
  mineral: string;
  clay: string;
  pathCompleted: string;
  pathCurrent: string;
  pathFuture: string;
  pathAlternate: string;
  pathClosed: string;
  border: string;
  borderStrong: string;
  focus: string;
  error: string;
  success: string;
  dark: boolean;
}>;

export const journeyLightTheme: JourneyThemeTokens = Object.freeze({
  name: "light",
  canvas: "#f6f0e6",
  canvasElevated: "#fbf7f0",
  surface: "#fffdf9",
  surfaceStrong: "#fffaf2",
  textPrimary: "#2b211a",
  textSecondary: "#5f554c",
  textMuted: "#71665c",
  textInverse: "#fbf3e8",
  forest: "#1f5f43",
  forestStrong: "#0b3b2d",
  forestMuted: "#dce9df",
  gold: "#9a742d",
  mineral: "#5e766c",
  clay: "#9b7560",
  pathCompleted: "#1f5f43",
  pathCurrent: "#0b3b2d",
  pathFuture: "#847d75",
  pathAlternate: "#5e766c",
  pathClosed: "#9b7560",
  border: "#d8cfc1",
  borderStrong: "#a69a8a",
  focus: "#0b6b4d",
  error: "#9d352f",
  success: "#1f5f43",
  dark: false,
});

export const journeyDarkTheme: JourneyThemeTokens = Object.freeze({
  name: "dark",
  canvas: "#17120f",
  canvasElevated: "#1b1512",
  surface: "#211a16",
  surfaceStrong: "#2a211c",
  textPrimary: "#fbf3e8",
  textSecondary: "#d7ccc0",
  textMuted: "#b8aca1",
  textInverse: "#17120f",
  forest: "#73b992",
  forestStrong: "#9bd1b2",
  forestMuted: "#254434",
  gold: "#d4b06a",
  mineral: "#99aaa2",
  clay: "#c28f78",
  pathCompleted: "#73b992",
  pathCurrent: "#a0d6b7",
  pathFuture: "#7a6d63",
  pathAlternate: "#8c9f96",
  pathClosed: "#8d7062",
  border: "#4e4139",
  borderStrong: "#6c5f55",
  focus: "#e7c77c",
  error: "#ef9a91",
  success: "#73b992",
  dark: true,
});

export function resolveJourneyTheme(theme: JourneyThemeName = "light") {
  return theme === "dark" ? journeyDarkTheme : journeyLightTheme;
}

export function resolvedAppearance(preference: AppearancePreference | undefined, isPro: boolean, systemDark: boolean): "light" | "midnight" | "forest" {
  if (!isPro) return "light";
  if (preference === "system") return systemDark ? "midnight" : "light";
  return preference === "midnight" || preference === "forest" ? preference : "light";
}

const cssTokenNames: Readonly<Record<Exclude<keyof JourneyThemeTokens, "name" | "dark">, string>> = {
  canvas: "--journey-canvas",
  canvasElevated: "--journey-canvas-elevated",
  surface: "--journey-surface",
  surfaceStrong: "--journey-surface-strong",
  textPrimary: "--journey-text-primary",
  textSecondary: "--journey-text-secondary",
  textMuted: "--journey-text-muted",
  textInverse: "--journey-text-inverse",
  forest: "--journey-forest",
  forestStrong: "--journey-forest-strong",
  forestMuted: "--journey-forest-muted",
  gold: "--journey-gold",
  mineral: "--journey-mineral",
  clay: "--journey-clay",
  pathCompleted: "--journey-path-completed",
  pathCurrent: "--journey-path-current",
  pathFuture: "--journey-path-future",
  pathAlternate: "--journey-path-alternate",
  pathClosed: "--journey-path-closed",
  border: "--journey-border",
  borderStrong: "--journey-border-strong",
  focus: "--journey-focus",
  error: "--journey-error",
  success: "--journey-success",
};

function declarations(tokens: JourneyThemeTokens) {
  return Object.entries(cssTokenNames).map(([key, variable]) => `${variable}:${tokens[key as keyof typeof cssTokenNames]}`).join(";");
}

/** Generated from the same token objects used by Open Line and export SVGs. */
export function journeyThemeCss() {
  return `:root{${declarations(journeyLightTheme)}}[data-theme="midnight"],[data-theme="forest"]{${declarations(journeyDarkTheme)}}`;
}
