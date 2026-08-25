# Opportunity Collections

Collections answer one product question: **where should a student in a known situation start?** They do not replace Discover, For You, Explore, Paths, Watch, or Journey.

## Architecture

- `data/opportunity-collections.ts` is the versioned registry of candidate collections and quality thresholds.
- `lib/opportunity-collections.ts` builds a date-bounded, cached projection from the published catalog.
- Every member must pass the existing recommendation-safety audit before it can appear.
- Collection-specific selectors require structured evidence. International and transfer collections never infer eligibility from missing data; deadline collections require a verified deadline.
- Coverage gates determine whether a candidate launches or remains deferred. Deferred candidates have no public detail page and do not appear in navigation or search.
- Start Here uses deterministic quality, lifecycle, deadline, organization-diversity, and light profile ordering. It is bounded to four examples for Free and five for Pro.
- Explanations are factual labels from the registry. No generated recommendation copy is used.

## State ownership

Collections create no new student state. Add to Journey uses the existing idempotent Journey endpoint. Pro Watch uses the existing Watch endpoint. Completed, watched, and active records are projected from the account and cannot be duplicated by Collections.

## Maintenance

Run `npm run check:opportunity-collections` whenever the catalog or collection registry changes. The coverage report records launched and deferred candidates with their blockers. Weak collections should remain deferred until the underlying verified inventory improves.
