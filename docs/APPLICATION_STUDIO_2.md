# Application Studio

## Purpose

Application Studio turns an active Journey pursuit into a factual preparation workspace. It supports the lifecycle **Understand → Prepare → Draft → Assemble → Review → Submit → Preserve → Reuse**. It does not predict acceptance, generate a competitiveness score, or claim to know what a provider “wants to hear.”

## Ownership model

- Journey owns pursuit status, transitions, deadlines, outcomes, and the authoritative “submitted” state.
- Build owns reusable Experience Bank facts, resumes, Materials, and Answer Bank stories.
- Application Studio extends the existing `ApplicationWorkspaceRecord` with application-specific prompts, response drafts, recommenders, private notes, checklists, final review, and submission snapshots.
- Materials owns reusable resume, transcript, cover-letter, personal-statement, essay, portfolio, writing-sample, recommendation, project-sample, and certification metadata and exact application associations.
- Opportunity trust and changelog projections own provider facts, verified requirements, sources, and changes.

There is no second application store. The route remains `/applications/[applicationId]`, and the student-facing name remains “Application details.”

## Application brief and requirements

The first viewport retains one identity, one deterministic next action, a compact readiness summary, and the verified deadline. Eligibility, requirement provenance, opening-date availability, last verification, and official source are progressively disclosed. Unknown information is labeled “Not published,” “Unknown,” or “not verified.”

Requirements originate only from official evidence or student-created private tasks. Material-backed requirements use factual states: missing, available, selected, ready, needs review, or submitted snapshot. An external form remains an external step linked to the provider.

## Next-action precedence

The canonical action is selected deterministically:

1. submitted application: await outcome;
2. provider change requiring review;
3. verified missing/available required material;
4. selected material needing review;
5. required written response missing or carrying a factual/limit blocker;
6. required recommendation without an actionable student-reported recommender state;
7. selected Resume Studio factual/structural blocker;
8. incomplete verified requirement;
9. incomplete private task;
10. unknown requirement set: review official source;
11. final review and official-provider handoff.

Deadlines affect display only when verified. No date or urgency is inferred.

## Written responses

Each response stores exact prompt text, verified/student source, optional source URL, required state, word/character limit, draft, status, bounded revision history, and optimistic version. Official prompt text is never inferred from a generic “essay required” label. Students may record an exact prompt from the form, which remains visibly student-added.

The editor provides live exact counts and never truncates. Deterministic prompt decomposition identifies common requested components such as challenge, response, outcome, and learning. Coverage uses “Addressed,” “Possibly missing,” or “Needs review”; it is language analysis, not a rubric.

Review categories are prompt coverage, specificity, evidence, clarity, structure, length, and repetition. Numbers, leadership/comparison terms, and named technologies absent from confirmed Experience or Answer Bank evidence are flagged before Ready. Concision/directness/repetition aids only delete or rearrange existing language; they never add facts and provide local undo. Saved revisions remain bounded to 20 per response.

No external LLM provider was introduced. If an approved provider is added later, input must be limited to the prompt, current draft, verified opportunity context, explicitly selected Answer Bank facts, and confirmed Experience facts. The model must be instructed not to add facts, output must be rescanned, and text must never overwrite silently.

## Answer Bank and reuse

Answer Bank is a private Build-owned store at `/answer-bank`, bounded to 500 entries. Entries can include title, category, linked Experience IDs, situation, action, challenge, result, learning, and notes; no field other than title/action is forced by the UI. Application Studio can save a factual story and surfaces potentially relevant entries through transparent keyword/category mapping with a written reason. Nothing is auto-copied. A student must explicitly insert story notes and review them.

Universal Search indexes only Answer Bank title/category metadata. It does not index story bodies, essay bodies, response drafts, private notes, recommender details, or resume bullet prose.

## Cover letters, resumes, and Materials

Cover-letter requirements open a structured preparation panel: exact opportunity, organization, selected resume, official context, actual reason for interest, relevant evidence, connection, and closing. Organization praise is never generated. The canonical cover-letter version remains in Materials.

Resume selection stays in Materials and links to the exact Resume Studio target. Application review reuses Resume Studio’s evidence, contact, and layout findings. “Create targeted resume” carries the opportunity ID into Resume Studio. Transcript and other files remain metadata-only because secure binary storage has not been implemented.

## Recommenders and external forms

Application-specific recommender records support name, role, organization, optional email, relationship, request/deadline dates, status, and notes. Status is always student-reported: not requested, planning, requested, confirmed, submitted, unknown, or declined. UnlockED does not claim a provider received a recommendation. Email sending is not implemented. External-form questions remain provider-owned; students can record exact prompts and private tasks without representing them as official structured data.

## Final Review and submission

Final Review groups factual issues across requirements, resume, written responses, Materials, recommendations, dates, and factual integrity. “Ready to submit” means known verified required components have no blocking issue; it does not mean the application is competitive.

The primary handoff remains “Open official application.” After external submission, “Mark as applied” shows a confirmation of selected resume, written-response versions, recommenders, and date. Application Studio first captures an immutable, bounded snapshot of the opportunity identity/source/deadline, exact selected Material metadata, response text and versions, recommender states, and notes; Journey then records the submission transition. Later edits do not mutate that snapshot. The canonical Materials associations also preserve exact selected version snapshots independently.

## Privacy, security, and analytics

Application drafts, Answer Bank, recommender details, notes, resume content, and snapshots are private and account-scoped. They are removed from the general public session payload and loaded only by authenticated dedicated routes. Mutations preserve same-origin checks, bounded JSON, authentication, per-account rate limits, idempotent creation/snapshot actions, server-authoritative locks, and optimistic workspace/response versions. Analytics records only existing structural events and never logs body text.

## Performance and accessibility

Normalization bounds 250 workspaces, 40 tasks, 40 prompts, 20 recommenders, 20 response revisions, 10 submission snapshots, and 500 Answer Bank entries. Deterministic review is linear in selected draft and evidence size; the 1,000-prompt fixture has a 150ms average budget.

Editors use labels, native textareas/selects/buttons, visible counts, live save announcements, keyboard-operable disclosure, 44px actions, and an accessible modal confirmation. The layout is optimized for 1280–1728px, collapses at 1080/900/720px, and uses a single-pane editor at 390/640px. Reduced motion disables shimmer and transitions. Existing light, dark, and alternate token modes remain authoritative.

## Known limitations

- No binary upload, provider API submission, provider recommender status, or automatic email sending.
- Official prompt ingestion depends on structured verified data; exact prompts can be student-recorded meanwhile.
- Recommender contacts are application-specific in this release; cross-application contact deduplication is deferred.
- Prompt similarity is transparent keyword/category mapping, not semantic embeddings.
- Draft save is explicit rather than debounced autosave to preserve the current optimistic version contract.
- Submitted response snapshots are immutable records, but there is not yet a side-by-side visual diff/restore UI.
