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

## Application workspace

Application-based Journey records may expose a progressively disclosed workspace.
The workspace is intentionally not a second tracker:

- `TrackedOpportunity` remains the sole source of truth for Journey status.
- Verified catalog `metadata.applicationRequirements` seed deterministic,
  read-only requirement tasks. Unverified requirements never appear as facts.
- Private user tasks live in `AccountData.applicationWorkspaces`, keyed by the
  canonical opportunity ID. A task may have only a name and optional due date.
- Dated, incomplete tasks project into the existing Journey calendar as
  `application_task` events. The notification service schedules those projected
  events through the existing calendar reminder pipeline.
- Completing every task only exposes an explicit `Mark as Applied` action. The
  existing Journey transition route remains authoritative for submission.
- Benefits, no-application listings, career resources, student organizations, and
  certifications do not receive an application workspace.

All workspace writes go through `/api/journey/application`. The route requires a
valid session and same-origin request, applies rate limits, checks Journey
ownership again while holding the account security lock, and uses expected
workspace versions plus idempotency keys. The catalog is never mutated by a
student checklist update.

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
