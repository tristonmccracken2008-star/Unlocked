# Recommendation-Safe Catalog Report

Audit date: 2026-08-14

## Executive Result

UnlockED's production recommendation gate was preserved. The project added field-level provenance, a deterministic blocker funnel, a coverage-aware review queue, an admin review surface, distribution reporting for the 250-profile suite, and regression checks. One existing high-value record, DOE SULI, had sufficient current first-party evidence to move safely into ranking.

This is not a claim that the catalog is verified. The dominant remaining constraint is genuine lifecycle and eligibility review, not a threshold bug.

| Inventory measure | Before | After |
| --- | ---: | ---: |
| Total records | 5,998 | 5,998 |
| Canonical public records | 5,987 | 5,987 |
| Verification status `verified` | 205 | 205 |
| Recommendation-safe | 67 | 68 |
| High-value recommendation-safe | 9 | 10 |
| Canonical eligibility `needs_eligibility_review` | 5,841 | 5,840 |
| Lifecycle-actionable | 77 | 78 |
| New records | 0 | 0 |
| Existing records safely upgraded | 0 | 1 |
| Duplicates or obsolete records newly archived | 0 | 0 |

## Production Gate

A record is recommendation-safe only when the existing production validator proves all of the following:

1. It is canonical and not superseded.
2. Its lifecycle is currently actionable with strong or confirmed evidence.
3. It has a usable HTTPS official source, organization, and eligibility statement.
4. Its verification status is `verified` and not excluded, closed, or awaiting review.
5. Its canonical eligibility status is `eligible_for_ranking`.
6. No critical eligibility dimension is unresolved.
7. Eligibility text is sufficiently specific to prove fit.
8. Eligibility and verification confidence both meet the Pro threshold.
9. The student-level eligibility engine separately proves institution, enrollment, school, host, year, degree, citizenship, GPA, major, external-student, age, residency, transfer, invitation, need/merit, demographic, application-cycle, and availability checks.

No condition was removed or relaxed.

## Blocker Funnel

The new deterministic audit maps production gate failures to operational categories. Counts overlap because one record can have several blockers.

| Stage | Records remaining |
| --- | ---: |
| Total | 5,998 |
| Lifecycle actionable | 78 |
| Official source explicitly confirmed in verification metadata | 51 |
| Eligibility explicitly verified | 38 |
| Recommendation-safe | 68 |

The apparent non-monotonicity between explicitly verified eligibility and recommendation-safe records is intentional legacy behavior: some older safe records reach the existing confidence threshold through verified status and complete canonical metadata without the newer boolean. Future reviews should use field evidence and the explicit flag.

Top overlapping blockers after the audit:

| Blocker | Count |
| --- | ---: |
| Weak or unconfirmed source provenance | 5,964 |
| Lifecycle unknown | 5,907 |
| Eligibility not reviewed | 5,847 |
| Insufficient structured metadata/confidence | 5,847 |
| Missing critical eligibility evidence | 4,478 |
| Unknown citizenship semantics | 56 |
| Non-actionable current lifecycle | 13 |
| Unknown geographic/external-student restriction | 10 |
| Duplicate uncertainty | 9 |
| Closed or archived | 3 |

Lifecycle states: 5,907 unknown, 76 open, 2 rolling, 4 upcoming, 6 temporarily closed, and 3 archived.

## Work Performed

### Evidence semantics

Eligibility fields can now retain one of four states:

- `verified_restriction`
- `verified_open`
- `reviewed_no_restriction`
- `unreviewed`

Each stored field fact carries an HTTPS source, authority class, verification date, optional cycle, and concise note. Silence is never converted into unrestricted eligibility.

### Priority and coverage

The review queue deterministically considers opportunity value, source readiness, review effort, breadth, lifecycle, and blocker count. It does not auto-verify facts. The admin Opportunity Intelligence page now exposes the queue, exact blockers, and missing evidence dimensions.

### Evidence-backed upgrade

DOE Science Undergraduate Laboratory Internships (SULI) was upgraded from a verified-but-blocked record using current official DOE pages. Stored facts include:

