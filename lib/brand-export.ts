import { UNLOCKED_MARK_SRC } from "@/data/brand-assets";

let embeddedMarkPromise: Promise<string> | null = null;

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

async function embeddedMark() {
  embeddedMarkPromise ??= fetch(UNLOCKED_MARK_SRC, { cache: "force-cache" }).then(async (response) => {
    if (!response.ok) throw new Error("The UnlockED logo could not be loaded.");
    return blobAsDataUrl(await response.blob());
  }).catch((error) => {
    embeddedMarkPromise = null;
    throw error;
  });
  return embeddedMarkPromise;
}

export async function serializeBrandedArtwork(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const marks = clone.querySelectorAll<SVGImageElement>("image[data-unlocked-brand-mark]");
  if (marks.length) {
    const dataUrl = await embeddedMark();
    for (const mark of marks) {
      mark.setAttribute("href", dataUrl);
      mark.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
    }
  }
  return new XMLSerializer().serializeToString(clone);
}
