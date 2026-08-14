# High-Quality Opportunity Expansion Report

Audit date: 2026-08-14  
Batch: `high-quality-expansion-2026-08-wave-1`

## Executive Result

UnlockED researched 21 current or near-current high-value programs using official sources. Eight passed the unchanged production recommendation gate, thirteen were rejected or deferred with explicit reasons, six new canonical records were added, and two existing canonical records were enriched in place.

The aspirational first-batch target of 40–60 additions was not met. That is a quality outcome, not hidden underperformance: the remaining researched candidates lacked a currently open cycle, had conflicting official sources, depended on position-specific eligibility, required unsupported school/team facts, or duplicated an existing record.

| Measure | Before | After | Change |
| --- | ---: | ---: | ---: |
| Total records | 5,998 | 6,004 | +6 |
| Canonical public records | 5,987 | 5,993 | +6 |
| Verified records | 205 | 211 | +6 |
| Recommendation-safe | 68 | 76 | +8 |
| High-value recommendation-safe | 10 | 18 | +8 |
| Safe organizations | 63 | 70 | +7 |
| Safe categories | 21 | 23 | +2 |
| International-safe | 0 | 5 | +5 |
| Transfer-safe | 0 | 0 | 0 |

## Accepted Records

| Opportunity | Change | Current state | Primary audience |
| --- | --- | --- | --- |
| Fund for Education Abroad Scholarships | Enriched canonical record | Open, Winter/Spring 2027 | U.S. undergraduates with financial need |
| HACU National Internship Program | Added | Rolling, Spring 2027 | Second-year and later U.S. students |
| ISTA Year-Round Scientific Internships | Added | Rolling | International STEM students/recent graduates |
| OIST Research Internship | Added | Open, Spring 2027 | Advanced undergraduate and graduate STEM students |
| KAUST Visiting Student Research Program | Added | Rolling | Advanced undergraduate and master's STEM students |
| Knight-Hennessy Scholars | Added | Open, 2027 cohort | Graduating seniors and graduate applicants worldwide |
| Rhodes Scholarship for the United States | Added | Open, 2027 entry | Eligible U.S. graduating seniors/recent graduates |
| NASA International Space Apps Challenge | Enriched canonical record | Open, 2026 challenge | Students worldwide across majors and years |

All eight records include official sources, current lifecycle evidence, field-level eligibility provenance, deadline semantics, value or `Unknown`, tags, verification metadata, acquisition batch metadata, and a next review date.

## Coverage Change

### Opportunity type

| Type | Before | After |
| --- | ---: | ---: |
| Benefit | 35 | 35 |
| AI | 23 | 23 |
| Research | 5 | 8 |
| Career | 4 | 6 |
| Scholarship | 1 | 4 |

The new records specifically changed safe categories from: Internships 1→5, Fellowships 0→2, Study Abroad 0→1, and Competitions 1→2.

### Class year

| Year | Before | After |
| --- | ---: | ---: |
| First year | 7 | 10 |
| Second year | 10 | 14 |
| Third year | 9 | 15 |
| Fourth year | 8 | 16 |
| Graduate student | 2 | 8 |
| Any Year | 58 | 58 |

### Academic area

Counts below use one count per safe opportunity per broad academic area, not one count per major alias.

| Broad area | Before | After |
| --- | ---: | ---: |
| Broad / undecided | 61 | 66 |
| Computer science / data | 7 | 10 |
| Engineering / STEM | 7 | 10 |
| Mathematics | 7 | 10 |
| Pre-med / health | 7 | 10 |
| Other sciences | 5 | 8 |
| Arts / design | 3 | 3 |
| Economics / finance / business | 1 | 1 |
| Humanities | 1 | 1 |
| Social sciences / policy | 1 | 1 |

Knight-Hennessy and Rhodes are any-major opportunities and therefore improve practical eligibility for humanities, business, arts, and social-science students even though the conservative area report classifies `Any Major` as broad rather than multiplying one record across every discipline.

## Recommendation Impact

The 249 undergraduate profiles in the golden suite now produce:

- 1,421 approved recommendations, up from 1,236;
- 5.71 average recommendations, up from 4.96;
- p10 4, up from 3;
- p25 4, up from 3;
- median 6, up from 5;
- 3 profiles at or below 3, down from 64;
- 65 profiles at or below 5, down from 128;
- average category diversity 4.74, up from 4.24;
- average organization diversity 5.71, up from 4.96;
- zero empty undergraduate profiles.

Representative outputs remain precise rather than padded: community-college transfer 3, first-year four-year student 4, international CS 6, junior economics/banking 3, humanities/publishing 4, and research-focused student 6.

## Rejected and Deferred Candidates

Thirteen candidates remain outside recommendations:

- Current cycle unavailable: Library of Congress Junior Fellows, Putnam, Phi Kappa Phi Study Abroad, D-Prize, PPIA JSI, Rangel, and Outreachy.
- Variable or unresolved eligibility: Fulbright awards, The Washington Center, OECD internships, and VentureWell E-Team.
- Conflicting official sources: Wege Prize.
- Duplicate: Cooke Undergraduate Transfer Scholarship; the existing canonical record is retained for its announced opening review.

Every rejected candidate has a disposition, reason, official source, and source-watch date. None enters public recommendations.

## Quality Audit

### False positives

All eight accepted records were manually sampled against their official pages and pass the unchanged production validator. The importer detected the two existing identities and updated them rather than creating duplicates. Current-cycle, citizenship, GPA, year, academic-stage, institution, financial-need, and external-student restrictions remain explicit. The 13 uncertain candidates were blocked.

### False negatives

Conservative exclusions remain intentional:

- FEA's DACA route is not ranked because the profile model has no DACA status.
- HACU is limited to U.S. citizens even though some placements accept other work-authorized students.
- Rhodes uses its standard age route and does not broaden to exceptions the profile cannot prove.
- KAUST graduate matching excludes doctoral students because the current class-year field cannot distinguish master's from PhD enrollment.
- Fulbright, OECD, and other variable programs remain blocked until individual award or role eligibility is modeled.

### Import safety

The importer is dry-run by default, performs canonical duplicate checks, and upserts deterministically. After the write, a second dry run reported 0 additions, 0 updates, and 8 unchanged accepted records.

## Performance and Product Impact

- The full golden-profile coverage run completed in 544 ms locally.
- Acquisition and provenance data stay server-side; no new public interaction or recommendation path was added.
- Existing Discover, For You, Journey, notification, auth, billing, and account behavior remain unchanged.
- The admin acquisition queue reuses the existing protected Opportunity Intelligence page.

## Remaining Work

The primary launch-quality gaps are still inventory gaps:

1. Transfer-safe inventory remains zero. Review the existing Cooke record when its announced cycle opens.
2. Economics/finance, humanities, and social-science specific inventory remains thin.
3. First-year safe inventory improved to 10 but still relies heavily on broad resources.
4. Fifteen prior `needs_review` records and the 13 new source-watch candidates require manual cycle review over time.
5. International-safe inventory improved to five, but nationality-specific and visa-sensitive programs should remain position-specific.

The next batch should prioritize current transfer scholarships, humanities/public-service internships, economics insight programs, and first-year scholarships only when official current-cycle eligibility can be proven.
