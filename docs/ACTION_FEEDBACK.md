# Action feedback

UnlockED uses one restrained interaction language for authenticated mutations. The interface acknowledges the press immediately, delays pending copy for 300 ms, confirms the specific result, and explains recoverable failures without exposing infrastructure details.

## Hierarchy

- **Routine:** the control itself changes. Application task completion and appearance changes do not produce a toast.
- **Confirmatory:** a compact inline message confirms an otherwise quiet result such as a saved profile, date, or notification preference.
- **Important:** the existing Journey transformation experience explains submissions, interviews, acceptances, and completed experiences.
- **Specialized:** Save to Journey keeps its existing transfer animation and confirmation state. It is not followed by a redundant global message.

`ActionButtonLabel` preserves button dimensions across idle, delayed-pending, and success copy. `ActionFeedback` provides semantic success and error regions with optional retry or undo-ready actions. Feature components remain responsible for placement so feedback stays close to the action instead of becoming toast spam.

## Mutation rules

- The server remains authoritative.
- Repeated actions are blocked locally and by existing idempotency or expected-version checks.
- Optimistic updates are limited to reversible application-task completion and notification read state.
- A failed optimistic update restores the prior projection and keeps user input intact.
- Destructive task removal requires a second explicit action.
- Account changes abort or clear pending feature state through the existing authenticated-request and account-session infrastructure.
- Background analytics and refresh work remain silent.

## Accessibility and motion

Pending controls use `aria-busy`. Important success and error text uses polite status or assertive alert semantics. Routine updates use one concise live-region announcement. Focus does not move after completion. Feedback uses text and icons in addition to color, supports 44 px actions, and removes entrance motion when reduced motion is requested.
