import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const opportunities = JSON.parse(fs.readFileSync(path.join(root, "data/db/opportunities.json"), "utf8"));
const live = process.argv.includes("--live");
const prefix = "national-curated-2026--";
const national = opportunities.filter((item) => item.id.startsWith(prefix));
const failures = [];

function officialHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function checkUrl(item) {
  if (!item.official_source_url?.startsWith("https://")) {
    failures.push(`${item.id} official source is not HTTPS.`);
    return { id: item.id, status: "invalid", url: item.official_source_url };
  }
  if (!live) return { id: item.id, status: "format_only", url: item.official_source_url };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(item.official_source_url, { method: "GET", redirect: "follow", signal: controller.signal, headers: { "user-agent": "UnlockED data verification audit" } });
    const finalHost = officialHost(response.url);
    const originalHost = officialHost(item.official_source_url);
    if (response.status >= 400 && response.status !== 403) failures.push(`${item.id} returned HTTP ${response.status}.`);
    if (!finalHost.endsWith(originalHost.split(".").slice(-2).join(".")) && !originalHost.endsWith(finalHost.split(".").slice(-2).join("."))) {
      failures.push(`${item.id} redirects from ${originalHost} to unexpected host ${finalHost}.`);
    }
    return { id: item.id, status: response.status, url: item.official_source_url, finalUrl: response.url };
  } catch (error) {
    failures.push(`${item.id} failed live link check: ${error instanceof Error ? error.message : "unknown error"}.`);
    return { id: item.id, status: "error", url: item.official_source_url };
  } finally {
    clearTimeout(timeout);
  }
}

const results = [];
for (const item of national) {
  results.push(await checkUrl(item));
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`${live ? "Live" : "Format"} link audit passed for ${results.length} national records.`);
