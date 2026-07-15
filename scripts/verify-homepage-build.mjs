import { readFile } from "node:fs/promises";

const manifestPath = new URL("../.next/server/app-paths-manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const pagePath = manifest["/page"];
if (!pagePath) throw new Error("Production homepage verification failed. The /page route is missing from the app manifest.");
const homepage = await readFile(new URL(`../.next/server/${pagePath}`, import.meta.url), "utf8");
const chunkPaths = [...homepage.matchAll(/R\.c\("([^"]+)"\)/g)].map((match) => match[1]);
const routeOutput = [
  homepage,
  ...await Promise.all(chunkPaths.map((chunkPath) => readFile(new URL(`../.next/${chunkPath}`, import.meta.url), "utf8"))),
].join("\n");
const requiredSignatures = [
  "journey-editorial-v1",
  "public-or-onboarding-v1",
  "data-journey-editorial",
];

const missing = requiredSignatures.filter((signature) => !routeOutput.includes(signature));
if (missing.length) {
  throw new Error(`Production homepage verification failed. Missing: ${missing.join(", ")}`);
}

console.log("Verified the server-first UnlockED Journey and public homepage branches in the production build.");