- Spring 2027 applications open
- September 30, 2026 deadline
- completed matriculated semester
- 3.0 cumulative GPA
- age 18 by internship start
- U.S. citizen or lawful permanent resident
- current undergraduate or qualifying recent-graduate enrollment

First-year profiles remain conservatively excluded because UnlockED cannot prove that an arbitrary first-year profile has completed the required semester. International profiles remain excluded unless represented as lawful permanent residents.

Official sources: [program](https://science.osti.gov/wdts/suli), [eligibility](https://science.osti.gov/wdts/suli/Eligibility), and [key dates](https://science.osti.gov/wdts/suli/Key-Dates).

## Safe Coverage

By opportunity class:

| Type | Safe records |
| --- | ---: |
| Benefit | 35 |
| AI | 23 |
| Research | 5 |
| Career | 4 |
| Scholarship | 1 |

By class year (records can support multiple years):

| Year | Safe records |
| --- | ---: |
| Any Year | 58 |
| First year | 7 |
| Second year | 10 |
| Third year | 9 |
| Fourth year | 8 |

The catalog remains too resource-heavy. Research improved from 4 to 5 safe records, but scholarships, internships, fellowships, competitions, humanities, social science, and international eligibility remain material deserts. The system deliberately does not compensate by promoting more tools or benefits.

## Golden Profiles

The 249 undergraduate profiles in the 250-profile suite produced:

- 1,236 approved recommendations
- 4.96 average
- minimum 3
- p10 3
- p25 3
- median 5
- p75 6
- p90 6
- 64 profiles at or below 3
- 128 profiles at or below 5
- average category diversity 4.24
- average organization diversity 4.96
- 865 excellent recommendations and 371 controlled-exploration recommendations
- zero empty undergraduate profiles

The aggregate recommendation count did not increase because the newly safe SULI record serves a constrained subset and portfolio selection was already saturated for the repeated golden fixtures. This is a truthful result: safe inventory improved, but the three-recommendation tail is not solved.

Representative results:

| Persona | Recommendations | Categories | Organizations | Excellent |
| --- | ---: | ---: | ---: | ---: |
| First-year math/CS/quant | 5 | 5 | 5 | 3 |
| First-year pre-med | 5 | 5 | 5 | 3 |
| Sophomore engineering | 6 | 5 | 6 | 3 |
| Community-college transfer | 3 | 3 | 3 | 3 |
| International CS undergraduate | 3 | 3 | 3 | 2 |
| Junior economics/banking | 3 | 3 | 3 | 2 |
| Humanities/publishing | 4 | 4 | 4 | 2 |
| Undecided | 3 | 3 | 3 | 2 |

## Quality Audits

- False-positive review: the newly safe SULI record preserves GPA, age, citizenship, completed-semester, academic-level, and current-cycle restrictions. It is not exposed to first-year or unsupported international profiles.
- False-negative review: SULI was the only open, high-value verified record blocked solely by structured eligibility. The other currently open false negatives are convenience tools/benefits and were not promoted.
- Upcoming records such as Gilman, Goldwater, CLS, and Boren remain blocked until their exact current application state and all modelable eligibility facts are established.
- No migration events, Changelog events, Radar events, or notifications were generated.
- No IDs, Journey references, or account data changed.

## Remaining Work

The remaining 5,930 unsafe records predominantly require real review:

1. Resolve 5,907 unknown lifecycle states from current official evidence.
2. Replace organization homepages with program-level official sources where possible.
3. Review the 4,478 records with critical variable eligibility language.
4. Establish citizenship semantics for 56 records without treating silence as international eligibility.
5. Prioritize currently opening scholarships, research programs, fellowships, and competitions.
6. Build verified humanities, policy/social-science, transfer, and international inventory.
7. Re-run the 250-profile suite after every evidence-backed batch and optimize for p10, not total count.

The operational stop condition was reached for this pass: further automatic promotion would require factual claims not established by stored or current first-party evidence. Those records remain blocked by design.
