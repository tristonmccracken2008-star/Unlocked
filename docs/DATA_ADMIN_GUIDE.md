# UnlockED data administration guide

UnlockED has two canonical datasets:

- `data/db/opportunities.json` contains every benefit, AI tool, career program, and future opportunity type.
- `data/db/schools.json` and `data/db/institutions.json` contain curated and imported institution records.

Read the [Unified Opportunity Engine guide](./OPPORTUNITY_ENGINE.md) before editing content. All opportunity records use the single model in `data/opportunities.ts`.

## Add a school

Add one object to `schools.json` with a unique `slug`, official name, primary `.edu` domain, location, initials, and optional confirmed aliases. National opportunities become available automatically. School-specific opportunities must list the school slug in their `schools` array.

The loader derives the domain stem and conventional acronym, so a normal school addition requires one JSON object and no relationship table.

## Add or update content

Add or edit a record in `opportunities.json`. Use an official HTTPS source, conservative eligibility, an ISO `last_verified` date, and `null` for values or deadlines that are not officially documented.

Do not create separate benefit, AI, scholarship, research, software, or career data files. Use a new `type` or `category` in the Opportunity model instead.

## Verification

- `verified_recently`: official source and material claims were reviewed.
- `needs_review`: evidence is stale, incomplete, redirected, or unclear.
- `expired`: an official source confirms the opportunity ended.
- `community_submitted`: unreviewed lead that must not count as verified.

School-specific records require at least one valid school slug. The build rejects unknown schools, duplicate opportunity IDs, non-HTTPS sources, invalid dates, missing core fields, and migration-count regressions.

## Required commands

```bash
npm run validate:data
npm run build
```

Both commands must pass before publishing.
