# Journey Workspace Quality

## Product ownership

Journey answers one question: **What am I actively pursuing, and what needs attention next?**

- Discover owns finding opportunities.
- For You owns personalized discovery.
- Journey owns pursuit state, immediate application context, verified dates, and progress history.
- Applications owns requirements, tasks, materials selection, and submission preparation.
- Build owns reusable application assets.
- Calendar owns the complete schedule and conflict-planning view.
- Strategy owns detailed mix, overlap, Path context, and planning context.
- Accomplishments and Insights own validated outcomes and historical analysis.

The Journey root composes those systems. It does not duplicate them.

## Default hierarchy

The server-rendered Journey home presents:

1. One explainable next action.
2. At most two supporting attention items.
3. Compact active-pursuit rows.
4. At most three upcoming verified dates or personal reminders.
5. A compact current-mix summary.
6. Full Calendar and Strategy views behind progressive disclosure.
7. Professional history and Journey Cards as secondary content.

Overview metrics and full subsystem panels no longer compete with active work in the first viewport.

## Projection architecture

`buildJourneyCommandCenterModel()` remains the request-scoped composition boundary. It loads only opportunities already identified by account Journey, saved, or watched IDs. It projects canonical Journey records once and passes them to `projectJourneyWorkspace()`.

`projectJourneyWorkspace()` is pure and deterministic. It returns:

- `nextAction`
- `secondaryActions`
- `upcomingDates`
- `timingSummary`
- `strategySummary`

The projection is not persisted. React components do not independently score or rank pursuits.

## Next-action precedence

The ordering is factual and stable:

1. A material provider change affecting an active application. Submitted work is included only for a critical change.
2. A verified deadline within 14 days with unfinished known application items.
3. A recorded application task due within seven days.
4. An active application with unfinished known requirements.
5. A verified opening date for a pursued opportunity.
6. A generic continuation action for an active application.
7. A generic opportunity review action.

Ties use the relevant date, title, and stable ID. One pursuit can occupy only one attention slot. Unknown requirements do not create warnings. Unknown or rolling deadlines are never converted into dates or low-priority claims.

## Lifecycle semantics

Provider lifecycle and student lifecycle remain independent.

- Provider lifecycle describes the public listing: open, upcoming, rolling, closed, canceled, or temporarily closed.
- Student lifecycle uses the existing Journey state machine and professional workflow labels.

A provider closure never rewrites student progress. Submitted records remain visible but do not receive generic preparation actions. Accepted and completed records retain factual result/history actions instead of application-preparation actions. Closed or not-selected records remain in professional history and do not change recommendation interests.

## Row actions

Each active row exposes one primary action:

- `Continue application` for active application work.
- `Open opportunity` for a pursuit that is still being considered.
- `View record` after submission or validation.

Canonical progress controls, private notes, provider lifecycle, and recent history remain in the secondary details menu. The server remains authoritative for every status transition.

## Application and Build boundaries

Journey may state the number of unfinished **known** application items and link to the existing Application detail route. It does not render a second checklist or material editor. Application detail determines exact requirement and Materials/Build handoffs.

## Calendar and Strategy boundaries

Journey shows only three upcoming dates and one existing Calendar Intelligence cluster sentence. The complete calendar remains available in the Calendar disclosure.

Journey shows active count, the first three opportunity-type counts, and one neutral overlap sentence for Pro when supported. Detailed timing, similarity, goals, and Path context remain in Strategy. Core pursuit state, known requirements, and verified dates remain available to Free accounts.

## Failure isolation

Active Journey records are projected before Calendar and Strategy. Calendar and Strategy each have a bounded fallback. A subsystem failure logs only its name and error type; it does not log account identifiers, profile data, opportunity contents, or private notes. A Calendar or Strategy failure cannot erase or block active pursuits.

## Privacy and security

- Journey remains server-rendered behind the existing authenticated route.
- The workspace projection receives only the active account's request-scoped data.
- No new store, status, API, or database was introduced.
- Existing same-origin, session, lock, idempotency, and version-conflict protections remain authoritative.
- Private notes remain searchable server-side but do not appear in collapsed rows or summaries.
- Provider changes and opportunity metadata are read-only projection inputs.

## Performance

The home projection performs bounded passes over current Journey records and already-projected calendar items. It does not scan the full opportunity catalog, perform network requests, compute client geometry, or persist derived output. Initial active and history lists remain bounded with server-side progressive disclosure.

Regression checks cover a 50-record home projection and the existing 600-record/500-history command-center fixture. Strict catalog and application checks remain in the production prebuild chain.

## Known limitations

- Full Calendar and Strategy details remain embedded disclosures rather than separate Journey routes.
- Provider-change acknowledgement is shown only where existing persisted acknowledgement semantics already exist; Journey does not add another read-state store.
- The dominant action selects among known structured facts. When no safe action exists, Journey keeps the active list available without inventing work.
- Large lists use bounded server rendering and `content-visibility`; virtualization is intentionally deferred because the initial DOM remains small.
