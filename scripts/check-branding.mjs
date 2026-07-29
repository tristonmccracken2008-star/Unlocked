import assert from "node:assert/strict";
import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";

const read = (path) => readFileSync(path, "utf8");
const brand = read("components/brand-mark.tsx");
const assets = read("data/brand-assets.ts");
const logo = read("components/logo.tsx");
const openGraph = read("app/opengraph-image.tsx");
const exportUtility = read("lib/brand-export.ts");
const pathMoment = read("components/path-moment-artwork.tsx");
const semesterStory = read("components/semester-story-artwork.tsx");
const journeyCard = read("components/journey-card-artwork.tsx");

const sourcePath = "public/brand/unlocked-logo-source.png";
const markPath = "public/brand/unlocked-mark.png";
assert.ok(existsSync(sourcePath) && existsSync(markPath), "The preserved source and canonical transparent UnlockED mark must exist.");
assert.equal(crypto.createHash("sha256").update(readFileSync(sourcePath)).digest("hex"), "3aeeec0a5c12e3dcf8ffa861ec2bd1402a67263b191a78da4f269b4bf1b8ea93", "The uploaded source logo must remain byte-for-byte unchanged.");
const markMetadata = await sharp(markPath).metadata();
assert.ok(markMetadata.hasAlpha && (markMetadata.width ?? 0) >= 512 && (markMetadata.height ?? 0) >= 512, "The canonical mark must be a high-density transparent PNG.");
const { data: markPixels } = await sharp(markPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let transparentPixels = 0;
for (let index = 3; index < markPixels.length; index += 4) if (markPixels[index] === 0) transparentPixels += 1;
assert.ok(transparentPixels > markPixels.length / 16, "The canonical mark must retain meaningful transparent space.");
for (const path of ["app/icon.png", "app/apple-icon.png"]) assert.ok(existsSync(path), `${path} must be generated from the canonical mark.`);
assert.equal(existsSync("app/icon.tsx"), false, "The legacy generated favicon route must be removed.");
assert.equal(existsSync("app/apple-icon.tsx"), false, "The legacy generated app-icon route must be removed.");

for (const token of ["UNLOCKED_MARK_SRC", "BrandMark", "BrandMarkArtwork", "tone"]) assert.ok(brand.includes(token), `Canonical branding must expose ${token}.`);
assert.ok(assets.includes('"/brand/unlocked-mark.png"'), "All product branding must resolve through the canonical asset path.");
assert.doesNotMatch(brand, /unlockedBrandPaths|<path|<svg/, "The canonical component must not redraw the uploaded mark.");
for (const [file, source] of [
  ["components/logo.tsx", logo],
  ["components/path-moment-artwork.tsx", pathMoment],
  ["components/semester-story-artwork.tsx", semesterStory],
  ["components/journey-card-artwork.tsx", journeyCard],
]) assert.ok(source.includes("BrandMark"), `${file} must use the canonical UnlockED mark.`);

assert.ok(openGraph.includes("unlocked-mark.png"), "Open Graph artwork must use the canonical uploaded logo.");
assert.ok(exportUtility.includes("image[data-unlocked-brand-mark]") && exportUtility.includes("UNLOCKED_MARK_SRC"), "Downloaded artwork must embed the canonical uploaded logo.");
assert.doesNotMatch(pathMoment, /openLineAperturePath/, "Path Moment exports must not reuse the Open Line marker as a logo.");
assert.doesNotMatch(semesterStory, /openLineAperturePath/, "Semester exports must not reuse the Open Line marker as a logo.");
assert.doesNotMatch(journeyCard, /openLineAperturePath|OpenLineRenderer/, "Journey Cards must use the brand mark and an editorial grid, not a decorative path.");
assert.equal((logo.match(/<svg/g) ?? []).length, 0, "The wordmark component must not redraw the logo inline.");

console.log("UnlockED brand consistency checks passed.");
