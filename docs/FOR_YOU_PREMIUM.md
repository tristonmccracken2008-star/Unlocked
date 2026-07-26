# For You Premium Portfolio

## Product Contract

For You is a server-authoritative Pro discovery surface. It does not coach, plan, apply, or duplicate Journey. The page answers three questions for each selected opportunity: what it is, why it fits, and what factual timing or value makes it worth reviewing.

The browser renders a persisted snapshot. It does not receive the catalog, rebuild rankings, or infer explanations.

## Data Flow

`Account profile + bounded activity + effective feedback + verified catalog`

`-> Advisor Profile`

`-> positive-proof eligibility and professional quality gates`

`-> deterministic ranking`

`-> category, organization, and semantic portfolio balancing`

`-> portfolio-role assignment`

`-> explanations, timing, trust, and related-path projection for selected results only`

`-> account-scoped For You snapshot`

Saved and active Journey opportunities, completed records, explicit dismissals, confirmed ineligibility, malformed records, expired records, and records below the professional confidence floor are excluded before the premium portfolio is returned.

## Portfolio Roles

Roles are bounded labels derived from structured opportunity data:

- `Best Overall Match`: the highest-ranked approved result.
- `Deadline Approaching`: a selected result with a verified near-term deadline.
- `Newly Available`: a selected result recently added to the catalog.
- `High-Impact Opportunity`: a selected result above the structured impact threshold.
- `Worth Exploring`: the bounded exploration slot.
- `Reach Opportunity`: a selected result documented as highly competitive.
- `Strong Alternative`: an approved result that adds useful depth without unsupported urgency.

Roles add only a small portfolio-balancing preference. They cannot bypass eligibility, confidence, verification, or quality floors.

## Match Language

The internal Opportunity Score remains available to ranking, diagnostics, and regression tests. Students see qualitative labels instead of precise numbers:

- `Exceptional Match`: score 94 or higher.
- `Excellent Fit`: score 90–93.
- `Strong Match`: score 84–89.
- `Worth Exploring`: score below 84 after all mandatory recommendation gates pass.

These are deterministic product labels, not probabilities.

## Timing And Trust

“Why now” is omitted when no supported timing or documented-value signal exists. It may appear only for verified deadlines, recent catalog additions, rolling application metadata, confirmed published deadlines, or documented values of at least $5,000.

Trust labels come from canonical verification fields. The UI never upgrades a partially verified record into a verified claim.

## Behavioral Learning

Explicit saves may influence related-category ranking immediately. Passive views are bounded to the latest 50 opportunity IDs and require at least two observations in the same category or organization before they affect ranking. Category-level negative preference requires at least two explicit `Show fewer like this` or `Not for me` records. A single action still removes the selected opportunity.

Feedback is append-only and account scoped. Each browser mutation carries an opaque request ID. The route validates opportunity/recommendation identity and performs replay detection, undo validation, and persistence under the existing account security lock. Undo retracts the latest effective preference without deleting history.

## Stability And Freshness

The strongest positions receive continuity from the previous snapshot. Lower positions use deterministic daily rotation, bounded repeat-exposure penalties, and newly verified catalog changes. Identical profile, activity, feedback, catalog, and daily rotation inputs produce the same feed.

## Free And Pro Isolation

Free users receive an honest explanation of the eligibility, ranking, and evidence standards. Full recommendation records and deeper explanations are not returned in the free response, client HTML, analytics, or accessibility labels. Discover and Journey remain available on the Free plan.

## Validation

`npm run check:for-you` includes:

- UI and client/server contract checks;
- score-label and factual-explanation checks;
- seven representative student personas;
- final eligibility and professional audits;
- diversity and duplicate checks;
- saved/active suppression;
- dismissal, replay, and undo behavior;
- deterministic daily feed stability;
- malformed and sparse inventory behavior;
- representative average, p95, and worst-case timing.

The broader professional recommendation, security, entitlement, analytics, accessibility, browser, and production-build suites remain mandatory.
