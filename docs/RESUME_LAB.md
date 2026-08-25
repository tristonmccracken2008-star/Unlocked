# Resume Lab

Resume Lab is UnlockED's private, evidence-first resume workspace. It does not generate facts or simulate an ATS score.

## Data flow

1. `AccountData.resumeLab` stores private experience evidence and resume compositions.
2. Accomplishment-backed experiences retain an `accomplishmentId`; Resume Lab resolves the current canonical Accomplishment instead of copying it.
3. Every resume version owns one `ApplicationMaterialRecord` of type `resume`. Materials remains authoritative for status and application associations.
4. The authenticated `/api/resume-lab` endpoint applies bounded mutations inside `withSecurityLock("resume-lab")`, checks expected store and record versions, and writes Resume Lab plus Materials atomically.
5. `publicAccountData` excludes Resume Lab. The dedicated server page composes only the signed-in account's records.

## Evidence model

Facts are confirmed before deterministic bullet drafting. A bullet records the fact IDs that support it. Numeric claims not found in confirmed facts are flagged until the student confirms or removes them. Deterministic drafting only combines supplied fact text; it never invents verbs, metrics, outcomes, dates, tools, or skills.

## Versions and targeting

The first version is a master resume. Targeted copies preserve the master and can reference an opportunity already in Journey. Alignment is a transparent concept comparison against published opportunity skills, tags, majors, and category. It uses `represented` and `not represented in this resume`, never selection predictions or eligibility claims.

## Export

`/resume-lab/print/[resumeId]` renders selectable, single-column HTML protected by the normal onboarding/session requirement. Browser print provides paper output and PDF where the browser supports it. UnlockED does not expose a fake DOCX or PDF download.

## Privacy and lifecycle

- Resume content, contact details, facts, and drafts are private by default.
- The account export includes the complete Resume Lab store.
- Account deletion removes Resume Lab with the canonical account object.
- Free accounts keep the complete core workflow and retain data after any billing change.
- Analytics record only bounded action types; they never include resume text, facts, contact details, or target names.
