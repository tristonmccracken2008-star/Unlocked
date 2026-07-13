# Recommendation Engine 2.0

UnlockED recommendations come from one canonical path:

`StudentProfile + School + StudentActivity + StudentProgress + Opportunities -> buildRecommendationService() -> RecommendationV1[]`

Primary modules:

- `data/recommendation-config.ts`: tunable weights, label thresholds, and diversity penalties.
- `data/opportunity-enrichment.ts`: canonical schema derivation, organization normalization, structured eligibility, rich tags, duplicate keys, and data quality scores.
- `data/opportunity-intelligence.ts`: opportunity metadata normalization, eligibility matching, scoring inputs, and explanation reasons.
- `data/recommendation-engine.ts`: ranking, exclusion rules, roadmap connections, deterministic diversity, and `RecommendationV1` output.
- `data/recommendation-service.ts`: product-facing view models consumed by For You, Journey, and Discover.
- `data/career-roadmaps.ts`: deterministic career progression maps by destination career and student stage.
- `data/opportunity-relationships.ts`: inferred prerequisites, follow-ups, alternatives, easier/harder versions, and career progression chains.
- `data/recommendation-weekly-strategy.ts`: internal weekly strategy summary for future Pro surfaces.

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
- Career roadmap fit: destination careers such as quantitative finance, software engineering, medicine, investment banking, and data science add stage-specific category, skill, signal, and organization boosts.
- Skill alignment: opportunities that build roadmap skills receive additional weight.
- Opportunity gaps: underused categories in the student's stage receive a balancing boost so the feed does not overfit to one behavior.
- Adaptive feedback: dismissed, hidden, not-interested, already-applied, and already-completed recommendations are suppressed or penalized immediately.
- Freshness and deadline confidence: recently verified records receive a small boost; weak deadline confidence receives a penalty.
- Expected ROI and time required: high-value or low-effort opportunities can rise when other eligibility signals are strong.

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
- career roadmap fit
- prerequisite or follow-up relationship
- opportunity mix gap
- adaptive learning from prior feedback

The engine does not fabricate reasons for unavailable data.

## Diversity

After base scoring, the engine applies deterministic diversity penalties so the ranked list does not become five similar items in a row.

The diversity pass balances:

- organization
- category
- opportunity type

Diversity can lower an otherwise strong duplicate, but it does not introduce randomness.

## Quality Gates

Recommendation Engine 1.0 uses internal quality gates before an opportunity can appear in For You or Journey's “Next to review.”

A recommendation is filtered when:

- it is not eligible for the student's school
- it does not match the student's class year and is not marked `Any Year`
- the student's reported GPA is below a listed GPA requirement
- the deadline has passed
- it has fewer than two meaningful positive signals
- the final score falls below the minimum recommendation score
- the explanation lacks a factual matching reason

This reduces recommendations that are technically in the catalog but would not feel trustworthy to a student.

## Opportunity Quality Score

Each opportunity receives an internal quality score in `getOpportunityIntelligence()`.

Quality signals include:

- verified source
- HTTPS official source
- complete description
- clear eligibility
- deadline or documented rolling/varies state
- documented value or explicit unknown value
- non-expired verification status
- normalized organization metadata
- enriched tags and career fields

The quality score contributes to ranking but does not override eligibility.

## Internal Diagnostics

Development and future admin tooling can call `buildRecommendationDiagnosticReport()` to inspect recommendation quality.

The diagnostic report includes:

- top recommendation
- final ranking order
- competing opportunities
- filtered recommendations
- positive and negative ranking signals
- filter reasons
- final score
- deterministic match label
- generation timing
- confidence level
- career roadmap adjustments
- timing and verification adjustments
- matched interests, roadmap skills, and opportunity relationships

This report is internal. It should not be exposed to normal users because it contains debugging details and ranking internals.

## Cache and Refresh

Recommendations regenerate when inputs change:

