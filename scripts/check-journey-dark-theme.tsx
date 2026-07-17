import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { journeyDarkTheme, journeyLightTheme, journeyThemeCss, resolveJourneyTheme, resolvedAppearance, type JourneyThemeTokens } from "../lib/journey-theme";
import { openLineDarkTheme, openLineLightTheme } from "../components/open-line/open-line-theme";

const read = (path: string) => readFileSync(path, "utf8");
const semanticKeys: Array<keyof JourneyThemeTokens> = [
  "name", "canvas", "canvasElevated", "surface", "surfaceStrong", "textPrimary", "textSecondary", "textMuted", "textInverse",
  "forest", "forestStrong", "forestMuted", "gold", "mineral", "clay", "pathCompleted", "pathCurrent", "pathFuture",
  "pathAlternate", "pathClosed", "border", "borderStrong", "focus", "error", "success", "dark",
];
for (const theme of [journeyLightTheme, journeyDarkTheme]) for (const key of semanticKeys) assert.notEqual(theme[key], undefined, `${theme.name} is missing ${key}.`);
assert.equal(journeyDarkTheme.canvas, "#17120f");
assert.equal(journeyDarkTheme.surface, "#211a16");
assert.equal(journeyDarkTheme.textPrimary, "#fbf3e8");
assert.equal(journeyDarkTheme.forest, "#73b992");
assert.equal(journeyDarkTheme.gold, "#d4b06a");
assert.deepEqual(
  [openLineDarkTheme.pathCompleted, openLineDarkTheme.pathCurrent, openLineDarkTheme.pathFuture, openLineDarkTheme.pathAlternate, openLineDarkTheme.pathClosed],
  [journeyDarkTheme.pathCompleted, journeyDarkTheme.pathCurrent, journeyDarkTheme.pathFuture, journeyDarkTheme.pathAlternate, journeyDarkTheme.pathClosed],
);

function luminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  return channels.reduce((sum, channel, index) => {
    const linear = channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}
function contrast(foreground: string, background: string) {
  const [high, low] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (high + .05) / (low + .05);
}
const contrastResults = {
  primaryCanvas: contrast(journeyDarkTheme.textPrimary, journeyDarkTheme.canvas),
  secondaryCanvas: contrast(journeyDarkTheme.textSecondary, journeyDarkTheme.canvas),
  mutedCanvas: contrast(journeyDarkTheme.textMuted, journeyDarkTheme.canvas),
  primarySurface: contrast(journeyDarkTheme.textPrimary, journeyDarkTheme.surface),
  forestCanvas: contrast(journeyDarkTheme.forest, journeyDarkTheme.canvas),
  goldCanvas: contrast(journeyDarkTheme.gold, journeyDarkTheme.canvas),
};
for (const [role, value] of Object.entries(contrastResults)) assert.ok(value >= 4.5, `${role} must meet WCAG AA; received ${value.toFixed(2)}.`);
assert.notEqual(journeyDarkTheme.canvas, journeyDarkTheme.surface);
assert.notEqual(journeyDarkTheme.surface, journeyDarkTheme.surfaceStrong);
assert.notEqual(journeyDarkTheme.pathCompleted, journeyDarkTheme.pathFuture);
assert.notEqual(journeyDarkTheme.pathCurrent, journeyDarkTheme.pathAlternate);

assert.equal(resolvedAppearance("system", true, true), "midnight");
assert.equal(resolvedAppearance("system", true, false), "light");
assert.equal(resolvedAppearance("midnight", false, true), "light");
assert.equal(resolveJourneyTheme("dark"), journeyDarkTheme);
const generatedCss = journeyThemeCss();
for (const token of ["--journey-canvas", "--journey-surface", "--journey-text-primary", "--journey-path-current", "--journey-focus"]) assert.match(generatedCss, new RegExp(token));

const globals = read("app/globals.css");
const journeyStyles = read("components/journey-editorial.module.css");
const creatorStyles = read("components/path-moment.module.css");
const controller = read("components/theme-controller.tsx");
const home = read("app/page.tsx");
const pathArtwork = read("components/path-moment-artwork.tsx");
const semesterArtwork = read("components/semester-story-artwork.tsx");
const pathCreator = read("components/path-moment-creator.tsx");
const semesterCreator = read("components/semester-story-creator.tsx");
const renderer = read("components/open-line/open-line-renderer.tsx");
const pathMomentModel = read("lib/path-moments.ts");
const semesterModel = read("lib/semester-story.ts");

assert.doesNotMatch(globals, /\[data-theme[^\n]+\]\s+\.(?:bg|text|border)-[^\n]+!important/, "Theme CSS cannot override utility classes globally.");
assert.doesNotMatch(globals, /\.dark\s+\*/, "Theme CSS cannot use a destructive wildcard override.");
assert.doesNotMatch(renderer, /soft-shadow|soft-blur|<filter/, "Open Line dark mode cannot rely on glow or blur filters.");
assert.match(journeyStyles, /var\(--journey-canvas\)/);
assert.match(journeyStyles, /var\(--journey-surface\)/);
assert.match(journeyStyles, /@media \(forced-colors: active\)/);
assert.match(creatorStyles, /@media \(forced-colors: active\)/);
assert.doesNotMatch(creatorStyles, /\.dialog\[data-theme="dark"\][\s\S]{0,100}#[0-9a-f]{3,8}/i);

for (const source of [pathArtwork, semesterArtwork]) {
  assert.match(source, /resolveJourneyTheme\(theme\)/);
  assert.match(source, /data-export-theme=\{theme\}/);
  assert.match(source, /theme=\{theme\}/);
  assert.doesNotMatch(source, /fill="#[0-9a-f]{3,8}"|stroke="#[0-9a-f]{3,8}"/i);
}
for (const source of [pathCreator, semesterCreator]) {
  assert.match(source, /<legend>Appearance<\/legend>/);
  assert.match(source, /\["light", "dark"\]/);
  assert.match(source, /theme=\{exportTheme\}/);
}

assert.match(controller, /prefers-color-scheme: dark/);
assert.match(controller, /unlocked-color-scheme/);
assert.match(controller, /localStorage\.getItem\("unlocked-account-session"\)/);
assert.match(controller, /media\.addEventListener\("change"/);
assert.match(home, /cookies\(\)/);
assert.match(home, /resolvedTheme/);
assert.doesNotMatch(pathMomentModel, /JourneyTheme|appearance|data-theme/);
assert.doesNotMatch(semesterModel, /JourneyTheme|appearance|data-theme/);

const started = performance.now();
for (let index = 0; index < 20_000; index += 1) resolveJourneyTheme(index % 2 ? "dark" : "light");
const tokenResolutionMs = performance.now() - started;
assert.ok(tokenResolutionMs < 30, `Theme token resolution must remain constant-time; received ${tokenResolutionMs.toFixed(2)}ms.`);

console.log(JSON.stringify({
  message: "Journey dark-theme checks passed.",
  tokenCount: semanticKeys.length,
  contrast: Object.fromEntries(Object.entries(contrastResults).map(([key, value]) => [key, Number(value.toFixed(2))])),
  openLineThemes: [openLineLightTheme.name, openLineDarkTheme.name],
  tokenResolutionMs: Number(tokenResolutionMs.toFixed(2)),
}, null, 2));
