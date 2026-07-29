# UnlockED motion and milestone feedback

## Audit

UnlockED already had:

- a deterministic Open Line motion planner with full, reduced, and no-motion modes;
- global `prefers-reduced-motion` and account-level `data-motion="reduce"` handling;
- CSS hover and focus states across the primary product surfaces;
- server-confirmed inline save and Journey update states;
- static loading skeletons with a restrained pulse;
- a Journey Card preview entrance.

The audit found no animation library and no reason to add one. The main gaps were
inconsistent duration values, abrupt label replacement after saves, no factual
importance model for milestone feedback, no one-time celebration guard, and no
session-aware treatment for overview or notification changes. Existing Open Line
motion remains the canonical geometry and path animation system.

No existing motion was removed as over-animated. New effects are intentionally
limited to state changes that occurred in the current session.

## Canonical motion tokens

The product tokens live in `app/globals.css`:

| Token | Value | Use |
| --- | ---: | --- |
| `--motion-micro` | 140 ms | hover, press, icon, badge |
| `--motion-standard` | 220 ms | panel and content replacement |
| `--motion-success` | 360 ms | confirmed inline success |
| `--motion-celebration` | 1,200 ms | major milestone particles only |
| `--motion-ease` | cubic bezier | ordinary state changes |
| `--motion-ease-emphasis` | cubic bezier | one-time confirmed outcomes |

Motion uses opacity and transform. It does not use continuous JavaScript loops,
layout measurement, sound, vibration, elastic easing, or looping decoration.

## Milestone eligibility

`data/milestone-celebrations.ts` resolves importance from the canonical,
server-confirmed Journey transition and prior account history.

- **Meaningful:** application submitted, interview reached, or an active program
  start. These receive a focused success panel and row emphasis, never confetti.
- **Major:** a repeated offer, acceptance, scholarship award, competition result,
  or completed experience. These may receive restrained confetti.
- **Signature:** the first factual event of one of those major kinds. The
  treatment is slightly stronger and remains available only once.

Choosing, saving, preparing, pausing, resuming, closing, correcting details,
editing notes, billing, profile changes, and filters cannot qualify. Prestige,
school, compensation, and organization ranking are not inputs.

## Confirmation and suppression

The transition service remains authoritative. It returns a milestone event ID and
classification only after persistence succeeds. The UI never derives a
celebration from optimistic state.

The client records shown event IDs in bounded local storage. Refreshes and
revisits do not trigger effects because celebrations only run from a fresh
mutation response. Duplicate server responses return no celebration, and
concurrent stale updates remain protected by the existing version and security
lock checks. Account switching and logout abort the request, close the dialog,
and clear active visual state.

If the lazy visual chunk fails, an error boundary renders no effect while the
saved milestone and factual success panel remain intact.

## Supporting feedback

- Discover and For You use the same server-confirmed `Saved to Journey` state.
- Journey rows receive one temporary background wash after a confirmed update.
- Overview cards animate only when their value changes during the current browser
  session.
- The final Things to Do change can briefly show `You’re all caught up`.
- Confirmed deadlines use explicit normal, approaching, due soon, tomorrow,
  today, and overdue labels in the saved notification timezone.
- The notification badge and newly inserted notification receive one short
  arrival treatment.
- Journey Card formats reveal without blanking privacy controls, and a successful
  export reports `Journey Card ready.`
- First-use Journey guidance is inline, dismissible, account-scoped, and hidden
  once the student has recorded progress beyond an initial save.

## Accessibility and performance

All meaning remains in text and semantic state. Confetti is `aria-hidden`,
pointer-independent, non-blocking, and never receives focus. Success is announced
through the existing polite live region. Reduced motion prevents the confetti
chunk from rendering and globally removes decorative animation while preserving
the confirmation panel, row state, labels, and controls.

The implementation uses CSS and one lazily loaded React component. It adds no
dependency, no animation loop, no geometry work, and no catalog work. Particle
density drops on small screens. The visual effect is decoupled from persistence,
so rendering or navigation failure cannot affect the saved milestone.

## Known limits

- UnlockED does not have a cross-device preference for previously displayed
  visual effects. This is not required to prevent replay because effects are
  never generated during page load; server idempotency and the current browser's
  bounded event history cover retries and tabs.
- Browser screen-reader smoke tests validate semantic live regions and focus
  behavior, but final release QA should still include manual VoiceOver and NVDA
  listening tests.
