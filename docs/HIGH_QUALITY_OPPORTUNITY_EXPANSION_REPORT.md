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

---

## Batch 2: Remaining Coverage Deserts

Audit date: 2026-08-15
Batch: `coverage-deserts-2026-08-wave-2`

### Executive result

Batch 2 researched 45 official-source candidates. Five passed the unchanged recommendation gate: four new canonical records were added and the existing DOE Community College Internships record was enriched in place. Forty candidates were rejected or deferred. A post-import dry run reports 13 reviewed records unchanged across both batches, with zero additions and zero updates.

The batch improved the most constrained personas without meeting every aspirational inventory target. Recommendation-safe inventory rose by four, high-value safe inventory rose by four, transfer-safe coverage became non-zero, and explicit international-safe inventory rose by two. The 250-profile p10 did not move, while a corrected legacy GPA parser removed false requirements inferred from year numbers and left no undergraduate profile below four recommendations.

| Measure | Before Batch 2 | After Batch 2 | Change |
| --- | ---: | ---: | ---: |
| Total records | 6,004 | 6,008 | +4 |
| Recommendation-safe | 76 | 80 | +4 |
| High-value safe | 18 | 22 | +4 |
| Transfer-safe | 0 | 1 | +1 |
| Explicit international-safe | 5 | 7 | +2 |
| Safe categories | 23 | 27 | +4 |
| First-year safe | 10 | 13 | +3 |
| Scholarship safe | 4 | 5 | +1 |
| Humanities-specific safe | 1 | 4 | +3 |
| Social-science/policy-specific safe | 1 | 3 | +2 |
| Economics/finance/business-specific safe | 1 | 3 | +2 |

High-value safe means recommendation-safe `Career`, `Research`, or `Scholarship` records. Academic-area counts use one count per safe opportunity per broad area, regardless of how many major aliases appear on the record. International-safe requires an explicit `international_allowed` rule; silence and generic work authorization do not count. Transfer-safe requires `transfer_specific` or `explicitly_eligible`; generic undergraduate and community-college access do not count.

### Accepted records

| Opportunity | Change | Coverage value | Current state |
| --- | --- | --- | --- |
| Community College Internships (CCI) | Enriched canonical record | Paid first-year/two-year-college research | Spring 2027 open; September 30 deadline |
| CHCI Congressional Internship Program | Added | Explicit transfer route; public service; any major | Summer 2027 open; December 1 deadline |
| Heritage Young Leaders Program | Added | Social science, economics, policy, paid career experience | Spring 2027 rolling |
| Archives of American Art Internships | Added | Humanities, museums/archives, community-college access, explicit international access | Year-round rolling |
| Schwarzman Scholars | Added | Fully funded global fellowship for graduating seniors across majors | 2027-28 open; September 9 deadline |

CCI is intentionally classified `unknown` for transfer eligibility. Its official source proves community-college access, not transfer intent. CHCI is `explicitly_eligible`, not transfer-only, because the official page specifically permits graduating community-college students who will transfer to a four-year institution.

### Safe coverage after Batch 2

| Type | Count |
| --- | ---: |
| Benefit | 35 |
| AI | 23 |
| Career | 9 |
| Research | 8 |
| Scholarship | 5 |

| Year | Count |
| --- | ---: |
| Any Year | 58 |
| First year | 13 |
| Second year | 17 |
| Third year | 18 |
| Fourth year | 20 |
| Graduate student | 10 |

| Broad academic area | Unique safe opportunities |
| --- | ---: |
| Broad / undecided | 68 |
| Computer science / data | 10 |
| Engineering / STEM | 10 |
| Mathematics | 10 |
| Pre-med / health | 10 |
| Other sciences/fields | 9 |
| Humanities | 4 |
| Arts / design | 3 |
| Economics / finance / business | 3 |
| Social sciences / policy | 3 |

The remaining academic-area weakness is category depth, not complete absence: humanities now has four safe Career records but no field-specific safe Scholarship or Research record; economics and social sciences each have three Career records but no field-specific safe Scholarship or Research record.

### Golden-profile impact

| Metric | Before Batch 2 | After Batch 2 |
| --- | ---: | ---: |
| Total approved recommendations | 1,421 | 1,424 |
| Average | 5.71 | 5.72 |
| Minimum | 3 | 4 |
| p10 | 4 | 4 |
| p25 | 4 | 4 |
| Median | 6 | 6 |
| p75 | 6 | 6 |
| p90 | 7 | 7 |
| Profiles at or below 3 | 3 | 0 |
| Profiles at or below 5 | 65 | 65 |
| Excellent tier | 993 | 998 |
| Strong tier | 0 | 1 |
| Controlled exploration | 428 | 425 |
| Average category diversity | 4.74 | 4.76 |
| Average organization diversity | 5.71 | 5.72 |

