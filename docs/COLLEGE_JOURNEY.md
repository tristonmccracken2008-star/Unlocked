# Journey and Path Moments

Journey is the canonical progress experience for tracked opportunities. Application status remains managed by the existing Journey Board, while the editorial Journey reads the same persisted transition history through the Open Line systems.

Path Moments are the sharing layer. A Path Moment represents one evidenced transformation, never a dashboard recap or a synthetic progress summary.

## Data Flow

1. Existing account activity and transition history build the canonical `Pathprint`.
2. The Narrative and Branch Intelligence systems attach deterministic meaning.
3. `lib/journey-editorial.ts` builds the editorial Journey once on the server.
4. `lib/path-moments.ts` reuses that Pathprint and its share geometry to select eligible moments.
5. The client receives only the resulting Path Moment collection and renders an opt-in preview.

No second status, milestone, or persistence system is created.

## Eligibility

Path Moments may represent:

- first application
- first submission
- first interview
- first acceptance
- first completed experience
- meaningful career-direction shift
- semester recap
- first research experience
- scholarship
- fellowship
- leadership
- portfolio milestone

Routine views and saved opportunities are explicitly suppressed. Every exported moment retains a signature derived from its canonical event, narrative, and cropped geometry.

## Composition

Each image contains only:

- one narrative headline
- one supporting explanation
- one cropped Open Line segment
- one semantic marker
- optional user-selected details
- subtle UnlockED branding

Supported PNG layouts are:

- Instagram Story: `1080 x 1920`
- Square: `1080 x 1080`
- LinkedIn: `1200 x 627`

The SVG preview is serialized and rasterized at the exact target dimensions. Copy image and native share appear only when the browser supports them.

## Privacy

Path Moments are anonymous by default. School, organization, opportunity, month/year, and first or full name require an explicit choice in the preview.

Path Moments never include GPA, notes, application counts, rejection history, internal identifiers, or the full Journey.

## Analytics

Path Moment and Semester Story actions use the privacy-first `_v1` event contract in `docs/PRODUCT_INTELLIGENCE.md`. Export content, Journey narrative text, selected identity values, and image bytes never enter analytics. Historical `journey_card_*` and unversioned Path Moment names remain registry-only compatibility identifiers and are not emitted by current creators.

## Validation

Run:

```bash
npm run check:path-moments
npm run test:path-moments-browser
npm run check:journey-visual
npm run test:journey-visual-browser
```

The checks cover all supported types, evidence rules, deterministic signatures, privacy defaults, exact image dimensions, download, copy fallback behavior, mobile layout, dark mode, reduced motion, Chromium, and WebKit.

## Visual System

Journey uses one editorial hierarchy across its opening, history, and Horizon. Forest identifies actions and the Open Line; gold is reserved for evidenced validation; mineral is limited to metadata. The current waypoint is the only prominent contained surface. History remains on the page, with quiet inline surfaces appearing only after a detail disclosure opens.

The history and Horizon rails share one alignment token at each breakpoint. At mobile widths the waypoint participates in document flow beside the rail, including an explicit 320px treatment that keeps the primary action clear of fixed navigation. Long histories and alternate Horizon directions remain bounded by server-side progressive disclosure rather than synthetic offscreen heights.

Path Moment exports use the same serif/sans hierarchy and a larger local Pathprint crop in every format. Optional footer details are arranged into separate identity and context rows so full privacy selections remain inside the export bounds.

## Theme Architecture

Journey, Open Line, Path Moments, and Semester Stories share the semantic contract in `lib/journey-theme.ts`. Light and dark modes use identical role names for canvas, surfaces, text, Forest direction, sparse gold validation, path states, borders, focus, errors, and success. The Open Line renderer accepts legacy compact custom themes but normalizes them over that contract. Theme selection never enters Pathprint, geometry, narrative, moment, or Semester Story signatures.

Dark mode uses a warm editorial canvas (`#17120f`) and surface (`#211a16`) rather than black. Primary text is `#fbf3e8`; direction is `#73b992`; validation is `#d4b06a`. Components consume semantic CSS variables instead of global utility overrides. Forced-colors retains native control and outline behavior.

Path Moment and Semester Story creators provide an explicit Light/Dark export choice. The preview SVG carries the chosen theme and is the exact SVG serialized for PNG export, so preview and file appearance cannot diverge. Export dimensions and canonical evidence remain unchanged.

