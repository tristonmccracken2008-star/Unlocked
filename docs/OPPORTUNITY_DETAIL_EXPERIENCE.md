# Opportunity Detail Experience

## Audit

The former canonical page was factually strong but assembled decisions inside the route. It combined lifecycle, trust, eligibility, advisor output, application requirements, catalog history, and related opportunities directly in JSX. This made the page difficult to extend safely and left account context fragmented: Journey state was client-derived, application materials and resume readiness were absent, and Path, collection, and For You context were not connected.

The existing systems remain authoritative:

- `data/opportunity-lifecycle.ts` owns current-cycle state.
- `data/opportunity-trust.ts` owns field-level trust.
- `data/opportunity-eligibility.ts` owns strict eligibility proof.
- `lib/application-workspace.ts` and `lib/application-materials.ts` own application readiness.
- `lib/opportunity-paths.ts` and `lib/opportunity-collections.ts` own catalog context.
- `lib/discover-related.ts` owns safe related-opportunity selection.
- Journey, watch, accomplishments, resume, and For You snapshots remain in existing account data.

## Data Flow

`app/opportunities/[id]/page.tsx` loads the authenticated account and managed opportunity together, then loads only the bounded related IDs and existing Advisor explanation needed for that record. The normal request path never reads or scans the full published catalog. It passes those values to `buildOpportunityDetailProjection()`.

`lib/opportunity-detail-projection.ts` is a server-only, read-only composition layer. It returns one typed projection covering:

- concise identity and at-a-glance facts;
- lifecycle and field-level trust;
- strict personal eligibility comparison;
- Journey/watch/application/accomplishment state;
- verified requirements, material readiness, and resume context;
- current For You and Path relationships, plus collection relationships when a caller already has a precomputed catalog context;
- meaningful verified changes and safe related records;
- one state-adaptive primary action.

The projection does not write account data, create an application, regenerate recommendations, or infer eligibility from missing evidence. Unknown critical eligibility remains `cannot_determine` and is never presented as a positive match.

## Presentation

`components/opportunity-detail-experience.tsx` is server rendered. The first viewport answers five questions: what the opportunity is, who provides it, whether the current cycle is actionable, what the most important facts are, and what the student should do next.

The page then reveals eligibility, application preparation, product context, verified changes, related opportunities, and source provenance in decision order. Detailed personal comparisons and Advisor evidence use native progressive disclosure. Sparse records omit unsupported facts instead of rendering empty template rows.

`components/opportunity-decision-actions.tsx` is the narrow client boundary. It reuses the existing idempotent Add to Journey flow and existing Pro watch endpoint. Journey remains progress management; Watch remains change monitoring.

## Security And Privacy

- The route retains completed-onboarding protection.
- No new persistence endpoint was added.
- Same-origin, session, rate-limit, and security-lock behavior remains in the existing Journey and watch APIs.
- Profile eligibility evidence is rendered only to the authenticated owner and never included in metadata or JSON-LD.
- No profile answers, recommendation content, Stripe identifiers, or eligibility evidence are logged.
- Official/provider links keep `target="_blank"` and `rel="noreferrer"`.

## Coverage And Regression Checks

`npm run check:opportunity-detail` now audits every catalog record for a unique canonical ID, valid source URL, bounded summary, non-empty identity, non-duplicated facts, and omission of meaningless unknown values. It also tests sparse and rich records, strict unknown eligibility, available and Applying states, non-mutating material context, and use of canonical trust, Path, collection, and application projections.

The detail route remains dynamic because it includes private account context. The loading boundary continues to use the shared opportunity-detail skeleton. Path membership is resolved against the current record with the canonical stage matcher. Collection membership is accepted only from an already-built catalog context; the production detail route intentionally omits it instead of introducing an all-catalog request scan. Related opportunities remain bounded, structured, and recommendation-safe rather than personalized guesses.

## Intentional Limits

- The page reports the facts available in the catalog; it does not manufacture missing deadlines, value, requirements, or eligibility.
- For You context appears only when the current saved recommendation snapshot contains the opportunity.
- Collection context is omitted on the normal detail request until a precomputed membership lookup is available; it is never derived by scanning the full catalog per request.
- Application workspaces appear only after the opportunity is in Journey.
- Resume context is informational and does not select or mutate a resume.
- Archived historical records may still be opened by direct authenticated URL, but current application actions remain controlled by lifecycle state.
