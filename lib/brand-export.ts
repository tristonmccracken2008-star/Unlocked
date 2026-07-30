import { UNLOCKED_MARK_SRC } from "@/data/brand-assets";

const embeddedAssets = new Map<string, Promise<string>>();

function blobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The UnlockED logo could not be prepared."));
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("The UnlockED logo could not be prepared."));
    reader.readAsDataURL(blob);
  });
}

async function embeddedAsset(path: string) {
  const existing = embeddedAssets.get(path);
  if (existing) return existing;
  const pending = fetch(path, { cache: "force-cache" }).then(async (response) => {
    if (!response.ok) throw new Error(path === UNLOCKED_MARK_SRC ? "The UnlockED logo could not be loaded." : "A card logo could not be loaded.");
    return blobAsDataUrl(await response.blob());
  }).catch((error) => {
    embeddedAssets.delete(path);
    throw error;
  });
  embeddedAssets.set(path, pending);
  return pending;
}

export async function serializeBrandedArtwork(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const assets = clone.querySelectorAll<SVGImageElement>("image[data-unlocked-brand-mark], image[data-export-asset]");
  for (const asset of assets) {
    const path = asset.getAttribute("href") ?? asset.getAttributeNS("http://www.w3.org/1999/xlink", "href");
    if (!path?.startsWith("/")) continue;
    const dataUrl = await embeddedAsset(path);
    asset.setAttribute("href", dataUrl);
    asset.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
  }
  return new XMLSerializer().serializeToString(clone);
}
