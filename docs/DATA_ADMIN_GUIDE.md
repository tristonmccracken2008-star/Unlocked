# UnlockED data administration guide

The catalog is stored as normalized JSON under `data/db`. Application code should not contain school or benefit records.

## Collections

| File | Purpose | Primary key |
| --- | --- | --- |
| `schools.json` | Curated schools and human-reviewed aliases | `slug` |
| `institutions.json` | Bulk institution registry sourced from College Scorecard | `slug` |
| `benefits.json` | Benefit content, eligibility, category, scope, and source reference | `slug` |
| `sources.json` | Official verification URLs and verification dates | `id` |
| `categories.json` | Allowed benefit categories | `id` |
| `school-benefits.json` | Links between schools and school-specific benefits only | `schoolId` + `benefitId` |

Type definitions and validation rules live in `data/schemas.ts`. The loader in `data/index.ts` joins relationships and sources, derives search aliases and verification confidence, and makes every national benefit available to every school. The build rejects duplicate IDs, duplicate domains, duplicate provider benefits, broken relationships, invalid category IDs, non-HTTPS offer URLs, and mismatched verification dates.

## Add a school

1. Open `data/db/schools.json`.
2. Add one object with a unique lowercase, hyphenated `slug`.
3. Use the institution’s primary `.edu` domain without `https://` or `www`.
4. Add only confirmed nicknames or abbreviations to `aliases`. The loader automatically adds the domain stem and a conventional acronym, so this field may be omitted.
5. Optionally add `website`, `unitId`, and `sourceUrl` when an authoritative institution record is available.
6. Add school-specific relationships only when an official university source supports them. Do not add relationships for national benefits; they are inherited automatically.
7. Run `npm run build`. The build rejects invalid `.edu` domains, duplicate schools, and broken relationships.

That single school object is enough to publish a school page with all current national benefits, which keeps routine additions under two minutes.

Example:

```json
{
  "slug": "example-university",
  "name": "Example University",
  "aliases": ["Example U", "EU"],
  "domain": "example.edu",
  "location": "Example City, ST",
  "initials": "EU"
}
```

Relationship example:

```json
{ "schoolId": "example-university", "benefitId": "github-student-developer-pack" }
```

## Add a national benefit

1. Verify the offer on the provider’s official website.
2. Add a unique source to `sources.json`. Use the benefit slug in `benefitId` and an ISO `YYYY-MM-DD` date in `lastVerified`.
3. Add the benefit to `benefits.json` with `scope: "national"` and the matching `sourceId`.
4. Use `"Unknown"` for `value` and `0` for `annualValue` unless an official source provides a fixed value or the value is a direct calculation from published prices.
5. Do not create school relationships for a national benefit. It is inherited by every school automatically.
6. Run `npm run build`.

## Add a school-specific benefit

Follow the same process, but:

- The source must be an official university page.
- Set `scope` to `"school"`.
- Add relationships only for the exact school or schools named by the official source.
- Describe campus, program, enrollment, and ID restrictions precisely.

## Required benefit fields

- `slug`, `name`, `provider`, `description`
- `categoryId`: the normalized ID of a record in `categories.json`
- `scope`: `national` or `school`
- `eligibility` and structured `eligibilityNotes` covering qualification and verification requirements
- `claimUrl` and `sourceId`
- `verified`, a display date, and `verifiedAt`, an ISO date
- `status` (`verified_recently`, `needs_review`, `expired`, or `community_submitted`)
- `reviewScore`, an internal integer from 0–100 assigned using the [verification guide](./VERIFICATION_GUIDE.md)
- `verificationMethod`, `claimSteps`, and `renewalNotes`

`value`, `annualValue`, and `featured` are optional in the schema. Unknown values must not be estimated.

The UI-facing `verificationConfidence` value is derived by the loader so it cannot drift from the review state:

- `high`: `verified_recently` with a review score of at least 85
- `moderate`: not expired and review score of at least 65
- `low`: all other records

## Update or remove a benefit

To reverify a benefit, check the official source and update both `benefits.json` verification dates and the corresponding `sources.json` `lastVerified` date. Those ISO dates must match. If the official page no longer supports the offer, set it to `expired` or remove its benefit record, source record, and every school-specific relationship using its benefit ID in the same change.

## Refresh the institution registry

`institutions.json` is sourced from the U.S. Department of Education’s [College Scorecard data download](https://collegescorecard.ed.gov/data/). The current import includes active, predominantly bachelor’s-degree institutions under public or private nonprofit control with a valid `.edu` hostname. `UNITID` is preserved as `unitId` for traceability.

When refreshing the registry:

1. Download the latest “Most Recent Institution-Level Data” archive from College Scorecard.
2. Select records where `CURROPER=1`, `PREDDEG=3`, `CONTROL` is public or private nonprofit, and `INSTURL` resolves to a `.edu` hostname.
3. Deduplicate by normalized hostname; a domain represents one searchable school entry.
4. Preserve the highest-enrollment record when multiple Scorecard records share a domain.
5. Map `UNITID`, `INSTNM`, `CITY`, `STABBR`, `INSTURL`, and conservative values from `ALIAS`.
6. Never overwrite a record in `schools.json`; curated records take precedence over imported records with the same domain.
7. Record the download date and source URL in the pull request or commit message.
8. Run `npm run build` and review the school count and duplicate checks.

Do not import nicknames from unofficial directories. Remove malformed, promotional, or ambiguous aliases during review.

## Quality checklist

- Source is official and directly supports the claim.
- No coupon blogs, affiliate pages, search snippets, or unsourced estimates.
- School-specific claims are linked only to confirmed schools.
- Eligibility and renewal limits match the source.
- Eligibility text states who qualifies and the verification mechanism; do not use “students” when the source has narrower enrollment, age, country, or program restrictions.
- Unknown value is recorded as unknown.
- Benefit name is unique for its provider and category IDs resolve to `categories.json`.
- Benefit and source verification dates match and all official URLs use HTTPS.
- National benefits have no manual school relationships.
- `npm run build` passes before publishing.
