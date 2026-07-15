# Open Line Branch Intelligence

## Scope

Branch Intelligence is the semantic layer between canonical Journey events and Pathprint geometry. It has no React, persistence, database, network, recommendation-ranking, or rendering dependency.

```text
Persisted activity
  -> normalizeJourneyEvents
  -> analyzeJourneyBranches
  -> PathEvent direction projection
  -> Pathprint branches
  -> geometry
  -> renderer
```

Geometry may hide branches to fit a viewport, but it never decides whether a branch is meaningful. The renderer receives finished geometry and has no direction logic.

## Versioning

The deterministic branch rules are versioned independently as `open-line-branches-v1`. Direction, transition, rejoin, validation, ordering, and diagnostics signatures include this version.

## Canonical directions

The engine supports six direction kinds:

- `career`
- `academic`
- `experience`
- `skill`
- `opportunity_category`
- `personal_goal`

States are `exploring`, `active`, `paused`, `closed`, and `rejoined`. Canonical keys use a kind prefix and normalized value, such as `career:quantitative-finance`, `academic:undergraduate-research`, `experience:internships`, `skill:python`, and `category:scholarships`.

Career, skill, and opportunity-category aliases are normalized once. Unknown exact values receive a stable slug; broad substring or keyword matching is not used.

## Activation

Directions may exist internally before appearing as branches. The visible activation threshold is `0.55`.

| Strongest signal | Base confidence |
| --- | ---: |
| Viewed | 0.10 |
| Saved | 0.20 |
| Explicit goal | 0.35 |
| Chosen / added to Journey | 0.55 |
| Application started | 0.70 |
| Application submitted | 0.82 |
| Interview | 0.92 |
| Verified skill evidence | 0.94 |
| Accepted or completed | 1.00 |

Sustained meaningful activity adds a bounded confidence bonus. An explicit current goal receives a bounded bonus only when meaningful activity explicitly supports it. Skill directions require validation evidence even if their numerical confidence would otherwise pass the threshold.

Viewing and saving never create a visible branch. Student benefits and AI tools are category directions with a ranking penalty because they rarely represent a major direction by themselves.

## Primary selection

Primary selection is deterministic and is not based on event count. The score combines:

- semantic confidence
- strongest progress level
- at most two evidence records
- explicit current-goal alignment
- current-waypoint opportunity alignment
- bounded sustained activity
- bounded recency relative to the latest known event

Skill strands cannot become primary while a substantive direction exists. Stable keys provide the final tie-break. Generation time is never used.

The selected primary direction is projected to `branchKey: "main"`. Activated alternate directions keep their canonical key. The immutable `directionKey` remains on private `PathEvent` records so projections can be recalculated without changing semantic identity.

## Secondary ranking and capacity

Alternates use the same deterministic score, followed by confidence, progress, evidence, recency, and stable key tie-breaks. Skill strands receive a supporting-rank penalty so they do not compete visually with career and experience paths.

All activated alternates remain in `secondaryDirectionKeys`. The engine reports the top three desktop or top two mobile keys separately. Pathprint retains overflow branches; geometry applies its own existing viewport capacity without deleting model data.

## Direction transitions

Transition records use calm deterministic templates:

- `continued`: repeated activity in the same direction
- `expanded`: a second direction is selected while another remains active
- `shifted`: an explicit goal change names a previous and new direction
- `paused`: an explicit pause or explicit goal shift places the old direction on hold
- `closed`: an explicit close ends that semantic path
- `rejoined`: meaningful activity resumes the same stable key after pause or close

Time alone never pauses or closes a direction. A later meaningful event resumes the original key rather than creating another branch.

A rejected application maps to an opaque opportunity-specific experience direction whose parent is the broader category. Closing that branch cannot close a career direction or every internship.

## Rejoin evidence

Rejoins require one of four explicit reasons:

- `shared_goal`: two validated directions have explicit opportunity `careerPaths` matching the primary career key
- `shared_skill`: two validated directions have the same exact normalized `skillsGained` value
- `experience_completed`: a completed experience contributes its evidence back to the primary direction
- `direction_synthesis`: activated sources satisfy a fixed, versioned synthesis rule for the explicit target direction

Rejoin discovery uses maps keyed by canonical goal and skill. Direction synthesis evaluates a small fixed rule table. It never compares free text, providers, dates, or broad keywords. Explanations are deterministic and cite the relevant direction labels only.

## Validation

Canonical validation evidence is emitted only for:

- interview reached
- acceptance or scholarship award
- completed experience
- skill evidence with a real evidence reference

Saved opportunities, started applications, profile edits, recommendations, and unverified internal work are not validation. External source identifiers are opaque stable IDs derived from official source metadata.

## Skill strands

Skills originate only from completed opportunity `skillsGained` metadata or referenced manual/milestone evidence. Exact aliases such as `Data Analytics` and `Data Analysis` normalize to one strand. Skills remain supporting branches, are capacity bounded, and normally rejoin a career or experience direction through explicit evidence.

## Privacy

Private Pathprints retain paused/closed directions, detailed transitions, and private evidence. Diagnostics use opaque direction identifiers and reason codes rather than labels, opportunity IDs, user IDs, or narratives.

Public Pathprints are reprojected from shareable, public-safe `PathEvent` records only. The public primary and branch order are recalculated without private branch state or private ordering. Canonical `directionKey`, opportunity IDs, organization IDs, and career directions are stripped before serialization. Consequently, hidden private activity cannot alter a public signature or lane ordering.

## Performance

Analysis has no I/O. Opportunity metadata is indexed once, candidates are capped defensively, event-to-candidate assignments are indexed, shared relationships are grouped by maps, and synthesis traversal is fixed and bounded. The regression suite measures robust p95 latency for typical and 2,000-event histories.

Run:

```bash
npm run check:open-line-branches
```