The final golden run completed in 641 ms locally. Results can vary in elapsed time, but output counts and ordering remain deterministic.

### Representative personas

| Persona | Recommendations | Top Picks | Categories | Organizations | Remaining gap |
| --- | ---: | ---: | ---: | ---: | --- |
| Community-college transfer | 4 | 3 | 4 | 4 | Only one record is explicitly transfer-safe; most useful options are community-college or broad-undergraduate records. |
| Four-year first-year economics | 4 | 4 | 4 | 4 | No economics-specific scholarship or research record. |
| International CS undergraduate | 6 | 5 | 5 | 6 | Strong count, but international-safe inventory remains concentrated in research and global programs. |
| Economics junior / banking | 4 | 3 | 4 | 4 | Improved from three; finance competition and economics-research depth remain thin. |
| English / publishing | 4 | 2 | 4 | 4 | Smithsonian adds a substantive humanities path; field-specific funding remains scarce. |
| First-year math / quant | 6 | 4 | 6 | 6 | Count is strong; age-dependent records remain correctly blocked when age is unknown. |
| Scholarship-focused / financial need | 4-6 depending on proved need and citizenship | Profile-dependent | Profile-dependent | Profile-dependent | Only five total scholarships pass the gate. Need, GPA, age, and citizenship continue to fail closed. |

### Rejected and deferred research

Forty Batch 2 candidates remain outside recommendations. The most important reasons are:

- **Not yet open:** Gilman, Cooke Transfer, PPIA JSI, Girls Who Invest, Smithsonian APAC, Library of Congress programs, National Gallery, The Met, RTDNA, Yenching, Putnam, D-Prize, Outreachy, NCAS, and several writing/film competitions.
- **Eligibility cannot be proved from the current profile:** MLT Career Prep's inequitable-access criterion, Truman and Marshall institutional nomination, Tau Sigma and PTK membership/nomination, VentureWell institutional membership, and The Washington Center's school-specific rules.
- **Umbrella records would be unsafe:** Fulbright country awards, OECD position/nationality rules, CFA local university teams, and PTK's award-specific requirements.
- **Official sources conflict or lag:** Wege Prize and Cato Spring 2027.
- **Closed/stale:** CME's August challenge and the 2026 Magna Charta essay competition.
- **Current but not safely international:** Humanities at Hertog is open, but its current eligibility page does not explicitly state nationality rules. It was deferred rather than allowing international eligibility by silence.
- **Unavailable indefinitely:** Smithsonian SOAR states that it will not accept interns for the foreseeable future.
- **Duplicate:** SULI and SMART already have safe canonical records; no duplicate was inserted.

Every deferred candidate remains in the source-watch ledger with an official URL, disposition, reason, and review date.

### False-positive audit

All five accepted records were reviewed against their stored official sources and passed the unchanged production validator. Specific checks confirmed:

- CCI remains restricted to community-college/two-year students and does not count as transfer-safe.
- CHCI passes both a qualifying non-transfer undergraduate and a qualifying community-college transfer profile; it is not transfer-exclusive.
- Heritage requires a supported U.S. citizenship, permanent-resident, or work-authorization status.
- Archives of American Art is the only new humanities record marked international-safe, based on the Smithsonian's explicit `No Citizenship Requirement` listing.
- Schwarzman is limited to fourth-year/graduate-stage profiles and requires a known age within 18-28.
- Existing Journey IDs, notification semantics, and changelog history are unchanged; initial ingestion creates no synthetic change event.

### False-negative audit

The strongest excluded records were reviewed again. Hertog, MLT, Truman, Fulbright, OECD, Cooke, Gilman, Cato, and Yenching remain legitimately blocked for nationality ambiguity, unsupported eligibility attributes, nomination, variable award rules, unopened cycles, or conflicting status. No production gate was bypassed to admit them.

### Remaining deserts

1. Transfer-safe inventory is one, not “several.” Cooke opens August 19 and is the highest-priority scheduled review.
2. Explicit international-safe inventory is seven, below the aspirational ten.
3. Scholarships improved to five but remain too sparse for a scholarship-first product experience.
4. Humanities, economics, and social sciences now have substantive Career options but still lack type diversity.
5. No golden undergraduate profile is below four recommendations, but records with real GPA or age requirements still fail closed when those attributes are unknown.

These are operational acquisition gaps, not reasons to weaken the recommendation gate.
