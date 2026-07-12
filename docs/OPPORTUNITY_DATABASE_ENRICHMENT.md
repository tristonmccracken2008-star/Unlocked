# Opportunity Database Enrichment 1.0

UnlockED now derives a canonical opportunity model from the existing `data/db/opportunities.json` catalog. The JSON source remains backward compatible, while `data/opportunity-enrichment.ts` produces structured metadata for search, recommendations, validation, and future imports.

## Canonical Model

Every opportunity can be normalized into:

- title
- organization
- organizationDomain
- normalizedOrganization
- logo
- canonical category
- subcategory
- opportunity type
- description
- deadline and rolling deadline state
- verified state
- location
- remote / paid / compensation / currency
- application URL and official website
- structured eligibility
- career fields
- rich tags
- difficulty
- estimated time commitment
- verification source and state
- link status
- data quality score
- duplicate key
- search text

Unknown values stay `null` or explicit unknown states. The enrichment layer does not fabricate unavailable facts.

## Migration Strategy

The migration is additive:

1. Keep existing opportunity JSON unchanged.
2. Attach `canonical` enrichment data when opportunities load in `data/opportunities.ts`.
3. Use `canonical.searchText` for Discover search.
4. Use canonical tags, career fields, eligibility, and data quality in Recommendation Engine 1.0.
5. Add validation through `npm run check:data-enrichment`.

Future imports can write the canonical fields directly or continue using the existing fields and rely on the enrichment layer.

## Organization Normalization

Organizations resolve through the centralized registry in `data/organization-logos.ts`.

The enrichment layer stores:

- display name
- normalized name
- domain
- logo reference
- alias-backed identity when available

Unregistered organizations still receive normalized names and domain-derived logo fallbacks.

## Duplicate Detection

Duplicate keys compare:

- title
- organization
- official source URL
- deadline or deadline type

`detectDuplicateOpportunities()` returns grouped IDs so duplicates can be reviewed before appearing as repeated recommendations.

## Eligibility Structure

Eligibility is derived into:

- freshman eligible
- sophomore eligible
- junior eligible
- senior eligible
- graduate eligible
- international eligible
- transfer eligible
- minimum GPA
- preferred majors
- required majors
- school restrictions

Unknown international or transfer eligibility remains `null`.

## Data Quality Score

The internal score rewards:

- verified opportunity status
- HTTPS official source
- parseable official domain
- known organization
- normalized organization domain
- logo availability
- strong description
- clear eligibility
- deadline or explicit rolling/varies/not-announced state
- rich tags
- major coverage
- academic year coverage
- documented or explicitly unknown value

Expired opportunities and invalid links cap the score.

## Search Improvements

Discover search now includes:

- canonical category
- subcategory
- normalized organization
- rich tags
- majors
- career fields
- eligibility
- descriptions

This helps searches like `quant`, `machine learning`, `remote`, or `paid` find relevant opportunities even when the title is not an exact match.

## Recommendation Integration

Recommendation Engine 1.0 now consumes:

- canonical category
- enriched tags
- career fields
- structured eligibility
- minimum GPA
- data quality score

The engine still respects hard eligibility and quality gates before recommending anything.

## Link Validation

This sprint adds non-network link status validation:

- `valid_format`
- `missing`
- `non_https`
- `invalid_url`

Live broken-link checking is intentionally not part of recommendation generation. It can be added as a scheduled admin audit later.

## Validation

Run:

```bash
npm run check:data-enrichment
```

This checks canonical schema support, enriched search integration, recommendation integration, duplicate keys, HTTPS official URLs, tag coverage, organization presence, eligibility presence, and description quality.
