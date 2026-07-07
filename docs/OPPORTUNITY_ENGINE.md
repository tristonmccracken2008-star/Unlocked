# Unified Opportunity Engine

Every content item in UnlockED is an `Opportunity`. The canonical catalog is `data/db/opportunities.json`; the TypeScript model, validator, query engine, and helpers live in `data/opportunities.ts`.

The catalog currently contains five types: `Benefit`, `AI`, `Career`, `Research`, and `Scholarship`. Existing benefit, school, AI, career, research, and scholarship interfaces are projections over this catalog. They must not introduce separate content records.

## Core model

Every record includes the same top-level fields: `id`, `title`, `type`, `category`, `description`, `organization`, `school_scope`, `schools`, `majors`, `academic_years`, `eligibility`, `estimated_value`, `application_deadline`, `recurring`, `location`, `remote`, `paid`, `tags`, `official_source`, `verification_status`, `last_verified`, `date_added`, `difficulty`, `prestige`, `icon`, `featured`, and `hidden_gem`.

Type-specific fields belong in `metadata`. Current extensions include benefit claim instructions, AI access type, and career deadline/format labels. Do not add type-specific fields to the core model unless they apply meaningfully to every opportunity.

## Add an opportunity

1. Open `data/db/opportunities.json`.
2. Copy a record of the closest existing type.
3. Assign a unique ID using `<type>--<slug>`.
4. Fill every core field; use `null` or an empty array when a field genuinely does not apply.
5. Use only an official HTTPS source and a real ISO verification date.
6. Add type-specific values under `metadata`.
7. Run `npm run validate:data` and `npm run build`.

A valid record automatically receives a universal detail page at `/opportunities/[id]` and appears in the universal filtering engine.

It also enters the recommendation engine automatically. See `RECOMMENDATION_ENGINE.md` for scoring and dashboard collection rules.

## Add a new opportunity type

1. Add the type name to `opportunityTypes` in `data/opportunities.ts`.
2. Add records using the existing core schema.
3. If specialized display is useful, add only an adaptive branch to `OpportunityCard` and the universal detail page.
4. Query the new type with `filterOpportunities({ types: ["NewType"] })`.
5. Add its minimum-count or category rules to `scripts/validate-data.mjs`.

No new database file, relationship table, card model, or detail route is required.

## Universal filters

`filterOpportunities` supports type, major, school, academic year, paid status, remote status, deadline state, featured, hidden gems, and text search. School filtering always retains national opportunities and restricts school-specific opportunities to explicit school IDs.

## Compatibility views

- `data/index.ts` maps `Benefit` opportunities into the legacy benefit shape used by existing school and SEO pages.
- `data/ai-tools.ts` maps `AI` opportunities into the current dashboard AI interface.
- `careerOpportunities` is a `Career` query used by the dashboard.
- `researchOpportunities` is a `Research` query used by the dashboard.
- `scholarshipOpportunities` is a `Scholarship` query used by the dashboard.

These are read-only adapters. Never store content in an adapter.
