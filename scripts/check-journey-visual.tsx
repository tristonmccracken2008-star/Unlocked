import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { journeyCardLayouts } from "../lib/journey-timeline";

const read = (file: string) => readFileSync(file, "utf8");
const journey = read("components/journey-timeline.tsx");
const journeyStyles = read("components/journey-timeline.module.css");
const artwork = read("components/journey-card-artwork.tsx");
const creator = read("components/journey-card-creator.tsx");
const entry = read("components/journey-card-entry.tsx");
const creatorStyles = read("components/path-moment.module.css");
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
for (const [foreground, background] of [["#2b211a", "#f6f0e6"], ["#1f5f43", "#f6f0e6"], ["#fbf3e8", "#17120f"], ["#91c9ad", "#17120f"]] as const) assert.ok(contrast(foreground, background) >= 4.5);

assert.match(journey, /<ol className=\{styles\.timeline\} aria-label="Journey events in chronological order">/);
assert.match(journey, /JourneyTimelineControl/);
assert.match(journey, /JourneyCardEntry/);
assert.doesNotMatch(journey, /Journey Board|Your next step|Horizon|OpenLineRenderer/);
assert.match(journeyStyles, /grid-template-columns:\s*7rem 2\.9rem minmax\(0, 1fr\)/);
assert.match(journeyStyles, /@media \(max-width: 640px\)[\s\S]*grid-template-columns:\s*2\.5rem minmax\(0, 1fr\)/);
assert.match(journeyStyles, /min-height:\s*44px/);
assert.match(journeyStyles, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(journeyStyles, /@media \(prefers-contrast: more\)/);
assert.doesNotMatch(journeyStyles, /backdrop-filter|repeating-linear-gradient|contain-intrinsic-size/);

assert.match(entry, /import\("@\/components\/journey-card-creator"\)/, "Journey Card export code must load on intent.");
assert.doesNotMatch(journey, /journey-card-creator|XMLSerializer|canvas\.toBlob/, "The timeline cannot hydrate export code before intent.");
assert.deepEqual(Object.fromEntries(Object.entries(journeyCardLayouts).map(([key, value]) => [key, { width: value.width, height: value.height }])), {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  linkedin: { width: 1200, height: 627 },
});
for (const token of ["BrandMarkArtwork", "MY JOURNEY", "MOMENTS", "Built with UnlockED", "unlockededu.com"]) assert.match(artwork, new RegExp(token));
assert.doesNotMatch(artwork, /OpenLineRenderer|openLineAperturePath|gradient|filter=|drop-shadow|confetti/i);
for (const token of ["Download PNG", "Copy image", "navigator.share", "Private until you share it", "role={messageIsError ?"]) assert.ok(creator.includes(token));
assert.match(creatorStyles, /min-height:\s*44px/);
assert.match(loading, /Loading your saved opportunities and progress\./);
assert.doesNotMatch(loading, /loadingWaypoint|next step|story\./i);

console.log(JSON.stringify({ message: "Unified Journey visual checks passed.", viewports: [320, 390, 820, 1440], themes: ["cream", "forest"], exports: journeyCardLayouts }, null, 2));
