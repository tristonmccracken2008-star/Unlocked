import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { OpenLineMarkerGallery } from "../components/open-line/open-line-marker-gallery";

const svg = renderToStaticMarkup(<OpenLineMarkerGallery />);
writeFileSync(new URL("../docs/open-line-marker-gallery.svg", import.meta.url), `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`, "utf8");
console.log("Open Line marker gallery rendered at 1200x1260.");
