# High-Quality Opportunity Acquisition Playbook

Last updated: 2026-08-14

## Purpose

This playbook governs how UnlockED acquires opportunities that may enter professional recommendations. Catalog size is not the objective. The objective is a growing set of current, useful opportunities for which UnlockED can positively prove student eligibility.

The production recommendation gate remains authoritative. Acquisition code may structure evidence and identify gaps, but it may not infer missing eligibility, promote a closed cycle, or override the gate.

## Operating Workflow

1. **Source candidates.** Start with official program, university, government, foundation, or employer pages. Record the target student groups and the coverage gap before researching details.
2. **Check identity.** Search canonical IDs, aliases, organization/title pairs, and official URLs. Enrich the canonical record when one exists; never create a second record for a new cycle.
3. **Confirm lifecycle.** Prove that the exact cycle is open or rolling. An announced future cycle is `current_cycle_unavailable`, not open. Conflicting official pages remain rejected until resolved.
4. **Resolve eligibility.** Record academic level, institution type, enrollment, school/host restrictions, external-student access, class year, major, citizenship, residency, GPA, age, financial need, invitation status, application status, and deadline.
5. **Capture provenance.** Every structured fact must cite an official URL, authority, verification date, cycle, and concise source note. Silence never means unrestricted.
6. **Structure the record.** Add title, organization, concise description, type/category, official source, deadline model, value, work mode, compensation, requirements, tags, skills, career paths, lifecycle, verification, and review schedule.
7. **Run the production gate.** Only records already accepted by the unchanged professional validator may receive `recommendation_safe` status.
8. **Review recommendation impact.** Run representative personas and the golden-profile suite. Check both false positives and false negatives.
9. **Import deterministically.** Run `npm run audit:opportunity-acquisition`, then `npm run acquire:opportunities`. A second dry run must report zero additions and zero updates.
10. **Schedule re-verification.** Fixed cycles are reviewed after deadlines and before the next opening. Rolling programs receive bounded periodic reviews. Source-watch candidates retain a reason and next review date.

## Candidate Statuses

| Status | Meaning |
| --- | --- |
| `candidate` | Identified but not researched. |
| `researching` | Official-source review is incomplete. |
| `source_confirmed` | Program identity and official source are confirmed. |
| `structuring` | Evidence is sufficient and metadata is being normalized. |
| `review_needed` | A material fact remains unresolved. |
| `recommendation_safe` | The unchanged production gate accepts the complete record. |
| `rejected` | The candidate is not currently safe to import or recommend. |

Rejection dispositions are retained rather than discarded. They distinguish duplicates, unavailable cycles, conflicting sources, variable-position eligibility, unclear eligibility, and institution-membership requirements.

## Prioritization

`acquisitionPriority()` produces a deterministic review order from:

- opportunity quality and likely student value;
- current lifecycle stability;
- broad but provable eligibility;
- underserved student groups and categories;
- expected verification effort;
- source-watch readiness.

Priority decides what humans review next. It never changes verification status.

## Source Standards

Acceptable primary sources include official application pages, official eligibility pages, current-cycle program pages, official PDFs hosted by the program, and government program pages. A provider homepage, search result, aggregator, blog, social post, or stale prior-cycle page is not enough for recommendation safety.

When official sources disagree, use the most specific current-cycle application source only if its authority and date are clear. Otherwise reject the candidate and schedule a source watch.

## Record Quality Standard

A recommendation-safe record must explain, in concise student-facing language:

- what the opportunity is and why it matters;
- who is eligible and which restrictions are material;
- how and where to apply;
- whether the deadline is fixed, rolling, varying, or not announced;
- compensation or estimated value, including `Unknown` when no defensible amount exists;
- verification state, last verified date, current cycle, and official sources.

Descriptions must not contain invented urgency, inferred benefits, or copied promotional claims.

## Quality Controls

Each batch must pass:

- duplicate and alias detection;
- required-source and field-evidence validation;
- lifecycle and current-cycle validation;
- the unchanged recommendation-safety gate;
- importer dry-run and idempotency checks;
- representative-persona sampling;
- false-positive and false-negative review;
- catalog, recommendation, Discover, For You, Journey, notification, auth, security, performance, release-candidate, build, and postbuild checks.

The admin Opportunity Intelligence page exposes the acquisition queue, disposition, priority, effort, coverage targets, and source-watch schedule without changing public UI.

## Review Cadence

- Fixed deadline: review immediately after the deadline and again when the next cycle is expected.
- Rolling program: review at least every 90 days; use 30–45 days for volatile programs.
- Temporarily closed/upcoming: review on the official stated opening date.
- Conflicting source: review within 30 days or when the application portal changes.
- Variable role/award: acquire individual positions only when their own eligibility is explicit.

## Commands

```bash
npm run audit:opportunity-acquisition
npm run acquire:opportunities
npm run check:opportunity-acquisition
npm run audit:recommendation-safe-catalog
npm run check:recommendation-coverage
```

The first command is always dry-run. The importer writes only with its explicit `--write` path exposed through `npm run acquire:opportunities`.
