# For You 2.0 Recommendation Audit

Audit date: 2026-08-13

## Architecture

For You remains deterministic and server-authoritative. The existing professional recommendation service performs profile matching, mandatory eligibility filtering, quality scoring, repetition controls, behavioral weighting, diversity selection, and final safety auditing. `lib/for-you-snapshot.ts` persists only the bounded result set for the authenticated account.

For You 2.0 adds `lib/for-you-briefing.ts`, a small projection over those already-approved results. It assigns each recommendation to exactly one presentation role:

- Top Picks: up to three high-confidence core recommendations.
- Don't Miss: strong recommendations with documented timing.
- Expand Your Options: bounded exploration selected by the existing engine.
- More Matches: remaining approved recommendations.

The projection also derives factual Journey mix, concise recommendation insights, and Opportunity Radar events. It does not score catalog records again and cannot introduce an opportunity that did not pass the recommendation pipeline.

## Explainability

User-facing explanations reuse structured recommendation reasons and opportunity intelligence:

- `whyItFits` comes from the canonical summary reason or ranked reason list.
- `whyNow` exists only when the recommendation service has documented timing evidence.
- `whatItAdds` compares the opportunity's canonical category with active Journey categories.
- application effort comes from structured Opportunity Intelligence metadata and remains `Unknown` when absent.

The UI shows qualitative match labels, not percentages. “Recommended” remains distinct from “eligible,” and every page retains the instruction to confirm current requirements with the official source.

## Journey And Behavior

Active, applied, accepted, and completed opportunities are handled by the existing recommendation pipeline and do not consume new recommendation slots. Journey status, saves, views, completed work, explicit feedback, prior exposure, and profile preferences are included in the snapshot version. Any meaningful account change invalidates or refreshes the account-scoped snapshot.

The briefing uses Journey only for descriptive portfolio context. It can state that a category is absent or concentrated; it does not prescribe a career path.

## Opportunity Radar

Radar reuses the catalog changelog, lifecycle freshness, verified deadline timing, and the prior account snapshot. Supported presentation events are:

- new strong match
- newly added to UnlockED
- recently verified
- deadline approaching
- applications reopened
- meaningful catalog change

Top Pick IDs are excluded from Radar to avoid presenting one opportunity as multiple discoveries. Radar stores no separate event history and makes no network calls during generation.

## Safety And Entitlements

- Recommendation eligibility and final auditing are unchanged.
- Pro entitlement is resolved from server-side billing data.
- Free receives one current-strategy preview recommendation and no serialized briefing intelligence.
- Pro receives up to eight approved recommendations plus the typed briefing.
- Snapshot records remain scoped by user ID and include all ranking, catalog, eligibility, and rules versions.
- Analytics use opaque IDs and bounded labels only. Profile answers, recommendation copy, notes, essays, and private tasks are not recorded.

## Measured Results

The current catalog contains 5,998 opportunities:

- 205 verified
- 67 recommendation-safe
- 9 high-value recommendation-safe
- 5,841 needing eligibility review

Across 250 golden undergraduate profiles:

- 249 ranked profiles
- 1,236 total recommendations
- 4.96 average recommendations
- 0 empty undergraduate profiles
- 865 excellent-tier and 371 controlled-exploration recommendations

The seven representative Pro personas each received three current safe recommendations in the deterministic premium test. A CS/quant fixture received three recommendations across three categories, with two Top Picks and one factual Radar event.

Performance on the current catalog:

- representative premium persona generation: 19.90 ms average, 35.56 ms p95
- briefing projection: 0.006 ms average, 0.008 ms p95
- browser-observed warm API completion: generally 35–74 ms in the local account-scoped test environment

## Catalog Limitations

The primary constraint is verified eligibility coverage, not ranking throughput. Of 5,998 catalog records, 5,841 remain in `needs_eligibility_review`. Important unresolved metadata includes 4,428 variable-eligibility records, 57 citizenship gaps, and 11 external-student eligibility gaps.

Current safe profile coverage is strongest for broad STEM/research profiles and thinner for economics/finance, humanities, and undecided students. For You intentionally returns fewer results rather than relaxing verification or filling sections with weaker records.

## Known Weaknesses

- Radar value depends on meaningful changelog coverage; an empty Radar is expected when nothing material changed.
- Current recommendation-safe depth often produces three to six results, limiting how often every optional section appears.
- Location preferences and estimated application effort are useful only where catalog metadata is structured.
- The deterministic daily snapshot is stable by design; it is not a real-time streaming feed.

