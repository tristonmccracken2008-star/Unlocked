# Verified Opportunity Inventory Report

Audit date: 2026-08-20

## Catalog Breakthrough — August 20, 2026

The sustained acquisition ledger now contains 260 researched candidates across federal agencies, NSF ETAP, national laboratories, scholarships and fellowships, cultural institutions, policy organizations, finance programs, competitions, international programs, transfer programs, and national service. Forty-two candidates have been accepted across all acquisition waves and 218 have an explicit rejection or defer disposition with a scheduled official-source review.

This pass evaluated 108 additional candidates and accepted six current, fully evidenced records:

- ELEAN Nanomanufacturing Traineeship
- NSF Bridge To Cyber Program
- TFAS Spring Washington Fellowship
- TFAS Summer Academic Internship Program
- Fulbright U.S. Student Program
- AmeriCorps FEMA Corps

| Measure | Before breakthrough | After breakthrough |
| --- | ---: | ---: |
| Total catalog | 6,029 | 6,035 |
| Public canonical records | 6,018 | 6,024 |
| Verified records | 236 | 242 |
| Recommendation-safe records | 103 | 109 |
| High-value recommendation-safe records | 45 | 51 |
| Verified career records | 96 | 102 |
| Verified research records | 33 | 33 |
| Verified funding records | 39 | 39 |
| Verified resources | 68 | 68 |

The six records broaden first-year, humanities, policy, public-service, senior, and international coverage. Each one has official field-level evidence, structured eligibility, lifecycle state, current deadline or rolling status, review scheduling, and targeted negative eligibility tests. A provenance defect in the shared acquisition builder was also corrected: lifecycle deadline evidence now receives the record's actual batch verification date rather than the first wave's date.

### Recommendation impact

The 250-profile golden suite remains precision constrained: 1,488 recommendations, 5.98 average, minimum 4, p10 5, p25 5, median 6, p75 6, p90 7, no profiles at or below 3, and 64 profiles at or below 5. Average organization diversity remains 5.98; average category diversity changes from 5.22 to 4.99 as broad high-value programs compete with lower-value category variety. The professional quick matrix remains at 153 recommendations and 4.78 recommendations per profile; two of 32 deliberately difficult profiles remain empty.

The aspirational p10 and median targets were not reached. The recommendation engine was not relaxed and the safe threshold was not manipulated. The accepted records increase the candidate universe but do not displace stronger top-eight matches for most existing golden profiles.

### Rejection and defer findings

The 218 non-accepted candidates break down as follows:

| Reason | Candidates |
| --- | ---: |
| Current cycle unavailable | 98 |
| Graduate or post-baccalaureate only | 39 |
| Eligibility unclear | 23 |
| Institution membership or nomination unproven | 21 |
| Position-specific eligibility | 16 |
| Existing canonical duplicate | 16 |
| Conflicting official sources | 3 |
| Stale | 2 |

The strongest remaining source families are operational follow-ups rather than safe bulk imports: NIH and NIST when 2027 applications open, NOAA Hollings after its next opening, Library of Congress and cultural-institution cycles in the fall, CLS and PPIA when their cycles publish, and institution-nominated scholarships where the product can positively prove nomination. Role-based federal, finance, think-tank, and AmeriCorps listings must continue to be captured as individual vacancies; their umbrella pages cannot support one safe national record.

### Quality and performance

All six accepted records were manually red-teamed for stale cycles, degree level, citizenship, age, class year, major restrictions, external-student access, and duplicate identity. The ETAP importer was corrected to use distinct official opportunity endpoints instead of treating the shared search page as a canonical source. A final replay reports zero additions and zero updates.

Discover remains stable at 6.26 ms trimmed average, 6.40 ms median, 7.27 ms p95, and 7.51 ms maximum over 6,035 records; cold initialization is 519 ms. Recommendation generation remains within its existing gate at 21.92 ms average and 30 ms p95 in the quick professional matrix. No client feature code or client asset was added.

## Outcome

UnlockED now contains 6,035 opportunity records, including 6,024 public canonical records after archived and secondary duplicate records are excluded, and 242 records verified against official sources. The current recommendation pipeline admits 109 records after lifecycle, verification, and structured-eligibility checks. Fifty-one are high-value internships, research programs, scholarships, competitions, fellowships, national-service roles, or career-development programs rather than software and student-benefit resources.

The expansion preserved the fail-closed recommendation policy. Four fully verified programs are marked `upcoming` and remain excluded until their published application windows open. Requirements involving age, GPA, citizenship, work authorization, Pell status, financial need, transfer status, institution type, or class year must be positively satisfied by the profile before ranking.

## Initial August Expansion History

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

- 5,790 records remain unresolved across `needs_review`, `temporarily_closed`, `incomplete`, and `broken_source`; most are broad catalog records retained for Discover and are not eligible for Pro ranking.
- Six records remain `temporarily_closed` and require cycle-specific review before reopening.
- The four newly modeled upcoming programs should be rechecked when their application windows begin.
- International-student, humanities-specific, economics/finance, transfer, and broad scholarship coverage remain thinner than undergraduate STEM coverage.
- Strict source verification should continue through scheduled source-watch operations using `npm run check:verified-inventory` as the regression baseline.

## Reproducibility

Run `npm run audit:opportunity-acquisition` for a dry run and `npm run acquire:opportunities` to reapply accepted batches idempotently. Run `npm run check:verified-inventory` to verify official-source metadata, structured eligibility, lifecycle suppression, duplicate archival, targeted eligibility regressions, and representative-profile coverage.
