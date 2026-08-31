# Verified Acquisition Sprint 2026

Verification date: **2026-08-31**

## Objective and method

This sprint used the existing Catalog Reliability & Coverage Engine without changing its architecture or safety rules. Research prioritized scholarships, transfer access, humanities, social sciences, arts/design, competitions, fellowships, first-year access, international access, government, laboratories, museums, libraries, archives, professional societies, foundations, and international institutions.

Discovery could begin from a secondary lead, but acceptance required current first-party program evidence. Every accepted record passed identity, official-source, field-provenance, structured-eligibility, lifecycle, deduplication, and production recommendation gates. Unknown compensation remained unknown; closed or future applications remained suppressed; citizenship, transfer access, deadlines, and recurrence were never inferred.

## Baseline and outcomes

| Measure | Start | Final |
| --- | ---: | ---: |
| Canonical | 6,035 | 6,040 |
| Recommendation-safe | 50 | 55 |
| High-value safe | 50 | 55 |
| Near-safe | 2 | 2 |
| Stale | 1 | 1 |
| International-safe | 16 | 17 |
| Transfer-safe | 2 | 2 |

### Near-safe review

| Record | Blocker | Official source result | Outcome |
| --- | --- | --- | --- |
| Girls Who Invest Scholars 2027 | Application is not actionable | The exact October 15 deadline is published, but the application is not open | Still blocked |
| DAAD RISE Germany 2027 | Application is not actionable | The next application opens October 15 | Still blocked |

### Stale recertification

`career--nsf-bridge-to-cyber-2026` has no official evidence for a current successor cycle. It remains resolvable in the catalog but is not recommendation-eligible. The regression suite now explicitly verifies this suppression rather than assuming every historically accepted acquisition remains actionable forever.

## Candidate funnel

Batch 8 contains 260 entries: 244 genuinely new investigations and 16 explicit cross-wave duplicates. Five new candidates were accepted and 239 were deferred or rejected.

| Gap researched | New candidates |
| --- | ---: |
| Social sciences | 76 |
| Humanities | 58 |
| Competitions | 53 |
| Scholarships | 52 |
| Arts/design | 45 |
| International | 43 |
| Research | 37 |
| Engineering | 31 |
| First year | 31 |
| Writing/journalism | 27 |
| Transfer | 25 |
| Public service | 24 |
| Fellowships | 24 |
| Public policy | 14 |
| Math/data | 14 |

The complete durable ledger now contains 520 entries: 47 accepted, 441 deferred/rejected for substantive reasons, and 32 duplicates. A source-watch date remains on 457 non-duplicate deferred records.

## Accepted records

### Humanities at Hertog Fellowship

Official evidence: `https://hertogfoundation.org/application-2026` and `https://hertogfoundation.org/faqs`.

The Fall 2026 cycle is open through September 8. The official FAQ positively establishes international access. The record is limited to current undergraduates and preserves the published age ceiling, application materials, completion award, and remote format.

### NSF Graduate Research Fellowship Program

Official evidence: `https://www.nsf.gov/funding/opportunities/grfp-nsf-graduate-research-fellowship-program/nsf26-526/solicitation` and `https://www.nsf.gov/funding/initiatives/grfp`.

The FY2027 solicitation positively establishes final-year bachelor eligibility, citizenship, eligible research degrees and fields, field-specific October deadlines, and the stipend and education allowance. The stored date is the earliest applicant deadline so no field receives an incorrectly late deadline.

### Hertz Fellowship

Official evidence: `https://www.hertzfoundation.org/hertz-fellowship/apply/`, `https://www.hertzfoundation.org/hertz-fellowship/application-help/recommenders/`, and `https://www.hertzfoundation.org/hertz-fellowship/who-can-apply/`.

The 2027 application is open. Official pages establish the October 30 deadline, senior status, citizenship or permanent residence, eligible PhD fields, U.S. institution requirement, and funding value.

### White House Council of Economic Advisers Internship

Official evidence: `https://www.whitehouse.gov/cea/information-resources/`.

