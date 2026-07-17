import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { journeyDarkTheme, journeyLightTheme } from "../lib/journey-theme";

const read = (file: string) => readFileSync(file, "utf8");
const journey = read("components/journey-editorial.tsx");
const journeyStyles = read("components/journey-editorial.module.css");
const liveLine = read("components/journey-live-line.tsx");
const transition = read("components/journey-transition-control.tsx");
const renderer = read("components/open-line/open-line-renderer.tsx");
const pathCreator = read("components/path-moment-creator.tsx");
const semesterCreator = read("components/semester-story-creator.tsx");
const creatorStyles = read("components/path-moment.module.css");
const loading = read("app/loading.tsx");

const editorialRender = journey.slice(journey.indexOf("export function JourneyEditorial("), journey.indexOf("export function JourneyEditorialUnavailable("));
const unavailableRender = journey.slice(journey.indexOf("export function JourneyEditorialUnavailable("));
assert.equal((editorialRender.match(/<h1\b/g) ?? []).length, 1, "Journey must expose exactly one H1.");
assert.equal((unavailableRender.match(/<h1\b/g) ?? []).length, 1, "Journey error state must expose exactly one H1.");
assert.match(journey, /<main[^>]+aria-labelledby="journey-story-title"/);
assert.match(journey, /<section className=\{styles\.opening\} aria-labelledby="journey-story-title"/);
assert.match(journey, /<h1 id="journey-story-title">/);
assert.match(journey, /<section className=\{styles\.history\} aria-labelledby="journey-history-title"/);
assert.match(journey, /<section className=\{styles\.horizon\} aria-labelledby="journey-horizon-title"/);
assert.match(journey, /<ol className=\{styles\.momentList\}>/);
assert.match(journey, /data-journey-text-timeline=""/);
assert.match(journey, /momentMeaning\(item\)/, "Visual marker states need a text equivalent.");
assert.match(journey, /className=\{styles\.lineField\} aria-hidden="true"/, "The visual Open Line must supplement the ordered text story.");

assert.match(renderer, /tabIndex=\{interactive \? 0 : undefined\}/);
assert.match(renderer, /focusable=\{interactive \? "true" : "false"\}/);
assert.doesNotMatch(liveLine, /announcement=/, "Decorative Journey motion cannot create a duplicate live announcement.");
assert.match(transition, /role="status" aria-live="polite" aria-atomic="true"/);
assert.match(transition, /role="alert"/);
assert.match(transition, /aria-busy=\{pending \? "true" : undefined\}/);

for (const [name, source, prefix] of [
  ["Path Moment", pathCreator, "path-moment"],
  ["Semester Story", semesterCreator, "semester-story"],
] as const) {
  assert.match(source, new RegExp(`aria-labelledby="${prefix}-title"`), `${name} dialog needs an accessible name.`);
  assert.match(source, new RegExp(`aria-describedby="${prefix}-description"`), `${name} dialog needs an accessible description.`);
  assert.match(source, /role="img" aria-label=\{alt\} aria-describedby=/, `${name} preview needs a readable image description.`);
  assert.match(source, /aria-busy=\{busy \? "true" : undefined\}/);
  assert.match(source, /role=\{messageIsError \? "alert" : "status"\}/);
}
assert.match(semesterCreator, /<ol>\{story\.moments\.map/, "Semester recap needs chronological list semantics.");
assert.match(pathCreator, /className=\{styles\.orderedStory\}>\{moment\.headline\}/);

assert.match(journeyStyles, /\.disclosure summary \{[^}]*min-height:\s*2\.75rem/);
assert.match(journeyStyles, /\.momentSummary \{[^}]*min-height:\s*3\.5rem/);
assert.match(journeyStyles, /@media \(max-width: 22\.5rem\)[\s\S]*\.primaryAction \{ min-height: 2\.75rem/);
assert.doesNotMatch(creatorStyles, /\.segmented button \{[\s\S]*?min-height:\s*40px/);
assert.match(creatorStyles, /\.segmented button \{[\s\S]*?min-height:\s*44px/);
assert.match(creatorStyles, /\.checks label \{[\s\S]*?min-height:\s*44px/);
assert.match(creatorStyles, /\.actions button \{[\s\S]*?min-height:\s*44px/);
assert.match(journeyStyles, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(journeyStyles, /@media \(forced-colors: active\)/);
assert.match(journeyStyles, /@media \(prefers-contrast: more\)/);
assert.match(creatorStyles, /@media \(forced-colors: active\)/);
assert.match(creatorStyles, /@media \(prefers-contrast: more\)/);
assert.match(loading, /role="status" aria-live="polite"/);

for (const source of [journey, liveLine, transition, pathCreator, semesterCreator]) {
  assert.doesNotMatch(source, /ResizeObserver|IntersectionObserver|getBoundingClientRect|requestIdleCallback/, "Journey accessibility cannot add measurement or observer overhead.");
}

function channel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string) {
  const values = hex.slice(1).match(/.{2}/g)?.map((value) => channel(Number.parseInt(value, 16))) ?? [];
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const contrastChecks = {
  lightPrimary: contrast(journeyLightTheme.textPrimary, journeyLightTheme.canvas),
  lightSecondary: contrast(journeyLightTheme.textSecondary, journeyLightTheme.canvas),
  darkPrimary: contrast(journeyDarkTheme.textPrimary, journeyDarkTheme.canvas),
  darkSecondary: contrast(journeyDarkTheme.textSecondary, journeyDarkTheme.canvas),
  darkFocus: contrast(journeyDarkTheme.focus, journeyDarkTheme.canvas),
};
for (const [name, value] of Object.entries(contrastChecks)) assert.ok(value >= 4.5, `${name} must meet WCAG AA; received ${value.toFixed(2)}.`);

console.log(JSON.stringify({
  message: "Journey accessibility checks passed.",
  semantics: ["single-h1", "named-regions", "ordered-history", "text-equivalent-open-line", "described-dialogs"],
  interaction: ["44px-targets", "single-live-announcement", "focus-safe-svg", "error-semantics"],
  contrast: Object.fromEntries(Object.entries(contrastChecks).map(([key, value]) => [key, Number(value.toFixed(2))])),
}, null, 2));
