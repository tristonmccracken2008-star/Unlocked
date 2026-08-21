# For You decision intelligence

For You Pro uses the existing eligibility and recommendation engine as its only source of ranking truth. The decision layer does not rescore opportunities. It projects the approved shortlist into a compact set of factual signals that help a student compare timing, application workload, documented value, and contribution to their current Journey.

## Data flow

1. The professional recommendation pipeline proves eligibility and ranks candidates.
2. `lib/for-you-snapshot.ts` selects the bounded Pro shortlist and loads the account's Watch records.
3. `lib/for-you-decision-intelligence.ts` derives `for-you-decision-v1` projections once on the server.
4. `lib/for-you-briefing.ts` assigns each opportunity one primary section, adds meaningful Radar events, and creates factual priority orders.
5. `components/advisor-page.tsx` renders the projection. It does not calculate fit, urgency, effort, or Journey contribution.

## Signal rules

- **Best fit** is the first result from the existing recommendation order. No second score is created.
- **Deadline soon** requires an exact future deadline with `deadlineVerified: true`.
- **Application workload** appears only when the application URL and structured requirements are verified. It describes materials, not competitiveness or acceptance odds.
- **Value** uses only structured award, stipend, compensation, or estimated-value fields. Unlike value types are not sorted against each other.
- **Adds something new** compares the opportunity's canonical category with active Journey records. It is not a numerical diversification score.
- Unknown fields are omitted from cards, ordering, and comparison rather than inferred.

## Watch semantics

Watch is Pro-only potential interest. It is persisted as a versioned account record and does not create Journey history, tasks, applications, or milestones. The dedicated same-origin route validates the catalog ID, applies a per-account security lock, is idempotent, and invalidates the account's For You snapshot. Watched records join the existing lifecycle recipient index so only meaningful catalog changes can produce notifications. Removing Watch keeps notification registration when the opportunity remains in Journey.

Watch data is included in account export and remains private to the authenticated account.

## Comparison and priority views

Comparison accepts two to four recommendations and uses only the server projection. Rows with no supported values are omitted. The optional deadline and workload views appear only when at least two opportunities have comparable evidence. Curated order remains the default.

## Analytics and privacy

Analytics record bounded action names and opaque opportunity IDs for priority views, comparison, and Watch changes. They do not record profile fields, comparison contents, eligibility details, or recommendation explanations.
