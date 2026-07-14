import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { OpenLineRenderer } from "../components/open-line";
import { createRendererFixtureGeometry } from "./open-line-renderer-fixtures";

const geometry = createRendererFixtureGeometry("desktop");
const svg = renderToStaticMarkup(<OpenLineRenderer
  geometry={geometry}
  idPrefix="open-line-preview"
  background="paper"
  quality="high"
  interactive={false}
  showLabels
  showWaypoint
  showFuture
  showBranches
  title="UnlockED Open Line renderer preview"
  description="A visual test of the completed path, branches, current waypoint, and future possibilities."
/>);

writeFileSync(new URL("../docs/open-line-renderer-preview.svg", import.meta.url), `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`, "utf8");
console.log(`Open Line preview rendered at ${geometry.width}x${geometry.height}.`);
