# UnlockED visual system implementation

Updated September 2, 2026. The approved UnlockED workspace mockup is the visual source of truth for this system. It establishes one quiet, precise product language across Discover, For You, Journey, Build, Applications, account surfaces, opportunity detail, and supporting editorial routes.

## Direction

UnlockED is an editorial productivity workspace, not a generic dashboard. The interface uses cool near-white canvas layers, dark ink, restrained forest green, a serif display voice, compact sans-serif controls, and selective translucent surfaces. Depth clarifies ownership and priority. It is never decoration by default.

The core reference values are:

- Canvas `#F7F8F8`, elevated canvas `#EEF2F5`, soft surface `#E6EBF1`
- Borders `#D9DFE7` and `#B6BDC9`
- Primary ink `#0F1419`
- Brand soft `#E9F4EE` and `#D6EEDC`
- Brand `#1E7F56`, strong brand `#125D3E`, supporting teal `#348679`

The global semantic aliases are `--canvas`, `--canvas-elevated`, `--surface-solid`, `--surface-subtle`, `--surface-glass`, `--surface-glass-strong`, `--surface-floating`, `--border-soft`, `--border-strong`, `--edge-highlight`, `--text-primary`, `--text-secondary`, `--text-muted`, `--brand`, `--brand-strong`, `--brand-soft`, `--brand-glow`, and the success, warning, danger, and information roles. Components should consume semantic roles rather than copy literal colors.

## Themes

Light mode is the primary visual reference. Ambient green, cyan, violet, and warm light are low-opacity radial fields behind content, never a saturated page background.

Midnight is the same product at night: `#11171D` canvas, `#192129` elevation, `#202A34` surfaces, `#F1F3F2` primary text, and the same green hierarchy with sufficient contrast. Forest remains a distinct deep-green workspace. System mode delegates the choice to the operating system. Theme switching changes tokens, not component geometry or information hierarchy.

## Surfaces and depth

There are three glass tiers:

1. Subtle glass for navigation groups, search, chips, and secondary controls.
2. Standard glass for the floating product header and selected high-level panels.
3. Strong glass for overlays, dialogs, and the single most important card in a workspace.

Ordinary result rows remain opaque or transparent with quiet dividers. Glass is not used on every card. Elevation uses low-contrast shadows at roughly 4/12, 10/24, 18/48, and 28/72 blur/spread scales. A one-pixel inner highlight preserves the crisp edge visible in the reference.

Radii follow a deliberate 6, 10, 14, 18, 24, and 32px progression. Controls use the smaller values; hero panels and floating surfaces use the larger values. Pills are reserved for chips, segmented navigation, status, and compact actions.

## Type, spacing, and controls

Editorial headings use Iowan Old Style/Baskerville/Georgia fallbacks with dark ink, tight leading, and restrained sizes. Product copy and controls use Inter/Avenir/system sans fallbacks. Uppercase eyebrows are small, bold, and widely tracked. Body copy targets a comfortable 1.5–1.7 line height.

The composition is spacious, but not oversized. Major workspaces use bounded 1280–1504px content widths and reduce outer padding continuously on tablet and mobile. Dense rows keep 44px minimum targets. Primary green actions, quiet bordered secondary actions, translucent search fields, compact chips, badges, tabs, toasts, menus, and tooltips all share the same token set.

The desktop header floats 10px from the viewport edge, is bounded to 1504px, and combines the logo, destination navigation, search, notifications, and account identity. Mobile uses a compact four-destination bottom navigation with 44px targets and safe-area positioning.

## Workspace mapping

- Discover uses a compact editorial introduction, a broad search surface, restrained filters, and quiet results.
- For You uses a personalized heading, one elevated top recommendation, flat supporting rows, explicit reasons, and direct Journey actions.
- Journey leads with one next action, then attention, active opportunities, dates, strategy, and history.
- Build leads with one reusable-material action, then resume, experience, and material inventories.
- Applications uses factual status, attention queues, active work, dates, and material reuse without changing the underlying workflow.
- Account, settings, billing, notifications, overlays, and public pages inherit the same canvas, typography, controls, and theme roles.

## Interaction, accessibility, and performance

Motion remains transform/opacity based and honors reduced motion. List continuity does not replay downward movement across newly inserted content, preventing temporary action overlap. Focus rings remain visible, semantic landmarks and native controls remain intact, and touch targets are at least 44px.

Backdrop blur is bounded to chrome, overlays, and select priority surfaces. Reduced-transparency and reduced-motion modes remove expensive or nonessential effects. `content-visibility` remains on long secondary groups. No new runtime visual dependency, font request, or image payload was added.

## Anti-patterns

Do not reintroduce beige canvas tones, oversized marketing headlines inside workspaces, glass on every result, neon dark-mode color, heavy shadows, decorative gradients behind dense data, icon boxes without meaning, or independent page-level palettes. Do not encode state by color alone or place fixed navigation over a primary action.
