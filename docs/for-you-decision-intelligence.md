# For You decision intelligence

For You Pro uses the existing eligibility and recommendation engine as its only source of ranking truth. The decision layer does not rescore opportunities. It projects the approved shortlist into a compact set of factual signals that help a student compare timing, application workload, documented value, and contribution to their current Journey.

## Data flow

1. The professional recommendation pipeline proves eligibility and ranks candidates.
2. `lib/for-you-snapshot.ts` selects the bounded Pro shortlist and loads the account's Watch records.
3. `lib/for-you-decision-intelligence.ts` derives `for-you-decision-v2` projections once on the server.
4. `lib/for-you-briefing.ts` assigns each opportunity one bounded presentation role and selects at most two factual explanation lines.
5. `components/advisor-page.tsx` renders the projection. It does not calculate fit, urgency, requirements, or Journey contribution.

## Signal rules

- **Deadline soon** requires an exact future deadline with `deadlineVerified: true`.
- **Known requirements** appear only when the application URL and structured requirements are verified. The count is not presented as total effort.
- **Value** uses only structured award, stipend, compensation, or estimated-value fields. Unlike value types are not sorted against each other.
- **Current-pursuit context** comes from the canonical Strategy projection and remains neutral. It is not a numerical diversification score.
- Unknown fields are omitted from cards, ordering, and comparison rather than inferred.

## Watch semantics

Watch is Pro-only potential interest. It is persisted as a versioned account record and does not create Journey history, tasks, applications, or milestones. The dedicated same-origin route validates the catalog ID, applies a per-account security lock, is idempotent, and invalidates the account's For You snapshot. Watched records join the existing lifecycle recipient index so only meaningful catalog changes can produce notifications. Removing Watch keeps notification registration when the opportunity remains in Journey.

Watch data is included in account export and remains private to the authenticated account.

## Comparison

Comparison accepts two to four recommendations and uses only the server projection. It begins only after the student enters comparison mode, omits identical and unsupported rows, and shows at most four meaningful differences. The default briefing has no recommendation-mode tabs.

## Analytics and privacy

Analytics record bounded action names and opaque opportunity IDs for priority views, comparison, and Watch changes. They do not record profile fields, comparison contents, eligibility details, or recommendation explanations.
