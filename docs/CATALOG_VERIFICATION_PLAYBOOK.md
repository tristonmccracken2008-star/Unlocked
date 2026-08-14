# Catalog Verification Playbook

This playbook defines how an opportunity becomes eligible for UnlockED Pro recommendations. Discover may show lower-confidence records with transparent labels; Pro ranking requires positive proof.

## Source Standard

Use sources in this order:

1. Official program or application page
2. Official organization page
3. Official institutional documentation
4. An authorized application platform linked by the official organization

Do not verify eligibility from aggregators, SEO articles, reposts, or social summaries when a first-party source exists. A reachable URL proves only source health, not the facts on the page.

## Field Evidence

For every material field, store:

- state: `verified_restriction`, `verified_open`, `reviewed_no_restriction`, or `unreviewed`
- source URL
- source authority
- verification date
- application cycle when relevant
- a short internal note only when needed

Use `reviewed_no_restriction` only after a reviewer has examined the authoritative program requirements and confirmed that the dimension is not restricted. Never convert a missing value into an open value during migration.

Fields to review include academic level, institution type, enrollment, school/host restriction, external-student eligibility, class year, major, citizenship, residency, GPA, age, financial need, invitation/nomination, application status, and deadline.

## Eligibility Rules

- Encode restrictions as normalized enums and numbers; do not depend on free-text parsing at request time.
- Keep descriptive relevance separate from eligibility. A STEM-focused program may accept any major while still ranking most highly for STEM interests.
- If the profile model cannot prove a requirement, keep the record out of Pro ranking for affected users.
- Never infer international eligibility from an absent citizenship statement.
- Never infer “no GPA requirement” from a missing GPA value.
- Preserve nomination, transfer, residency, course-credit, and completed-semester requirements when they affect eligibility.

## Lifecycle and Cycles

Program identity and application cycle are separate. Reuse a stable opportunity ID across annual cycles and update cycle metadata.

- `open` and `rolling` require current authoritative evidence.
- `upcoming` requires a verified future opening date or explicit official statement.
- `temporarily_closed` is appropriate for a recurring program awaiting its next cycle.
- `unknown` is correct when no current-cycle status is proven.
- A previous year's date must never become a current deadline by adding one year.

Store current deadlines only when the source identifies the current cycle. Personal target dates remain separate.

## Recommendation-Safety Review

Before approving a record:

1. Confirm canonical identity and duplicate status.
2. Confirm an official HTTPS source and application destination.
3. Confirm current lifecycle and cycle.
4. Review every material eligibility dimension.
5. Store normalized rules and field evidence.
6. Confirm current deadline semantics.
7. Run `npm run check:recommendation-safe-catalog`.
8. Run eligibility and recommendation coverage checks.
9. Inspect the opportunity detail trust projection.
10. Test at least one eligible and one deliberately ineligible profile.

Do not mark a record safe merely because it is prestigious, useful, or broadly worded.

## Review Queue

Use `/admin/opportunities` to review the prioritized queue. Priority is an operational hint based on value, coverage, lifecycle, source readiness, and effort; it is not evidence.

Recommended batch order:

1. Open, high-value records with official sources and one resolvable blocker
2. Upcoming high-value cycles before their opening dates
3. Coverage deserts: scholarships, research, internships, fellowships, competitions, humanities, policy, transfer, and international
4. Broad programs that can serve many profiles without sacrificing quality
5. Convenience resources only after consequential inventory is healthy

## Mutations and Audit Trail

- Keep IDs stable.
- Do not emit student-facing Changelog, Radar, or notification events for internal cleanup alone.
- Record factual lifecycle changes only when the underlying program changed.
- Make migrations idempotent and fail without partially verified records.
- Never overwrite personal Journey, application, task, or calendar data.

## Regression Commands

Run at minimum:

```bash
npm run audit:recommendation-safe-catalog
npm run check:recommendation-safe-catalog
npm run check:verified-inventory
npm run check:recommendation-eligibility-production
npm run check:recommendation-coverage
npm run check:professional-recommendations:quick
npm run build
npm run postbuild
```

Critical integrity failures should fail builds. Review backlog and optional enrichment should be reported without pretending the records are safe.
