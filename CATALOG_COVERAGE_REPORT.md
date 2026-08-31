# Catalog Coverage Report

Audit date: **2026-08-31**

Source of truth: `docs/catalog-health.json`. Counts are measured outcomes, not quotas.

## Verified acquisition result

The acquisition sprint investigated 244 genuinely new candidates across 189 organizations and retained 16 cross-wave matches as explicit duplicates. Five programs passed every official-source, lifecycle, eligibility, provenance, and recommendation-safety gate. No gate or ranking threshold was changed.

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Canonical records | 6,035 | 6,040 | +5 |
| Recommendation-safe | 50 | 55 | +5 |
| High-value safe | 50 | 55 | +5 |
| Career | 30 | 32 | +2 |
| Research | 12 | 13 | +1 |
| Scholarship | 8 | 10 | +2 |
| First year | 33 | 36 | +3 |
| Second year | 40 | 43 | +3 |
| Third year | 43 | 46 | +3 |
| Fourth year | 46 | 51 | +5 |
| International-safe | 16 | 17 | +1 |
| Transfer-safe | 2 | 2 | 0 |
| Humanities | 18 | 19 | +1 |
| Social sciences | 19 | 24 | +5 |
| Arts/design | 13 | 13 | 0 |
| Fellowship signal | 5 | 8 | +3 |
| Competition signal | 4 | 4 | 0 |

## Accepted programs

- Humanities at Hertog Fellowship: international-safe, first-year-accessible humanities fellowship.
- NSF Graduate Research Fellowship Program: senior-level research funding across STEM, psychology, and social science.
- Hertz Fellowship: senior-level doctoral funding in applied science, mathematics, and engineering.
- White House Council of Economic Advisers Internship: undergraduate public-policy and economic-research experience.
- Argonne Undergraduate Seasonal Internship: first-year-accessible national-laboratory research.

All five are new canonical records. No existing record was activated or enriched, and no previously safe record was removed. The already-unsafe NSF Bridge To Cyber record remains suppressed because no current official cycle could be established.

## Current safe coverage

### Paths

| Path | Before | After |
| --- | ---: | ---: |
| Quantitative Finance & Data | 19 | 22 |
| Software Engineering & Cybersecurity | 18 | 21 |
| Research & Graduate Study | 17 | 19 |
| Public Policy & Service | 17 | 18 |
| Finance & Business | 17 | 18 |
| Journalism & Public Humanities | 11 | 11 |

### Health and evidence

| Health state | Records |
| --- | ---: |
| Safe | 55 |
| Near-safe | 2 |
| Needs research | 5,971 |
| Stale | 1 |
| Duplicate candidate | 9 |
| Archive candidate | 2 |

Official-source coverage increased from 91 to 96 records. Explicit eligibility, class-year, and citizenship evidence increased from 42 to 47; deadline evidence increased from 64 to 69; lifecycle evidence increased from 55 to 60.

Girls Who Invest Scholars and DAAD RISE Germany remain near-safe. Their official future cycles are published, but applications are not actionable, so both remain outside For You. NSF Bridge To Cyber remains stale and recommendation-ineligible.

## Acquisition funnel

| Sprint measure | Count |
| --- | ---: |
| New candidates researched | 244 |
| Organizations represented | 189 |
| Accepted | 5 |
| Deferred/rejected new candidates | 239 |
| Cross-wave duplicates | 16 |
| New canonical records | 5 |
| Existing records enriched | 0 |
| Existing records activated | 0 |
| Newly recommendation-safe | 5 |
| Safe records removed | 0 |

The sprint researched 52 scholarship, 25 transfer, 58 humanities, 76 social-science, 45 arts/design, 53 competition, 24 fellowship, 31 first-year, and 43 international gap candidates. Counts overlap because one candidate can address multiple gaps.

Top sprint dispositions were: current cycle unavailable (134), variable position eligibility (55), institution or membership condition unproven (35), low quality or pay-to-enter value (15), accepted (5), plus 16 cross-wave duplicates. Acceptance efficiency was 2.05% of genuinely new research. This low rate is expected under the fail-closed standard and identifies current-cycle evidence, not catalog machinery, as the main bottleneck.

## Representative recommendation coverage

The deterministic named profiles remain stable before and after the five additions: first-year CS 7, economics/finance 5, pre-med 7, engineering 7, humanities 5, scholarship seeker 7, research seeker 7, and undecided 5. The new records expand the safe candidate universe but do not displace stronger top-eight results for these profiles.

Transfer remains the weakest inventory dimension at two explicit safe records. Arts/design and competitions gained no safe records. Humanities improved by one but remains thin, and the journalism/public-humanities Path did not grow. These areas should drive the next source-watch cycle.

## Product implications

- Discover, For You, Opportunity Detail, Paths, and Collections receive five additional safe canonical records without ranking changes.
- Summer, Competitions, Transfer-Friendly, and Next Cycle collections still lack enough incremental safe breadth to justify automatic activation in this sprint.
- Potential consulting, law, medicine, and entrepreneurship Paths remain research opportunities, not supported additions.
- Acquisition replay is idempotent: zero additions, zero updates, and zero duplicate additions.
