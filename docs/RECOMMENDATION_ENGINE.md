# Professional Recommendation Engine

UnlockED recommendations come from one canonical path:

`StudentProfile + School + StudentActivity + StudentProgress + Opportunities -> buildRecommendationService() -> RecommendationV1[]`

Primary modules:

- `data/recommendation-config.ts`: tunable weights, label thresholds, and diversity penalties.
- `data/opportunity-enrichment.ts`: canonical schema derivation, organization normalization, structured eligibility, rich tags, duplicate keys, and data quality scores.
- `data/opportunity-intelligence.ts`: opportunity metadata normalization, eligibility matching, scoring inputs, and explanation reasons.
- `data/opportunity-eligibility.ts`: fail-closed eligibility checks and evidence for every applicable restriction.
- `data/opportunity-confidence.ts`: eligibility, metadata, verification, recommendation, and overall confidence dimensions.
- `data/recommendation-engine.ts`: ranking, exclusion rules, roadmap connections, deterministic diversity, and `RecommendationV1` output.
- `data/recommendation-service.ts`: product-facing view models consumed by For You, Journey, and Discover.
- `data/career-roadmaps.ts`: deterministic career progression maps by destination career and student stage.
- `data/opportunity-relationships.ts`: inferred prerequisites, follow-ups, alternatives, easier/harder versions, and career progression chains.
- `data/recommendation-weekly-strategy.ts`: internal weekly strategy summary for future Pro surfaces.

No recommendation surface should independently rank opportunities.

The production eligibility and availability architecture is documented in `FOR_YOU_PRODUCTION_CORRECTNESS.md`.

## Canonical eligibility and tiers

`data/opportunity-eligibility-model.ts` normalizes every hard eligibility constraint before scoring. Unknown critical eligibility is quarantined; unknown noncritical value, effort, or competitiveness may reduce ranking quality without making a student ineligible. Application-cycle availability is tracked separately from personal eligibility.

Opportunity recommendations carry one of three tiers: `excellent`, `strong`, or `explore`. Explore is a verified, eligibility-safe fallback tier with weaker personalization or an unannounced future cycle. It never bypasses school, education, enrollment, class-year, major, GPA, citizenship, transfer, demographic, source, or verification gates.

For You snapshots are compatible only when user, profile, engine, eligibility schema, catalog, rules, and source versions match. Compatible snapshots are re-audited before rendering.

## Signal Weights

Weights are centralized in `recommendationConfig`.

- School eligibility: school-specific matches are stronger than national availability. Wrong-school exclusive opportunities receive a hard negative score.
- Major alignment: major matches are a primary positive signal. `Any Major` receives a smaller boost.
- Minor alignment: minor matches receive a moderate boost for interdisciplinary fit.
- Graduation year eligibility: matching class year is strong. Wrong class year receives a hard penalty.
- Career goals: destination careers match the structured career-field taxonomy; arbitrary token overlap is not treated as career fit.
- Opportunity interests: selected interests match explicit categories, tags, and career fields. Research, internship, scholarship, benefit, and AI interests require the corresponding opportunity category or type.
- Current priority: current priority receives a temporary boost. It biases ranking but is not a hard filter.
- GPA handling: GPA is used only when an opportunity publishes a requirement. Unknown GPA fails that opportunity's eligibility gate.
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

After base scoring, the engine applies deterministic diversity penalties and hard per-organization, category, and type caps so the ranked list cannot be padded with near-identical items.

The diversity pass balances:

- organization
- category
- opportunity type

Diversity can lower an otherwise strong duplicate, but it does not introduce randomness.

## Quality Gates

The professional pipeline uses internal quality gates before an opportunity can appear in For You or Journey's “Next to review.” Unknown eligibility fails closed.

A recommendation is filtered when:

- it is not eligible for the student's school
- institution type, enrollment, host-institution access, or external-student access is not proven
- it does not match the student's class year and is not marked `Any Year`
- degree level does not match
- citizenship and work-authorization requirements are unresolved or mismatched
- the student's reported GPA is below a listed GPA requirement
- a listed GPA exists but the profile GPA is unknown
- age, residency, transfer, invitation-only, need, merit, or demographic eligibility is unresolved
- the current application cycle is explicitly closed, expired, or otherwise non-actionable for the selected tier
- the deadline has passed
- eligibility, metadata, or verification confidence is below the professional threshold
- an Excellent or Strong item has fewer than two meaningful positive signals
- an Excellent or Strong item has no student-specific relevance signal; generic `Any Major`, `Any Year`, and national availability do not count as personalization
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

The engine avoids frontend ranking work by keeping personalized recommendation generation behind server-gated For You APIs. Discover uses lightweight local ordering after search/filter narrowing so browsing remains responsive without duplicating Advisor Brain work in the browser.

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

Every opportunity recommendation carries five internal confidence dimensions:

- eligibility confidence
- metadata confidence
- verification confidence
- recommendation confidence
- overall confidence, calculated from the weakest dimension rather than an average

The engine maps overall confidence to:

- High
- Medium
- Low

Excellent and Strong recommendations require every confidence dimension to be at least 78. Explore recommendations retain the same 78-point eligibility, metadata, and verification floors while permitting recommendation confidence down to 52. Low-confidence results are always filtered. Product cards continue to show plain match labels and explanations rather than formulas.

## Professional Audit

`npm run check:professional-catalog` inspects every catalog record for semantic duplicates, repeated copy, school-scope contradictions, verification contradictions, and deadline inconsistencies.

`npm run check:professional-recommendations` executes the real ranking pipeline against 512 synthetic students spanning schools, majors, years, career goals, GPAs, citizenship/work authorization, ages, institution types, transfer states, financial situations, and relevant eligibility attributes. The fast prebuild smoke test runs the same invariants across 32 profiles.

The performance guard measures ranking time separately from test assertions and catalog-audit bookkeeping. It requires average generation below 1 second, p95 below 2 seconds, and every run below the production snapshot generation ceiling of 2.8 seconds. This catches sustained regressions while tolerating an isolated build-worker scheduling or garbage-collection pause that remains inside the server's hard bound.

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

- For You consumes `buildRecommendationService()` through the server-gated recommendation API.
- Journey uses tracked opportunity records and journey milestones only; it does not generate recommendations.
- Discover uses search, filters, and lightweight local relevance sorting for manual browsing.

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
