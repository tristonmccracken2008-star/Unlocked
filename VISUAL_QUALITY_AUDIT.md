# UnlockED Visual Quality Audit

## Before

The product already had strong information architecture and an editorial serif/sans pairing, but most screens used one paper color, the same thin border, small 8–12px radii, and repeated independent cards. Navigation, contextual menus, focus panels, dense content, and overlays did not express clearly different material layers. Midnight mode was warm brown-black rather than the desired navy/charcoal atmosphere. Shadows and radii were frequently embedded as one-off values.

The clearest problems were:

- flat application and public backgrounds;
- identical visual weight across primary and supporting surfaces;
- repeated hard cards in Discover, For You, Applications, and Build;
- weak material distinction for search, dialogs, and contextual navigation;
- direct light-theme RGB values in Resume Lab controls;
- a lead Journey action and lead For You recommendation that were structurally important but materially ordinary;
- dark mode that lacked cool depth and ambient separation.

## Direction Chosen

The rebuild uses warm editorial light mode and deep navy-charcoal dark mode, with static blue/violet/cyan ambient fields. It introduces one centralized material hierarchy, three bounded glass tiers, four shadow tiers, four radius tiers, an edge-highlight token, and opaque fallbacks. The motion system, routes, workflow ownership, data logic, auth, billing, recommendation safety, and Journey authority were not changed.

## Changed Areas

- Product shell: frosted sticky navigation, stronger scrolled state, layered contextual menus, and material mobile navigation.
- Public marketing: ambient hero composition, restrained grid texture, and a glass product-preview frame.
- Universal Search and overlays: strong elevated glass, dim/blur separation, inner highlight, WebKit prefix, and opaque fallback.
- Discover: glass search command surface and quiet result cards with removed default shadows; filters use a quieter solid layer.
- For You: atmospheric page field, one elevated lead recommendation, quieter subsequent rows, and subtle glass utilities.
- Journey: consolidated orientation/next-action composition and one elevated canonical action surface. History and dense rows remain solid.
- Applications: larger unified application surface, quiet context groups, and reduced equal-weight card treatment.
- Opportunity Detail: atmospheric editorial hero and one elevated decision panel; trust and evidence remain factual.
- Build: ambient workspace canvas and elevated next-action composition.
- Resume Lab: tokenized theme-aware controls, translucent editor material, and unchanged solid white resume paper.
- Explore, Collections, Paths, and Planner: retained their borderless editorial row composition while gaining faint contextual depth.
- Toast/recovery feedback: elevated transient material without duplicate UI or decorative glow.

## Card, Border, and Composition Decisions

Discover result cards lost their default shadows and use quiet subtle surfaces; hover/focus alone increases contrast. Journey's primary composition and Build's next action now group related content in one larger parent rather than several equally weighted rectangles. For You's secondary matches remain border-separated editorial rows. Applications remain one workflow surface with rows, not a collection of floating glass tiles.

The repository still contains many borders because trust evidence, forms, timelines, and data rows legitimately need separation. New glass surfaces use the highlight border token; dense sections continue to use the standard divider token. This pass centralizes future decisions without attempting unrelated markup cleanup across every legacy module.

## Intentionally Solid or Quiet

Opportunity results, eligibility checks, official-source trust information, comparison tables, calendar cells, application rows, Materials rows, Journey history, Resume paper, settings forms, error states, and long reading surfaces are not glass. Semantic states retain their established colors. There is no glow on citations, status pills, ordinary icons, or every button.

## Accessibility and Compatibility

Dark theme token checks report strong contrast: 17.60:1 primary/canvas, 12.28:1 secondary/canvas, 7.93:1 muted/canvas, 9.59:1 accent/canvas, and 9.20:1 gold/canvas. Focus behavior and 44px controls are preserved. Mobile public inspection at 390px showed no horizontal overflow and a 44px minimum sampled focusable height.

Every blurred material includes `-webkit-backdrop-filter`. Unsupported backdrop filtering and reduced-transparency preferences receive opaque elevated materials. Mobile uses smaller blur and static page backgrounds. Reduced-motion rules and the recently completed layout-continuity system are unchanged. Print explicitly removes the application background; resume paper remains canonical.

## Performance and Footprint

No runtime dependency was added. The initial source CSS footprint was 389,621 bytes; the final implementation source CSS is 404,254 bytes, a 14,633-byte increase (3.76%). Blur is limited to navigation, overlays, search, and a handful of focal panels rather than long lists. The optimized build emits 511,158 bytes of CSS across its generated chunks. The total static-chunk directory moved from 20,420 KB to 20,436 KB (+16 KB, 0.08%).

Primary-route JavaScript stayed within the existing performance guardrails: Journey and Discover each load five chunks with a 90,877-byte maximum; Explorer and Collections each load three with a 52,671-byte maximum; For You loads five with a 52,671-byte maximum. The fixture-backed application-performance suite passed on desktop, narrow desktop, tablet, and mobile, with all warm-route samples remaining below the repository's thresholds.

## Validation Record

- TypeScript, lint, the complete prebuild regression gate, the production build, 80-page static generation, and postbuild checks passed.
- Visual-language, global UX, product-polish, premium-navigation, motion, dark-theme, accessibility, Journey visual, Path Moment, Semester Story, Discover, For You, Build, Resume Lab, Applications, and all opportunity-mode checks passed.
- Public QA passed at 1440px and 390px with no horizontal overflow and a sampled 44px minimum focusable height.
- Fixture-backed Chromium and WebKit suites passed for Applications, Build/Resume, Journey, Explorer, Collections, Paths, and app performance. Coverage includes dark mode, reduced motion, 200% effective zoom, 390–1728px layouts, print, signed-out states, account isolation, and Journey datasets up to 500 historical records.
- One Journey stress-test failure revealed that the recovery toast could intercept an unrelated click. The host is now pointer-transparent while its controls remain interactive; the identical suite then passed.

## Remaining Weaknesses

Several older feature modules still contain embedded shadow and radius values. Replacing all of them would be a separate component-system migration and risks changing established print/export or dense-data layouts. Some browsers cannot blur page content and intentionally receive an opaque premium surface. The public hero remains deliberately sparse; it gains atmosphere and depth without adding illustrations or unnecessary marketing sections.

## Rejected Effects

The pass explicitly rejected animated gradients, full-page blur, glass result grids, frosted data tables, neon edges, RGB glow, liquid distortion, giant orbs, gradient text in the authenticated app, decorative charts, icon-container proliferation, and a new UI or visual-effects dependency.
