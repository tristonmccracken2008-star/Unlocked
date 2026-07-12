import { existsSync, readFileSync } from "node:fs";

const opportunities = JSON.parse(readFileSync("data/db/opportunities.json", "utf8"));
const resolverSource = readFileSync("data/organization-logos.ts", "utf8");
const config = readFileSync("next.config.mjs", "utf8");

const examples = [
  "Amazon Future Engineer",
  "Adobe",
  "8VC",
  "AFCEA",
  "University of Chicago",
  "OpenAI",
  "GitHub",
  "Apple",
];

function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function hostname(value) {
  try {
    return new URL(value, "https://unlocked.local").hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function parseRegistry() {
  return [...resolverSource.matchAll(/\{ displayName: "([^"]+)", aliases: \[([^\]]+)\], domain: "([^"]+)"(?:, logoUrl: "([^"]+)")?, logoVerified: (true|false) \}/g)].map((match) => ({
    displayName: match[1],
    aliases: [...match[2].matchAll(/"([^"]+)"/g)].map((alias) => alias[1]),
    domain: match[3],
    logoUrl: match[4] || `https://logo.clearbit.com/${match[3]}`,
    logoVerified: match[5] === "true",
  }));
}

const registry = parseRegistry();
const byAlias = new Map();
for (const entry of registry) {
  byAlias.set(normalize(entry.displayName), { entry, alias: entry.displayName });
  for (const alias of entry.aliases) byAlias.set(normalize(alias), { entry, alias });
}

function matchingOpportunity(example) {
  const normalized = normalize(example);
  return opportunities.find((item) => normalize(`${item.organization} ${item.title}`).includes(normalized)) ?? opportunities.find((item) => normalize(item.organization).includes(normalized) || normalize(item.title).includes(normalized));
}

for (const example of examples) {
  const opportunity = matchingOpportunity(example);
  if (!opportunity) {
    console.log(`${example}: no matching opportunity found`);
    continue;
  }
  const normalized = normalize(opportunity.organization);
  const match = byAlias.get(normalized);
  const entry = match?.entry;
  const logoUrl = entry?.logoUrl ?? `https://logo.clearbit.com/${hostname(opportunity.official_source)}`;
  const host = hostname(logoUrl);
  const local = logoUrl.startsWith("/");
  const permitted = local || config.includes(host);
  const succeeds = local ? existsSync(`public${logoUrl}`) : "not checked in offline audit";
  console.log([
    `example=${example}`,
    `opportunity=${opportunity.id}`,
    `organization=${opportunity.organization}`,
    `normalized=${normalized}`,
    `matchedAlias=${match?.alias ?? "none"}`,
    `domain=${entry?.domain ?? hostname(opportunity.official_source)}`,
    `logoUrl=${logoUrl}`,
    `hostPermitted=${permitted}`,
    `requestSucceeds=${succeeds}`,
    `fallbackUsed=${succeeds === true ? "no" : "yes if image request fails"}`,
  ].join(" | "));
}
