# Resume & Application Studio

## Product intent

The Studio turns a student's confirmed experience into reusable resume versions and application-ready materials. It is a factual workspace, not a generic text generator: every generated bullet must remain traceable to confirmed Fact Ledger records, and target comparison describes representation rather than predicting hiring outcomes.

## Canonical architecture

- `data/resume-lab.ts` defines the private, account-scoped Experience Bank, Fact Ledger, resume versions, targets, templates, and bounded revision history.
- `lib/resume-lab-service.ts` is the mutation boundary. It uses optimistic versions, idempotency keys, account security locks, bounded records, and the existing private account store.
- `lib/resume-lab.ts` composes server-side Studio views with profile, Journey opportunities, Materials usage, audits, and deterministic next actions.
- `lib/resume-intelligence.ts` contains local deterministic drafting, evidence checks, categorized review findings, target-language comparison, and layout estimates. It has no remote model dependency.
- `components/resume-lab.tsx` provides Experience Bank, Edit, Review, Tailor, and Preview modes. The print route is the browser-native PDF path.

Resume records own a canonical Materials record. Application associations remain owned by Materials, so the Studio never creates a second source of truth for submission state. Universal Search indexes resume names and structured confirmed experience fields, but intentionally excludes resume-specific bullet prose.

## Student workflow

1. Capture a role, project, program, research activity, course project, publication, award, athletics, teaching, volunteer work, or other experience.
2. Answer context-aware prompts about actions, collaborators, tools, scale, frequency, and outcomes. Quantification is optional and must never be estimated.
3. Review or paste plain-text source material. Imported lines carry `import` provenance and remain visible as facts.
4. Build a master or targeted resume from Experience Bank entries.
5. Edit resume-specific wording while keeping its linked facts visible. Labeled alternatives use only those confirmed facts.
6. Review content, evidence, clarity, consistency, layout, and target alignment as separate categories. There is deliberately no opaque quality score.
7. Choose Classic, Modern, Technical, or Academic layout, inspect estimated pagination, and confirm the browser print preview.
8. Save or mark ready. Previous saved states remain in a bounded version history, and the Materials association shows which applications use the version.

## Import and export

Plain-text paste is supported in the Experience Bank and is normalized into confirmed source facts after user review. The current application does not store PDF or DOCX binaries. That boundary avoids pretending extraction fidelity and keeps private artifacts out of general client session data. A future binary pipeline should use private object storage, malware scanning, bounded extraction, explicit preview/confirmation, and deletion controls before writing facts.

Export uses a dedicated server-rendered print route and native browser “Save as PDF.” This retains selectable text and avoids a second document renderer. DOCX export is intentionally deferred until a tested document-generation pipeline can preserve sections, line breaks, and accessibility reliably.

## Integrations

- Profile supplies name, school, major, graduation year, and default email.
- Accomplishments can be reviewed into the Experience Bank without automatic resume insertion.
- Journey opportunities provide explicit target language and return paths.
- Materials owns readiness, preference, recurring requirement, and per-application selection state.
- Applications link to the exact selected resume and Studio return path.
- Universal Search finds resume versions and Experience Bank records without indexing private bullet content.

## Privacy and reliability

Resume drafts are excluded from public session payloads. API mutations require authentication, completed onboarding, same-origin requests, rate limiting, bounded JSON, optimistic version checks, and account-scoped storage locks. Normalization bounds experiences, facts, bullets, resumes, sections, and revisions. The intelligence pass is deterministic and runs in linear time over included resume content.

## Known limitations

- Pagination is a conservative text-line estimate; final layout must be confirmed in print preview.
- Plain-text paste is supported; binary PDF/DOCX ingestion and DOCX export are deferred behind the privacy and fidelity requirements above.
- Saved revisions show metadata and structure history; interactive field-level diff and restore are future work.
- Suggestions are writing guidance, not admissions, employment, or selection predictions.
