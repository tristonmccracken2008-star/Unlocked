# UnlockED Motion and Interaction System

## Philosophy

UnlockED is calm when idle and precise when used. Motion communicates a state change, preserves identity during a small layout change, or connects an action to its result. It does not decorate static content. The product does not use scroll reveals, ambient particles, card tilt, cursor effects, sound, synthetic haptics, or full-page transition choreography.

The interaction hierarchy is:

1. **Micro:** press, focus, checkbox, tooltip, menu, and selection feedback.
2. **State:** Watch, Add to Journey, task completion, material selection, disclosure, and comparison selection.
3. **Workflow:** application submission, a Journey lifecycle move, and a genuine milestone.

Intensity follows that hierarchy. Routine saves never trigger particles. Celebration effects are reserved for the existing, server-confirmed major-milestone system.

## Foundation

UnlockED uses its existing CSS and Web Animations foundation. No animation package is installed. This avoids a new shared client dependency and keeps server-rendered pages server-first.

- CSS owns hover, press, focus, presence, dialog, disclosure, status, and loading transitions.
- `lib/motion-system.ts` exposes the small JavaScript token set needed by Web Animations.
- `components/use-layout-continuity.ts` provides bounded FLIP continuity for small keyed lists. It never owns product state.
- Existing Open Line animation remains a domain-specific renderer with its own deterministic motion plan.
- The View Transitions API is intentionally not used; current route identity and browser support do not justify the added routing complexity.

## Tokens

| Concept | Value | Typical use |
| --- | ---: | --- |
| instant | 80 ms | press release and immediate correction |
| fast | 140 ms | hover, focus, icon/state crossfade |
| standard | 220 ms | menus, disclosures, bounded layout movement |
| deliberate | 320 ms | workflow acknowledgement and destination continuity |
| standard easing | `cubic-bezier(.2, .7, .2, 1)` | most UI transitions |
| emphasized easing | `cubic-bezier(.16, 1, .3, 1)` | fast settling without bounce |

CSS tokens live in `app/globals.css`; matching JavaScript values live in `lib/motion-system.ts`. Distances are normally 1–4 px and interaction scale remains between `.975` and `1`.

## Rules by Surface

- **Buttons:** immediate mutation, 80 ms press response, stable labels, delayed loading treatment, and no large scale change.
- **Watch:** bookmark-to-check icon crossfade, stable button width, authoritative pressed semantics, and clear rollback copy.
- **Add to Journey:** inline confirmed state plus a 360 ms source-to-Journey continuity cue when the destination is visible. No burst, confetti, toast duplication, sound, vibration, or fake success.
- **Small lists:** keyed items may use bounded FLIP movement in For You, Application Details, Materials, and Resume Lab. Discover's large result set never animates each row.
- **Application tasks:** check feedback and physical row movement explain completion and reordering; the server response can still roll back optimistic state.
- **Resume switching:** the selected version stays explicit while the editor surface enters over 220 ms. Resume cards do not bounce.
- **Dialogs, menus, and popovers:** enter from the trigger/edge with 0–8 px movement and 140–220 ms duration. Focus management remains authoritative.
- **Loading:** delayed indicators avoid flashes; skeletons keep stable dimensions; animation never delays the request.
- **Milestones:** only server-confirmed important milestones may use the existing stronger celebration layer.

## Reduced Motion

`prefers-reduced-motion: reduce` and the account-level `html[data-motion="reduce"]` setting are both authoritative. They reduce animation and transition duration to effectively immediate, remove translation/scale from surfaces, hide shimmer/progress decoration where appropriate, and make the layout-continuity helper return the final layout without calling `Element.animate()`.

Reduced motion never changes semantics, focus order, accessible names, loading state, or success/error authority.

## Performance and Architecture

- Animate `transform` and `opacity` where possible.
- Never add layout animation to unbounded search results.
- Measure only direct, explicitly keyed children of a small list.
- Do not add observers or global listeners for cosmetic animation.
- Cancel or remove transient Web Animations and DOM decorations during account changes and unmounts.
- Keep server components server-rendered; animation may decorate an existing client boundary but must not create a new page-sized client boundary.
- Do not use animated blur or large shadow interpolation as a routine effect.

## Accessibility

- Native button, link, `details`, dialog, input, checkbox, and progress semantics remain authoritative.
- Essential affordances never depend on hover.
- Focus rings remain visible and focus is restored after popovers close.
- Visual motion is `aria-hidden`; server-confirmed state is announced once through the existing live region.
- Touch targets remain at least 44 px where the surface is designed as a primary interaction.
- Motion does not change tab order, hide the focused element, or delay an ARIA state.

## References Studied

The live sites were inspected on September 1, 2026.

- Motion: layout identity, presence, gestures, reduced motion, LazyMotion guidance, and spring restraint.
- Kokonut UI: compact button, tab, command, and form feedback; its particle and liquid-glass treatments were rejected.
- Bklit UI: chart hover/tooltip precision and search affordances; no charts were added.
- Aceternity UI: attached surface entrances and marketing choreography; animated backgrounds and cursor effects were rejected.
- Cult UI: compact shadcn-compatible disclosure and control patterns; no component was copied.
- 21st.dev: button, accordion, checkbox, dialog, dropdown, navigation, and comparison discovery; patterns were normalized into UnlockED rather than installed.

## Explicit Anti-Patterns

No routine particles, confetti, vibration, sound, custom cursor, magnetic control, tilt card, animated gradient border, ambient glow, constant floating, authenticated-app scroll reveal, generic full-page fade, mass list animation, or dependency added solely for motion.
