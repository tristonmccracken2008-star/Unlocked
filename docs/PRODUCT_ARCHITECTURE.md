# UnlockED Product Architecture

UnlockED's authenticated experience is organized around three simple sections:

- **Discover** answers: "What opportunities can I find?"
- **For You** answers: "Which opportunities fit me best right now?"
- **Journey** answers: "What have I already done, and what is active?"

Profile remains secondary account navigation. Billing, onboarding, authentication, profile persistence, opportunity search, saves, tracking, and Advisor Brain infrastructure stay behind these surfaces.

## Primary Navigation

The signed-in header exposes only:

- Discover (`/opportunities`)
- For You (`/advisor`)
- Journey (`/`)

Profile stays available as account-level navigation. Mobile signed-in users receive the same three primary destinations in a compact bottom navigation.

Logged-out users still see only the UnlockED brand and Google sign-in.

## Discover

Discover is the opportunity database.

It preserves the existing search, browse, filters, saved opportunities, and opportunity detail behavior. Categories such as scholarships, research, internships, benefits, AI tools, and career resources live inside search/filter controls rather than top-level navigation.

Advisor handoffs open Discover through URL parameters such as `query`, `category`, or `type`. `OpportunityFilter` reads those parameters on load and applies them to the existing filter state.

## For You

For You is the Advisor Brain's opportunity-ranking surface.

It does not invent broad life advice or hardcode recommendations in React components. It consumes `buildAdvisorBrain` and displays one high-priority recommendation from structured profile, activity, progress, and opportunity data.

For You shows:

- one primary recommendation;
- why it fits;
- evidence and confidence behind disclosure;
- alternatives behind disclosure;
- a direct link into Discover or the opportunity detail page.

Completion and tracking use the existing helpers:

- milestone recommendations call `markMilestoneCompleted`;
- opportunity recommendations call `updateApplicationStatus`.

## Journey

Journey is the private student home.

It is not a generic dashboard and it does not fabricate motivation metrics. Journey only displays real persisted or locally hydrated data:

- completed profile milestone;
- saved opportunities;
- tracked applications;
- submitted/interview/accepted/rejected/completed statuses;
- recent milestones derived from student activity;
- a recap generated from those same records.

Journey data is produced by `data/journey.ts`:

- `buildJourneyMilestones`
- `buildJourneyRecap`

If a student has no activity, Journey shows empty states that explain the next useful action instead of fake stats.

## Recap and Sharing

Journey recap is generated only from actual saved/tracked opportunity records. Share text includes counts and the latest real milestone when one exists. It does not include GPA, private notes, raw evidence, or unverified inferred achievements.

## Journey Board

`/my-opportunities` is the Journey Board: a focused opportunity tracker for moving saved opportunities through real statuses.

It preserves the existing status model:

- Saved
- Interested
- Applying
- Submitted
- Interview
- Accepted
- Rejected
- Completed

Each card has one primary status action, "Move to...", which opens an accessible menu. Desktop users may also drag a card between lanes; the menu remains the keyboard and mobile-safe alternative.

Status changes are optimistic:

1. The card moves locally immediately.
2. Counts update immediately.
3. The activity record is persisted through the existing account data API.
4. If persistence fails, the previous activity snapshot is restored and a visible error toast is shown.

Milestone panels are shown only for real tracked activity, such as first submission, first interview, first acceptance, first completed opportunity, five applications tracked, or ten opportunities tracked. Journey Board does not add XP, streaks, fake scores, or unverifiable progress.

## Product Intelligence

The canonical versioned event contract, field allowlists, privacy rules, retention recommendations, offline queue, and deterministic aggregate model are documented in `docs/PRODUCT_INTELLIGENCE.md`.

Historical unversioned identifiers remain accepted at the ingestion boundary for compatibility. New Journey, export, recommendation-conversion, health, and error telemetry uses `_v1` events exclusively. The app mounts one first-party transport and stores aggregates rather than raw event bodies.

## Semester Story Projection

`buildJourneyEditorialProjection()` computes the canonical `Pathprint` once. Both Path Moments and Semester Story consume that in-memory result. `buildSemesterStories()` performs a bounded event filter, deterministic term grouping, privacy-safe event projection, and share-mode geometry pass; it does not call the database, recommendation systems, or client geometry APIs.

The resulting `SemesterStoryCollection` is serialized with the Journey server model. Its creator is a narrow client island loaded on demand from `components/semester-story-entry.tsx`, so normal Journey visits do not mount export SVGs, canvases, clipboard handling, or native sharing code.

## Free and Pro Boundary

`lib/advisor-access.ts` defines the future access states:

- `free`
- `preview`
- `pro`
- `unavailable`

The normal product remains available to Free users. Current UI does not aggressively advertise Pro or lock the core experience.

## Preserved Infrastructure

This product layer must not rewrite:

- Google OAuth
- session cookies
- onboarding persistence
- profile persistence
- billing or Stripe
- opportunity data/search/filtering
- saved opportunities
- tracking records
- Advisor Brain internals
- Student Digital Twin
- Evidence Inventory
- Interview Intelligence

## Tests

The architecture is covered by:

```bash
npm run check:advisor-ux
npm run check:profile-flow
npm run check:onboarding
npm run check:auth
npm run check:advisor
npm run check:interview
npm run validate:data
npm run build
```
