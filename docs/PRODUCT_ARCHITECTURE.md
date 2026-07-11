# UnlockED Product Architecture

UnlockED is organized around three primary authenticated sections.

## Primary Navigation

- **Home** answers: “What should I pay attention to right now?”
- **Opportunities** answers: “What opportunities exist?”
- **Advisor** answers: “What should I do?”

Profile remains secondary account navigation. Saved opportunities remain available through Home and the existing saved-opportunities route.

## Home

Home is a command center, not an analytics dashboard.

It shows:

- one primary mission;
- why the mission matters;
- estimated effort and expected impact;
- one primary action: Open Advisor;
- secondary saved/deadline context behind disclosure.

Home uses `buildAdvisorBrain` but does not duplicate recommendation logic.

## Opportunities

Opportunities preserves the existing search, browse, saved, tracking, and opportunity database behavior.

The visible hierarchy is:

1. Search
2. Quick category chips
3. Advanced filters on demand
4. Results

Advisor can open Opportunities with query parameters such as `query`, `category`, or `type`. `OpportunityFilter` reads those parameters on load and applies them to the existing filter state.

## Advisor

Advisor is the premium coaching surface.

It uses existing infrastructure:

- Advisor Brain
- Student Digital Twin
- Evidence Inventory
- Recommendation Engine
- Interview Intelligence
- Student Progress

Advisor shows one highest-priority recommendation with:

- why it matters now;
- evidence used;
- confidence;
- expected benefit;
- estimated effort;
- direct next action;
- alternatives behind disclosure.

Completion uses existing progress helpers:

- milestone recommendations call `markMilestoneCompleted`;
- opportunity recommendations call `updateApplicationStatus`.

Completion confirms what changed before revealing the next recommendation.

## Free and Pro Boundary

`lib/advisor-access.ts` defines the future access states:

- `free`
- `preview`
- `pro`
- `unavailable`

Current behavior keeps Advisor available as a tasteful preview for authenticated students with a completed profile. The type boundary allows future Stripe/Pro enforcement without changing the Advisor UI contract.

## Performance Notes

The dashboard no longer fetches the duplicate `/api/advisor/recommend` panel on initial load. Home computes the mission from local hydrated profile/activity/progress state and keeps secondary information collapsed.

Opportunities keeps the existing client filter infrastructure but avoids rendering the full advanced filter grid until requested.

## Tests

The architecture is covered by:

- `npm run check:advisor-ux`
- `npm run check:profile-flow`
- existing onboarding, auth, advisor, interview, data validation, and production build checks.
