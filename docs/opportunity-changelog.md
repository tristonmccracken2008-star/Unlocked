# Opportunity changelog

UnlockED records meaningful provider changes when an authorized catalog write replaces an existing opportunity. The detector runs in the server-side content ingestion path, never during page rendering or in the browser.

## Data flow

1. An authorized content update is validated and assigned authoritative lifecycle evidence.
2. `detectMeaningfulOpportunityChanges` compares normalized structured fields.
3. Only verified changes with strong or confirmed official evidence become durable events.
4. Events are appended idempotently to `opportunity.metadata.changelog` and retained across recurring cycles.
5. Notifications, official calendar projections, Journey, application workspaces, opportunity details, and admin diagnostics consume canonical events or the current canonical opportunity.

Formatting-only edits, tracking URL parameters, uncertain evidence, and unverified records fail closed. Changelog events contain no student data. User relevance is evaluated later against authenticated Journey records and notification preferences.

## Operational review

The admin content API returns recent processing diagnostics without exposing user identifiers. Each diagnostic records event IDs, recipient count, scheduled notification count, projection impacts, and a safe error category. Provider updates never overwrite personal calendar entries or user-created application tasks.

Run `npm run check:opportunity-changelog` after catalog ingestion or changelog changes.
