import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const opportunities = JSON.parse(fs.readFileSync(path.join(root, "data/db/opportunities.json"), "utf8"));
const prefix = "national-curated-2026--";
const national = opportunities.filter((item) => item.id.startsWith(prefix));
const failures = [];

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasArray(value) {
  return Array.isArray(value) && value.length > 0;
}

if (national.length < 40) failures.push(`Expected at least 40 curated national records, found ${national.length}.`);

const requiredTypes = ["Scholarship", "Research", "Career", "AI", "Benefit"];
for (const type of requiredTypes) {
  if (!national.some((item) => item.type === type)) failures.push(`Missing national ${type} records.`);
}

const requiredCategories = ["Internships", "Freshman Programs", "Competitions", "Conferences", "Certifications", "Software"];
for (const category of requiredCategories) {
  if (!national.some((item) => item.category === category)) failures.push(`Missing national category: ${category}.`);
}

for (const item of national) {
  if (!item.official_source_url?.startsWith("https://")) failures.push(`${item.id} is missing an HTTPS official source.`);
  if (!hasArray(item.tags)) failures.push(`${item.id} is missing tags.`);
  if (!hasArray(item.majors)) failures.push(`${item.id} is missing supported majors.`);
  if (!hasArray(item.academic_years)) failures.push(`${item.id} is missing supported class years.`);
  if (!hasText(item.eligibility)) failures.push(`${item.id} is missing eligibility.`);
  if (!hasText(item.metadata?.estimatedApplicationTime)) failures.push(`${item.id} is missing estimated application time.`);
  if (!hasText(item.metadata?.expectedROI)) failures.push(`${item.id} is missing expected ROI.`);
  if (!hasArray(item.metadata?.skillsGained)) failures.push(`${item.id} is missing structured skills gained.`);
  if (!hasArray(item.metadata?.careerPaths)) failures.push(`${item.id} is missing structured career paths.`);
  if (!hasArray(item.metadata?.recommendedMajors)) failures.push(`${item.id} is missing recommended majors.`);
  if (!hasArray(item.metadata?.recommendedClassYears)) failures.push(`${item.id} is missing recommended class years.`);
  if (!hasArray(item.metadata?.applicationRequirements)) failures.push(`${item.id} is missing application requirements.`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

const byType = Object.groupBy(national, (item) => item.type);
console.log(`Validated ${national.length} curated national opportunities: ${Object.entries(byType).map(([type, items]) => `${items.length} ${type}`).join(", ")}.`);
