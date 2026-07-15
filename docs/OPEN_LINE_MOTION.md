# Open Line Motion Engine

## Architecture

Motion is a consumer of canonical semantic and geometry state:

```text
Previous PathGeometry
  + Current PathGeometry
  + update cause
  -> stable-ID geometry diff
  -> semantic transition classification
  -> preference-adjusted motion plan
  -> cancellable browser animation driver
```

The current geometry is always rendered as the canonical accessible state. Animation only changes its temporary visual presentation. Removed waypoints and horizon items use a temporary `aria-hidden` previous-geometry layer, which is removed after the plan settles.

The planner has no React, browser, network, persistence, or DOM dependency. The browser driver does not calculate geometry or call `getTotalLength()`; path lengths are approximated once from the canonical cubic geometry with a bounded 12-step calculation.

## Transition detection

`diffOpenLineGeometry()` compares stable identifiers rather than array positions. It records:

- added and removed nodes
- marker-kind changes
- added and removed segments
- segment-state changes
- added, removed, paused, closed, and rejoined branches
- new validation nodes
- waypoint and horizon changes
- geometry-only coordinate and curve changes

Endpoint identity changes caused by viewport layout are excluded from semantic change counts. Explicit causes suppress misleading progress animation for normal revisits, snapshot refreshes without semantic changes, layout changes, theme changes, privacy projections, and imported histories.

## Timing

All durations and easing are centralized in `OPEN_LINE_MOTION`:

| Token | Duration |
| --- | ---: |
| Focus | 140ms |
| Session reveal | 180ms |
| Disclosure | 240ms |
| Marker | 250ms |
| Pause | 320ms |
| Horizon | 320ms |
| Close | 340ms |
| Branch | 500ms |
| Extension | 640ms |
| Rejoin | 720ms |
| Validation budget | 900ms |

The canonical easing is `cubic-bezier(0.2, 0, 0, 1)`. Foreground motion is capped at 1,600ms, and histories with more than 24 simultaneous semantic changes settle immediately as snapshot refreshes.

## Causal sequences

- Starting: marker center strengthens, the affected strand extends, then its label may appear.
- Submission: the marker fills before commitment extends through it.
- Completion: fill settles, the line extends, accomplishment construction resolves, then meaning and the next waypoint may appear.
- Validation: marker resolves, gold ring draws once, validation axis draws, then copy and horizon changes appear.
- Branch creation: branch strand establishes before branch markers and labels.
- Pause: the affected branch settles into its neutral terminal state.
- Close: only the terminal branch fades; the main line remains unchanged.
- Rejoin: incoming branch draws first, intersection order resolves second, and junction marker settles last.
- Waypoint: old emphasis fades on the previous layer before the new current construction appears. Keyboard focus never moves.
- Horizon: obsolete possibilities fade before new nonbinding possibilities appear.

## Preferences and accessibility

`full`, `reduced`, and `none` plans share the same semantic transition classification. Reduced motion makes line, branch, ring, and intersection drawing immediate and limits remaining fades to 100ms. No-motion plans contain no phases.

System preference is resolved before animation starts, so hydration cannot briefly begin a full transition for a reduced-motion user. The final semantic SVG and optional live-region text exist immediately; animation timing never controls screen-reader state and does not move focus.

## Interruption safety

Each `OpenLineMotionController` owns a generation counter and driver. Starting a newer plan cancels the prior driver. A stale completion cannot invoke its callback, and `skip()` or `dispose()` settles the final canonical DOM and cancels active Web Animations. There are no global mutable controllers, continuous timers, or idle animations.

## Renderer integration

The static renderer remains the default. It exposes motion-layer, plan-signature, segment, marker, validation-axis, and intersection identifiers. `OpenLineMotionRenderer` is an opt-in client wrapper that overlays previous geometry only when an exit phase requires it.

## Laboratory

The laboratory component is developer-only and is not mounted by a production route. It contains 16 scenarios covering the canonical transitions, preferences, interruption, and rapid replacement.

Generate the standalone local preview:

```bash
npm run preview:open-line-motion
```

Then open `docs/open-line-motion-laboratory.html`. The preview supports scenario selection, replay, interruption, and skip controls.

Run deterministic and browser checks:

```bash
npm run check:open-line-motion
npm run test:open-line-motion-browser
```
