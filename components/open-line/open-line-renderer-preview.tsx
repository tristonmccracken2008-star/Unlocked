import type { PathGeometry } from "@/data/open-line";
import { OpenLineRenderer, type OpenLineRendererProps } from "./open-line-renderer";

export type OpenLineRendererPreviewProps = Pick<OpenLineRendererProps, "theme" | "quality" | "className" | "idPrefix"> & {
  geometry: PathGeometry;
  diagnostics?: boolean;
};

/** Diagnostic-only preview surface. It is intentionally not mounted by any route. */
export function OpenLineRendererPreview({ geometry, diagnostics = true, ...props }: OpenLineRendererPreviewProps) {
  return <OpenLineRenderer
    geometry={geometry}
    background="paper"
    interactive
    showLabels
    showWaypoint
    showFuture
    showBranches
    showDiagnostics={diagnostics}
    title="Open Line renderer preview"
    description="A diagnostic preview of the canonical Open Line SVG renderer."
    {...props}
  />;
}
