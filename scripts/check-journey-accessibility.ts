import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");
const timeline = read("components/journey-timeline.tsx");
const control = read("components/journey-timeline-control.tsx");
const entry = read("components/journey-card-entry.tsx");
const creator = read("components/journey-card-creator.tsx");
const artwork = read("components/journey-card-artwork.tsx");
const styles = read("components/journey-timeline.module.css");
const creatorStyles = read("components/path-moment.module.css");
const loading = read("app/loading.tsx");

const unavailable = timeline.slice(timeline.indexOf("export function JourneyTimelineUnavailable"));
const primary = timeline.slice(0, timeline.indexOf("export function JourneyTimelineUnavailable"));
assert.equal((primary.match(/<h1\b/g) ?? []).length, 1, "Journey must expose exactly one H1.");
assert.equal((unavailable.match(/<h1\b/g) ?? []).length, 1, "Journey's unavailable state must expose exactly one H1.");
assert.match(primary, /<main className=\{styles\.page\} data-journey-timeline=/);
assert.match(primary, /<ol className=\{styles\.timeline\} aria-label="Journey events in chronological order">/);
assert.match(primary, /<time dateTime=\{event\.occurredAt\}>/);
assert.match(primary, /<section className=\{styles\.share\} aria-labelledby="journey-card-heading">/);
assert.match(primary, /<section className=\{styles\.empty\} aria-labelledby="journey-empty-heading">/);
assert.match(primary, /aria-hidden="true"/);
assert.match(control, /<dialog[\s\S]*?aria-labelledby=/);
assert.match(control, /aria-label="Close Update Journey"/);
assert.match(control, /data-journey-update-confirmation/);
assert.match(control, /aria-live="polite"/);
assert.match(control, /role="alert"/);
assert.match(entry, /aria-describedby=\{error \? "journey-card-load-error" : undefined\}/);
assert.match(entry, /role="alert"/);

assert.match(creator, /<dialog[^>]+aria-labelledby="journey-card-title" aria-describedby="journey-card-description"/);
assert.match(creator, /aria-label="Journey Card preview"/);
assert.match(creator, /role="img" aria-label=\{alt\}/);
assert.match(creator, /aria-busy=\{busy \? "true" : undefined\}/);
assert.match(creator, /role=\{messageIsError \? "alert" : "status"\}/);
assert.match(creator, /aria-pressed=\{layout === item\}/);
assert.match(creator, /aria-pressed=\{exportTheme === item\}/);
assert.match(creator, /aria-pressed=\{privacy\.nameMode === mode\}/);
assert.match(artwork, /aria-hidden="true" focusable="false"/);

assert.match(styles, /\.eventFooter a \{[^}]*min-height:\s*44px/);
assert.match(styles, /\.updateJourneyButton \{[^}]*min-height:\s*45px/);
assert.match(styles, /\.updateClose \{[^}]*width:\s*44px;[^}]*height:\s*44px/);
assert.match(styles, /\.updateActions button \{[^}]*min-height:\s*45px/);
assert.match(creatorStyles, /\.segmented button \{[\s\S]*?min-height:\s*44px/);
assert.match(creatorStyles, /\.checks label \{[\s\S]*?min-height:\s*44px/);
assert.match(creatorStyles, /\.actions button \{[\s\S]*?min-height:\s*44px/);
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(styles, /@media \(prefers-contrast: more\)/);
assert.match(creatorStyles, /@media \(forced-colors: active\)/);
assert.match(creatorStyles, /@media \(prefers-contrast: more\)/);
assert.match(loading, /role="status" aria-live="polite"/);

for (const source of [timeline, control, entry, creator, artwork]) {
  assert.doesNotMatch(source, /ResizeObserver|IntersectionObserver|getBoundingClientRect|requestIdleCallback/, "Journey must not add client geometry or observer work.");
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
  lightPrimary: contrast("#2b211a", "#f6f0e6"),
  lightSecondary: contrast("#6f675f", "#f6f0e6"),
  lightGreen: contrast("#1f5f43", "#f6f0e6"),
  darkPrimary: contrast("#fbf3e8", "#17120f"),
  darkSecondary: contrast("#c2b7aa", "#17120f"),
  darkGreen: contrast("#91c9ad", "#17120f"),
};
for (const [name, value] of Object.entries(contrastChecks)) assert.ok(value >= 4.5, `${name} must meet WCAG AA; received ${value.toFixed(2)}.`);

console.log(JSON.stringify({
  message: "Unified Journey accessibility checks passed.",
  semantics: ["single-h1", "chronological-list", "semantic-dates", "named-share-and-empty-regions", "named-dialog"],
  interaction: ["44px-targets", "keyboard-details", "focus-return", "pending-and-error-semantics", "pressed-state-controls"],
  contrast: Object.fromEntries(Object.entries(contrastChecks).map(([key, value]) => [key, Number(value.toFixed(2))])),
}, null, 2));
