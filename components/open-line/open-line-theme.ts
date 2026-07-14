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

export const openLineLightTheme: OpenLineThemeTokens = Object.freeze({
  name: "light",
  paper: "#f6f0e6",
  ink: "#2b211a",
  forest: "#1f5f43",
  deepForest: "#0b3b2d",
  gold: "#b48a45",
  mineral: "#5e766c",
  clay: "#9b7560",
  neutral: "#847d75",
  border: "#d8cfc1",
  dark: false,
});

export const openLineDarkTheme: OpenLineThemeTokens = Object.freeze({
  name: "dark",
  paper: "#171411",
  ink: "#f7f0e6",
  forest: "#75b795",
  deepForest: "#a5d2b9",
  gold: "#d4ad63",
  mineral: "#91a79d",
  clay: "#c3937b",
  neutral: "#aaa198",
  border: "#4e463f",
  dark: true,
});

export function resolveOpenLineTheme(theme: OpenLineTheme = "light"): OpenLineThemeTokens {
  if (typeof theme !== "string") return theme;
  return theme === "dark" ? openLineDarkTheme : openLineLightTheme;
}
