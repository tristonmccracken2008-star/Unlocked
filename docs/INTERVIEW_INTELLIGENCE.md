# Interview Intelligence

UnlockED Interview Intelligence is deterministic internal infrastructure. It does not call an AI API and it does not generate free-form coaching text.

## Purpose

The original Advisor Brain archive included prototype interview logic that scored STAR answers with keyword checks and returned generic prompts such as developing missing competency stories. UnlockED now uses a production TypeScript implementation that connects interview readiness to the same systems used by the live app:

- `data/recommendation-engine.ts` for current recommendations and next actions.
- `data/student-progress.ts` for milestones, applications, deadlines, and submitted work.
- `data/evidence-inventory.ts` for profile, activity, milestone, application, and recommendation evidence.
- `data/student-digital-twin.ts` for current planning state and readiness dimensions.
- `data/interview-intelligence.ts` for interview story coverage, STAR completeness, evidence support, risks, and practice planning.

## Data Flow

1. `createAdvisorProfile` builds the structured Advisor Profile from the saved profile, school, activity, and progress.
2. `runRecommendationEngineV1` creates ranked recommendations.
3. `buildEvidenceInventory` converts profile state, tracked opportunities, completed milestones, applications, and recommendations into evidence items.
4. `buildStudentDigitalTwin` summarizes the student state across academics, technical ability, evidence, network, communication, execution, wellbeing, and interview readiness.
5. `runInterviewIntelligence` evaluates interview competency coverage and any provided STAR stories against the evidence inventory.

## Outputs

`runInterviewIntelligence` returns:

- readiness stage and score;
- primary recommendation and next action;
- competency coverage;
- STAR story evaluations;
- evidence-backed story ideas;
- practice plan linked to current recommendations;
- risks such as missing external validation or time constraints;
- the Student Digital Twin used for scoring;
- knowledge references for auditability.

Scores are planning aids only. They are not hiring, admission, funding, or interview-success probabilities.

## Backwards Compatibility

This is additive infrastructure. It does not change authentication, onboarding, profile persistence, billing, opportunity search, or dashboard rendering. Existing Advisor and recommendation APIs continue to work with their current contracts.

## Tests

Run:

```bash
npm run check:interview
```

The check verifies that Interview Intelligence:

- uses the Student Digital Twin;
- uses existing recommendation and progress types;
- requires evidence support;
- avoids prototype keyword-only scoring;
- is included in the production `prebuild` pipeline.
