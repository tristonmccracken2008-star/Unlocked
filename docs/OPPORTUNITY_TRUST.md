# Opportunity trust

UnlockED presents trust at the field level. A record-level `verified` status does not automatically verify its deadline, eligibility, requirements, or source.

## Projection

`data/opportunity-trust.ts` is the shared projection for user-facing trust claims. It resolves:

- official source attribution from explicit source evidence;
- deadlines only when the deadline and source are explicitly verified;
- eligibility only when eligibility and source evidence are explicit;
- application requirements only when the record, eligibility evidence, and source are verified;
- potentially stale deadline and eligibility evidence using field-specific windows.

Deadline evidence is considered current for 120 days for fixed-cycle claims. Eligibility and application requirement evidence use a 366-day window. Rolling and no-deadline facts are not treated like fixed-cycle dates.

Unknown or incomplete evidence stays unconfirmed. Recommendations express relevance, not guaranteed eligibility. Private student tasks and target dates never become catalog facts.

## Product use

- Opportunity details show the fact first, then restrained source and freshness context.
- Discover and For You use the same deadline and source semantics without adding badge clutter.
- Calendar imports only explicitly verified official deadlines.
- Application workspaces materialize only verified provider requirements. Completing private tasks cannot produce an official-ready claim.
- Existing Changelog, Notifications, Journey, and Return Experience preserve current catalog truth separately from student history.

## Audit

Run `npm run check:opportunity-trust`. The deterministic audit reports actual canonical coverage and fails on unsupported verified deadlines, invalid canonical sources, contradictory archived state, or verified requirements without evidence. Review-only metadata gaps remain visible without blocking a production build.

Source health is validated offline from catalog evidence and URL safety during builds. Ordinary page rendering never performs network verification.

