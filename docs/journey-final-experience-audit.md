# Journey Final Experience Audit

Date: 2026-07-29

## Existing systems retained

- `/` is the authenticated Journey route and remains server-authoritative.
- `buildJourneyCommandCenterModel()` is a read-only projection over the existing
  account tracker, saved records, opportunity catalog, lifecycle metadata, and
  Journey Card model.
- `/api/journey/add` owns duplicate-safe catalog additions.
- `/api/journey/transition` owns stage changes, version conflicts, idempotency,
  security locking, reminders, and private milestone details.
- Public opportunity lifecycle and private Journey stage remain independent.
- The Journey Card SVG renderer already supports square, story, and LinkedIn
  output, conservative privacy controls, PNG download, clipboard copy, and the
  native share sheet.
- The account-center browser suite already reproduces temporary session API
  failures and verifies that they are not classified as sign-out.

## What matched the approved mockup

- Full-width product shell with no Journey sidebar.
- Cream, forest, brown, and restrained accent palette.
- Server-rendered overview, attention, active records, and collapsed History.
- Compact status controls backed by the canonical transition service.
- Lazy Journey Card loading.
- Mobile bottom navigation and existing responsive shell.

## Weaknesses found

- Overview values were generic counts instead of current deadlines, reminders,
  milestones, and annual facts.
- The first viewport could render 100 active records.
- Needs Attention was visually heavier and less immediate than an inbox.
- Opportunity rows repeated organization, status, public-listing, and update copy.
- Search and sorting consumed a full row and required an ambiguous Apply action.
- History opened as one long section instead of compact annual summaries.
- Add opportunity and Export data were absent.
- Journey Card creation was correctly lazy, but its entry point lacked the final
  milestone-focused framing.
- The loading skeleton described the previous long-form Journey layout.

## Data and migration decision

No schema or record migration is required.

The final experience is a projection and workflow pass over canonical data. It
does not rewrite existing tracker entries, status histories, reminders, notes,
saved records, billing data, profiles, or account ownership. The only new
persisted behavior is an optional initial stage and optional private details when
a user explicitly adds a new catalog opportunity from Journey; it uses the
existing tracker record and history model.

## Deliberately unsupported

- Private custom opportunities are not present in the current canonical model, so
  the Add flow searches the existing catalog only.
- Public share links are not implemented. The builder offers only existing,
  directly verified PNG, clipboard, and native-device sharing.
- The account document is the current persistence boundary, so active and History
  expansion are bounded server projections rather than database cursors.
