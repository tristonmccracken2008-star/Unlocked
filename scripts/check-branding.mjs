import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const brand = read("components/brand-mark.tsx");
const logo = read("components/logo.tsx");
const icon = read("app/icon.tsx");
const appleIcon = read("app/apple-icon.tsx");
const openGraph = read("app/opengraph-image.tsx");
const pathMoment = read("components/path-moment-artwork.tsx");
const semesterStory = read("components/semester-story-artwork.tsx");
const journeyCard = read("components/journey-card-artwork.tsx");

for (const token of ["unlockedBrandPaths", "BrandMark", "BrandMarkArtwork", "tone"]) assert.ok(brand.includes(token), `Canonical branding must expose ${token}.`);
for (const [file, source] of [
  ["components/logo.tsx", logo],
  ["app/icon.tsx", icon],
  ["app/apple-icon.tsx", appleIcon],
  ["app/opengraph-image.tsx", openGraph],
  ["components/path-moment-artwork.tsx", pathMoment],
  ["components/semester-story-artwork.tsx", semesterStory],
  ["components/journey-card-artwork.tsx", journeyCard],
]) assert.ok(source.includes("BrandMark"), `${file} must use the canonical UnlockED mark.`);

assert.doesNotMatch(pathMoment, /openLineAperturePath/, "Path Moment exports must not reuse the Open Line marker as a logo.");
assert.doesNotMatch(semesterStory, /openLineAperturePath/, "Semester exports must not reuse the Open Line marker as a logo.");
assert.doesNotMatch(journeyCard, /openLineAperturePath|OpenLineRenderer/, "Journey Cards must use the brand mark and an editorial grid, not a decorative path.");
assert.equal((logo.match(/<svg/g) ?? []).length, 0, "The wordmark component must not redraw the logo inline.");

console.log("UnlockED brand consistency checks passed.");
