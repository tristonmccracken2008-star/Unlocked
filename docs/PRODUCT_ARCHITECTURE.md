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

## Analytics Events

The product event vocabulary includes:

- `discover_opened`
- `search_performed`
- `filter_applied`
- `opportunity_view`
- `opportunity_saved`
- `status_changed`
- `application_recorded`
- `for_you_opened`
- `recommendation_viewed`
- `recommendation_clicked`
- `journey_opened`
- `recap_viewed`
- `share_card_generated`
- `share_initiated`

`journey_opened` is stored in the existing dashboard funnel bucket for analytics compatibility.

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
