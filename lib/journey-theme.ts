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
  canvas: "#f7f8f8",
  canvasElevated: "#eef2f5",
  surface: "#ffffff",
  surfaceStrong: "#fbfcfc",
  textPrimary: "#0f1419",
  textSecondary: "#34404c",
  textMuted: "#5f6b78",
  textInverse: "#f7f8f8",
  forest: "#1e7f56",
  forestStrong: "#125d3e",
  forestMuted: "#d6eedc",
  gold: "#9a742d",
  mineral: "#5e766c",
  clay: "#9b7560",
  pathCompleted: "#1e7f56",
  pathCurrent: "#125d3e",
  pathFuture: "#7b8794",
  pathAlternate: "#52786b",
  pathClosed: "#9b7560",
  border: "#d9dfe7",
  borderStrong: "#b6bdc9",
  focus: "#1e7f56",
  error: "#9d352f",
  success: "#1e7f56",
  dark: false,
});

export const journeyDarkTheme: JourneyThemeTokens = Object.freeze({
  name: "dark",
  canvas: "#11171d",
  canvasElevated: "#192129",
  surface: "#202a34",
  surfaceStrong: "#26323d",
  textPrimary: "#f1f3f2",
  textSecondary: "#c9d1dc",
  textMuted: "#9da9b8",
  textInverse: "#091018",
  forest: "#82c7a3",
  forestStrong: "#a4ddbd",
  forestMuted: "#203d34",
  gold: "#d4b06a",
  mineral: "#9fb2bd",
  clay: "#c28f78",
  pathCompleted: "#82c7a3",
  pathCurrent: "#a4ddbd",
  pathFuture: "#718093",
  pathAlternate: "#91a7b2",
  pathClosed: "#9b7568",
  border: "#2b394c",
  borderStrong: "#526279",
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