- profile fields, including onboarding answers
- current priority
- saved/Journey activity
- completed or rejected opportunities
- viewed opportunities
- opportunity database contents
- advisor feedback records
- hidden or dismissed opportunities
- referral activity for future recommendation rules

Advisor profile fingerprints include minor, GPA status/value, current priority, goals, interests, and preferred opportunity types so cached Advisor Brain snapshots invalidate when meaningful recommendation inputs change.

## Performance

Recommendation generation is deterministic and in-memory over the local opportunity catalog. The diagnostic report records elapsed time, ranked count, recommended count, and source opportunity count so future regressions can be caught before launch.

The engine avoids frontend sorting hacks by letting product surfaces consume `buildRecommendationService()`. Discover only applies search/filter narrowing around the same canonical ranking order.

Relationship inference is cached by opportunity id and catalog size. Advisor Brain results keep the existing bounded in-memory cache. The ranking pass remains deterministic and avoids client-side recomputation.

## Career Roadmaps

Career roadmaps are structured rules, not AI text generation. Each roadmap defines:

- aliases used to select the destination career
- stage-specific focus
- preferred categories
- skills to build
- target organizations
- opportunity text signals

If a career goal is unknown or broad, the engine uses the general exploration roadmap. Two students with different goals should receive meaningfully different rankings because the roadmap categories, skills, organizations, and signals differ by destination career.

## Opportunity Relationships

Every scored opportunity can expose internal relationships:

- prerequisites
- follow-up opportunities
- alternatives
- easier version
- harder version
- career progression chain

These relationships support explanations such as “this can unlock stronger follow-up opportunities later” without exposing private ranking formulas.

## Adaptive Learning

The For You page stores feedback through `/api/advisor/feedback`.

Supported user signals:

- Interested
- Not interested
- Hide
- Already applied
- Already completed
- Never show again

Feedback records are server-side Advisor data. React components do not rank opportunities. The recommendation service passes feedback into the Advisor Profile, and the engine suppresses or penalizes opportunities according to structured rules.

## Confidence Model

The engine calculates raw numeric confidence internally, then maps it to:

- High
- Medium
- Low

Low-confidence results are filtered by quality gates instead of being promoted. Product cards continue to show plain match labels and explanations rather than formulas.

## Premium Behavior

Free users receive two genuine recommendations as a preview. Pro users receive the full ranked feed, complete explanations, adaptive learning, career roadmap intelligence, opportunity relationships, and future weekly strategy surfaces. Core Discover and Journey behavior remains available to free users.

## Recommendation Quality Audit

The trust sprint found these weak areas and corrected them:

- recommendations could carry useful scores without an explicit audit object
- weak one-signal matches could survive if the database quality score was high
- GPA requirements were recognized but below-requirement reported GPAs were not hard-filtered
- class-year mismatch was penalized but not consistently filtered
- internal validation could not explain why a recommendation was excluded

Current behavior:

- every scored opportunity carries positive, negative, or neutral signals
- weak recommendations are filtered by quality gates
- ineligible school, year, GPA, expired, completed, rejected, accepted, and active Journey opportunities are suppressed
- final rankings are stable for identical inputs
- match labels use score thresholds rather than exposed confidence percentages

## Product Surfaces

- For You consumes `buildRecommendationService()` for the full recommendation page.
- Journey uses the same service for “Next to review.”
- Discover uses the same service to order “Relevant” results when a completed profile is available, while search and filters still narrow the browsed result set.

This preserves the product model:

- Discover: browse manually.
- For You: UnlockED already found the best matches.
- Journey: manage active progress.

## Remaining Future Improvements

- Add larger anonymous aggregate behavior once enough real users exist.
- Build manual admin controls for reviewing individual diagnostic reports.
- Add explicit search-history storage only after privacy wording and retention rules are finalized.
- Add more destination career roadmaps as usage data shows demand.
- Tune weights from real conversion outcomes rather than assumptions.
