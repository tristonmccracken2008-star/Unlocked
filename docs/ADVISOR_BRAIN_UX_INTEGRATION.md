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

## Dashboard Integration

`components/personalized-home.tsx` uses `buildAdvisorBrain` after the existing account/profile/activity hydration completes.

The dashboard now shows:

- Today’s Highest-Impact Action
- Biggest Career Gap
- Career Readiness Score

The existing progressive-disclosure Advisor recommendation card still uses the current `/api/advisor/recommend` route and remains backwards compatible.

## Opportunity Integration

`app/opportunities/[id]/page.tsx` checks for the current session server-side. If the student is authenticated and onboarded, the page builds an Advisor Profile and renders a personalized “Why this is recommended for you” section.

Signed-out users and incomplete profiles do not receive fake personalization.

## Profile Integration

`components/profile-page.tsx` adds an Advisor Brain tab beside the existing Edit Profile tab.

The tab displays:

- Student Digital Twin summary
- Evidence inventory
- Competency coverage
- Skill graph
- Current bottlenecks
- Confidence levels
- Career trajectory
- Interview Intelligence

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
