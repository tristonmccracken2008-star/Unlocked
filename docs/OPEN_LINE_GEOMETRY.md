# Open Line Geometry Engine

The geometry engine is the second renderer-independent Open Line layer:

```text
Pathprint projection
  -> resolved layout constraints
  -> quiet-event units
  -> positioned nodes and stable branch lanes
  -> cubic Bezier segments
  -> intersections, validation axes, and diagnostics
  -> PathGeometry
```

It contains no React, SVG, Canvas, CSS, DOM measurement, browser API, persistence, network access, or recommendation logic.

## Coordinate System

- The logical origin is the top-left.
- Positive X moves right; positive Y moves forward chronologically.
- Every segment has at least 48 logical pixels of vertical travel.
- End-to-end direction changes never exceed 42 degrees.
- Geometry receives explicit options and never reads a viewport.
- All points are finite, dimensions are non-negative, and generated bounds are validated before return.

## Canonical Modes

| Mode | Width | Primary rail | Visible branches | Visible possibilities | Routine / meaningful / validation spacing |
| --- | ---: | ---: | ---: | ---: | --- |
| Desktop | 1200 | 576 | 3 | 3 | 72 / 104 / 144 |
| Tablet | 880 | 388 | 3 | 3 | 68 / 96 / 132 |
| Mobile | 390 | 40 | 2 | 2 | 68 / 96 / 132 |
| Share | 1080 | 518 | 3 | 3 | 72 / 104 / 144 |

Desktop output is capped at 1200 logical pixels. Mobile labels always start to the right of the 40px rail, while branch and curve coordinates remain on or left of that rail. All modes reserve at least 44px interaction geometry for the future renderer.

## Vertical Rhythm

Spacing uses semantic progress first and Prompt 1 importance second:

- Exploration: routine spacing.
- Intention: midpoint between routine and meaningful spacing.
- Action: meaningful spacing.
- Commitment: midpoint between meaningful and validation spacing.
- Validation: validation spacing.
- Importance adds a bounded 0-12px hierarchy adjustment.

Lateral travel can increase the gap further so the resulting direction remains within 42 degrees. Lower-level event volume never changes a stronger event's semantic priority.

## Quiet-Event Compaction

Only consecutive `explored` events are eligible.

- Minimum cluster: 3 events.
- Maximum cluster: 8 events.
- Same category: adjacent events may be up to 30 days apart.
- Mixed categories: adjacent events may be up to 7 days apart.
- Every source event ID remains on the cluster node for later disclosure.
- Submissions, validation, acceptances, completions, and evidence are never clustered.
- Compaction runs only on the supplied projection, so private counts cannot affect public geometry.

## Nodes And Labels

The engine emits origin, event, cluster, waypoint, rejoin-junction, horizon, and open-endpoint geometry. Clusters retain the `explored` node kind and carry cluster metadata rather than inventing a new semantic event.

Desktop and tablet labels prefer the outside of branch lanes and alternate around the primary lane when space permits. Mobile labels always resolve right. Bounds reserve expected copy space without measuring text.

## Branch Lanes

Lane `0` is primary. Desktop, tablet, and share layouts use bounded alternatives from `-2, -1, +1, +2`; mobile uses `-1, -2` so paths remain left of copy.

Visible branches are selected by strongest real importance, lifecycle state, start time, and stable key. Preferred lanes derive from a stable branch-key hash. A lane changes only when its preferred slot conflicts with another visible branch. Collapsed branches retain their events on lane `0` and are reported with opaque diagnostic IDs.

## Curves

Each segment is a deterministic cubic Bezier. Control-point weights and a small asymmetric sway derive from stable segment IDs. Controls are clamped to content bounds; mobile controls are additionally clamped to the primary rail. Curves have rounded direction changes without random geometry, sharp corners, arrows, or a repeated symmetric wave.

## Rejoins And Validation

A `rejoined` PathBranch receives a synthetic junction after its last identified branch event. The junction returns to lane `0` with at least 32px of clear space and exposes foreground/background segment order.

Validation-level event nodes expose a deterministic short intersection axis for future rendering. Ordinary exploration, intention, and action nodes do not receive one.

Paused nodes expose a flat terminal cap. Closed nodes expose the same cap plus a 48px terminal fade length; no X marker or fabricated continuation is created.

## Waypoint And Horizon

An existing canonical waypoint is placed after all verified history with larger marker and copy bounds. No waypoint is invented. Up to three desktop or two mobile possibilities branch below the current anchor with `future` state. A central open endpoint always continues beyond them.

`currentWaypointNodeId` gives the future renderer an explicit initial-focus target without coupling geometry to viewport height or scrolling APIs.

## Collision Handling

Layout resolution is bounded to four canonical passes and hard-capped at eight. It uses:

1. Semantic and lateral vertical spacing.
2. Label-side changes outside mobile.
3. Stable bounded lane assignment.
4. Quiet-event compaction.
5. Branch and horizon visibility caps.

Node, label, node-label, content-edge, and sampled segment-label conflicts are diagnosed. Any unresolved conflict remains explicit instead of triggering an unbounded solver.

## Privacy And Diagnostics

Geometry is generated from either a private `Pathprint` or a `PublicPathprint`. The engine never consults hidden source history. Public event IDs, branch IDs, timing, counts, lane assignments, and signatures therefore derive only from the public projection.

Diagnostics contain numeric measurements, opaque IDs, reason types, lane numbers, and counts. They do not include titles, narratives, profile fields, opportunity content, or raw career branch labels.

## Determinism

The geometry signature includes:

- Pathprint transformation version
- geometry-engine version
- resolved mode and options
- node positions and bounds
- segment control points
- branch/lane assignments
- rejoin order
- validation axes

It intentionally excludes `generatedAt`, user-visible copy that does not change geometry, and renderer-only style choices.

## Performance

The engine is synchronous and uses bounded passes, forward compaction, deterministic sorting, and local collision comparisons. The regression suite measures p50 and p95 after warmup rather than relying on a single run.

Run:

```bash
npm run check:pathprint-geometry
```
