# Journey Command Center Architecture

## Information architecture

1. **Overview**: active records, upcoming dates, submitted applications, and
   milestones this year. Values are server-composed and non-interactive unless
   they have an obvious filtering destination.
2. **Needs Attention**: at most five deterministic items backed by a reminder,
   confirmed deadline, lifecycle change, or prolonged active inactivity. Every
   item explains why it appears.
3. **Active Opportunities**: compact opportunity-level records with stage,
   relevant date, public lifecycle, update action, and expandable details.
4. **History**: terminal records grouped by meaningful Journey year and collapsed
   by default. Initial history is bounded.
5. **Journey Cards**: a secondary factual export action shown only when the account
   has card-worthy data.

## Data model

- **Journey record**: the existing `TrackedOpportunity`. It remains the present,
  user-controlled state for one opportunity.
- **Stage history**: existing bounded `JourneyTransitionHistoryRecord[]`. It is
  append-only through the authoritative transition service.
- **User details**: existing `JourneyMilestoneDetails` on a transition. Notes,
  dates, reminders, and document references remain private.
- **Opportunity identity**: canonical catalog opportunity where available. Missing
  catalog records are preserved in the projection as unavailable records.
- **Opportunity lifecycle**: derived from the public catalog and shown separately.
  It never writes Journey state.
- **Milestones**: explicit terminal or validation transitions and existing
  `journeyProgress` facts.
- **Card metadata**: existing card projection and account privacy defaults.

## Migration strategy

The initial rebuild is projection-only and requires no destructive account-data
migration:

1. Merge `account.tracker` and `account.activity.tracked` using the existing server
   compatibility behavior.
2. Normalize display stage from the professional workflow where possible.
3. Preserve malformed or unavailable records as conservative History/active
   placeholders without changing their persisted status.
4. Keep all existing history, notes, dates, reminders, document references,
   milestones, and card preferences untouched.
5. Compare input record IDs with projected active/history/unavailable IDs in a
   deterministic migration audit. Counts must match before release.

Rollback is immediate: the persisted account schema is unchanged, so the prior
timeline can be restored without reversing user data.

## Session-error contract

- A successful `/api/auth/session` response may explicitly report signed out.
- A `401` from a private data mutation means authentication is invalid.
- A non-OK session endpoint response, network failure, or malformed payload is a
  retryable session-data failure and must not be converted into signed out.
- Profile receives the server-confirmed session used to authorize the route. A
  failed client refresh keeps that identity and displays a retryable data error.
- `403` remains an authorization/security classification and never becomes a
  sign-in prompt.
