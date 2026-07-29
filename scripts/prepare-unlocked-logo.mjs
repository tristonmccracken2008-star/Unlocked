import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourcePath = path.join(root, "public/brand/unlocked-logo-source.png");
const markPath = path.join(root, "public/brand/unlocked-mark.png");
const iconPath = path.join(root, "app/icon.png");
const appleIconPath = path.join(root, "app/apple-icon.png");
const safeMargin = 18;

const source = sharp(sourcePath);
const metadata = await source.metadata();
if (!metadata.width || !metadata.height) throw new Error("The UnlockED source logo has no readable dimensions.");

const { data, info } = await source.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const pixels = [];
const backgroundSamples = [];

for (let offset = 0; offset < data.length; offset += info.channels) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const pixel = Math.floor(offset / info.channels);
  const x = pixel % info.width;
  const y = Math.floor(pixel / info.width);
  const edge = x < 18 || y < 18 || x >= info.width - 18 || y >= info.height - 18;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  if (edge && Math.min(r, g, b) > 210 && chroma < 32) backgroundSamples.push([r, g, b]);
  if (chroma > 42 && Math.max(r, g, b) < 238) pixels.push([r, g, b]);
}

if (!backgroundSamples.length || pixels.length < 100) throw new Error("The UnlockED source logo could not be separated from its background.");

const average = (samples, channel) => samples.reduce((sum, sample) => sum + sample[channel], 0) / samples.length;
const background = [average(backgroundSamples, 0), average(backgroundSamples, 1), average(backgroundSamples, 2)];

let centroids = [
  [27, 86, 59],
  [188, 140, 65],
];
for (let iteration = 0; iteration < 8; iteration += 1) {
  const groups = [[], []];
  for (const pixel of pixels) {
    const distances = centroids.map((centroid) => centroid.reduce((sum, value, channel) => sum + (pixel[channel] - value) ** 2, 0));
    groups[distances[0] <= distances[1] ? 0 : 1].push(pixel);
  }
  centroids = groups.map((group, index) => group.length
    ? [average(group, 0), average(group, 1), average(group, 2)]
    : centroids[index]);
}

const output = Buffer.alloc(info.width * info.height * 4);
const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
const smoothstep = (value) => {
  const bounded = Math.max(0, Math.min(1, value));
  return bounded * bounded * (3 - 2 * bounded);
};

for (let sourceOffset = 0, targetOffset = 0; sourceOffset < data.length; sourceOffset += info.channels, targetOffset += 4) {
  const observed = [data[sourceOffset], data[sourceOffset + 1], data[sourceOffset + 2]];
  let best = { alpha: 0, error: Number.POSITIVE_INFINITY };

  for (const foreground of centroids) {
    const vector = foreground.map((value, channel) => value - background[channel]);
    const observedVector = observed.map((value, channel) => value - background[channel]);
    const denominator = vector.reduce((sum, value) => sum + value ** 2, 0);
    const projected = denominator ? observedVector.reduce((sum, value, channel) => sum + value * vector[channel], 0) / denominator : 0;
    const alpha = Math.max(0, Math.min(1, projected));
    const error = observed.reduce((sum, value, channel) => {
      const predicted = background[channel] + alpha * vector[channel];
      return sum + (value - predicted) ** 2;
    }, 0);
    if (error < best.error) best = { alpha, error };
  }

  const distance = Math.sqrt(observed.reduce((sum, value, channel) => sum + (value - background[channel]) ** 2, 0));
  const confidence = smoothstep((distance - 3) / 24);
  const alpha = best.alpha > 0.94 ? 1 : best.alpha * confidence;

  if (alpha <= 0.015) {
    output[targetOffset] = 0;
    output[targetOffset + 1] = 0;
    output[targetOffset + 2] = 0;
    output[targetOffset + 3] = 0;
    continue;
  }

  for (let channel = 0; channel < 3; channel += 1) {
    output[targetOffset + channel] = alpha < 0.985
      ? clamp((observed[channel] - (1 - alpha) * background[channel]) / alpha)
      : observed[channel];
  }
  output[targetOffset + 3] = clamp(alpha * 255);
}

const transparentMark = await sharp(output, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 4 })
  .extend({
    top: safeMargin,
    right: safeMargin,
    bottom: safeMargin,
    left: safeMargin,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .resize({ height: 1024, fit: "inside", kernel: sharp.kernel.lanczos3, withoutEnlargement: false })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();

async function appIcon(size, markHeight, destination) {
  const mark = await sharp(transparentMark)
    .resize({ height: markHeight, fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const markMetadata = await sharp(mark).metadata();
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 246, g: 240, b: 230, alpha: 1 } },
  })
    .composite([{
      input: mark,
      left: Math.round((size - (markMetadata.width ?? markHeight)) / 2),
      top: Math.round((size - (markMetadata.height ?? markHeight)) / 2),
    }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(destination);
}

await mkdir(path.dirname(markPath), { recursive: true });
await writeFile(markPath, transparentMark);
await appIcon(64, 48, iconPath);
await appIcon(180, 140, appleIconPath);

console.log(JSON.stringify({
  message: "Prepared canonical UnlockED logo assets.",
  source: path.relative(root, sourcePath),
  mark: path.relative(root, markPath),
  background: background.map((value) => Number(value.toFixed(2))),
  centroids: centroids.map((centroid) => centroid.map((value) => Number(value.toFixed(2)))),
  icons: [path.relative(root, iconPath), path.relative(root, appleIconPath)],
}, null, 2));
