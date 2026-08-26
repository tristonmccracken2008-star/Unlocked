# Build workspace audit

## Current architecture

Build data is already modeled correctly as a chain of references:

1. Accomplishments owns confirmed outcomes.
2. Experience Bank records manual facts or references an accomplishment.
3. Resume versions reference Experience Bank records and may override presentation at the bullet level.
4. Resume Lab synchronizes each resume to one canonical Material record.
5. Applications associate requirements with those Material records.

This architecture should remain authoritative. A Build home only needs to project it clearly.

## Product problems found

- The primary Build destination opens Resume Lab directly. There is no `/build` parent experience.
- Experience Bank is a tab inside Resume Lab even though it is the factual source for every resume.
- Resume Lab and Materials use separate page language and do not show their relationship at a glance.
- Application demand is visible in Materials, but not at the point where a student decides what to work on.
- The resume list treats every active version equally and becomes harder to scan as versions accumulate.
- Experience rows do not show where they are reused, making references feel like copied content.
- Accomplishments available for review are present, but their role as an inbox is visually understated.
- Application-to-resume links preserve the target but do not consistently preserve the exact return destination.
- Universal Search exposes Resume Lab and Materials as separate products instead of one Build domain.
- The resume editor exposes many inputs at once and gives section visibility/order little emphasis.
- Materials are grouped only by status. Students first think in asset types, then readiness.

## Decisions

- Add a server-rendered `/build` workspace composed from existing projections. Do not add a Build store.
- Keep Experience Bank and resume editing in Resume Lab, but give both explicit deep links and a shared Build sub-navigation.
- Keep Materials canonical and metadata-only. Group the UI by Resumes, Documents, References, and Other.
- Derive one deterministic next action from existing facts. Do not add scores, completion percentages, or productivity metrics.
- Preserve Accomplishments as authoritative and require an explicit review/import action.
- Preserve all existing mutation APIs, optimistic boundaries, security locks, version conflicts, export, deletion, and downgrade behavior.

## Intentionally deferred

- File uploads, document storage, ATS scores, generated cover letters or essays, public portfolios, template marketplaces, and external synchronization.
- A second application queue or a second resume/material status system.
- Automatic claims, inferred skills, or fabricated metrics.
