# Onboarding personalization V2

## Question audit

The V1 school, graduation year, and primary-major questions are retained. School and major inputs now keep searchable catalog matching while allowing manual values. Graduation year remains the single source for academic stage.

The V1 career-direction question was removed as a required identity choice. Its broad intent is split between current goals and the optional specific-career refinement. The V1 mixed interests question was replaced by separate opportunity-type and field-interest questions. The V1 single current-priority question was rewritten as a bounded multi-select because students often have more than one immediate goal.

Minor and GPA remain editable in Profile, but GPA is not required during onboarding. Current experience, weekly availability, geography, and demographic questions are not collected because the current recommendation path does not use them consistently enough to justify the friction.

## Final order and signal use

1. School: school restrictions and school-specific eligibility.
2. Graduation year: academic stage and class-year eligibility.
3. Academic focus: major, second-major, and minor eligibility and relevance.
4. Opportunity types: bounded category ranking and portfolio balance.
5. Fields of interest: academic-field relevance.
6. Current goals: current-priority relevance.
7. Location format: remote, hybrid, and in-person ranking.
8. Compensation: paid-only eligibility gate or bounded paid preference.
9. Time commitment: duration and season ranking.
10. Specific career paths: optional career-roadmap relevance.

The canonical answer choices live in `data/onboarding-options.ts`. Fields are limited to five, current goals to four, and specific career paths to five. `Still exploring`, `Still figuring it out`, `Not sure yet`, and `No preference` are exclusive choices within their respective groups.

## Legacy mapping

Existing completed accounts remain completed and are never sent through V2 automatically. Existing major, second major, minor, school, graduation year, recommendation history, and profile completion timestamps remain unchanged.

Legacy opportunity values map only through explicit aliases. Legacy topics are preserved verbatim as field interests because values such as Research may have represented either a category or a field; V2 does not guess. A known V1 priority maps to the equivalent current-goal wording. Unknown values remain available in Profile as custom values. Missing V2 practical preferences default to No preference without asserting a new preference.

## Validation and persistence

The client prevents duplicate completion and keeps a per-account V2 draft with the exact current step. The account API independently validates V2 required fields, limits, supported enums, and mutually exclusive exploration choices before it marks a new account as onboarded. Existing optimistic-concurrency and same-origin account-write protections remain authoritative.

## Current limits

Geographic city, state, relocation, and international preferences are intentionally omitted until catalog geography is structured consistently. Custom schools can complete onboarding, but school-specific matching is naturally limited until the school is represented in the catalog.

The current professional recommendation gate admits 49 catalog records for the representative University of Chicago cold-start profiles, and those records are all AI tools or student benefits. V2 prevents four same-type results and preserves preference ranking, but it cannot produce a scholarship, internship, or research mix until those catalog categories have enough positively verified eligibility metadata. Eligibility remains fail-closed; onboarding does not lower the trust gate to manufacture variety.
