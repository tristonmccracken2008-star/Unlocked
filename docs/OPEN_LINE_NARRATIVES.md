# Open Line Narrative and Meaning Engine

## Scope

The Narrative and Meaning Engine is the final data layer in Open Line Milestone 2. It explains verified Journey progress without generative text, network calls, randomness, or renderer-owned inference.

The engine does not implement the final Journey page, Path Moments, sharing, or editorial layout.

## Pipeline

```text
Journey input
  -> normalizeJourneyEvents()
  -> analyzeJourneyBranches()
  -> buildOpenLineNarratives()
  -> buildPathprint()
  -> createPathGeometry()
  -> OpenLineRenderer
```

Narratives are fully resolved before geometry and rendering. The renderer remains presentation-only.

## Public API

`buildOpenLineNarratives(input, events, branchIntelligence)` returns:

- versioned and signed narrative output
- localized-template-ready event copy
- hierarchically classified narrative moments
- deterministic explanations and evidence references
- structured waypoint and horizon meaning
- privacy-safe diagnostics

`createPublicNarrativeProjection(result)` filters private moments, removes evidence IDs and internal explanation sources, rewrites opportunity-specific titles to generic public-safe copy, and signs only the public result.

## Story hierarchy

The canonical hierarchy is:

1. Validation
2. Completed experience
3. Acceptance
4. Submission
5. Started application
6. Direction chosen
7. Expansion or refinement
8. Exploration

Saved opportunities retain useful Pathprint copy but are suppressed as major narrative moments. Repeated exploration in the same category is merged into one calm summary.

## Evidence rules

Narratives may use only:

- normalized event type and chronology
- branch transition and rejoin evidence
- persisted validation state
- structured opportunity category, career path, and skill metadata
- structured roadmap prerequisites, skills, and unlocks
- explicit profile year for early-program reasoning

Weak evidence selects a restrained fallback template. Input rationale is never repeated when it claims guarantees or certainty.

## First and repeated events

Counts are deterministic and category-aware. The first internship submission and a later internship submission receive different templates. Public counts are computed independently so private history cannot alter public wording.

## Waypoints and horizons

Waypoint reasoning prioritizes, in order:

1. verified early-year eligibility
2. required skill metadata
3. roadmap sequencing metadata
4. roadmap unlock metadata
5. a bounded category or source fallback

Horizon copy uses `strengthens`, `prepares`, and `can prepare`. It never uses guarantee language or presents a future path as inevitable.

## Localization

All canonical user-facing strings live in `data/open-line/narrative-templates.ts`. Templates use named parameters and fail closed when a required placeholder is absent. Engine code chooses template keys and structured parameters instead of assembling prose from fragments.

## Privacy

Public projections exclude:

- GPA and profile answers
- private goals and direction history
- private notes and manual evidence
- rejected or closed private paths
- organization and opportunity identifiers
- evidence event IDs
- internal explanation-source diagnostics

Equivalent public histories produce identical public signatures even when their private histories differ.

## Determinism and diagnostics

Rules are versioned as `open-line-narratives-v1`. Output signatures use compact semantic inputs: template keys, parameters, evidence identities, confidence, ordering, and structured waypoint or horizon data.

Diagnostics contain only counts, enums, signatures, and opaque IDs for suppressed or merged events. They never contain student or opportunity content.

The optional fourth argument is a synchronous stage observer used by the regression benchmark. It records aggregate durations only and is never enabled by the product request path.

## Performance

The engine is synchronous and performs no I/O. It uses maps and bounded sorting, then hashes a compact semantic representation rather than duplicating rendered prose in signature input.

Run:

```bash
npm run check:open-line-narratives
```

The regression suite enforces:

- typical-history p95 below 2 ms
- 1,000-event history average below 12 ms
- 1,000-event history p95 below 15 ms
- 1,000-event history hard maximum below 50 ms
- no network or asynchronous generation path

The benchmark warms the runtime before collecting 40 large-history samples. The p95 gate therefore ignores isolated build-worker scheduling or garbage-collection pauses while the hard maximum still catches severe stalls. Fixture construction, normalization, branch intelligence, assertions, and benchmark bookkeeping are measured separately from narrative generation.
