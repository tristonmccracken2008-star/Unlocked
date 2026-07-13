# UnlockED Professional Recommendation Launch Audit

Audit date: 2026-07-13

## Launch Decision

The professional recommendation path is fail-closed and ready for undergraduate precision testing. It should not yet be marketed as a complete paid recommendation product for graduate or recent-graduate students: all 102 graduate profiles in the adversarial population correctly received an empty feed because the catalog does not contain enough current, fully proven graduate opportunities.

That is a coverage limitation, not an eligibility bypass. The engine now prefers a short or empty feed over a questionable recommendation.

## Architecture

The canonical product path remains:

`Account profile + school + Journey/activity + catalog -> Advisor Profile -> professional eligibility gate -> deterministic scoring -> confidence gate -> diversity caps -> final recommendation audit -> For You snapshot`

New internal boundaries:

- `data/opportunity-eligibility.ts` owns fail-closed eligibility decisions and evidence.
- `data/opportunity-confidence.ts` owns five-dimensional confidence.
- `data/recommendation-engine.ts` ranks only candidates that passed the professional gate.
- `data/recommendation-professional-pipeline.ts` validates source data and audits final recommendations.
- `scripts/check-professional-catalog.mjs` audits every catalog record.
- `scripts/check-professional-recommendations.ts` runs executable adversarial tests through the real engine.

Auth, onboarding UI, billing, Journey persistence, Discover search, referrals, analytics, and payments were not redesigned or replaced.

## Weaknesses Found

1. Generated school-directory records were labeled verified even though they pointed to a university root domain and explicitly required office-level review.
2. Eligibility depended heavily on free-text inference and did not cover age, transfer status, residency, invitation-only access, financial need, merit, demographic restrictions, or current cycle availability.
3. A generic work-authorization value could satisfy a citizenship restriction, including cases that required citizenship specifically.
4. External-student access could be inferred too broadly for university-hosted national programs.
5. Generic `Any Major`, `Any Year`, national availability, and catalog quality could make an unrelated item appear personalized.
6. Career-field inference used substring matching. For example, `ai` inside another word and `lab` inside `collaboration` created false career signals.
7. Scores were clamped before final ranking, producing many 100-point ties and alphabetical ordering among materially different candidates.
8. Diversity penalties discouraged repetition but still filled the feed with near-identical tools when no stronger alternatives existed.
9. Existing Advisor v3 checks primarily inspected source patterns instead of executing the production ranking behavior.
10. The catalog contained one semantic NASA OSTEM duplicate and 188 descriptions with repeated sentences.

## Fixes Implemented

- Downgraded 2,373 generated school-directory records from `verified` to `needs_review` and marked eligibility verification incomplete.
- Removed the superseded NASA OSTEM duplicate.
- Removed repeated sentences from 188 descriptions.
- Added deterministic checks for institution type, enrollment, school restrictions, host institution, class year, degree level, citizenship, work authorization, GPA, major, external-student access, age, residency, transfer status, invitation status, financial need, merit, demographic eligibility, application cycle, and availability.
- Removed the external-student profile shortcut and separated citizenship from work authorization.
- Added optional, backward-compatible profile fields for future proof data. The onboarding UI and persistence flow were not changed.
- Added structured `eligibilityRules` metadata support for verified facts and evidence.
- Added eligibility, metadata, verification, recommendation, and overall confidence. The weakest dimension determines overall confidence; every Pro dimension must be at least 78.
- Required at least one real personalized signal. Generic availability and broad eligibility no longer qualify.
- Replaced career token overlap with structured career taxonomy matching.
- Replaced unsafe substring signal matching with normalized phrase boundaries.
- Preserved raw ranking resolution until final selection so strong candidates no longer collapse into 100-point ties.
- Added hard caps of one opportunity per organization, two per category, and three per type in a recommendation feed.
- Added structured explainability for why the user, why now, why the opportunity, why it ranked above alternatives, and the eligibility evidence used.

## Catalog Results

- Total records inspected: 5,991
- Verified: 201
- Needs review: 5,787
- Temporarily closed: 2
- Archived: 1
- Semantic duplicate groups remaining: 0
- Repeated descriptions remaining: 0
- Verified records suppressed for uncertain eligibility: 28
- Generated school-directory records awaiting office-level review: 2,373

Uncertain records remain available for manual discovery with their trust status, but they cannot enter Pro recommendations.

## Adversarial Recommendation Results

The final behavioral audit ran the full 5,991-record catalog against 512 synthetic students covering 339 supported schools, ten majors, five academic stages, ten career goals, varied GPAs, citizenship/work authorization, ages, institution types, transfer states, financial situations, and relevant eligibility attributes.

- Recommendations generated: 1,741
- Average recommendations per profile: 3.40
- Undergraduate profiles: 410
- Undergraduate profiles with an empty feed: 0
- Average undergraduate recommendations: 4.25
- Graduate/recent-graduate profiles: 102
- Graduate/recent-graduate profiles with an empty feed: 102
- Eligibility bypasses found after fixes: 0
- Duplicate recommendations in a feed: 0
- Recommendations below the five confidence thresholds: 0
- Feeds exceeding eight recommendations: 0

Targeted tests also prove fail-closed behavior for wrong-school, community-college-only, transfer-only, GPA, citizenship, work authorization, age, residency, invitation-only, financial-need, demographic, external-student, closed-cycle, and unknown-eligibility cases.

## Performance

Before relevance hardening, the 512-profile audit averaged 246.93 ms per full-catalog run with a 371 ms slowest run. After hardening, it averaged 245.28 ms with a 332 ms slowest run.

The normal request target remains under two seconds. The audit observed no external network calls, database scans, retries, or client-side ranking in the recommendation path. The full 512-profile audit is intentionally separate from prebuild; prebuild runs the same checks across 32 profiles to keep deployments bounded.

## Remaining Launch Work

1. Graduate coverage is the only commercial recommendation blocker found. Do not promise a complete Pro feed to graduate or recent-graduate users until current, fully verified opportunities are added for that stage.
2. Manually review the 5,787 `needs_review` records over time, starting with school-specific resources for institutions with active users. Office-level URLs and explicit eligibility evidence are required before promotion.
3. The current profile does not ask for citizenship, work authorization, age, transfer status, residency, financial need, merit, or demographic eligibility. This audit deliberately did not expand onboarding. Opportunities requiring those facts remain excluded unless the facts already exist in the account profile.
4. Continue running `check:professional-catalog`, the quick behavioral smoke test in prebuild, and the full 512-profile audit before recommendation-policy releases.

## Verification Commands

- `npm run lint`
- `npm run check:professional-catalog`
- `npm run check:professional-recommendations`
- `npm run prebuild`
- `npm run build`
