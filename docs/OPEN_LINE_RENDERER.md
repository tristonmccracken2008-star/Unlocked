# Open Line SVG Renderer

`OpenLineRenderer` is the canonical visual layer between deterministic `PathGeometry` and every future Open Line surface. It accepts geometry and paints it; it does not read accounts, infer progress, measure the DOM, or calculate layout.

## Pipeline

```text
Journey data -> Pathprint -> PathGeometry -> OpenLineRenderer -> SVG
```

The renderer lives in `components/open-line/` and is not mounted by an application route yet.

## API

```tsx
<OpenLineRenderer
  geometry={geometry}
  theme="light"
  quality="high"
  interactive={false}
  showLabels
  showWaypoint
  showFuture
  showBranches
  showDiagnostics={false}
/>
```

Themes may be `light`, `dark`, or a complete `OpenLineThemeTokens` object. Rendering logic consumes semantic tokens only.

## SVG layers

The paint order is stable: definitions, background, future paths, completed paths, alternate branches, validation paths, intersections, markers, label anchors, interaction targets, and optional diagnostics. Every marker exposes a 44 by 44 logical-pixel interaction target. Label anchors reserve headline, body, and metadata geometry without rendering final typography.

## Preview

`components/open-line/open-line-renderer-preview.tsx` is an unmounted diagnostic wrapper. The generated visual fixture is [open-line-renderer-preview.svg](./open-line-renderer-preview.svg). Regenerate it with:

```bash
npm run preview:open-line-renderer
```

## Verification

```bash
npm run check:open-line-renderer
```

The check covers empty, single, large, branched, rejoined, future, validation, mobile, desktop, light, dark, SVG validity, deterministic output, duplicate IDs, coordinate precision, accessibility, and server-render performance.

The production marker grammar and exact size/stroke tokens are documented in [OPEN_LINE_MARKERS.md](./OPEN_LINE_MARKERS.md).
