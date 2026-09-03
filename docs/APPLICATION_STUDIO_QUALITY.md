# Application Studio Quality Audit

## Before

Application Details already had strong server-first infrastructure: verified requirements, private tasks, Materials selection, Resume Studio handoff, provider-change context, Calendar clusters, Journey transitions, exact material snapshots, account isolation, and bounded performance. The main weakness was preparation depth. It could say what existed but could not store exact prompts, review whether a response addressed them, preserve reusable factual stories, track recommender context, inspect writing integrity, or snapshot written work at submission.

## Systems built

- Application brief with source/provenance disclosure and explicit unknown states.
- One deterministic next action spanning materials, writing, recommendations, resume warnings, tasks, final review, and official handoff.
- First-class written prompt and response records with source distinction, exact limits, revision history, status, and conflict checking.
- Deterministic prompt decomposition and conservative coverage states.
- Writing review for specificity, factual evidence, clarity, length, and repetition without a score.
- Fact-preserving concision/directness/repetition edits with local undo.
- Build-owned Answer Bank, story discovery reasons, explicit note insertion, and metadata-only search.
- Structured cover-letter preparation based on official opportunity context.
- Student-reported recommender tracking.
- Private application notes excluded from general session and search.
- Final Review across requirements, resume, writing, Materials, recommendations, dates, and factual integrity.
- Submission confirmation and immutable opportunity/Material/written-response/recommender/note snapshots before the Journey transition.
- Applications overview rows centered on readiness language and the exact next action.

## Factual and writing safeguards

Unknown provider prompts are never invented. Student-added prompts are labeled. Counts and overages are exact; drafts are never truncated. The system flags numbers, percentages, money, authority/comparison terms, and named technologies not represented in confirmed Experience/Answer Bank evidence. Story suggestions expose their reason and never auto-copy. Writing guidance avoids scores, “winning” language, provider-preference claims, or acceptance predictions. Ready means known components are prepared.

## Privacy and security

Highly private Studio fields and Answer Bank are omitted from the general session payload. Dedicated mutations require auth, onboarding ownership, same origin, rate limiting, bounded input, server-side locks, expected workspace versions, response versions, and idempotency keys. Analytics remains structural and receives no drafts, notes, stories, resume content, or recommender details.

## Performance and scale

The contract suite covers 100 applications, 500 Materials, 500 Answer Bank entries, 40 prompts per persisted workspace, and a direct 1,000-prompt review workload. Request-time maps and bounded arrays avoid unbounded history scans. No new client dependency or remote inference call was introduced.

## Browser and responsive QA

The Application Studio browser flow covers Chromium and WebKit, desktop and mobile widths, reduced motion, theme handling, account isolation, exact prompt creation, limit display, response save, recommender creation, Answer Bank save, Final Review, and submission history. Existing Applications, Materials, Resume Studio, Journey, and application-packet browser assertions remain in force.

## Deferred

Secure binary storage/extraction, provider submission APIs, provider recommendation status, email sending, cross-application recommender deduplication, automated verified-prompt ingestion, semantic prompt similarity, debounced autosave, and visual revision diff/restore are deferred. They are not represented as complete.

## Remaining weaknesses

Deterministic prompt coverage is intentionally conservative and may ask for review when a concept is expressed with unexpected language. Evidence review recognizes a bounded class of sensitive claims rather than proving every sentence. Final print/export for essays remains browser/document workflow outside the Studio. Manual user confirmation is still required before provider submission.
