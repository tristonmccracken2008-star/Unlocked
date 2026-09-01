# UnlockED Visual Language System

## Philosophy

UnlockED uses material depth to clarify hierarchy, not to decorate every container. The system combines a calm editorial structure with bounded frosted surfaces, static ambient light, subtle internal highlights, and solid reading areas. The product should feel composed and dimensional while remaining a serious opportunity and productivity platform.

Three rules govern the system:

1. One focal material per viewport whenever possible.
2. Dense information stays opaque, quiet, and easy to scan.
3. Blur is reserved for bounded navigation, overlays, search, and decision surfaces.

## Background and Ambient Light

The base canvas uses three static radial fields: cool blue at the upper left, restrained violet at the upper right, and a very faint cyan/green field near the lower center. They are tokens (`--unlocked-ambient-a`, `--unlocked-ambient-b`, and `--unlocked-ambient-c`) so every domain stays in one family.

Contextual pages may reuse only one or two of those lights. For You and Journey use cool blue/violet emphasis, Build and Resume Lab add a faint cyan field, and Discover keeps the treatment closest to neutral. Ambient light always sits behind content and never communicates state.

Authenticated gradients are static. No background gradient is animated.

## Surface Hierarchy

- Layer 0 — `--unlocked-page`: application canvas.
- Layer 1 — `--unlocked-surface-subtle`: large compositional sections and quiet groups.
- Layer 2 — `--unlocked-surface-elevated`: opaque interactive and reading surfaces.
- Layer 3 — `--unlocked-glass-subtle` / `--unlocked-glass`: navigation, bounded controls, and a page's main focus surface.
- Layer 4 — `--unlocked-glass-strong`: dialogs, command search, popovers, and transient feedback.

Glass tiers are deliberately limited to subtle, standard, and strong. They combine translucent fill, a light edge, a small saturation increase, a coherent shadow, and `--surface-inner-highlight`. Browsers without backdrop-filter receive the elevated opaque surface. `prefers-reduced-transparency` also removes blur and translucency.

## Where Glass Belongs

- Global navigation and contextual navigation menus.
- Universal Search and Discover's bounded search shell.
- Dialogs, modal sheets, mobile filters, and transient recovery feedback.
- For You's lead recommendation and small briefing utilities.
- Journey's canonical next action and consolidated focus composition.
- Build's next-action surface and Resume Lab's control panels.
- Opportunity Detail's decision panel.

Opportunity results, trust evidence, tables, eligibility copy, application rows, Journey history, calendar cells, resume paper, and long-form content stay solid or transparent.

## Borders, Shadows, and Shape

`--unlocked-border` separates dense content. `--unlocked-border-highlight` defines glass edges. Borders should not merely announce that a component exists.

Shadows use four tokens: `--shadow-sm`, `--shadow-md`, `--shadow-elevated`, and `--shadow-floating`. Dark shadows are broad and low-contrast; selected high-value surfaces may use a faint cool bloom through `--unlocked-accent-glow`.

Shape uses four levels: control, surface, panel, and floating. Parent surfaces are rounder than their children. Pills remain appropriate for compact filters, status, and navigation—not for ordinary labels or full-width actions.

## Typography and Composition

Iowan Old Style/Baskerville/Georgia remains the confident editorial display voice; Avenir Next/system sans remains the product voice. Page titles are large and balanced, while dense workflow labels stay compact. Secondary text must retain usable contrast on both solid and glass surfaces.

Typography and whitespace establish sections before a box does. For You is editorial and asymmetric, Journey is compact and action-led, Build is a two-surface workspace, and Discover remains information-dense. Large parent compositions replace card soup where the page has one clear job.

## Controls

Primary actions use the established brand color with a restrained vertical tonal gradient and inner highlight. Secondary controls sit on quiet or glass materials without becoming large gray capsules. Hover brightens a surface or border and preserves the existing motion vocabulary; it does not introduce a second animation system.

Focus rings remain explicit and offset. Semantic success, warning, error, and information colors remain factual rather than decorative.

## Themes

Light mode uses warm off-white, translucent white, forest green, and extremely faint blue/violet atmosphere. Midnight uses a deep navy-charcoal canvas (`#0b111b`) with blue-black layers rather than pure black. Forest keeps the same depth model with the brand's green foundation. Dark theme primary, secondary, muted, accent, and gold combinations pass the existing contrast checks.

## Performance and Accessibility

- Blur is bounded; lists and long scrolling result grids never receive backdrop filters.
- Mobile lowers the active blur tier and may use opaque materials.
- WebKit receives prefixed backdrop-filter declarations.
- Unsupported blur and reduced transparency fall back to opaque elevated surfaces.
- Reduced motion behavior is unchanged.
- Resume print forces a white background and never prints product glass.
- Controls preserve 44px touch targets, focus visibility, selection, keyboard behavior, and account/data semantics.

## Anti-patterns

Do not add neon borders, rainbow gradients, animated ambient backgrounds, glass data tables, glowing citations, transparent resume paper, glass on every card, giant gradient orbs, liquid-distortion shaders, decorative semantic colors, or new runtime visual libraries. Premium means clearer hierarchy and fewer competing materials—not more effects.
