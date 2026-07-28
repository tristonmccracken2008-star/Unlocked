# Opportunity lifecycle system

## Purpose

The lifecycle layer is the authoritative answer to a narrow question: what does current evidence support about an opportunity's application window?

It does not replace eligibility, verification, Journey status, or recommendation ranking. It supplies consistent lifecycle truth to those systems.

## Audit findings

Before this change, current availability was represented independently by:

- `verification_status`
- `metadata.deadlineType`
- `metadata.eligibilityRules.availability`
- raw comparisons against `application_deadline`
- opportunity freshness state
- recommendation exclusion rules
- notification deadline rules
- client-side card and detail-page copy

Recurring records were commonly marked `recurring` without a confirmed current cycle. A past date could produce a closed card while another surface still offered an application action. Admin review overrides were also browser-local in one review surface.

The existing systems retained and reused are:

- stable opportunity IDs and the committed duplicate manifest
- managed content storage and its audit log
- strict recommendation eligibility
- Journey's user-authored tracker status
- tracked-recipient notification storage and idempotency
- structured opportunity reporting
- the existing daily authenticated cron

## Canonical model

Persisted lifecycle states:

- `unknown`
- `upcoming`
- `open`
- `rolling`
- `temporarily_closed`
- `closed`
- `canceled`
- `archived`

`closing_soon` is derived for an open, confirmed or strong fixed deadline within 21 days. `reopened` is an open state with an `application_reopened` event. Recurrence is separate metadata and never implies that applications are open.

Confidence is independent:

- `confirmed`: current official evidence or authorized manual review
- `strong`: consistent current structured evidence
- `limited`: useful evidence with meaningful gaps
- `estimated`: historical or seasonal inference
- `unknown`: insufficient evidence

The user-facing state is always paired with a safe action. Only confirmed or strong `open` and `rolling` states with safe HTTPS URLs are actionable or Pro-recommendation eligible.

## Evidence precedence

Resolution is conservative:

1. An explicit authorized lifecycle review.
2. Current official status evidence.
3. Confirmed opening and final-deadline dates.
4. Verified structured availability.
5. Verified fixed or rolling legacy metadata.
6. Historical recurrence as an estimate only.
7. Unknown when current actionability cannot be proven.

Archived and canceled records are never actionable. A confirmed deadline may deterministically close a cycle. A current official open statement that conflicts with a passed deadline resolves to unknown and creates a conflict issue rather than trusting whichever field was processed last.

## Date semantics

Lifecycle dates retain source value, normalized value, precision, timezone when known, estimate status, verification date, and source URL.

- Exact timestamps transition at their instant.
- Date-only deadlines remain open through that calendar date in the normalized source representation and close the following day.
- Priority and final deadlines are separate.
- Program dates and decision dates are not application deadlines.
- Rolling opportunities never receive generated countdowns or deadline reminders.
- Seasonal values remain estimated; the system does not invent a day.

## Identity and cycles

`metadata.lifecycle.identity.identityId` represents the enduring opportunity. `metadata.lifecycle.cycle.cycleId` represents a time-specific application cycle. Existing `Opportunity.id` values and Journey references remain unchanged.

Aliases, successor relationships, and supersession can be recorded incrementally. The existing duplicate manifest remains authoritative for current duplicate suppression. Records are not merged solely from title similarity.

## Events

Material lifecycle events include:

- application opened, closed, or reopened
- deadline announced or changed
- cancellation
- application URL change
- eligibility change
- program-date change
- cycle archive
- material confidence change

Events have deterministic idempotency keys and are bounded to the latest 24 events per record. Whitespace-only edits do not create events.

## Freshness and conflicts

Field-level default review thresholds:

- 45 days: state, deadline, application URL, opening date
- 120 days: eligibility, award, location, program dates
- 365 days: description

Issues are classified as `review_soon`, `likely_stale`, `conflicting_evidence`, `broken_source`, or `unsafe_to_present_as_open`. A stale field does not delete the record. Unsafe state evidence prevents an application action and Pro recommendation.

