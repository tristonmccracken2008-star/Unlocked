import { journeyDarkTheme, journeyLightTheme, type JourneyThemeTokens } from "@/lib/journey-theme";

/** Compact custom themes remain supported for the renderer laboratory and embedders. */
export type OpenLineThemeTokens = Readonly<{
  name: "light" | "dark";
  paper: string;
  ink: string;
  forest: string;
  deepForest: string;
  gold: string;
  mineral: string;
  clay: string;
  neutral: string;
  border: string;
  dark: boolean;
}>;

export type OpenLineTheme = "light" | "dark" | OpenLineThemeTokens;
export type ResolvedOpenLineThemeTokens = JourneyThemeTokens & OpenLineThemeTokens;

export const openLineLightTheme: ResolvedOpenLineThemeTokens = Object.freeze({
  ...journeyLightTheme,
  paper: journeyLightTheme.canvas,
  ink: journeyLightTheme.textPrimary,
  deepForest: journeyLightTheme.forestStrong,
  neutral: journeyLightTheme.pathFuture,
});

export const openLineDarkTheme: ResolvedOpenLineThemeTokens = Object.freeze({
  ...journeyDarkTheme,
  paper: journeyDarkTheme.canvas,
  ink: journeyDarkTheme.textPrimary,
  deepForest: journeyDarkTheme.forestStrong,
  neutral: journeyDarkTheme.pathFuture,
});

export function resolveOpenLineTheme(theme: OpenLineTheme = "light"): ResolvedOpenLineThemeTokens {
  if (typeof theme !== "string") {
    const base = theme.dark ? journeyDarkTheme : journeyLightTheme;
    return {
      ...base,
      ...theme,
      canvas: theme.paper,
      textPrimary: theme.ink,
      forestStrong: theme.deepForest,
      pathCompleted: theme.forest,
      pathCurrent: theme.deepForest,
      pathFuture: theme.neutral,
      pathAlternate: theme.mineral,
      pathClosed: theme.clay,
    };
  }
  return theme === "dark" ? openLineDarkTheme : openLineLightTheme;
}
