import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const routes = [
  ["Journey", ".next/server/app/page_client-reference-manifest.js", "[project]/app/page"],
  ["Discover", ".next/server/app/opportunities/page_client-reference-manifest.js", "[project]/app/opportunities/page"],
  ["For You", ".next/server/app/advisor/page_client-reference-manifest.js", "[project]/app/advisor/page"],
];
const results = [];

for (const [label, manifestPath, routeKey] of routes) {
  assert.ok(existsSync(manifestPath), `${label} client reference manifest is missing.`);
  const source = readFileSync(manifestPath, "utf8");
  const sandbox = { globalThis: {} };
  vm.runInNewContext(source, sandbox, { filename: manifestPath });
  const routeManifest = sandbox.globalThis.__RSC_MANIFEST?.[routeKey.replace("[project]/app", "").replace(/^\/page$/, "/page")]
    ?? sandbox.globalThis.__RSC_MANIFEST?.[`/${routeKey.split("/app/")[1]}`];
  assert.ok(routeManifest?.entryJSFiles, `${label} entry chunks are missing from the client manifest.`);
  const chunks = [...new Set(routeManifest.entryJSFiles[routeKey] ?? [])];
  assert.ok(chunks.length > 0, `${label} must reference at least one client entry chunk.`);
  const sizes = chunks.map((chunk) => ({ chunk, bytes: statSync(path.join(".next", chunk)).size }));
  const largest = sizes.sort((left, right) => right.bytes - left.bytes)[0] ?? { chunk: "none", bytes: 0 };
  assert.ok(largest.bytes < 1_000_000, `${label} still references an oversized client chunk: ${largest.chunk} (${largest.bytes} bytes).`);
  assert.ok(!chunks.some((chunk) => readFileSync(path.join(".next", chunk), "utf8").includes('"benefit--github-student-developer-pack"')), `${label} must not embed the opportunity catalog in browser JavaScript.`);
  results.push({ route: label, chunks: chunks.length, largestChunkBytes: largest.bytes });
}

console.log(JSON.stringify({ message: "Primary product bundle checks passed.", routes: results }, null, 2));
