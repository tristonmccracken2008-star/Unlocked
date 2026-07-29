# Journey Command Center Implementation Report

Date: 2026-07-29

## A. Journey audit

The previous Journey page projected account records into a complete chronological
event document. Its backend was strong: server-owned sessions, account-scoped
records, idempotent transitions, expected-version conflicts, professional stages,
public lifecycle isolation, private transition details, reminders, notifications,
and factual card exports. The primary UX was weak because the same facts appeared
across summary, highlight, timeline, archive, and sharing sections while active and
historical records competed in one long surface.

The audit and retained/replaced systems are documented in
`docs/journey-command-center-audit.md`.

## B. Final information architecture

Journey now renders a server-first opportunity command center:

1. A compact four-value overview.
2. Up to five factual Needs Attention records.
3. A compact active-opportunity list with URL-addressable stage filters, search,
   and sorting.
4. Progressive record details and the existing authoritative update flow.
5. Collapsed, year-grouped History with bounded initial retrieval.
6. Journey Cards as a secondary factual export action.

The data contract and projection strategy are documented in
`docs/journey-command-center-architecture.md`.

## C. Final data model

No second Journey model was introduced. `TrackedOpportunity` remains the current
record, transition history remains the factual audit trail, and
`JourneyMilestoneDetails` retains private notes, dates, reminders, and document
references. Professional stage is a display refinement over canonical status.
Public opportunity lifecycle remains independently derived and cannot write
student progress. The command center is a read-only projection over these systems.

## D. Migration report

No database or account-data migration was necessary. This avoids write risk and
makes rollback a presentation-only change.

Deterministic 600-record migration fixture:

| Result | Count |
| --- | ---: |
| Canonical records before | 600 |
| Canonical records after | 600 |
| Records rewritten | 0 |
| Records unchanged | 600 |
| Active records | 100 |
| Historical records | 500 |
| Initial records projected | 124 |
| History intentionally deferred | 476 |
| Ambiguous records in fixture | 0 |
| Duplicate IDs after canonical merge | 0 |
| Projection failures | 0 |

Deleted-opportunity behavior was separately tested: the record remains available
as `Unavailable opportunity`. Its former title and organization cannot be
recovered when older account data never stored an identity snapshot. The
production account dataset was not mutated or exhaustively inspected, so this
report does not claim a production migration or universal zero data loss.

Rollback status: immediate. The prior timeline can consume the same unchanged
account records.

## E. Authentication bug report

Reproduced behavior: an authenticated Profile route was server-authorized, then a
temporary client `/api/auth/session` failure was converted into
`authenticated: false`. The global client boundary redirected to `/`, overriding
the valid server decision and producing a false session-ended experience.

Fix:

- non-OK or malformed session responses now throw a retryable request error;
- only a successful explicit unauthenticated session is treated as sign-out;
- Profile and Referrals receive the server-confirmed public session as initial
  state;
- the global auth boundary and header preserve server-rendered private pages
  during transport failure;
- temporary data failures show retryable copy instead of a sign-in message.

Regression coverage intercepts `/api/auth/session` with HTTP 503 after a valid
server render. Chromium confirms the Profile remains populated and does not show
`Your session has ended.` Existing auth, logout, onboarding, same-origin,
authorization, and security suites remain green. Production cookie behavior has
not been verified against a deployed build in this task.

## F. Performance report

Command-center projection, 600 records:

| Measurement | Result |
| --- | ---: |
| Average | 5.83-6.59 ms across complete-suite runs |
| p95 | 6.47-7.81 ms |
| Worst observed check run | 7.81 ms |
| Initial active records | 100 |
| Initial historical records | 24 of 500 |
| Needs Attention maximum | 5 |

Development browser observations:

| Scenario | Observed server response |
| --- | ---: |
| Cold rich Journey | about 1.4 s including development compilation |
| Warm filter/search navigation | 39-87 ms |
| 100 active + 500 history | about 2.3 s in development |

The route uses one account/session lookup and one batched opportunity lookup; it
does not issue per-record opportunity or reminder requests. Filtering and search
remain server-side. Records use CSS content visibility, and History is bounded.

The production build compiled in 2.7 seconds and generated 79 static pages in
1.42 seconds. The strict bundle audit passed; Journey uses four chunks and its
largest referenced chunk is 90,877 bytes. No trustworthy pre-change bundle
snapshot was captured, so a before/after byte delta is not claimed.

## G. Accessibility report

Automated/static coverage verifies a single page heading, labelled overview and
sections, semantic lists, labelled search and sort controls, details/summary
expansion, named update dialog, live success/error states, forced-colors support,
reduced-motion support, dark-mode contrast, and drag-free operation.

Browser coverage verifies 44px visible controls, no horizontal overflow, keyboard
detail expansion, dialog focus restoration, reduced motion, 390px mobile, 820px
tablet, 1440px desktop, Chromium, and WebKit. Existing contrast checks report
light secondary text at 4.9:1 and dark secondary text at 9.42:1.

Limitations: this task performed semantic screen-reader smoke coverage, not a
human VoiceOver/NVDA session. Browser-level 200% zoom was not directly exercised;
responsive and small-width checks are not a substitute for manual zoom QA.

## H. Journey Card report

The existing factual Journey Card pipeline was retained because it already
provides a focused live builder, canonical UnlockED artwork, Cream/Forest themes,
and three intentionally composed formats:

- Story: 1080 x 1920
- Square: 1080 x 1080
- LinkedIn: 1200 x 627

Privacy controls cover name mode, school, dates, organization, and UnlockED
branding. Email, GPA, profile answers, application notes, and internal account
data are excluded. The command-center browser test proves private Journey notes
do not enter artwork, validates all three preview dimensions, downloads a PNG,
and restores focus after closing.

No public share-link system was added. The current builder uses local download,
clipboard, and native sharing. It does not offer a new milestone-template picker,
award-amount field, or user-curated Year in Review selection flow. Those were not
added because they would extend the existing data and sharing products beyond a
presentation rebuild.

## Validation completed

- Complete `npm run prebuild`
- TypeScript via `npm run lint`
- Production `npm run build`
- Postbuild homepage and strict primary-bundle audits
- Security, auth, logout, onboarding, profile, billing, notifications, lifecycle,
  Journey, Open Line, transformation, analytics, performance, and release checks
- Chromium and WebKit command-center/browser checks
- Chromium and WebKit Account Center checks
- Journey Card PNG export from the rebuilt Journey entry point

## Remaining limitations

- Production deployment and production account verification remain outstanding.
- Legacy records without identity snapshots cannot recover removed catalog names.
- Existing transition metadata supports creating reminder facts but not a separate
  full reminder-management CRUD interface; no duplicate reminder model was added.
- History loads up to 100 records through the current URL projection rather than
  a database cursor API.
- The browser suite does not use a real screen reader or browser 200% zoom mode.
