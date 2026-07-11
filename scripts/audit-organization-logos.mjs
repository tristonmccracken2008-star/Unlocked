import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const opportunities = JSON.parse(readFileSync("data/db/opportunities.json", "utf8"));
const resolverSource = readFileSync("data/organization-logos.ts", "utf8");
const failures = [];

function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function hostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const organizationCounts = new Map();
const sourceDomains = new Map();
for (const item of opportunities) {
  if (!item.organization?.trim()) failures.push(`Missing organization: ${item.id}`);
  const normalized = normalize(item.organization);
  if (normalized) organizationCounts.set(normalized, [...(organizationCounts.get(normalized) ?? []), item.id]);
  const sourceDomain = hostname(item.official_source);
  if (!sourceDomain) failures.push(`Malformed official source: ${item.id}`);
  else sourceDomains.set(sourceDomain, (sourceDomains.get(sourceDomain) ?? 0) + 1);
}

const curatedDomains = [...resolverSource.matchAll(/domain: "([^"]+)"/g)].map((match) => match[1]);
for (const domain of curatedDomains) {
  assert.doesNotThrow(() => new URL(`https://${domain}`), `Curated logo domain is malformed: ${domain}`);
}

const curatedLogoUrls = [...resolverSource.matchAll(/logoUrl: "([^"]+)"/g)].map((match) => match[1]);
for (const url of curatedLogoUrls) {
  const host = hostname(url);
  if (!url.startsWith("https://")) failures.push(`Curated logo URL must be HTTPS: ${url}`);
  if (host !== "logo.clearbit.com" && !curatedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))) failures.push(`Curated logo URL host is not approved: ${url}`);
}

const duplicatedOrganizations = [...organizationCounts.entries()].filter(([, ids]) => ids.length > 1);
const unresolvedCandidates = [...organizationCounts.keys()].filter((name) => !resolverSource.toLowerCase().includes(name));

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Audited ${opportunities.length} opportunities across ${organizationCounts.size} normalized organizations.`);
console.log(`Curated logo domains: ${curatedDomains.length}. Source domains observed: ${sourceDomains.size}.`);
console.log(`Duplicate normalized organizations in catalog: ${duplicatedOrganizations.length}.`);
console.log(`Organizations relying on source-domain or generated fallback: ${unresolvedCandidates.length}.`);
if (unresolvedCandidates.length) console.log(unresolvedCandidates.slice(0, 40).join("\n"));