Stored URL checks distinguish official pages, equivalent redirects, organization homepages, unrelated redirects, authentication requirements, expired/not-found pages, temporary errors, and unsafe/malformed URLs. No provider URL is fetched during page rendering or recommendation generation.

## Product integration

- **Discover:** resolves lifecycle once per catalog/day, prioritizes actionable records, exposes Open now, Opening soon, Rolling, Closed, and Recurring filters, and serializes a compact lifecycle presentation to cards.
- **For You:** uses the managed catalog index and the lifecycle recommendation gate. Closed, canceled, archived, unknown, stale, and conflicting records are excluded.
- **Opportunity detail:** resolves server-side and changes the official action to match lifecycle truth. Closed and unknown records link only to the official source.
- **Journey:** public lifecycle never changes user-authored progress. Archived records remain readable for historical Journey references.
- **Notifications:** exact deadline reminders require high-confidence actionable fixed deadlines. Material lifecycle changes are sent only to tracked users and use existing preference, suppression, rate, and idempotency controls.
- **Reports:** user reports are aggregated as review signals and never mutate public state.
- **Admin:** the existing content editor now supports state, confidence, evidence reason, opening date, recurrence, and review notes. The server supplies reviewer attribution and events.

## Automated transitions

Deterministic:

- open to closing-soon presentation
- confirmed upcoming to open when an exact opening date arrives
- confirmed open to closed after an exact or date-only final deadline

Confidence-gated:

- lifecycle notification handoff
- rolling actionability
- reopened state after a material event

Review required:

- closed to open from a historical pattern
- unknown to canceled from a missing source
- archive restoration to any actionable state
- conflicting source evidence

Prohibited:

- recurrence implying open
- temporary URL failure implying closed
- public lifecycle changing Journey status
- user reports directly changing lifecycle state

## Operations and caches

The existing daily `CRON_SECRET`-protected notification route processes a bounded lifecycle batch before due notifications. It stores a cursor and non-user operational snapshots, emits bounded events, and hands material changes to the existing tracked-recipient notification service.

Managed catalog caches expire after 60 seconds. Discover lifecycle projections are keyed by source identity and UTC date. The For You catalog index uses the managed catalog and refreshes every 60 seconds. A lifecycle update does not trigger a global site rebuild or per-user cache purge.

No scheduled source fetching was added. URL classifications must come from a trusted ingestion or review process; this avoids uncontrolled third-party requests and provider load.

## Migration

Run a deterministic dry-run:

```sh
npm run migrate:opportunity-lifecycle
```

Write the additive metadata migration only after reviewing the distribution:

```sh
npm run migrate:opportunity-lifecycle -- --write
```

Rollback records created by this migration:

```sh
npm run migrate:opportunity-lifecycle -- --rollback --write
```

The migration preserves IDs, deadlines, sources, and all original fields. It is idempotent and rollback-tested. It does not classify uncertain legacy records as open.

## Validation

```sh
npm run check:opportunity-lifecycle
npm run test:opportunity-lifecycle-browser
npm run migrate:opportunity-lifecycle
npm run lint
npm run build
```

The checks use fixed dates and make no external requests. Strict scenarios cover lifecycle resolution, dates, recurrence, events, migration, Journey preservation, notification handoff, application actions, recommendation exclusion, source safety, accessibility, dark theme, mobile layout, Chromium, WebKit, and full-catalog throughput.

## Remaining operational limits

- The additive migration is dry-run by default and is not a production data migration until `--write` is deliberately run and deployed.
- Source URL checks are modeled and consumed but not fetched by the application. A future ingestion worker can populate cached classifications.
- Current catalog evidence is sparse. Most legacy records correctly remain unknown until official review.
- Production cron execution, notification delivery, and Vercel behavior must be verified after deployment; local checks cannot prove those external outcomes.
