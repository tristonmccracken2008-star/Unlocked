import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, "data", "db", file), "utf8"));
const categories = readJson("categories.json");
const schools = [...readJson("schools.json"), ...readJson("institutions.json")];
const opportunities = readJson("opportunities.json");
const benefitSlugs = opportunities.filter((item) => item.type === "Benefit" && item.metadata?.legacySlug).map((item) => item.metadata.legacySlug);

const staticRoutes = new Set([
  "/",
  "/about",
  "/ai",
  "/benefits",
  "/best-edu-email-perks",
  "/build-career",
  "/career",
  "/contact",
  "/disclaimer",
  "/financial",
  "/free-student-software",
  "/get-ahead",
  "/help",
  "/local",
  "/my-opportunities",
  "/opportunities",
  "/privacy",
  "/profile",
  "/research",
  "/save-money",
  "/scholarships",
  "/school-not-found",
  "/software",
  "/student-ai-tools",
  "/student-discounts",
  "/submit-perk",
  "/terms",
  "/university",
  "/updates",
  "/admin/analytics",
  "/admin/content",
  "/admin/review",
  "/api/auth/google",
]);

for (const item of schools) staticRoutes.add(`/schools/${item.slug}`);
for (const item of opportunities) staticRoutes.add(`/opportunities/${item.id}`);
for (const slug of benefitSlugs) staticRoutes.add(`/benefits/${slug}`);
for (const item of categories) if (item.slug !== "all") staticRoutes.add(`/categories/${item.slug}`);

const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".next" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx|ts|mjs|md)$/.test(entry.name)) sourceFiles.push(full);
  }
}
walk(path.join(root, "app"));
walk(path.join(root, "components"));
walk(path.join(root, "docs"));

const failures = [];
const patterns = [
  /href=["'`]([^"'`]+)["'`]/g,
  /href:\s*["'`]([^"'`]+)["'`]/g,
  /Link href=["'`]([^"'`]+)["'`]/g,
];

function normalizeLink(raw) {
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/api/") && raw !== "/api/auth/google") return null;
  return raw.split("#")[0].split("?")[0].replace(/\/$/, "") || "/";
}

for (const file of sourceFiles) {
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const route = normalizeLink(match[1]);
      if (!route) continue;
      if (route.includes("${") || route.includes("`") || route.includes("[") || route.includes("(")) continue;
      if (!staticRoutes.has(route)) failures.push(`${path.relative(root, file)} links to missing route ${route}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Checked internal links against ${staticRoutes.size} known routes.`);
