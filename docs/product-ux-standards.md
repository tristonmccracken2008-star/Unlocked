# UnlockED UX Standards

These standards formalize the strongest patterns already present in UnlockED.
They are intentionally small and product-specific.

## Navigation

- Primary destinations are **Discover**, **For You**, **Planner**, and **Journey**. Planner summarizes the opportunity landscape over time; it does not replace Calendar or Journey.
- Profile, notifications, referrals, billing, and data controls are secondary
  account destinations.
- `aria-current="page"` identifies the active destination.
- URL-addressable filters and account sections survive refresh and browser
  back/forward.
- Signed-out users see only the brand and Sign in.
- Account changes clear private client state and abort stale requests.

## Page headers

- One `h1`, a short orientation label, and one concise description.
- Authenticated product headers use `text-4xl` to `text-5xl`; only true landing
  experiences use larger display type.
- One primary action per local context. Secondary actions do not compete.
- Content begins promptly; headers do not create empty hero-height space.

## Actions

- Primary: direct verb, forest fill, sentence case, at least 44 px high.
- Secondary: bordered or text action, visually quieter than primary.
- Tertiary: inline navigation with a clear accessible name.
- Destructive: explicit language, red semantic treatment, confirmation when
  irreversible.
- Duplicate submission is blocked. Success is shown only after server
  confirmation.
- Opportunity terminology is **Open opportunity**, **Add to Journey**, and
  **Update Journey**. Status management exists only in Journey.

## Loading

- Skeletons mirror predictable final structure and use theme tokens.
- Compact actions keep their width and show an explicit pending verb.
- Page-level loading uses `aria-busy` plus one polite screen-reader status.
- A failed request always exits loading into a persistent, recoverable state.
- Reduced-motion preferences remove pulsing and nonessential transitions.

## Empty states

- State what is empty, why that is normal, and one useful next action when one
  exists.
- Empty states are calm, factual, and never framed as failure.
- Avoid decorative illustrations that do not add meaning.

## Errors and alerts

- Persistent failures use an inline `role="alert"` and retain user input.
- Temporary actions may offer Retry when idempotent.
- Session, conflict, permission, timeout, and network failures use distinct
  safe language.
- Never expose stack traces, secrets, provider errors, or private identifiers.
- The browser logs only safe categories; server logs retain diagnostic context.

## Success

- Prefer visible state change when the result is self-evident.
- Otherwise use one inline `role="status"` message that names the completed
  action.
- Do not combine a toast, inline message, and animation for the same result.
- One-time return confirmations remove their query parameter after display.

## Forms

- Visible labels are required; placeholders are examples, not labels.
- Optional fields say “optional.”
- Validate on submit or after a field is meaningfully complete, not on every
  keystroke.
- Preserve valid values after failure.
- Server rules remain authoritative.
- Save and cancel behavior is explicit; double submission is blocked.

## Dialogs and drawers

- Semantic `dialog`, `aria-modal`, labelled title, Escape close, focus trap, and
  focus return.
- Background scrolling and interaction are blocked while open.
- Destructive choices cannot be dismissed accidentally after meaningful input.
- Mobile dialogs fit the viewport and account for safe areas.

## Cards

- Opportunity cards, Journey records, settings sections, notifications, and
  pricing cards are separate families.
- Within a family, padding, title hierarchy, metadata order, hover, focus, and
  actions remain consistent.
- A clickable container never contains competing nested click targets.
- Lifecycle state, organization identity, and official-source trust use the
  canonical data model.

## Lifecycle and dates

- The Opportunity Lifecycle system is the source of truth for public
  availability and actionability.
- Unknown is not presented as open.
- Recurring does not imply the current cycle is open.
- Date-only deadlines remain active through the displayed local date.
- Dates use semantic `<time>` where practical and consistent human-readable
  formatting.

## Theme, motion, and accessibility

- Theme tokens drive surfaces, text, borders, focus, and semantic states.
- Visible focus is never removed without an equal replacement.
- Touch targets are at least 44 x 44 px.
- A skip link reaches the product content.
- Status is never conveyed by color alone.
- Motion is brief, interruptible, and disabled under reduced motion.
- DOM order remains meaningful at 200% zoom and on small mobile screens.
