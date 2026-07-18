import vm from "node:vm";

const deploymentIdReference = /\bprocess\s*\.\s*env\s*\.\s*NEXT_DEPLOYMENT_ID\b/g;

export function readClientReferenceManifest(source, filename = "client-reference-manifest.js") {
  if (typeof source !== "string" || source.length === 0) {
    throw new Error(`${filename} is empty.`);
  }

  // Vercel manifests may retain this runtime expression. Its value cannot affect
  // which chunks belong to a route, so remove it before inspecting the manifest.
  const safeSource = source.replace(deploymentIdReference, "void 0");
  if (/\bprocess\b/.test(safeSource)) {
    throw new Error(`${filename} contains an unsupported process reference.`);
  }

  const manifestGlobal = Object.create(null);
  const context = vm.createContext(
    Object.assign(Object.create(null), { globalThis: manifestGlobal }),
    { codeGeneration: { strings: false, wasm: false } },
  );
  new vm.Script(safeSource, { filename }).runInContext(context, { timeout: 1_000 });

  const manifest = manifestGlobal.__RSC_MANIFEST;
  if (!manifest || typeof manifest !== "object") {
    throw new Error(`${filename} did not define a client reference manifest.`);
  }
  return manifest;
}
