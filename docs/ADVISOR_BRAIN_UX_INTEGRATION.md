# Advisor Brain UX Integration

UnlockED now exposes Advisor Brain intelligence through one typed orchestration layer:

- `data/advisor-brain.ts`

This is deterministic infrastructure. It does not call an AI API and it does not generate free-form recommendations in React components.

## Data Flow

1. Saved profile, school, activity, and progress are converted into an `AdvisorProfile` with `createAdvisorProfile`.
2. `runRecommendationEngineV1` ranks milestones and opportunities using structured rules.
3. `buildEvidenceInventory` converts profile, activity, milestones, applications, and recommendations into evidence coverage.
4. `buildStudentDigitalTwin` summarizes readiness dimensions.
5. `runInterviewIntelligence` evaluates interview competency coverage, STAR readiness, missing stories, and practice priority.
6. `buildAdvisorBrain` returns UI-ready dashboard/profile objects with explainability.
7. `explainOpportunityWithAdvisorBrain` returns opportunity-level fit, skills, competencies, evidence, resume value, interview value, ROI, confidence, impact, tradeoffs, and time estimates.

## New APIs

### `buildAdvisorBrain(input)`

Input:

- `advisorProfile`
- optional `progress`
- optional `opportunities`

Output:

- `highestImpactAction`
- `biggestCareerGap`
- `readinessScores`
- `twin`
- `evidenceInventory`
- `interview`
- `recommendations`

### `explainOpportunityWithAdvisorBrain(input)`

Input:

- `advisorProfile`
- `opportunity`
- optional `progress`
- optional existing recommendations

Output:

- `whyRecommended`
- `skillsGained`
- `competenciesStrengthened`
- `evidenceGenerated`
- `resumeImpact`
- `interviewValue`
- `estimatedRoi`
- `evidenceUsed`
- `confidence`
- `expectedImpact`
- `tradeoffs`
- `estimatedCompletionTime`
- `knowledgeReferences`

## For You Integration

`components/advisor-page.tsx` uses `buildAdvisorBrain` after the existing account/profile/activity hydration completes.

For You now leads with one opportunity-focused surface:

- one best-fit recommendation from the UnlockED opportunity database or roadmap-linked opportunity context;
- one primary action into the matching opportunity or Discover filters;
- why it fits;
- evidence and confidence behind disclosure;
- alternatives behind disclosure.

React components do not rank or generate recommendations. They render the structured Advisor Brain output.

## Journey Integration

`components/personalized-home.tsx` is now the private Journey surface.

Journey uses:

- `buildJourneyMilestones`
- `buildJourneyRecap`
- existing saved/tracked activity records
- existing progress records where available

Journey does not fabricate streaks, points, goals, or achievements. If there is no real activity yet, it renders clear empty states and points the student back to Discover.

## Opportunity Integration

`app/opportunities/[id]/page.tsx` checks for the current session server-side. If the student is authenticated and onboarded, the page builds an Advisor Profile and renders a personalized “Why this is recommended for you” section.

Signed-out users and incomplete profiles do not receive fake personalization.

## Profile Integration

`components/profile-page.tsx` adds a Career Profile tab beside the existing Edit Profile tab.

The primary tab displays:

- current direction
- strongest areas
- top growth areas
- one recommended next step

Detailed evidence, confidence, competency coverage, skill graph, career trajectory, and interview-readiness details remain available behind the “How this was calculated” disclosure.

The existing edit form and profile persistence path are unchanged.

## Explainability Rules

Every surfaced recommendation includes:

- why it was recommended;
- evidence used;
- confidence;
- expected impact;
- tradeoffs;
- estimated completion time.

Those fields come from structured Advisor Brain outputs. React components only render the returned objects.

## Tests

Run:

```bash
npm run check:advisor-ux
```

This check verifies that dashboard, profile, and opportunity surfaces consume the Advisor Brain layer and expose the required explainability fields.
