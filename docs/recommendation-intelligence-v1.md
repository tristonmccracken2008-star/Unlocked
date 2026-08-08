# Recommendation Intelligence V1

For You remains a deterministic, server-side recommendation pipeline. It does not generate opportunity facts or use model-written recommendations.

## Pipeline

1. Build an Advisor Profile from onboarding, profile, and account activity.
2. Reject records that fail lifecycle, source, verification, eligibility, deadline, duplicate, dismissal, completion, or Journey gates.
3. Score eligible candidates across relevance, eligibility, quality, impact, freshness, timing, and behavior.
4. Build a bounded portfolio with organization, category, type, semantic-cluster, exploration, repetition, and convenience-resource controls.
5. Generate explanations only from the structured signals that affected the recommendation.
6. Run the final professional eligibility and confidence audit before serialization.

## Behavior Weights

Passive views are weak evidence. Two or more related views are required before view-based explanation copy appears. Saves are stronger, active Journey records are stronger still, and completed experiences are strongest. Contributions are capped so behavior cannot override eligibility or permanently narrow the feed.

## Resource Budget

AI tools, software benefits, discounts, and similar convenience resources may not pad a Pro shortlist. A normal portfolio contains at most one. Explicit preference or sustained meaningful activity can raise the cap to two. If the verified candidate pool contains only resources, For You returns a smaller shortlist rather than manufacturing variety or recommending unverified career listings.

## Diagnostics

`buildRecommendationDiagnosticReport()` exposes the following internal score components without adding them to the student-facing UI:

- base relevance
- eligibility
- quality
- impact
- freshness
- timing
- behavioral contribution
- diversity rank adjustment
- repetition penalty
- final score

## Verification

Run `npm run check:recommendation-intelligence` for representative CS, economics, pre-med, and undecided profiles; behavior adaptation; resource limits; organization diversity; eligibility; and diagnostic-shape coverage. The check is part of `prebuild`.
