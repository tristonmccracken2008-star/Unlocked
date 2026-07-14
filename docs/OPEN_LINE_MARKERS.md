# Open Line Marker System

Open Line markers communicate progress state. Event glyphs communicate event type. The two systems are deliberately separate.

## Canonical aperture

Every marker references one normalized 32-unit UnlockED aperture path with an upper-right opening. Production SVG defines the path once and reuses it through `<use>`. The primitive scales without reading layout or modifying geometry.

## Size tokens

| Token | Visible size | Use |
| --- | ---: | --- |
| `trace` | 8px | explored and open endpoints |
| `small` | 16px | chosen, future, paused, and rejoin |
| `origin` | 20px | journey origin |
| `standard` | 24px | active, submitted, and completed |
| `waypoint` | 32px | current recommended action |
| `validation` | 32px | external response and acceptance |

Visible size never changes the independent 44 by 44 interaction target.

## Stroke tokens

Trace uses 1.25px, small uses 1.5px, origin uses 1.75px, standard/waypoint/validation use 2px, details use 1.5px, cross strands use 1.75px, and focus infrastructure uses 1.5px. Marker primitives compensate for their internal SVG scale so these remain optical output widths.

## State grammar

- Origin: quiet 20px forest aperture.
- Explored: 8px neutral hollow aperture trace.
- Chosen: 16px open forest aperture.
- Active: 24px open aperture with a 6px solid center.
- Waypoint: 32px double deep-forest aperture.
- Submitted: 24px forest body with cream aperture.
- Validated: forest body with a restrained 32px gold validation aperture.
- Accepted: gold outer aperture, forest center, and cream aperture.
- Completed: forest body with a cream aperture and one woven cream strand.
- Future: 16px neutral dashed aperture.
- Paused: neutral open endpoint with a perpendicular terminal cap.
- Closed: quiet neutral open endpoint; terminal fade remains the primary signal.
- Junction: small aperture with a woven crossing strand.
- Endpoint: dashed trace preserving the line's open ending.

Gold is limited to validation and acceptance markers plus the short validation axis supplied by geometry.

## Interaction and accessibility

Markers expose static `default`, `hover`, `focus-visible`, `selected`, and `disabled` visual states without adding behavior or motion. Focus uses mineral, selection uses forest, and neither can be confused with gold validation. Noninteractive instances do not advertise clickability.

Each informative marker has deterministic title and description IDs. Interactive renderer targets carry the same semantic labels in chronological order. Decorative markers can be hidden explicitly. Public cluster labels never expose counts; private detailed contexts may opt into a quiet count.

## Event glyphs

`OpenLineEventGlyph` provides custom lightweight application, interview, research, scholarship, experience, skill-evidence, and completion drawings. They are intended beside future labels and are never rendered inside the core progress marker.

## Preview

```bash
npm run preview:open-line-markers
npm run preview:open-line-renderer
```

Generated assets:

- [Marker gallery](./open-line-marker-gallery.svg)
- [Renderer preview](./open-line-renderer-preview.svg)

No public route mounts either preview.
