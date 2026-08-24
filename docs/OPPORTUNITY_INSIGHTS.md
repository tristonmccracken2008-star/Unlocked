# Opportunity Insights

Insights is the authenticated, read-only answer to: **What does my own recorded history show me?**

## Data flow

`app/insights/page.tsx` loads the authenticated account and only the catalog records referenced by that account. `buildOpportunityInsights()` then creates one deterministic server projection. The browser receives summary values, not the complete underlying account history.

Authoritative inputs are Journey records and transition history, reconciled Accomplishments, Application Material associations, followed Paths, and current Watch records. Insights does not own or copy those records and exposes no mutation API.

## Coverage

- Lifecycle counts are fully supported when a dated Journey event exists. Legacy current stages may support an all-time count but never a fabricated date.
- Current Watch records are supported; historical removals are not, so Watch-to-Journey history is not shown.
- For You impressions are aggregate product analytics rather than an authoritative personal record, so recommendation attribution is unavailable.
- Older records do not retain reliable first-discovery provenance.
- Graduation year does not prove academic standing at an event date, so the first version uses calendar years.

## Counting rules

One opportunity remains one opportunity as it moves through its lifecycle. Undone transitions are excluded. Archived records are not outcomes. A missing outcome remains awaiting or unrecorded and is never classified as rejection. Manual Accomplishments linked to a Journey opportunity are reconciled through existing canonical identity semantics.

Material insights report selection and reuse only. They do not compare document quality or claim that a material caused an outcome. Rejections and acceptances do not alter recommendation affinity in this release; this avoids feedback loops and keeps eligibility, diversity, and explicit preferences authoritative.

## Privacy and account lifecycle

The route is protected in both proxy and server composition. The projection is available to Free and Pro accounts alike and survives downgrade because the underlying personal records remain available. Account export and deletion already cover those source records; there is no separate Insights store to export or orphan.
