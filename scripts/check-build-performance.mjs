import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schoolPage = fs.readFileSync(path.join(root, "app/schools/[slug]/page.tsx"), "utf8");
const benefitPage = fs.readFileSync(path.join(root, "app/benefits/[slug]/page.tsx"), "utf8");
const opportunities = JSON.parse(fs.readFileSync(path.join(root, "data/db/opportunities.json"), "utf8"));

function countStaticSchoolSeeds(source) {
  const match = source.match(/new Set\(\[([\s\S]*?)\]\)/);
  if (!match) return 0;
  return [...match[1].matchAll(/"([^"]+)"/g)].length;
}

assert.ok(schoolPage.includes("export const revalidate = 86400"), "School pages must use ISR instead of full long-tail static generation.");
assert.ok(schoolPage.includes("export const dynamicParams = true"), "School pages must allow on-demand dynamic params.");
assert.ok(schoolPage.includes("preRenderedSchoolSlugs"), "School page must explicitly document the pre-render seed set.");
assert.ok(countStaticSchoolSeeds(schoolPage) <= 24, "School static seed count must stay small enough to avoid generation timeouts.");
assert.ok(benefitPage.includes("export const revalidate = 86400"), "Benefit pages must use ISR instead of full long-tail static generation.");
assert.ok(benefitPage.includes("export const dynamicParams = true"), "Benefit pages must allow on-demand dynamic params.");
assert.ok(benefitPage.includes("scope === \"national\"") && benefitPage.includes("slice(0, 24)"), "Benefit static params must cap pre-rendered benefit pages.");

const estimatedStaticDetailPages = countStaticSchoolSeeds(schoolPage) + 24;
assert.ok(estimatedStaticDetailPages <= 48, `Expected no more than 48 pre-rendered school/benefit detail pages, found ${estimatedStaticDetailPages}.`);

const catalogBytes = Buffer.byteLength(JSON.stringify(opportunities));
assert.ok(catalogBytes < 24_000_000, `Opportunity catalog JSON is unexpectedly large: ${catalogBytes} bytes.`);

console.log(`Build performance checks passed. School/benefit pre-render seed estimate: ${estimatedStaticDetailPages}; catalog size: ${catalogBytes} bytes.`);
