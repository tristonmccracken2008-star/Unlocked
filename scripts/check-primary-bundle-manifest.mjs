import assert from "node:assert/strict";
import { readClientReferenceManifest } from "./lib/read-client-reference-manifest.mjs";

const deploymentManifest = `
globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};
globalThis.__RSC_MANIFEST["/page"] = {
  "moduleLoading": { "prefix": process.env.NEXT_DEPLOYMENT_ID },
  "entryJSFiles": { "[project]/app/page": ["static/chunks/app.js"] }
};
`;

const parsed = readClientReferenceManifest(deploymentManifest, "deployment-manifest-fixture.js");
assert.deepEqual(
  Array.from(parsed["/page"].entryJSFiles["[project]/app/page"]),
  ["static/chunks/app.js"],
  "Deployment-ID expressions must not prevent bundle inspection.",
);
assert.equal(parsed["/page"].moduleLoading.prefix, undefined);

assert.throws(
  () => readClientReferenceManifest(
    'globalThis.__RSC_MANIFEST = { "/page": { "secret": process.env.STRIPE_SECRET_KEY } };',
    "secret-reference-fixture.js",
  ),
  /unsupported process reference/,
  "The manifest loader must not expose arbitrary environment variables.",
);

console.log("Primary bundle manifest regression checks passed.");