Appearance is stored with the cloud account. `system` follows `prefers-color-scheme`; the pre-paint bootstrap reads the account cache, while a same-site color-scheme cookie lets server-rendered Journey artwork agree on later requests. A first visit without a prior system cookie safely begins in light mode and the bootstrap resolves before body content paints. Logout clears the account cache and returns the public product to light.

## Accessibility contract

Journey keeps its editorial reading order as the accessibility source of truth: one page heading, a labelled current-waypoint region, chronological ordered history, and an ordered Horizon. The Open Line is decorative in the Journey page because the same state and chronology are available as text; noninteractive Open Line SVGs never enter the keyboard order. Marker meaning is repeated in text and is not conveyed by color alone.

Native disclosures and dialogs provide keyboard behavior, Escape handling, and focus restoration. Path Moment and Semester Story previews expose privacy-aware text descriptions and keep their artwork SVGs decorative. Journey mutations produce one polite success announcement, specific alert semantics for failures, and retain focus on the initiating control. Reduced motion removes presentation timing without delaying state or announcements. Forced-colors and increased-contrast modes retain borders, focus indicators, and structural distinctions.

`npm run check:journey-accessibility` is deployment-blocking. `npm run test:journey-accessibility-browser` covers keyboard order, focus visibility, zoom-equivalent reflow, reduced motion, forced colors, mobile layouts, and export dialogs in Chromium and WebKit.

## Performance boundaries

Journey remains server-first. Account activity is adapted once and reused by advisor, roadmap, Pathprint, history, Horizon, and export projections. Desktop, tablet, and mobile geometry are produced on the server; the browser mounts one responsive Open Line SVG and performs no layout measurement or geometry generation.

Path Moment and Semester Story entry controls are intentionally small hydration boundaries. Their creator, artwork, canvas export, clipboard, and native-share code loads on pointer or keyboard intent and mounts only while its dialog is open. Closing a creator releases its artwork tree. Renderer paths and visibility projections use geometry-keyed `WeakMap` caches so theme changes and stable rerenders reuse deterministic SVG preparation without retaining obsolete geometry.

`npm run check:journey-performance` protects these architecture guarantees and broad catastrophic server timing ceilings. `npm run test:journey-performance-browser` verifies meaningful paint, layout stability, one-SVG rendering, immediate controls, lazy dialogs, exports, mobile scrolling, reduced motion, Chromium, and WebKit. Strict deterministic subsystem timing remains in `npm run benchmark:open-line`; browser development compilation is excluded from responsiveness conclusions.

## Semester Story

Semester Story is a deterministic term recap built from the same canonical `Pathprint` already produced for Journey. `lib/semester-story.ts` groups only meaningful, timestamped events into academic terms, creates a privacy-safe term projection, and passes that projection to the existing Open Line geometry engine. It does not read recommendations, rebuild Journey, perform network work, or introduce another status model.

The documented fallback calendar is contiguous and intentionally general: Winter is January, Spring is February through May, Summer is June through August, and Fall is September through December. Each term records `source: default_calendar`. The contract accepts school-calendar or profile-derived term overrides so an institution-specific calendar can replace the fallback without changing story logic. The UI never presents the fallback as an official school calendar.

Eligible evidence is limited to direction choices, applications started or submitted, interviews, acceptances, and completed experiences. Views, saves, refreshes, profile edits, logins, and referral activity are suppressed. A recap contains one evidence-based opening, a term-only Pathprint with an open endpoint, up to four strongest chronological moments, up to three secondary counts, and concrete “What changed” statements. Previous-term comparison appears only when both adjacent terms contain at least two reliable moments and the later term shows a stronger evidenced phase.

Active terms are labeled “so far.” Completed-term signatures depend only on the versioned term definition, canonical term events, deterministic copy, and geometry signature, so later recommendation changes cannot rewrite historical recaps.

Semester Story shares Path Moment’s exact PNG formats (`1080 x 1920`, `1080 x 1080`, and `1200 x 627`) and export mechanics. The creator and artwork are dynamically imported only after the student activates a real recap. The Journey entry point is omitted when no term contains qualifying evidence.

Privacy defaults are anonymous with only the academic term, general narrative, and Pathprint included. Name, school, major, opportunity, organization, date, counts, and profile link are opt-in. GPA, notes, application answers, rejection details, citizenship, eligibility data, source IDs, hidden branches, and the full Journey never enter the export projection.

Validate with:

```bash
npm run check:semester-story
npm run test:semester-story-browser
npm run check:journey-dark-theme
npm run test:journey-dark-theme-browser
```
