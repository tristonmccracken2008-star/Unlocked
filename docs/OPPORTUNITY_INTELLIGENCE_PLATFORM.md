# Opportunity Intelligence Platform

## Purpose

The Opportunity Intelligence Platform turns the static catalog into a deterministic, reviewable knowledge layer for Discover, For You, and internal catalog maintenance. It composes the existing opportunity schema, canonical enrichment, eligibility proof, verification, recommendation gates, and aggregate analytics. It does not use generated facts and does not perform external network requests in a student request path.

## Data flow

1. `data/db/opportunities.json` remains the source catalog and audit history.
2. `canonicalOpportunity()` normalizes organization identity, category, search fields, eligibility summaries, career fields, and factual enrichment already present in the record.
3. `normalizeOpportunityEligibility()` produces one canonical eligibility representation for institution type, enrollment, education level, school, class year, major, GPA, citizenship, residency, age, transfer status, and financial need.
4. `buildOpportunityCatalogIndex()` independently assesses confidence, freshness, duplicate status, quality, and enrichment gaps.
5. `data/db/opportunity-duplicates.json` is a deterministic build artifact. Discover and For You use it to suppress secondary duplicate records without deleting their source provenance.
6. The professional recommendation pipeline continues to apply its positive-proof eligibility gate. Partially verified records remain available for catalog review but cannot enter Pro recommendations.

## Confidence

Raw confidence is internal. The platform stores independent factors for:

- source reliability;
- last verification date;
- deadline confidence;
- eligibility confidence;
- content completeness;
- duplicate confidence;
- metadata quality;
- organization identity.

The internal tiers are `high_confidence`, `partially_verified`, `needs_review`, and `excluded`. Only `high_confidence` records with `eligible_for_ranking` canonical eligibility and no unresolved critical fields can be recommendation eligible. A high overall average never overrides a failed required factor.

## Eligibility policy

Unknown required eligibility remains ineligible for Pro. Normalization can recover facts that are already present in structured metadata or verified source notes; it cannot infer citizenship, school access, enrollment, or other restrictions from silence. Generic school-directory records stay in review until an office-level source verifies the actual program.

## Duplicate handling

Duplicate candidates use normalized organization identity, title-token similarity, program/source identifiers, and compatible deadlines. One canonical record is selected by verification, completeness, source specificity, and recency. Secondary records remain in the database for auditability, while `mergeDuplicateOpportunityMetadata()` preserves majors, years, tags, career paths, skills, and official-source provenance for editorial merging.

Refresh the committed manifest after catalog edits:

```bash
npm run generate:opportunity-duplicates
npm run check:opportunity-intelligence-platform
```

## Quality and feedback

Opportunity quality is separate from student relevance. It uses only documented catalog signals for prestige, career value, salary potential, scholarship value, resume value, networking value, selectivity, and uniqueness. Aggregate recommendation impressions, opens, saves, applications, dismissals, and acceptances provide a popularity factor over time. Individual users, profile answers, and free-form feedback are not stored in this aggregate.

Behavior cannot bypass verification or eligibility. It may change the independent quality assessment only.

## Freshness

The freshness engine identifies current, review-due, stale, expired, temporarily closed, broken-source, and archived records. Passed deadlines and excluded states cannot rank. No request-time link checks occur; source reachability comes from the verification pipeline so recommendation requests remain network-free and bounded.

## Relationships and performance

Opportunity relationships use reusable indexes for organization, category, career path, and skill. The engine no longer scans the full catalog every time one relationship is requested. Canonical enrichment, eligibility, intelligence, validation, and relationship results are memoized for immutable catalog objects.

`refreshOpportunityCatalogProfile()` supports an incremental confidence, freshness, quality, and enrichment refresh after an individual record or behavior aggregate changes. Changes to title, organization, source URL, or program identity must also regenerate the duplicate manifest because those fields can affect more than one record.

Strict recommendation performance checks remain unchanged. The platform check includes a broad full-catalog refresh ceiling and cached relationship lookup gate.

## Internal diagnostics

`/admin/opportunities` is protected by the existing server-side admin allowlist. It shows catalog totals, confidence states, recommendation inventory, duplicates, stale/expired records, missing eligibility, deadlines, logos, category/major/year coverage, and the largest quality gaps. Raw confidence data is never exposed in the student product.

## Current catalog finding

As of this implementation, the catalog contains 5,991 source records, but only 197 are marked verified. The intelligence layer identifies 135 unique records that satisfy the current professional recommendation gate after suppressing rankable duplicates. Most of the remaining records are generated school-directory coverage with broad home-page URLs and variable eligibility. They require manual office-level source verification; algorithms cannot safely promote them.

Organization descriptions are also intentionally left missing unless a factual curated source provides them. The platform reports that gap instead of inventing copy.
