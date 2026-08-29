# For You Quality

## Product role

For You answers one question: which currently safe opportunities are most worth this student reviewing? Discover remains the catalog, Opportunity Detail owns complete program context, Strategy explains the student's overall pursuit mix, Journey owns active pursuit state, and Build owns application preparation.

The page is intentionally a bounded briefing rather than a feed. Empty space is preferable to an unsafe or weak recommendation.

## Ranking and presentation boundary

`buildRecommendationService` remains the canonical ranking layer. It owns recommendation-safe eligibility, lifecycle checks, profile and activity signals, controlled exploration, diversity, exposure, feedback, and deterministic ordering. The For You overhaul does not introduce a second score or ranking algorithm.

`buildForYouBriefing` is the presentation projection. It consumes ranked recommendations and direct indexes for Watch, Journey, exposure, Strategy, lifecycle, and verified application facts. It decides what the page shows, not what is eligible to rank.

The projection is failure-isolated: if Strategy context cannot be produced, the ranked recommendations still render without Strategy copy.

## Briefing hierarchy

- **Top Picks:** at most three ranked, non-exploration opportunities. Unseen/current candidates are presented before previously viewed candidates while preserving canonical order within each group.
- **Worth exploring:** at most one recommendation already selected by the canonical controlled-exploration system. It receives no safety exemption.
- **Also selected:** at most four remaining matches.
- **Watching and updates:** secondary disclosures, not competing recommendation panels.
- **Sparse pools:** no section is padded. The page reports the number of current matches it can actually show.

The default briefing is sufficient. The former Curated, Deadline, and Application effort modes are no longer top-level controls. Verified deadlines and known requirements remain available as projection facts and comparison differences.

## Explanation precedence

Each recommendation receives one or two deterministic lines:

1. The best exact personal reason: verified eligibility, then recorded goal/interest/major, then recorded behavior.
2. The best conditional context: a neutral Strategy contribution or an adjacent exploration reason.

Fallback copy uses an existing canonical recommendation reason. A verified deadline or opening date appears separately as a meaningful date instead of repeating the explanation. The projection does not generate prose, expose a score, or append generic signals merely because they exist.

Strategy language stays factual: for example, "First competition among your current opportunities" or "Similar to 3 opportunities already in Journey." It never judges a pursuit mix as good, bad, balanced, or redundant.

## Freshness and exposure

- **New for you:** a prior authoritative snapshot exists and the opportunity was absent from it.
- **New to UnlockED:** the catalog record is recently added.
- **Previously seen:** the student's activity or exposure history records a prior view/recommendation.
- **Watching / In Journey:** authoritative user state overrides freshness language.

The page does not claim an item is new when prior exposure state is unavailable. Daily rotation remains deterministic; there is no random refresh or manual reshuffle control.

## Watch, Journey, and outcomes

Watch remains an authoritative Pro state and updates immediately. Watched opportunities move to a quieter disclosure and do not continue to occupy primary briefing sections. Add to Journey uses the shared mutation and confirmation system. Current Journey records are excluded from new briefing sections, while the current client session can safely retain its confirmed state until the next canonical snapshot.

Completed opportunity cycles remain excluded by the existing recommendation service. A rejection excludes that exact pursued record from active Journey context but does not suppress the student's broader field interest.

## Comparison

Comparison begins only after the student selects **Compare shortlist**. It supports two to four opportunities and shows at most four facts that actually differ: type, verified deadline, location, compensation/value, known requirements, or current-pursuit context. Unknown stays unknown. The UI presents differences and never declares a winner.

## Free and Pro

Free receives one genuine recommendation from the same safe ranked result, followed by a calm explanation of the full briefing. Pro receives the bounded briefing, Watch, comparison, Strategy contribution, and additional current matches. Watch and Journey records remain user-owned across entitlement changes.

## Privacy and security

For You stays authenticated and server-first. The API preserves rate limiting, bounded session/data-store operations, response-shape-only logging, same-origin mutations, billing checks, account isolation, and opaque analytics identifiers. Profile contents, Strategy details, material names, and recommendation prose are not analytics payloads or public-route data.

## Performance

Briefing decoration uses direct candidate and current-state indexes. Strategy receives only the ranked candidates plus IDs already present in Watch/Journey; it does not iterate the 6,035-record catalog. The regression suite uses a map whose `values()` method throws to prove that projection remains scan-free.

On the 2026-08-29 fixture, briefing projection measured approximately 0.17 ms average and 0.20 ms p95. The broader seven-persona recommendation suite measured approximately 15 ms average and 29 ms p95 on the local development host. These are test-host measurements, not production latency claims.

## Safe-pool coverage

The 2026-08-29 recommendation-safe catalog audit reported 50 actionable records out of 6,035 total records. The gap is caused primarily by unknown lifecycle state, weak source evidence, and unreviewed eligibility, not by the presentation layer.

Current safe records by type:

| Type | Safe records |
| --- | ---: |
| Career | 30 |
| Research | 12 |
| Scholarship | 8 |

Current safe records by academic year (records may support multiple years):

| Year | Safe records |
| --- | ---: |
| First year | 33 |
| Second year | 40 |
| Third year | 43 |
| Fourth year | 46 |
| Graduate student | 11 |

Broad-area unique coverage is strongest in Other (23), Computer Science/Data (22), Engineering/STEM (20), and Humanities (20). It is thinnest in Arts/Design (8). There are 16 international-safe records and only 2 transfer-safe records, including 1 transfer-specific record.

Current Path coverage (records may map to multiple Paths): Quantitative Finance & Data 19, Software Engineering & Cybersecurity 18, Finance & Business 17, Public Policy & Service 17, Research & Graduate Study 17, and Journalism & Public Humanities 11.

The largest coverage deserts are scholarships across most fields, humanities and social-science research, and transfer-specific opportunities. These limitations should be addressed through catalog verification and acquisition. Eligibility and lifecycle gates must not be lowered to fill the page.

## Known limitations

- Followed Path context appears only when canonical recommendation/Strategy evidence supports a concise line; For You does not build a separate Path feed.
- Upcoming opportunities remain governed by the current actionable lifecycle gate. The presentation can display a verified opening date, but it does not override ranking safety.
- Material readiness and resume details remain on Opportunity Detail and Build to keep selection focused.
- Catalog coverage still constrains humanities research, scholarships, transfer eligibility, and some international personas.
- Returning-user summaries are limited to authoritative snapshot and changelog evidence; there is no invented last-visit model.
