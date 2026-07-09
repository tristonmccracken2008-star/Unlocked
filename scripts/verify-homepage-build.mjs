import { readFile } from "node:fs/promises";

const homepagePath = new URL("../.next/server/app/index.html", import.meta.url);
const homepage = await readFile(homepagePath, "utf8");
const requiredSignatures = [
  'data-unlocked-home="personalized-dashboard-v1"',
  "Preparing your workspace.",
  "Checking your account and saved profile.",
];

const missing = requiredSignatures.filter((signature) => !homepage.includes(signature));
if (missing.length) {
  throw new Error(`Production homepage verification failed. Missing: ${missing.join(", ")}`);
}

console.log("Verified the personalized UnlockED homepage in the production build.");
