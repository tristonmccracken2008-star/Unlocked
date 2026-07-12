import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readText = (file) => fs.readFileSync(path.join(root, file), "utf8");
const opportunities = JSON.parse(fs.readFileSync(path.join(root, "data/db/opportunities.json"), "utf8"));

const enrichment = readText("data/opportunity-enrichment.ts");
const opportunitiesModule = readText("data/opportunities.ts");
const intelligence = readText("data/opportunity-intelligence.ts");
const logos = readText("data/organization-logos.ts");
const docs = readText("docs/RECOMMENDATION_ENGINE.md");

for (const field of [
  "organizationDomain",
  "normalizedOrganization",
  "rollingDeadline",
  "freshmanEligible",
  "sophomoreEligible",
  "juniorEligible",
  "seniorEligible",
  "graduateEligible",
  "internationalEligible",
  "minimumGPA",
  "careerFields",
  "dataQualityScore",
  "linkStatus",
]) {
  assert.ok(enrichment.includes(field), `Canonical enrichment model must include ${field}.`);
}

for (const helper of [
  "canonicalOpportunity",
  "canonicalCategory",
  "structuredEligibility",
  "dataQualityScore",
  "detectDuplicateOpportunities",
  "opportunityEnrichmentAudit",
]) {
  assert.ok(enrichment.includes(`function ${helper}`) || enrichment.includes(`export function ${helper}`), `Missing enrichment helper ${helper}.`);
}

assert.ok(opportunitiesModule.includes("canonical: canonicalOpportunity(item)"), "Opportunities must attach canonical enrichment data.");
assert.ok(opportunitiesModule.includes("canonicalOpportunity(item).searchText"), "Search must include enriched search text.");
assert.ok(intelligence.includes("canonicalOpportunity(item)") && intelligence.includes("dataQualityScore(item)"), "Recommendation intelligence must consume enriched metadata.");
assert.ok(logos.includes("organizationLogoRegistry") && logos.includes("aliases"), "Organization registry must support aliases.");
assert.ok(docs.includes("Opportunity Quality Score"), "Recommendation docs must document enriched quality scoring.");

const normalized = (value) => String(value ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const duplicateGroups = new Map();
const missing = [];
const nonHttps = [];
const weakTags = [];
const weakDescriptions = [];
for (const item of opportunities) {
  const key = normalized([item.title, item.organization, item.official_source_url, item.application_deadline ?? item.metadata?.deadlineType ?? ""].join(" "));
  duplicateGroups.set(key, [...(duplicateGroups.get(key) ?? []), item.id]);
  if (!item.organization?.trim()) missing.push(`${item.id}: organization`);
  if (!item.category?.trim()) missing.push(`${item.id}: category`);
  if (!item.eligibility?.trim()) missing.push(`${item.id}: eligibility`);
  if (!item.official_source_url?.startsWith("https://")) nonHttps.push(item.id);
  if (!Array.isArray(item.tags) || item.tags.length < 2) weakTags.push(item.id);
  if (!item.description || item.description.length < 40 || /<[^>]+>/.test(item.description)) weakDescriptions.push(item.id);
}
const duplicates = [...duplicateGroups.values()].filter((ids) => ids.length > 1);

assert.equal(missing.length, 0, `Missing required enrichment inputs:\n${missing.slice(0, 20).join("\n")}`);
assert.equal(nonHttps.length, 0, `Non-HTTPS official sources found: ${nonHttps.slice(0, 20).join(", ")}`);
assert.equal(duplicates.length, 0, `Duplicate opportunity keys found: ${duplicates.slice(0, 10).map((ids) => ids.join(", ")).join(" | ")}`);
assert.equal(weakTags.length, 0, `Opportunities with weak tag coverage: ${weakTags.slice(0, 20).join(", ")}`);
assert.equal(weakDescriptions.length, 0, `Opportunities with weak descriptions or HTML fragments: ${weakDescriptions.slice(0, 20).join(", ")}`);

console.log("Opportunity enrichment checks passed.");
