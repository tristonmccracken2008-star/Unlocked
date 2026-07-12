# Recommendation Engine 1.0

UnlockED recommendations come from one canonical path:

`StudentProfile + School + StudentActivity + StudentProgress + Opportunities -> buildRecommendationService() -> RecommendationV1[]`

Primary modules:

- `data/recommendation-config.ts`: tunable weights, label thresholds, and diversity penalties.
- `data/opportunity-intelligence.ts`: opportunity metadata normalization, eligibility matching, scoring inputs, and explanation reasons.
- `data/recommendation-engine.ts`: ranking, exclusion rules, roadmap connections, deterministic diversity, and `RecommendationV1` output.
- `data/recommendation-service.ts`: product-facing view models consumed by For You, Journey, and Discover.

No recommendation surface should independently rank opportunities.

## Signal Weights

Weights are centralized in `recommendationConfig`.

- School eligibility: school-specific matches are stronger than national availability. Wrong-school exclusive opportunities receive a hard negative score.
- Major alignment: major matches are a primary positive signal. `Any Major` receives a smaller boost.
- Minor alignment: minor matches receive a moderate boost for interdisciplinary fit.
- Graduation year eligibility: matching class year is strong. Wrong class year receives a hard penalty.
- Career goals: career-goal text and opportunity metadata are strongly weighted.
- Opportunity interests: selected interests bias categories and tags without excluding other strong matches.
- Current priority: current priority receives a temporary boost. It biases ranking but is not a hard filter.
- GPA handling: GPA is used only when an opportunity appears to publish a GPA requirement. No-GPA-yet is not broadly penalized.
- Deadline timing: near deadlines are boosted. Passed deadlines are suppressed.
- Verification and quality: verified, complete, official-source opportunities rank higher.
- Activity learning: saved and completed categories receive small boosts; already active Journey records are suppressed from For You.

## Recommendation Labels

UnlockED does not show raw confidence percentages in product cards. Labels come from deterministic score thresholds:

- `Excellent Match`: score >= 86
- `Strong Match`: score >= 72
- `Good Match`: score >= 56
- `Worth Reviewing`: score >= 38
- `Limited Match`: below 38

## Explanation Rules

Every explanation bullet must map to a real scoring signal:

- major or minor match
- career-goal match
- opportunity-interest match
- current-priority match
- class-year eligibility
- school eligibility
- GPA requirement handling
- deadline proximity
- official-source verification

The engine does not fabricate reasons for unavailable data.

## Diversity

After base scoring, the engine applies deterministic diversity penalties so the ranked list does not become five similar items in a row.

The diversity pass balances:

- organization
- category
- opportunity type

Diversity can lower an otherwise strong duplicate, but it does not introduce randomness.

## Cache and Refresh

Recommendations regenerate when inputs change:

- profile fields, including onboarding answers
- current priority
- saved/Journey activity
- completed or rejected opportunities
- viewed opportunities
- opportunity database contents

Advisor profile fingerprints include minor, GPA status/value, current priority, goals, interests, and preferred opportunity types so cached Advisor Brain snapshots invalidate when meaningful recommendation inputs change.

## Product Surfaces

- For You consumes `buildRecommendationService()` for the full recommendation page.
- Journey uses the same service for “Next to review.”
- Discover uses the same service to order “Relevant” results when a completed profile is available, while search and filters still narrow the browsed result set.

This preserves the product model:

- Discover: browse manually.
- For You: UnlockED already found the best matches.
- Journey: manage active progress.
