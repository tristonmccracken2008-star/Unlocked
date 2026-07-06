# Benefit verification guide

This policy defines the evidence required before an UnlockED benefit is published and how its review state is maintained. A reviewer must be able to reproduce every published claim from an official source.

## Statuses

- `verified_recently` — an editor checked the offer against a current official provider or university page within the review window.
- `needs_review` — the evidence is stale, unclear, changed, or temporarily unavailable. Do not include this status in verified counts or value totals.
- `expired` — an official source confirms the offer ended, or its stated end date has passed. Retain the record for audit history but do not present it as active.
- `community_submitted` — an unreviewed lead from a user. It is never considered verified until an editor completes this process.

## Evidence standard

Use a public page owned by the provider or university as the primary source. The page must identify the benefit, eligible audience, and current terms. Provider help centers, pricing pages, and official university service pages qualify. Search results, blogs, deal aggregators, social posts, screenshots, and unsourced user reports do not qualify as primary evidence.

If an offer requires sign-in and its terms cannot be viewed publicly, record the limitation and use `needs_review` unless an editor can validate it through an authorized student flow. Never infer eligibility, discount size, expiration, or estimated value.

## Publication checklist

Before setting a benefit to `verified_recently`, an editor must:

1. Open the official source URL and confirm it resolves to the provider or university.
2. Confirm the offer is currently available and the record’s name and description do not overstate it.
3. Confirm eligibility, geographic limits, enrollment requirements, and verification method.
4. Confirm the claim URL and claim steps match the current flow.
5. Confirm renewal, trial, billing, and expiration language.
6. Record today’s date in `verifiedAt`, update the human-readable `verified` field, and set the matching source record’s `lastVerified` date.
7. Include an estimated value only when the official source publishes the comparison price or the calculation can be reproduced from official prices. Otherwise omit `annualValue` and use an unknown/non-monetary value label.
8. Assign the review score using the rubric below and run `npm run build`.

## Internal review score

`reviewScore` is an integer from 0 to 100 for internal prioritization. It is not a user rating and is not displayed publicly.

Start at 0 and add:

- 40 points: current official source directly describes the offer.
- 20 points: eligibility and verification method are explicit.
- 15 points: price/value and renewal terms are explicit, or the record clearly leaves value unknown.
- 15 points: the claim flow was checked through the last publicly accessible step.
- 10 points: a second official page corroborates material details.

Scores do not override status. A record can only be `verified_recently` when it passes the full publication checklist. A community submission remains `community_submitted` regardless of its initial score.

## Review cadence and transitions

- Recheck active national offers at least every 90 days.
- Recheck school-specific benefits at least once per academic term.
- Immediately set a record to `needs_review` after a credible outdated-information report or source failure.
- Set a record to `expired` when the official evidence confirms the offer ended.
- Move `community_submitted` to `verified_recently` only after an editor completes the publication checklist.
- After every review, preserve the official source, update both verification dates, and recalculate the review score.

Reports submitted through the benefit page should be investigated before any claims are changed. When evidence conflicts, use the more conservative status and do not publish a monetary estimate.