The Spring 2027 program has a November 15 cutoff and publishes its dates, full-time in-person format, age, citizenship, and current-undergraduate eligibility. Compensation remains unknown because the current source does not publish it.

### Argonne Undergraduate Seasonal Internship

Official evidence: `https://argonne.wd1.myworkdayjobs.com/en-US/EDU_PUB/job/Undergraduate-Seasonal-Intern-General-Application---Spring-2027_421395`.

The live Spring 2027 requisition establishes the October 30 deadline, undergraduate enrollment, age, 3.0 GPA, citizenship or permanent residence, and U.S.-based appointment. Compensation remains unknown.

## Organization mining

The batch represents 189 organizations. Major systematic families included:

- Government and public policy: the White House, economic and regulatory agencies, Congress-facing institutions, and national public-policy organizations.
- National laboratories: Argonne, Fermilab, Los Alamos, Lawrence Livermore, Sandia, Brookhaven, Idaho, PNNL, NREL, Oak Ridge, Savannah River, SLAC, and PPPL.
- Humanities and cultural institutions: Library of Congress, National Archives, Smithsonian units, major museums, research libraries, and historic-preservation organizations.
- Professional societies: engineering, chemistry, physics, geoscience, journalism, statistics, design, and related student-award providers.
- Foundations and fellowships: Hertog, Hertz, public-service fellowships, study-abroad awards, and leadership programs.
- International institutions: OECD, World Bank, IMF, UN agencies, development banks, OAS, and NATO.

Official-domain identity is stored per mixed-family candidate. The batch fails at import time if a mixed organization lacks its own source identity, preventing one provider's URL from being reused as evidence for another.

## Why most candidates were not accepted

| Disposition | Sprint count |
| --- | ---: |
| Current cycle unavailable | 134 |
| Variable position eligibility | 55 |
| Institution/membership condition unproven | 35 |
| Low-quality or pay-to-enter value | 15 |
| Accepted | 5 |
| Cross-wave duplicate | 16 |

Other common practical blockers within those groups were unpublished 2027 dates, role-specific work authorization, host-school restrictions, nomination requirements, graduate-only pathways, and incomplete competition rules. No candidate was promoted from a provider homepage alone.

## Quality, performance, and product impact

The five records improve scholarships, senior research funding, humanities, public policy, national-laboratory research, first-year access, and international access. They do not solve transfer or arts/design coverage. No recommendation ranking logic changed.

The named golden-profile suite remains stable, with five to seven recommendations per profile. This indicates precision was preserved. The catalog reliability pass remains bounded over 6,040 records, and the acquisition replay reports zero additions and zero updates.

Collections for Summer, Competitions, Transfer-Friendly, and Next Cycle should remain deferred. Safe inventory also does not yet justify new consulting, law, medicine, or entrepreneurship Paths.

## Next source targets

The next scheduled research should prioritize official openings rather than another broad framework pass:

1. Girls Who Invest on its application opening.
2. DAAD RISE Germany on October 15.
3. Library of Congress Junior Fellows and Remote Metadata.
4. National Archives internships.
5. MoMA, MFA Boston, Whitney, Guggenheim, Getty, and National Gallery cycles.
6. PPIA Junior Summer Institute.
7. Ritchie-Jennings Memorial Scholarship.
8. RTDNA scholarships.
9. NOAA Hollings and Lapenta programs.
10. NIH and NIST 2027 undergraduate programs.
11. Current transfer-specific foundation awards.
12. Phi Theta Kappa awards where membership can be proven.
13. Current journalism scholarships and competitions.
14. Current no-fee design competitions.
15. Smithsonian unit-specific openings.
16. DOE and laboratory vacancy-specific undergraduate programs.
17. Public-policy roles with one stable vacancy and deadline.
18. International competitions with explicit nationality rules.
19. First-year humanities and archive programs.
20. Transfer-accessible research programs with explicit external eligibility.

## Reproducibility

Run `npm run audit:opportunity-acquisition` before applying a batch, `npm run acquire:opportunities` to apply it, and the dry run again afterward. The final replay for this sprint reports 47 unchanged accepted records, zero additions, zero updates, and zero duplicate additions.
