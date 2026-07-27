# Discover Search

Discover is UnlockED's complete, non-personalized opportunity catalog. It answers "What can I find?" For You remains the only surface that ranks opportunities from private profile or activity data.

## Request path

1. `OpportunityFilter` serializes query, filters, sort, and result-window size into the URL.
2. `/api/opportunities?view=discover` validates and bounds every parameter.
3. `buildDiscoverCatalog` filters the canonical public catalog and returns at most 64 records.
4. The browser preserves the previous grid while a replacement request is pending and cancels stale requests.

No external search service, per-card request, Advisor Brain call, or private account input is used for Discover ranking.

## Ranking

The server builds one cached index per catalog snapshot. Search documents contain normalized title, organization, category, type, description, eligibility, location, majors, class years, tags, skills, career paths, work format, compensation, and documented value fields.

Text relevance is deterministic:

- exact title
- exact organization
- title phrase
- organization phrase
- title token
- organization token
- category or type token
- structured subject token
- description or eligibility token
- bounded prefix, synonym, acronym, stem, and typo matches

The default relevance sort combines that score with documented quality signals:

- verified status
- verified eligibility and deadline metadata
- clear eligibility
- complete description
- HTTPS official source
- active deadline
- recent verification
- first-year accessibility
- documented value
- curated featured status

Confirmed closed records receive a large default penalty. Archived and broken-source records never enter the public Discover projection. Canonical duplicate suppression runs before filtering and ranking. Exact title or organization intent remains strong enough to locate a closed historical record when the student deliberately searches for it.

## State and recovery

The URL preserves query, type, category, major, school, value, format, difficulty, freshman-friendly status, deadline, sort, and loaded result count. Session storage is only a fallback when no Discover parameters are present. Browser back restores the URL and saved scroll position.

Zero-result recovery is calculated from the real filtered catalog. The API tests one active structured filter at a time and returns the highest-yield removal. The UI never invents a result count or inserts unrelated records.

## Reporting and analytics

Issue reports require an authenticated same-origin request, a published opportunity ID, a bounded issue type, an idempotency key, and rate-limit approval. Reporter identity is stored only as a keyed pseudonymous hash. Report details are optional and capped at 300 characters.

Discover analytics record bounded event names, opportunity IDs, catalog categories, and action types. Raw opportunity search text and full filter objects are not sent to analytics.

## Quality gates

`npm run check:discover` verifies:

- deterministic ranking fixtures
- exact title and organization intent
- acronyms, synonyms, stemming, and typos
- canonical duplicate suppression
- archived and broken-source suppression
- closed-result demotion
- verification quality
- conflicting-filter recovery
- report security and idempotency
- average, p95, and maximum full-catalog search latency

The strict result window remains 16 initially and 64 maximum.
