# Open Line Data Foundation

Open Line is derived from existing account activity. It does not replace the Journey Board, create another application tracker, or persist a duplicate event log.

## Pipeline

```text
Persisted profile, saved records, Journey statuses, and milestone progress
  -> normalized JourneyEvent records
  -> semantic PathEvent records and branches
  -> deterministic, renderer-independent Pathprint
```

`data/open-line` contains no React, geometry, animation, export, or recommendation-ranking code.

## Canonical Inputs

- `AccountData.activity` and `AccountData.tracker` remain the source for Journey state.
- `AccountData.savedOpportunities` supplies timestamps for legacy saved-only records.
- `StudentProgress` can supply application and completed-milestone evidence when a server caller already has it.
- `StudentProfile` supplies only the current career direction unless explicit direction history is provided.
- Recommendation and roadmap adapters consume an already-selected next step. Open Line never ranks or invents one.

The current tracker stores a status snapshot, not transition history. Open Line emits only the saved timestamp and the current proven status timestamp. It does not invent intermediate application stages.

## Progress Hierarchy

Every event maps to one semantic level:

| Level | Events |
| --- | --- |
| Exploration | viewed, saved |
| Intention | chosen/added to Journey, goal selected or changed, paused, closed |
| Action | application started |
| Commitment | application submitted |
| Validation | interview, acceptance, completion, skill evidence |

The summary records the strongest level reached. Counts of lower-level activity cannot outweigh a stronger event.

## Importance Weights

Weights establish deterministic visual hierarchy only. They are not engagement points, scores, streaks, or rankings.

| Event | Weight |
| --- | ---: |
| Viewed | 5 |
| Saved | 10 |
| Direction closed | 12 |
| Direction paused | 15 |
| Goal selected | 18 |
| Goal changed | 20 |
| Chosen | 25 |
| Application started | 45 |
| Application submitted | 65 |
| Interview reached | 80 |
| Skill evidence created | 84 |
| Accepted | 92 |
| Opportunity completed | 96 |

## Branches

- Viewed and saved activity stays on `main` and never creates a branch.
- Chosen or stronger opportunity activity creates `category:<category>`.
- Explicit direction records create `career:<direction>`.
- Completed skill evidence creates `skill:<skill>`.
- Paused and closed branches remain in private history.
- A later explicit goal selection can mark an inactive branch as rejoined.
- All meaningful branches are retained; visible branch limits belong to the future renderer.

## Narratives

Narratives use deterministic templates keyed by event type, category, and whether the event is the first of its kind. They describe only recorded activity, avoid outcome claims, and distinguish first events from later events.

## Determinism

Events are sorted by timestamp, semantic importance, opportunity ID, and stable event ID. IDs and the Pathprint signature use stable serialization and a versioned, non-security hash. `generatedAt` is intentionally excluded from the signature. There is no randomness, AI generation, or current-time-based ordering.

## Privacy

Every normalized event has `visibility` and `publicSafe`. Public Pathprints include only events that satisfy both conditions and replace private event and branch IDs with projection-specific IDs.

Public projections omit user IDs, opportunity IDs, organization IDs, career directions, current waypoints, and horizon data. Private closures cannot alter public branch state or origin timing. GPA, email, notes, application answers, sensitive eligibility, and rejection details are never accepted into the model by default.

## Compatibility And Persistence

`openLineInputFromAccount` adapts current and legacy account records without changing their schema. Pathprints are derived in memory and are not persisted or shared across users. A future snapshot cache must be versioned, user-scoped, and justified by export consistency or measured performance.

## Diagnostics

`getOpenLineDiagnostics` returns counts, source categories, ignored reason codes, and fixed privacy-exclusion field names. It never returns profile answers, IDs, opportunity content, or recommendation text.

## Validation

Run:

```bash
npm run check:open-line-data
```
