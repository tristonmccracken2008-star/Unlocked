# Opportunity Explorer

## Responsibility

Explorer answers: **What possibilities have I not considered?** It teaches the shape of the current verified catalog through curated fields and experience types. It is not a recommendation feed, career assessment, search engine, or duplicate Path system.

- **Explorer** broadens awareness.
- **Discover** searches and filters the complete catalog.
- **For You** prioritizes opportunities that positively fit the student.
- **Paths** organizes opportunity types around a goal over time.
- **Watch** monitors a listing; **Journey** records active pursuit.

## Data flow

`data/opportunity-explorer.ts` contains the curated, versioned field taxonomy, short descriptions, adjacency relationships, and deterministic Discover/Path handoffs. It contains no user data and no catalog records.

`lib/opportunity-explorer.ts` builds a server-only projection:

1. Apply the existing recommendation-safe catalog gate.
2. Build and cache field, landscape, and experience-type indexes for the catalog array.
3. Project existing profile, Watch, Journey, and Accomplishment state without mutating it.
4. Apply the existing eligibility evaluator to examples.
5. Require positive eligibility before an opportunity enters the first-year section.
6. Select adjacent exploration deterministically from curated relationships and available safe inventory.

The catalog is never sent to the client. Client components handle only links, analytics, Watch, and Add to Journey actions.

## Launch taxonomy

The launch set is intentionally bounded to areas with at least three recommendation-safe opportunities from at least two organizations:

- Computer Science
- Mathematics & Data
- Engineering
- Research & Science
- Business, Finance & Economics
- Public Policy & Service
- Humanities, Writing & Culture

Experience-first exploration covers Research, Internships, Scholarships, Fellowships, Competitions, Public Service, and Summer & Professional Programs. Definitions are short and avoid claiming that every program within a type has identical terms.

Medicine/clinical healthcare is deferred because current recommendation-safe coverage is too thin. Organization-type browsing is also deferred until organization taxonomy is explicit and reliable.

## Controlled serendipity

Serendipity is deterministic. It prefers a curated adjacent area that:

- is not already an explicit profile match;
- is not already represented in Watch, Journey, or Accomplishments;
- has at least two safe current opportunities;
- has useful organization diversity.

Free users receive a complete general Explorer and one deterministic different area. Pro may use account history and show a concise adjacency reason. Explorer never ranks the catalog as For You.

## State and privacy

Opening an area is not treated as a permanent preference. Explorer creates no account store and no export field. Existing explicit profile interests, followed Paths, Watch records, Journey records, and Accomplishments remain authoritative.

Analytics contain bounded area/type identifiers, opaque opportunity IDs, and handoff actions. They do not include school, major, career goals, profile answers, query text, or private history.

## Failure behavior

If personalized composition fails, the route presents a safe handoff to Discover. Path links are optional. Counts are derived from current safe inventory; unsupported areas are omitted rather than shown with fake zeroes.

## Validation

- `npm run check:opportunity-explorer`
- `npm run test:opportunity-explorer-browser`

The deterministic check covers taxonomy, safety, first-year eligibility, undecided and humanities personas, duplicate state, Discover/Path handoffs, privacy, and cached projection performance. Browser coverage includes Chromium, WebKit, desktop widths, mobile, dark mode, reduced motion, signed-out protection, reflow, and Journey persistence.
