# Catalog Reliability Engine 2.0

## Purpose

UnlockED treats a canonical catalog row and a recommendation-safe opportunity as different things. The production recommendation gate remains authoritative. The reliability engine explains why a row is or is not usable and turns that explanation into repeatable maintenance work; it never bypasses the gate.

The operational lifecycle is:

`discover -> verify -> structure -> prove -> activate -> monitor -> refresh -> retire`

Research and acquisition are explicit scripts. They never run during a production build or request.

## Health states

- `SAFE`: passes the existing production recommendation gate at the report date.
- `NEAR_SAFE`: has an authoritative source and only one or two explicit critical blockers.
- `NEEDS_RESEARCH`: is potentially useful but lacks enough authoritative structured evidence.
- `STALE`: previously maintained evidence is overdue or has a current freshness problem.
- `BLOCKED`: a source or evidence conflict prevents safe activation.
- `ARCHIVE_CANDIDATE`: is canceled, archived, expired, or has a broken source. Review precedes archival or deletion.
- `DUPLICATE_CANDIDATE`: matches a reviewed duplicate group but is not silently merged.

States are internal. Students never see them.

## Explicit blockers and queues

`data/recommendation-safe-catalog.ts` maps production-gate failures to named blockers. `data/catalog-reliability.ts` adds source, cycle, duplicate, recertification, and coverage context. No readiness score is used.

Queue order is deterministic:

1. `recertify_stale`
2. `one_critical_blocker`
3. `two_critical_blockers`
4. `coverage_gap`
5. `deeper_research`
6. `archive_or_duplicate_review`

Coverage-gap priority is explicit and currently recognizes scholarship, transfer, humanities, social sciences, arts/design, competitions, fellowships, first-year, and international access. A gap can raise research priority; it cannot make an unsafe record safe.

## Source hierarchy

Authoritative evidence uses:

1. Official program pages, official organization pages, official application portals, official eligibility pages, and official FAQs.
2. Official institutional announcements, department pages, and official documents.

Third-party sources may discover a candidate but are `discovery_only`, not evidence. Unsafe protocols and malformed URLs are rejected. URL canonicalization removes fragments and common tracking parameters without collapsing semantically different program and application links.

## Field provenance

`OpportunitySourceReference.supports` records which fields a source supports, when it was checked, and for which cycle. Existing eligibility fields remain supported. The schema now also permits explicit provenance for requirements, compensation, program dates, and location. A zero in those new report columns means no field-specific source reference has been recorded; it does not mean the catalog lacks display copy.

Critical facts require official evidence. Unknown compensation is not unpaid. A missing deadline is not rolling. Generic undergraduate eligibility is not explicit transfer eligibility. Silence about citizenship is not international eligibility.

## Program and cycle identity

Each maintained record retains a stable program `identityId` and a separate `cycleId`. Historical cycle facts are not rewritten as the next cycle. Recurrence must have explicit evidence; a previous annual cycle does not prove a future deadline.

Lifecycle semantics distinguish open, upcoming, rolling, temporarily closed, closed, canceled, archived, and unknown. Open and rolling require explicit support. A future opening remains outside current recommendations until the opening is reached and its evidence remains valid.

## Recertification

Lifecycle and deadline evidence is reviewed most frequently, eligibility per cycle or periodically, and organization identity least frequently. Per-record acquisition metadata can set a more precise `nextReviewAt` date. An inaccessible official source does not delete a record, but critical unrefreshable facts remove it from recommendation safety and put it in a review queue.

Suggested workflow:

### Daily or on demand

1. Run `npm run catalog:stale`.
2. Refresh due lifecycle and deadline evidence.
3. Run `npm run catalog:near-safe` and resolve the smallest authoritative blockers.
4. Process source-watch candidates whose review dates have arrived.

### Weekly

1. Run `npm run catalog:coverage` and `npm run catalog:safe-blockers`.
2. Research the highest-value coverage gaps using official sources.
3. Review duplicate and archive candidates.
4. Run recommendation coverage and representative For You QA.
5. Write the deterministic artifact with `npm run report:catalog-health -- --as-of=YYYY-MM-DD --write`.

## Acquisition pipeline

The existing candidate ledger records accepted and rejected/deferred candidates, disposition reasons, source-watch dates, and authoritative URLs. Queueing now uses explicit priority bands rather than a numeric scarcity score.

`npm run audit:opportunity-acquisition` is a non-mutating dry run. It checks existing matches, missing evidence, duplicates, and the production gate. Historical accepted records are evaluated at their documented review date, while the current catalog report evaluates safety at the report date. This preserves acquisition history without incorrectly presenting an expired cycle as current.

`npm run acquire:opportunities` applies only validated additions or updates. Running the dry run after apply must return zero additions and zero updates. Conflicting provider changes must use existing lifecycle and changelog semantics rather than silent overwrite.

## Deduplication and normalization

Deterministic duplicate evidence includes canonical ID, normalized title and organization, official URL, and reviewed duplicate groups. Similar names alone never cause a merge. Organization normalization is for identity comparison only; the official user-facing name is preserved.

## Safety and runtime boundaries

- No arbitrary URL fetch endpoint, crawler, client secret, or production-build research was added.
- No safety, eligibility, provenance, confidence, international, or transfer gate was weakened.
- Reliability and acquisition modules remain server/script dependencies and are not imported by client components.
- The production recommendation gate remains fail-closed.
- Reports perform bounded in-memory passes over the 6,035-record catalog and do not mutate catalog data.

## Validation

`npm run check:catalog-reliability` covers safe, stale, unknown-lifecycle, old-deadline, missing-citizenship, third-party-only, duplicate, rolling, future-opening, and graduate-only cases. It also checks URL and organization normalization, deterministic output, idempotency, and report performance.

The machine-readable result is `docs/catalog-health.json`. It contains complete aggregates and bounded operational queues so the checked-in artifact remains reviewable; the report command evaluates the complete catalog on every run.
