# Prompt 38: Final Journey Experience

Date: 2026-07-29

## Implementation

Journey now follows the approved opportunity-headquarters hierarchy:

1. concise Journey header with real Add opportunity and Export data actions;
2. factual overview cards that hide unsupported states;
3. a three-item Things to do inbox;
4. compact active opportunity rows with primary stage filters, search, sorting,
   progressive disclosure, updates, and details;
5. collapsed annual History summaries;
6. one restrained Journey Card entry point shown only after confirmed progress.

## Functional connections

- Add opportunity uses server-backed catalog search, account-scoped duplicate
  detection, the existing add endpoint, canonical workflow stages, optional
  private notes, and optional reminders.
- Unsupported initial stages are rejected rather than silently converted.
- Export data is an authenticated, rate-limited CSV generated from the active
  account. It includes the user's Journey facts but not their account email or
  internal account identifier.
- Update Journey continues to use expected status, expected version,
  idempotency keys, same-origin enforcement, account locks, and canonical
  transition narratives.
- Existing update details are prefilled.
- Public lifecycle changes remain informational and never move a student's
  Journey stage.
- Journey Card code remains outside the initial client bundle until opened.

## Responsive and accessibility behavior

- Desktop uses the same wide product shell as Discover and For You.
- Tablet uses a reduced row grid and two-column overview/history layouts.
- Mobile uses icon-led overview summaries, horizontally scrollable stage filters,
  compact opportunity cards, bottom-sheet details, and a full-screen Add flow.
- Interactive targets remain at least 44 by 44 CSS pixels.
- Native links, forms, details, dialog, fieldsets, labels, and live regions
  preserve keyboard and assistive-technology semantics.
- Focus returns after closing the Journey Card builder and Add dialog.
- Reduced motion and forced-colors rules are retained.
- Dark mode uses Journey tokens rather than mockup-specific hard-coded surfaces.

## Performance

- Initial active records: 6.
- Expanded active records: up to 100.
- Initial History records: 24.
- Expanded History records: up to 100.
- 600-record projection: 6.6-7.2 ms average and 7.8-8.2 ms p95 across the final
  deterministic build runs.
- Production-style browser run observed approximately 1.1-1.5 seconds for the
  cold development-server Journey render and 35-184 ms for warm renders.
- Browser-observed CSV export: approximately 20 ms warm.
- Browser-observed add mutation: approximately 27-31 ms warm.
- Browser-observed catalog search: approximately 500 ms cold and 13-20 ms warm.

These browser numbers are development-server observations, not production
service-level guarantees.

## Validation completed

- Complete prebuild passed.
- Two consecutive production builds passed before the final request-parser
  hardening; the final production build was rerun after that change.
- TypeScript and all 79 generated routes passed.
- Postbuild homepage verification and the strict primary-bundle audit passed.
- Journey, Discover, and For You each remained at four primary chunks. Journey's
  largest chunk was 90,877 bytes.
- Chromium and WebKit production-style browser suites passed for empty, rich,
  100-active, and 500-history accounts across desktop, tablet, mobile, dark mode,
  and reduced motion.
- A real CSV Journey export and Square, Story, and LinkedIn PNG exports were
  downloaded and inspected by the browser suite.
- The account-center browser suite passed in Chromium and WebKit with three
  isolated accounts and verified that a temporary session-data failure remains a
  retryable data error rather than a false sign-out.
- No database migration was required. Canonical record counts remained unchanged
  and the existing lifecycle migration/rollback checks passed.

## Free and Pro

- Core tracking, deadlines, reminders, History, updates, export, and factual
  Journey Cards remain available to Free users.
- The browser suite uses separate Free and Pro accounts. The Pro fixture verifies
  premium appearance without changing core Journey ownership or functionality.

## Limitations

- No private custom-record system was added.
- No public Journey Card link was added because the repository has no revocable,
  unguessable share-token service.
- Historical titles for deleted catalog records cannot be reconstructed when an
  old record lacks a stored snapshot; the UI preserves the record as
  `Unavailable opportunity`.
- Expansion is URL-backed and bounded rather than cursor-backed because account
  data is currently stored as one account document.
- Automated semantic checks do not replace a manual VoiceOver/NVDA audit.
- Browser coverage uses small mobile layouts as the practical reflow check; a
  manual browser 200% zoom audit remains outstanding.
- The existing canonical transition model stores reminder edits with Journey
  updates; there is no separate reminder-only persistence system.
- Production deployment cannot be verified until the local commit is pushed from
  an environment with GitHub credentials.
