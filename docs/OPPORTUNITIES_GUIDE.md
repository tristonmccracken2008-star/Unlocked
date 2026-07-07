# Opportunity catalog maintenance

Career programs are `Opportunity` records with `type: "Career"` in `data/db/opportunities.json`. Only real programs with a live official organization, government, university, or event source may be published.

## Evidence rules

1. Use the program’s official source URL. Job aggregators, reposts, social posts, and search snippets do not qualify.
2. Confirm the program title, organization, audience, and current existence on that source.
3. Use `application_deadline: null` when the official source has not published a current deadline.
4. Pair a null deadline with `rolling`, `varies`, or `not_announced`; never copy a deadline from a previous cycle.
5. Update `last_verified` only after reviewing the source.
6. Mark an opportunity `School Specific` only when the official source limits participation to named institutions, and add those school slugs to `schools`.
7. Do not infer compensation or format. Use `Varies` when roles or sites differ.

## Editorial estimates

`difficulty` and `prestige` are UnlockED editorial estimates, not claims made by the organization. Apply them consistently:

- `Open`: registration-based or broadly accessible participation.
- `Competitive`: selective application, team qualification, or limited capacity.
- `Highly Competitive`: nationally selective programs, major employers, or multi-stage competitions.
- `Established`: recognized recurring program.
- `High`: prominent national program or organization.
- `Very High`: globally recognized program, institution, employer, or competition.

These estimates must never affect eligibility or imply acceptance odds.

## Required checks

- Every one of the eight normalized categories contains at least one record.
- Majors and academic years use normalized labels.
- Fixed deadlines contain a valid ISO date.
- Official sources use HTTPS.
- School-specific records contain explicit school relationships.
- Duplicate slugs are rejected.
- `npm run validate:data` and `npm run build` pass.

The personalized ranking is deterministic and local. It prioritizes matching majors and years, freshman programs for first-year profiles, research for technical profiles, and quantitative organizations for mathematics/computer-science profiles. It does not invent opportunities or acceptance probabilities.
