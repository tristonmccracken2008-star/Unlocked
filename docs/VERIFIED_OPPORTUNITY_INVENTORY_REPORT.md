# Verified Opportunity Inventory Report

Audit date: 2026-08-08

## Outcome

UnlockED now contains 5,998 opportunity records, including 5,987 public canonical records after archived and secondary duplicate records are excluded, and 205 records verified against official sources. The current recommendation pipeline admits 67 records after lifecycle, verification, and structured-eligibility checks. Nine of those are internships, research programs, scholarships, competitions, or career-development programs rather than software and student-benefit resources.

The expansion preserved the fail-closed recommendation policy. Four fully verified programs are marked `upcoming` and remain excluded until their published application windows open. Requirements involving age, GPA, citizenship, work authorization, Pell status, financial need, transfer status, institution type, or class year must be positively satisfied by the profile before ranking.

## Inventory Change

| Measure | Before | After |
| --- | ---: | ---: |
| Total catalog records | 5,991 | 5,998 |
| Public canonical records | Not previously reported | 5,987 |
| Verified records | 197 | 205 |
| Explicit structured-eligibility candidates | 1 | 13 |
| Currently actionable non-resource candidates | 1 | 9 |
| Archived known duplicates | 1 | 3 |

Seven records were added and five existing records were materially enriched. Eight records became newly verified: the seven additions plus the previously `needs_review` Cooke transfer record.

## Added Programs

- SEO Career
- Naval Research Enterprise Internship Program
- COMAP Mathematical Contest in Modeling
- Forté Career Ready Certificate
- JPL Year-Round Internship Program
- DAAD RISE Germany 2027
- Girls Who Invest Scholars Program 2027

## Enriched Programs

- NASA OSTEM Internships
- DOE Science Undergraduate Laboratory Internships
- SMART Scholarship-for-Service
- Benjamin A. Gilman International Scholarship
- Jack Kent Cooke Undergraduate Transfer Scholarship

## Verified Category Balance

| Recommendation class | Verified records |
| --- | ---: |
| Career | 76 |
| Funding | 34 |
| Research | 27 |
| Student resources | 68 |

The newly actionable non-resource pool contains three career/program records, four research records, and one scholarship in addition to the pre-existing DOE CCI research program. One additional career/program record, one research record, and two scholarships are fully structured but lifecycle-suppressed until their opening dates.

## Representative Coverage

The deterministic inventory regression uses complete profiles so every eligibility claim can be proven. Current result counts are:

| Profile | Before | After |
| --- | ---: | ---: |
| First-year Computer Science | 1 | 6 |
| Economics / Finance | 1 | 4 |
| Pre-med | 1 | 7 |
| Engineering | 1 | 7 |
| Humanities | 1 | 4 |
| Scholarship seeker | 1 | 7 |
| Research seeker | 1 | 7 |
| Undecided | 1 | 4 |

These counts are precision-oriented. Profiles missing a required age, GPA, citizenship, work-authorization, need, Pell, transfer, or institution fact may correctly receive fewer results.

## Duplicate And Rejection Decisions

Two near-duplicate national records were archived and linked to their canonical IDs:

- Gilman International Scholarship → `scholarship--gilman-scholarship`
- SMART Scholarship-for-Service Program → `scholarship--dod-smart-scholarship`

No stale, unofficial, ambiguous, or already-closed candidate was promoted during this pass. Candidates with conflicting deadlines or unsupported institution restrictions were omitted rather than imported speculatively.

## Remaining Work

- 5,784 records remain `needs_review`; most are broad catalog records retained for Discover and are not eligible for Pro ranking.
- Six records remain `temporarily_closed` and require cycle-specific review before reopening.
- The four newly modeled upcoming programs should be rechecked when their application windows begin.
- Graduate-student, international-student, humanities-specific, and broad scholarship coverage remain thinner than undergraduate STEM coverage.
- Strict source verification should continue in small batches using `npm run check:verified-inventory` as the regression baseline.

## Reproducibility

Run `node scripts/expand-verified-opportunity-inventory.mjs` to reapply the curated changes idempotently. Run `npm run check:verified-inventory` to verify official-source metadata, structured eligibility, lifecycle suppression, duplicate archival, and representative-profile coverage.
