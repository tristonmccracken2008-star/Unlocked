# Catalog Coverage Report

Audit date: **2026-08-30**

Source of truth: `docs/catalog-health.json`. Counts below are results, not targets.

## Before and after

This sprint prioritized repeatable reliability infrastructure and recertification over raw additions. No candidate whose current official cycle was closed, future, ambiguous, or unsupported was activated.

| Metric | Start | Final | Change |
| --- | ---: | ---: | ---: |
| Canonical records | 6,035 | 6,035 | 0 |
| Recommendation-safe | 50 | 50 | 0 |
| High-value safe | 50 | 50 | 0 |
| International-safe | 16 | 16 | 0 |
| Transfer-safe | 2 | 2 | 0 |

No recommendation-safe record was found stale. One previously maintained but already unsafe record, `career--nsf-bridge-to-cyber-2026`, is overdue and remains outside recommendations.

## Current safe coverage

### Type

| Type | Safe |
| --- | ---: |
| Career | 30 |
| Research | 12 |
| Scholarship | 8 |

Canonical categories account for distinctions not represented as top-level types: 5 fellowship-category records, 4 competition-related records, 2 public-service-category records, and 1 professional/career-resource record are safe.

### Student stage

| Stage | Safe |
| --- | ---: |
| First year | 33 |
| Second year | 40 |
| Third year | 43 |
| Fourth year | 46 |
| Graduate student | 11 |

### Field and gap signals

| Signal | Safe |
| --- | ---: |
| Humanities | 18 |
| Social sciences | 19 |
| Arts/design | 13 |
| Fellowships | 5 |
| Competitions | 4 |
| International explicitly allowed | 16 |
| Transfer explicitly eligible or targeted | 2 |

The field counts are multi-label and must not be summed. Transfer is still severely constrained. Scholarships, competitions, fellowships, and recommendation diversity for writing/journalism also remain thin.

### Paths

| Path | Safe matches |
| --- | ---: |
| Quantitative Finance & Data | 19 |
| Software Engineering & Cybersecurity | 18 |
| Research & Graduate Study | 17 |
| Public Policy & Service | 17 |
| Finance & Business | 17 |
| Journalism & Public Humanities | 11 |

## Health and trust

| Health state | Records |
| --- | ---: |
| Safe | 50 |
| Near-safe | 2 |
| Needs research | 5,971 |
| Stale | 1 |
| Duplicate candidate | 9 |
| Archive candidate | 2 |

The two near-safe records are current official future cycles: Girls Who Invest Scholars Program and DAAD RISE Germany. Their only production blocker is that applications are not actionable yet. They remain outside For You.

| Trust evidence | Records |
| --- | ---: |
| Official source confirmed | 91 |
| Eligibility explicitly verified with references | 42 |
| Class-year evidence | 42 |
| Citizenship evidence | 42 |
| Deadline evidence | 64 |
| Lifecycle evidence/review | 55 |
| Requirements field provenance | 0 |
| Compensation field provenance | 0 |
| Program-date field provenance | 0 |
| Location field provenance | 0 |

The last four fields are newly supported provenance dimensions. Zero means the source references have not yet been assigned those field labels, not that display data is absent. Future review should add labels only when the cited official source actually supports the field.

## Acquisition funnel

The durable ledger now contains seven research waves:

- 260 plausible candidates researched
- 42 accepted into canonical acquisition records
- 218 rejected or deferred with reasons
- 218 retained with source-watch dates
- 0 duplicate additions on the current dry run
- 0 proposed additions or updates on the current dry run

Top disposition reasons:

| Reason | Count |
| --- | ---: |
| Current cycle unavailable | 98 |
| Accepted | 42 |
| Graduate only | 39 |
| Eligibility unclear | 23 |
| Institution/membership condition unproven | 21 |
| Duplicate | 16 |
| Position-specific eligibility varies | 16 |
| Conflicting official sources | 3 |
| Stale | 2 |

Research intentionally covered 62 research, 43 humanities, 41 scholarship, 40 international, 34 social-science, 25 first-year, 24 transfer, 23 competition, and 13 fellowship gap signals. Accepted-source mix includes government (11), nonprofit (8), museum/library (7), university (4), foundation (3), international organization (3), professional society (3), and other official providers (3).

## Current source-watch review

The highest-priority August 30 review produced no safe new addition:

- Gilman is already represented by a current safe canonical record.
- Ritchie-Jennings opens September 1, 2026.
- PPIA JSI opens September 8, 2026, while its official pages still contain mixed opening language.
- RTDNA's next application window opens September 9, 2026.
- D-Prize announces a fall launch without a current application.
- Point Foundation's prior cycle is closed.
- MoMA, National Gallery, Whitney, and Guggenheim pages did not expose a current reusable undergraduate cycle.

These remain deferred. Researching broadly and accepting none is the correct result when current official evidence does not support activation.

## Golden-profile coverage

The existing 250-profile production coverage suite remains green:

- 249 ranked undergraduate profiles
- 4.98 average recommendations
- minimum 3
- p10 4
- p25 4
- median 5
- 0 empty undergraduate feeds
- 4.23 average categories and 4.98 average organizations

Weakest named profiles remain English/publishing and no-GPA at 3 recommendations each. The community-college transfer profile receives 5 recommendations, but only 2 catalog records have explicit transfer-safe semantics; fallback breadth should not be mistaken for strong transfer inventory.

## Operational targets

Targets are planning goals, never safety quotas: 100 recommendation-safe, 15 scholarships, 20 research, 35 career, 40 first-year, 25 international, 10 transfer, 8 fellowships, and 8 competitions. The next acquisition sequence should be:

1. Recheck source-watch items on their exact opening dates.
2. Expand explicitly transfer-safe scholarships and programs.
3. Add current scholarships with complete citizenship, class-year, and lifecycle evidence.
4. Expand writing/journalism, competitions, and undergraduate fellowships.
5. Add field provenance for requirements, compensation, program dates, and location during normal recertification.

## Product implications

- Discover and For You receive no unsafe inventory and no ranking change from this sprint.
- Collections and Paths keep their existing mapping; no collection was padded to create breadth.
- Opportunity Detail can continue showing existing trust metadata. The new reliability states remain internal.
- No client bundle or request path imports acquisition or report generation.
- The current weaknesses are catalog evidence and breadth, not recommendation-gate strictness.
