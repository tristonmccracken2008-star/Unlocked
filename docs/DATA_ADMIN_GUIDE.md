# UnlockED data administration guide

The catalog is stored as normalized JSON under `data/db`. Application code should not contain school or benefit records.

## Collections

| File | Purpose | Primary key |
| --- | --- | --- |
| `schools.json` | School names, domains, locations, and search aliases | `slug` |
| `benefits.json` | Benefit content, eligibility, category, scope, and source reference | `slug` |
| `sources.json` | Official verification URLs and verification dates | `id` |
| `categories.json` | Allowed benefit categories | `id` |
| `school-benefits.json` | Many-to-many links between schools and benefits | `schoolId` + `benefitId` |

Type definitions and validation rules live in `data/schemas.ts`. The loader in `data/index.ts` joins relationships and sources for the existing UI.

## Add a school

1. Open `data/db/schools.json`.
2. Add one object with a unique lowercase, hyphenated `slug`.
3. Use the institution’s primary `.edu` domain without `https://` or `www`.
4. Add common names and abbreviations to `aliases`. Do not repeat the official name or domain.
5. Add relationships for applicable national benefits in `data/db/school-benefits.json`. Copy only benefit IDs that the school’s students can reasonably verify for; do not assume eligibility for institution-contract products.
6. Add separately verified school-specific relationships where applicable.
7. Run `npm run build`. The build rejects invalid `.edu` domains and broken relationship IDs.

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
5. Link the benefit to eligible schools in `school-benefits.json`.
6. Run `npm run build`.

## Add a school-specific benefit

Follow the same process, but:

- The source must be an official university page.
- Set `scope` to `"school"`.
- Add relationships only for the exact school or schools named by the official source.
- Describe campus, program, enrollment, and ID restrictions precisely.

## Required benefit fields

- `slug`, `name`, `provider`, `description`
- `category`: one of the values in `categories.json`
- `scope`: `national` or `school`
- `eligibility`
- `claimUrl` and `sourceId`
- `verified`, a display date, and `verifiedAt`, an ISO date
- `status` (`verified_recently`, `needs_review`, `expired`, or `community_submitted`)
- `reviewScore`, an internal integer from 0–100 assigned using the [verification guide](./VERIFICATION_GUIDE.md)
- `verificationMethod`, `claimSteps`, and `renewalNotes`

`value`, `annualValue`, and `featured` are optional in the schema. Unknown values must not be estimated.

## Update or remove a benefit

To reverify a benefit, check the official source and update both `benefits.json` verification dates and the corresponding `sources.json` `lastVerified` date. If the official page no longer supports the offer, remove its benefit record, source record, and every relationship using its benefit ID in the same change.

## Quality checklist

- Source is official and directly supports the claim.
- No coupon blogs, affiliate pages, search snippets, or unsourced estimates.
- School-specific claims are linked only to confirmed schools.
- Eligibility and renewal limits match the source.
- Unknown value is recorded as unknown.
- `npm run build` passes before publishing.
