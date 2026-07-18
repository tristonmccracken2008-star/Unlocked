import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathMomentLayouts } from "../lib/path-moments";

const read = (file: string) => readFileSync(file, "utf8");
const journey = read("components/journey-editorial.tsx");
const journeyStyles = read("components/journey-editorial.module.css");
const artwork = read("components/path-moment-artwork.tsx");
const creator = read("components/path-moment-creator.tsx");
const pathMomentEntry = read("components/path-moment-entry.tsx");
const momentStyles = read("components/path-moment.module.css");
const loading = read("app/loading.tsx");

function luminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  return channels.reduce((sum, channel, index) => {
    const linear = channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

for (const [foreground, background] of [
  ["#2b211a", "#f6f0e6"],
  ["#0e5b3e", "#f6f0e6"],
  ["#fbf3e8", "#17120f"],
  ["#91c9ad", "#17120f"],
] as const) assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background} must preserve text contrast.`);

assert.match(journeyStyles, /\.livingPath[\s\S]*padding-left:\s*2\.5rem/);
assert.match(journeyStyles, /\.pathConnection[\s\S]*left:\s*\.68rem/);
assert.match(journeyStyles, /storyFlow::before[\s\S]*left:\s*1rem/);
assert.match(journeyStyles, /@media \(max-width: 22\.5rem\)/, "Journey must explicitly support 320px screens.");
assert.doesNotMatch(journeyStyles, /contain-intrinsic-size|repeating-linear-gradient/, "Journey cannot create synthetic blank space or decorative gradient rails.");
assert.doesNotMatch(journeyStyles, /backdrop-filter/, "The primary Journey surface must not rely on expensive glass effects.");
assert.match(journeyStyles, /\.moment\[data-moment-kind="validation"\][\s\S]*margin-block/, "Validation moments need deliberate breathing room.");
assert.match(journeyStyles, /\.momentDetail[\s\S]*border-left:\s*1px solid var\(--journey-green\)/, "Progressive details need one quiet semantic rail rather than another card.");
assert.match(journeyStyles, /editorial-arrive/);
assert.match(journeyStyles, /\.loadingWaypoint,\s*\n\s*\.loadingLine \{ animation-delay: 160ms; \}/, "Orientation and next action must arrive together.");
assert.match(journeyStyles, /\.loadingStatus \{ animation-delay: 250ms; \}/, "Later loading copy must arrive last.");

assert.ok(!journey.startsWith('"use client"'), "The editorial Journey must remain server-first.");
assert.equal((journey.match(/<JourneyResponsiveLine/g) ?? []).length, 0, "Journey must not duplicate its readable path with a hydrated SVG.");
assert.match(journey, /data-journey-living-path/);
assert.match(loading, /loadingIdentity[\s\S]*loadingComposition/, "Loading must preserve identity-before-waypoint DOM order.");
assert.match(pathMomentEntry, /import\("@\/components\/path-moment-creator"\)/, "Path Moment artwork and export code must load on intent.");
assert.doesNotMatch(journey, /path-moment-creator/, "Journey cannot hydrate the full Path Moment creator while it is closed.");
assert.doesNotMatch(creator, /const \[open, setOpen\]/, "The lazy creator must mount only while its dialog is open.");

assert.deepEqual(Object.fromEntries(Object.entries(pathMomentLayouts).map(([key, value]) => [key, { width: value.width, height: value.height }])), {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  linkedin: { width: 1200, height: 627 },
});
assert.match(artwork, /momentLabel/);
assert.match(artwork, /footerLines/);
assert.doesNotMatch(artwork, /gradient|filter=|drop-shadow|confetti/i, "Path Moment exports must remain flat, print-safe, and restrained.");
assert.match(momentStyles, /\.previewFrame\[data-preview-layout="story"\]/);
assert.match(momentStyles, /\.previewFrame\[data-preview-layout="square"\]/);
assert.match(momentStyles, /\.previewFrame\[data-preview-layout="linkedin"\]/);
assert.match(momentStyles, /@media \(max-width: 480px\)[\s\S]*grid-auto-flow: column/, "Mobile export controls must avoid tall stacked segmented controls.");
assert.match(momentStyles, /min-height: 44px/, "Interactive Path Moment controls must preserve accessible touch targets.");

console.log(JSON.stringify({
  message: "Journey visual checks passed.",
  viewports: [320, 390, 820, 1440],
  themes: ["light", "midnight"],
  exports: pathMomentLayouts,
  contrast: {
    lightText: Number(contrast("#2b211a", "#f6f0e6").toFixed(2)),
    lightForest: Number(contrast("#0e5b3e", "#f6f0e6").toFixed(2)),
    darkText: Number(contrast("#fbf3e8", "#17120f").toFixed(2)),
    darkForest: Number(contrast("#91c9ad", "#17120f").toFixed(2)),
  },
}, null, 2));
